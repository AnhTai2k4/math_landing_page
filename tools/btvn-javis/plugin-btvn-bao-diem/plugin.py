"""Plugin chỉ đọc theo yêu cầu, không cron/hook, không mạng/secret khi import."""
from __future__ import annotations
import importlib
import json
import os
from pathlib import Path
import subprocess
import sys
from types import ModuleType, SimpleNamespace
import urllib.parse

ERROR = 'Chưa lấy được báo cáo lớp, vui lòng kiểm kết nối, quyền truy cập và cấu hình BTVN.'


def helpers(ctx):
    brain = Path(os.environ.get('JAVIS_BRAIN_ROOT', str(ctx.vault_root))).resolve()
    root = Path(os.environ.get('BTVN_JAVIS_DIR', str(brain / 'Javis/btvn'))).resolve()
    # Namespace riêng theo đường dẫn, tránh đè module runtime của server Javis.
    import hashlib
    name = '_mtm_btvn_'+hashlib.sha256(str(root).encode()).hexdigest()[:16]
    if name not in sys.modules:
        package = ModuleType(name); package.__path__ = [str(root)]
        sys.modules[name] = package
    runtime = importlib.import_module(name+'.runtime')
    attendance = importlib.import_module(name+'.attendance')
    bound = SimpleNamespace(now_vn=runtime.now_vn, service_account=runtime.service_account,
        load_pipeline=runtime.load_pipeline, brain_root=lambda: brain,
        config_path=lambda: runtime.config_path(brain), publish_settings=lambda: runtime.publish_settings(brain))
    return bound, attendance


def node_report(payload, bundle):
    run = subprocess.run(['node', str(bundle)], input=json.dumps(payload, ensure_ascii=False).encode(),
                         capture_output=True, timeout=60)
    if run.returncode or len(run.stdout) > 4*1024*1024:
        raise ValueError('Report unavailable')
    return run.stdout.decode('utf-8')


class ReadClient:
    """Chỉ gọi hai action đọc và GET sổ; không dùng publisher/worker ghi."""
    def __init__(self, runtime):
        self.url, self.secret = runtime.publish_settings()
        parsed = urllib.parse.urlsplit(self.url)
        if (parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password
                or parsed.path != '/functions/v1/mtm-btvn-publish' or parsed.query or parsed.fragment):
            raise ValueError('Invalid Edge URL')
        pipeline = runtime.load_pipeline()
        self.edge = pipeline.Transport(True, [parsed.hostname])
        self.runtime, self.pipeline = runtime, pipeline

    def call(self, payload):
        if payload not in ({'action': 'classes'}, {'action': 'scorebook', 'from': '2026-10-01'}):
            raise ValueError('Read actions only')
        return self.edge.json(self.url, payload, {'X-MTM-Publish-Secret': self.secret})

    def request(self, url, limit):
        # SA chỉ cấp spreadsheets.readonly; lấy token lúc tool chạy, không sửa env.
        from google.oauth2.service_account import Credentials
        from google.auth.transport.requests import Request
        credentials = Credentials.from_service_account_file(str(self.runtime.service_account()),
            scopes=['https://www.googleapis.com/auth/spreadsheets.readonly'])
        credentials.refresh(Request())
        transport = self.pipeline.Transport(True, ['www.googleapis.com'])
        return transport.request(url, headers={'Authorization': 'Bearer '+credentials.token}, limit=limit)


def report(args, ctx, *, runtime=None, attendance=None, client=None, render=node_report):
    args = args or {}
    lop, count = args.get('lop'), args.get('so_buoi', 1)
    if not isinstance(lop, str) or not lop.strip():
        return 'Cần chọn nhãn lớp chính xác trên web MTM.'
    if type(count) is not int or not 1 <= count <= 20:
        return 'Số buổi phải là số nguyên từ 1 đến 20.'
    try:
        if runtime is None or attendance is None:
            runtime, attendance = helpers(ctx)
        client = client or ReadClient(runtime)
        classes = client.call({'action': 'classes'})['classNames']
        if (not isinstance(classes, list) or len(classes) > 200
                or any(not isinstance(c, str) or not c.strip() or len(c) > 100 for c in classes)):
            raise ValueError('Invalid classes')
        if lop not in classes:
            return 'Lớp chưa hợp lệ; chọn đúng một lớp: '+('; '.join(classes) if classes else 'chưa có lớp trên web')+'.'
        rows = client.call({'action': 'scorebook', 'from': '2026-10-01'})
        if not isinstance(rows, list):
            raise ValueError('Invalid rows')
        now = runtime.now_vn()
        config = json.loads(runtime.config_path().read_text(encoding='utf-8-sig'))
        mapping = config.get('attendance_map') or os.environ.get('BTVN_ATTENDANCE_MAP')
        if not mapping:
            raise ValueError('Missing attendance map')
        mapping = Path(mapping)
        if not mapping.is_absolute():
            mapping = runtime.config_path().parent / mapping
        tabs = attendance.download_tabs(client)
        parsed = attendance.parse_tabs(tabs, mapping, now,
            bundle_path=runtime.brain_root() / 'Javis/btvn/attendance.bundle.mjs')
        if parsed['due']['pending'] or parsed['roster']['skippedMixedBlocks']:
            raise ValueError('Attendance needs review')
        # Chỉ chuyển lớp được hỏi sang trình dựng; tuyệt đối không đưa phone vào report bundle.
        sessions = [{'label': s['label'], 'startsAt': s['startsAt'],
                     'attendees': [{'name': a['name'], 'status': a['status']} for a in s['attendees']]}
                    for s in parsed['due']['sessions'] if s['label'] == lop]
        fields = ('studentId', 'fullName', 'className', 'lessonCode', 'title', 'date', 'dueAt', 'expectedDueAt', 'sourceIdentity')
        own = [{**{k: row[k] for k in fields if k in row},
                'receipts': [{k: v[k] for k in ('score', 'submittedAt', 'late')} for v in row['receipts']]}
               for row in rows if row['className'] == lop]
        bundle = Path(os.environ.get('BTVN_REPORT_BUNDLE', str(runtime.brain_root() / 'Javis/btvn/report.bundle.mjs')))
        return render({'rows': own, 'sessions': sessions, 'lop': lop, 'so_buoi': count,
                       'now': now.timestamp()*1000}, bundle)
    except Exception:
        return ERROR


def register(ctx):
    ctx.register_tool(name='btvn_bao_diem_lop',
        description='Lấy tin báo PH, bảng điểm và điểm danh của đúng một lớp sau ca học; chỉ đọc, không tự gửi tin.',
        handler=report, min_mode='readonly',
        schema={'type': 'object', 'properties': {
            'lop': {'type': 'string', 'description': 'Nhãn lớp chính xác trên web MTM'},
            'so_buoi': {'type': 'integer', 'default': 1, 'minimum': 1, 'maximum': 20}},
            'required': ['lop'], 'additionalProperties': False})
