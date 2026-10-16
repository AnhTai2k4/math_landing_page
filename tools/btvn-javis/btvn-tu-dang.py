"""Launcher mặc định chạy thật qua worker, dưới 20 giây và không đợi worker.

Không cờ hoặc --live đều khởi chạy theo cấu hình và khóa hiện hành.
Launcher không gọi mạng; --dry-run chỉ dùng dữ liệu giả ngoại tuyến.
"""
import argparse
import os
import subprocess
import sys
from pathlib import Path
import runtime as r

SAFE_ERRORS = {
    'Thiếu cấu hình BTVN', 'Chưa chọn mô hình vision trong cấu hình BTVN',
    'Thiếu khóa OpenAI hoặc Anthropic', 'Thiếu hoặc có nhiều tài khoản Google, cần chọn MTM_GOOGLE_SA_PATH',
    'Thiếu địa chỉ hoặc khóa đăng bài hợp lệ', 'Thiếu tệp khóa đăng bài',
    'Kiểm cấu hình BTVN quá thời gian',
}


def bounded_preflight():
    # Import config Javis trong tiến trình phụ để launcher không mắc kẹt quá 20s.
    try:
        result=subprocess.run([sys.executable,str(Path(__file__).resolve()),'--check-config'],capture_output=True,timeout=12)
    except subprocess.TimeoutExpired:
        raise ValueError('Kiểm cấu hình BTVN quá thời gian') from None
    if result.returncode:
        message=result.stdout.decode('utf-8',errors='replace').strip()
        raise ValueError(message if message in SAFE_ERRORS else 'Không đọc được cấu hình BTVN')


def launch(now=None, root=None, spawn=subprocess.Popen, check=bounded_preflight, lock_factory=r.FileLock):
    now = now or r.now_vn()
    if not r.in_window(now):
        return '[SILENT]'
    root = root or r.state_root()
    root.mkdir(parents=True, exist_ok=True)
    lock = lock_factory(root / 'worker.lock')
    try:
        if not lock.acquire():
            return '[SILENT]'
        try:
            check()
        except Exception as error:
            # Chỉ in lỗi đã định nghĩa; JSON/config/import không được lộ payload.
            safe = str(error) if type(error) is ValueError and str(error) in SAFE_ERRORS else 'Không đọc được cấu hình BTVN'
            return r.daily_error(root, safe, safe, now)
        logs = root / 'logs'; logs.mkdir(exist_ok=True)
        with open(logs / (now.astimezone(r.VN).date().isoformat() + '.log'), 'ab') as log:
            argv = [sys.executable, str(Path(__file__).with_name('worker.py')), '--live', '--lock-fd', str(lock.file.fileno())]
            spawn(argv, stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                  start_new_session=True, close_fds=True, pass_fds=(lock.file.fileno(),),
                  cwd=str(r.brain_root()), env=os.environ.copy())
        return '[SILENT]'
    finally:
        lock.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Mặc định chạy thật theo cấu hình và khóa hiện hành, kể cả khi không truyền cờ.')
    modes=parser.add_mutually_exclusive_group()
    modes.add_argument('--dry-run', action='store_true', help='Chỉ kiểm bằng dữ liệu giả ngoại tuyến, không chạy worker thật')
    modes.add_argument('--live', action='store_true', help='Tên tường minh của chế độ chạy thật mặc định; giống khi không truyền cờ')
    parser.add_argument('--check-config', action='store_true',help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.check_config:
        sys.stdout.reconfigure(encoding='utf-8')
        try:r.preflight()
        except Exception as error:
            print(str(error) if type(error) is ValueError and str(error) in SAFE_ERRORS else 'Không đọc được cấu hình BTVN')
            sys.exit(1)
    elif args.dry_run:
        from offline import dry_run
        dry_run()
    else:
        try:
            print(launch())
        except Exception:
            # Không in traceback, token, URL hay nội dung cấu hình.
            print('BTVN: Không khởi chạy được, cần kiểm tra quyền thư mục trạng thái.')
