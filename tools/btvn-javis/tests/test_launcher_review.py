"""L6: kiểm hợp đồng launcher bằng runpy, không đọc cấu hình hay chạy mạng."""
import datetime as dt
import io
from pathlib import Path
import runpy
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock, patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import runtime as r

NOW = dt.datetime(2026, 10, 16, 12, tzinfo=r.VN)
LAUNCHER = HERE / 'btvn-tu-dang.py'


class LauncherReviewTests(unittest.TestCase):
    def setUp(self):
        for target in ('socket.create_connection', 'socket.getaddrinfo', 'urllib.request.OpenerDirector.open'):
            block = patch(target, side_effect=AssertionError('Cấm mạng trong ca launcher GIẢ'))
            block.start()
            self.addCleanup(block.stop)

    def test_default_and_live_spawn_once_inside_window(self):
        for flags in ([], ['--live']):
            with self.subTest(flags=flags), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                lock = Mock()
                lock.acquire.return_value = True
                lock.file.fileno.return_value = 31
                with patch.object(r, 'now_vn', return_value=NOW), \
                     patch.object(r, 'in_window', return_value=True), \
                     patch.object(r, 'state_root', return_value=root), \
                     patch.object(r, 'brain_root', return_value=root), \
                     patch.object(r, 'FileLock', return_value=lock), \
                     patch.object(r, 'preflight', side_effect=AssertionError('Không đọc cấu hình thật')), \
                     patch('subprocess.run', return_value=Mock(returncode=0)) as preflight, \
                     patch('subprocess.Popen') as spawn, \
                     patch.object(sys, 'argv', [str(LAUNCHER), *flags]), patch('builtins.print') as output:
                    runpy.run_path(str(LAUNCHER), run_name='__main__')
                preflight.assert_called_once()
                self.assertEqual(preflight.call_args.args[0][-1], '--check-config')
                spawn.assert_called_once()
                argv = spawn.call_args.args[0]
                self.assertEqual(argv[1:], [str(HERE / 'worker.py'), '--live', '--lock-fd', '31'])
                self.assertEqual(spawn.call_args.kwargs['cwd'], str(root))
                self.assertEqual(spawn.call_args.kwargs['pass_fds'], (31,))
                lock.close.assert_called_once()
                output.assert_called_once_with('[SILENT]')

    def test_dry_run_only_calls_offline_path(self):
        offline = types.ModuleType('offline')
        offline.dry_run = Mock()
        with patch.dict(sys.modules, {'offline': offline}), \
             patch.object(r, 'preflight', side_effect=AssertionError('Không đọc cấu hình thật')), \
             patch.object(r, 'state_root', side_effect=AssertionError('Không đọc trạng thái thật')), \
             patch('subprocess.run') as preflight, patch('subprocess.Popen') as spawn, \
             patch.object(sys, 'argv', [str(LAUNCHER), '--dry-run']):
            runpy.run_path(str(LAUNCHER), run_name='__main__')
        offline.dry_run.assert_called_once_with()
        preflight.assert_not_called()
        spawn.assert_not_called()

    def test_help_states_default_is_live(self):
        output = io.StringIO()
        with patch.object(sys, 'argv', [str(LAUNCHER), '--help']), patch('sys.stdout', output):
            with self.assertRaises(SystemExit) as error:
                runpy.run_path(str(LAUNCHER), run_name='__main__')
        self.assertEqual(error.exception.code, 0)
        help_text = ' '.join(output.getvalue().split())
        self.assertIn('Mặc định chạy thật', help_text)
        self.assertIn('giống khi không truyền cờ', help_text)
        self.assertIn('dữ liệu giả ngoại tuyến', help_text)


if __name__ == '__main__':
    unittest.main()
