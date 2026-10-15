"""Tiện ích Javis, không mở mạng hoặc đọc bí mật khi import."""
from __future__ import annotations
import contextlib
import datetime as dt
import importlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys

VN = dt.timezone(dt.timedelta(hours=7))
END = dt.date(2027, 10, 15)
HERE = Path(__file__).resolve().parent


def now_vn():
    return dt.datetime.now(VN)


def in_window(now):
    now = now.astimezone(VN)
    return now.date() <= END and 7 <= now.hour <= 23


def state_root():
    return Path(os.environ.get('JAVIS_STATE_DIR', '/data/state')) / 'btvn'


def brain_root():
    return Path(os.environ.get('JAVIS_BRAIN_ROOT', os.getcwd()))


def config_path(brain=None):
    return Path(os.environ.get('BTVN_CONFIG', str((brain or brain_root()) / 'Javis/btvn/config.json')))


def pipeline_dir():
    return Path(os.environ.get('BTVN_PIPELINE_DIR', str(HERE.parent / 'btvn-pipeline')))


def load_pipeline():
    sys.path.insert(0, str(pipeline_dir()))
    return importlib.import_module('pipeline')


def read_keys():
    # Không cho thông báo nội bộ config/secrets_store lọt vào log/stdout launcher.
    sys.path.insert(0, '/app/server')
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        settings = importlib.import_module('config').read_settings()
    model = settings.get('model', {})
    a, b = model.get('openai_api_key'), model.get('anthropic_api_key')
    if not a or not b:
        raise ValueError('Thiếu khóa OpenAI hoặc Anthropic')
    return a, b


def service_account():
    explicit = os.environ.get('MTM_GOOGLE_SA_PATH')
    paths = [Path(explicit)] if explicit else sorted((state_root().parent / 'connector-files').glob('*service_account.json'))
    if len(paths) != 1 or not paths[0].is_file():
        raise ValueError('Thiếu hoặc có nhiều tài khoản Google, cần chọn MTM_GOOGLE_SA_PATH')
    return paths[0]


def publish_settings(brain=None):
    # Tệp ưu tiên có mặt nhưng sai thì dừng; không lùi sang bản secret cũ.
    for path in [state_root() / 'publish.env', (brain or brain_root()) / 'Javis/btvn/.publish.env']:
        if path.is_file():
            values = {}
            for line in path.read_text(encoding='utf-8').splitlines():
                if line.strip() and not line.lstrip().startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    values[key.strip()] = value.strip().strip('"\'')
            url = values.get('BTVN_PUBLISH_URL', os.environ.get('BTVN_PUBLISH_URL', ''))
            secret = values.get('BTVN_PUBLISH_SECRET', '')
            if not url.startswith('https://') or len(secret) < 32:
                raise ValueError('Thiếu địa chỉ hoặc khóa đăng bài hợp lệ')
            return url, secret
    raise ValueError('Thiếu tệp khóa đăng bài')


def preflight():
    if not config_path().is_file():
        raise ValueError('Thiếu cấu hình BTVN')
    config = json.loads(config_path().read_text(encoding='utf-8'))
    if not all(config.get(k, {}).get('model') and not config[k]['model'].startswith('CHON_') for k in ('extractor', 'reviewer')):
        raise ValueError('Chưa chọn mô hình vision trong cấu hình BTVN')
    service_account()
    read_keys()
    publish_settings()
    return config


def daily_error(root, code, message, now):
    path = root / 'launcher-errors.json'
    records = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    day = now.astimezone(VN).date().isoformat()
    if records.get(code) == day:
        return '[SILENT]'
    records[code] = day
    atomic_json(path, records)
    return 'BTVN: ' + message + '.'


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(temp, path)


class FileLock:
    """Khóa kernel tự nhả khi tiến trình chết; launcher truyền FD cho worker."""
    def __init__(self, path):
        self.file = open(path, 'a+b')

    def acquire(self):
        try:
            if os.name == 'nt':
                import msvcrt
                self.file.seek(0); self.file.write(b'0'); self.file.flush(); self.file.seek(0)
                msvcrt.locking(self.file.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.file, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return True
        except (BlockingIOError, OSError):
            return False

    def close(self):
        # Không LOCK_UN: trên Linux FD con giữ cùng open-file-description.
        self.file.close()


def ensure_dependencies(root):
    lib = root / 'lib'
    sys.path.insert(0, str(lib))
    modules = ('pypdfium2', 'PIL', 'pypdf', 'openpyxl', 'google.auth')
    try:
        for name in modules:
            importlib.import_module(name)
        return
    except ImportError:
        pass
    requirements = HERE / 'requirements.txt'
    result = subprocess.run([sys.executable, '-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', '--target', str(lib), '-r', str(requirements)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=600)
    if result.returncode:
        raise ValueError('Không cài được thư viện BTVN')
    importlib.invalidate_caches()
    for name in modules:
        importlib.import_module(name)
