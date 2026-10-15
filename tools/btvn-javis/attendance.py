"""Đồng bộ sổ qua Edge hiện hành. Không mở mạng/đọc secret lúc import."""
from __future__ import annotations
import datetime as dt
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.parse
try:
    from . import runtime as r
except ImportError:
    import runtime as r

SHEET = '1vgkRI7re62pROu3uWog6OXBp5bViBSqbjLdytBfqXT4'
TABS = ['Thứ '+str(i) for i in range(2, 8)]+['Chủ nhật']
LABEL = re.compile(r'2K\d{1,2}(?: (?:[89]\+|XPT|Thứ [2-7], [2-7]|HSA \((?:CN|THỨ 5)\)))?')


def download_tabs(transport):
    # Chỉ đọc sổ được chỉ định, API values trả text, không lấy links/chips.
    query = urllib.parse.urlencode([('ranges', "'"+tab+"'!A1:ZZ2000") for tab in TABS]+[('valueRenderOption','FORMATTED_VALUE')])
    raw = transport.request('https://www.googleapis.com/v4/spreadsheets/'+SHEET+'/values:batchGet?'+query, limit=16*1024*1024)
    result = json.loads(raw)
    ranges = result.get('valueRanges')
    if not isinstance(ranges,list) or len(ranges)!=len(TABS):
        raise ValueError('Sổ chưa đủ tab')
    tabs = {}
    for tab, value in zip(TABS, ranges):
        if not isinstance(value,dict) or str(value.get('range','')).split('!')[0].strip("'")!=tab:
            raise ValueError('Tab trả về không khớp')
        # Chặn snapshot chạm trần (có thể bị cắt) và sai kiểu.
        rows=value.get('values',[])
        if not isinstance(rows,list) or len(rows)>=2000:
            raise ValueError('Sổ vượt phạm vi')
        for row in rows:
            if not isinstance(row,list) or len(row)>=702 or any(not isinstance(c,str) for c in row):
                raise ValueError('Dòng không hợp lệ')
        if not rows:
            raise ValueError('Tab trống')
        tabs[tab]=rows
    return tabs


def parse_tabs(tabs, mapping, now, *, bundle_path=None):
    config=json.loads(Path(mapping).read_text(encoding='utf-8-sig'))
    # Giữ buổi tương lai có ô trống để RPC tính expected_due_at.
    # Operator có thể giới hạn fromDate/toDate trong map theo sổ đã đối soát.
    config.setdefault('fromDate','2026-10-15')
    bundle=Path(os.environ.get('BTVN_ATTENDANCE_BUNDLE',str(bundle_path or r.brain_root()/'Javis/btvn/attendance.bundle.mjs')))
    run=subprocess.run(['node',str(bundle)],input=json.dumps({'tabs':tabs,'map':config},ensure_ascii=False).encode(),capture_output=True,timeout=60)
    if run.returncode or len(run.stdout)>10*1024*1024:
        raise ValueError('Parser không đạt')
    return json.loads(run.stdout)


def support_summary(events):
    if not isinstance(events,list):
        raise ValueError('Báo cáo không hợp lệ')
    counts={}
    for event in events:
        if not isinstance(event,dict) or event.get('kind')!='dang_nhap_that_bai':continue
        label=event.get('className')
        # className từ ô nhập tự do có thể chứa tên/SĐT. Không in nhãn chưa hợp lệ.
        label=label if isinstance(label,str) and LABEL.fullmatch(label) else 'Lớp chưa xác định'
        counts[label]=counts.get(label,0)+1
    return 'BTVN hỗ trợ đăng nhập: '+'; '.join(k+': '+str(v)+' lần' for k,v in sorted(counts.items())) if counts else None


def run_attendance(config, transport, publisher, root, now, parse=parse_tabs, emit=print):
    result={}
    mapping=config.get('attendance_map') or os.environ.get('BTVN_ATTENDANCE_MAP')
    if not mapping:
        result['sync']='chua_cau_hinh'
        message=r.daily_error(root,'attendance_config','chưa cấu hình bản đồ sổ điểm danh trên VPS',now)
        if message!='[SILENT]':emit(message)
    else:
        try:
            tabs=download_tabs(transport)
        except Exception:
            result['sync']='loi_tai_so'
            message=r.daily_error(root,'attendance_download','không tải được sổ điểm danh; kiểm quyền chia sẻ SA và phạm vi tab',now)
            if message!='[SILENT]':emit(message)
        else:
            try:
                parsed=parse(tabs,mapping,now)
                roster=parsed['roster'];due=parsed['due']
                if not roster['rows'] or due['pending']:
                    raise ValueError('Snapshot chưa đạt')
                # Không lưu payload/đáp ứng report xuống receipt/log.
                preview=publisher.call({'action':'sync_attendance','rows':roster['rows'],'apply':False})
                if not isinstance(preview,dict) or preview.get('ok') is not True or preview.get('applied') is not False or preview.get('invalid')!=0:
                    raise ValueError('Lớp hoặc roster chưa hợp lệ trên DB')
                synced=publisher.call({'action':'sync_attendance','rows':roster['rows'],'apply':True})
                if not isinstance(synced,dict) or synced.get('ok') is not True or synced.get('applied') is not True or synced.get('invalid')!=0:
                    raise ValueError('Chưa xác nhận roster')
                synced=publisher.call({'action':'sync_due','sessions':due['sessions'],'apply':True})
                if not isinstance(synced,dict) or synced.get('applied') is not True:
                    raise ValueError('Chưa xác nhận hạn')
                result.update(sync='da_dong_bo',rows=len(roster['rows']),sessions=len(due['sessions']),skippedMixedBlocks=roster['skippedMixedBlocks'])
            except Exception:
                result['sync']='loi_dong_bo'
                emit('BTVN: chưa đồng bộ đầy đủ sổ điểm danh/hạn; kiểm bản đồ và mục cần đối soát.')
    # Báo cáo độc lập, vẫn chạy nếu sổ/map lỗi.
    try:
        events=publisher.call({'action':'support_report','since':(now-dt.timedelta(hours=1)).isoformat()})
        line=support_summary(events)
        if line:emit(line)
        result['support']='da_kiem'
    except Exception:
        result['support']='loi_bao_cao'
        emit('BTVN: chưa lấy được báo cáo hỗ trợ đăng nhập.')
    return result
