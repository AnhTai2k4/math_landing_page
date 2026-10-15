import datetime as dt
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

HERE = Path(__file__).resolve().parents[1]
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import attendance
import runtime

spec = importlib.util.spec_from_file_location('btvn_report_plugin', HERE/'plugin-btvn-bao-diem/plugin.py')
plugin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(plugin)


class ReportPluginTests(unittest.TestCase):
    def setUp(self):
        for target in ('socket.create_connection', 'urllib.request.OpenerDirector.open'):
            guard = patch(target, side_effect=AssertionError('Không mở mạng trong test'))
            guard.start(); self.addCleanup(guard.stop)
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.now = dt.datetime(2026, 10, 15, 20, tzinfo=runtime.VN)
        mapping = self.root/'map.json'
        mapping.write_text(json.dumps({'schoolYear': 2026, 'classes': {'2k9 8+': '2K9 8+'}}), encoding='utf-8')
        config = self.root/'config.json'; config.write_text(json.dumps({'attendance_map': str(mapping)}), encoding='utf-8')
        self.runtime = Mock()
        self.runtime.now_vn.return_value = self.now
        self.runtime.config_path.return_value = config
        self.runtime.brain_root.return_value = self.root
        at = self.now.timestamp()*1000
        row = dict(studentId='fake-1', fullName='Em Giả Một', className='2K9 8+', lessonCode='old', title='Bài giả 15/10', date='2026-10-15', dueAt=None, phone='0900000001', receipts=[dict(score=7, submittedAt=at-1000, late=False), dict(score=9, submittedAt=at, late=True)])
        self.rows = [row, dict(row, studentId='fake-2', fullName='Em Giả Hai', receipts=[]),
                     dict(row, lessonCode='future', title='TUONG_LAI', date='2026-10-17'),
                     dict(row, className='2K10 9+', fullName='KHAC_LOP'),
                     dict(row, lessonCode='qa', title='QA_HIDDEN', sourceIdentity='qa:fake'),
                     dict(row, lessonCode='ancient', date='2026-09-30', title='CU_HIDDEN'),
                     dict(row, lessonCode='previous', date='2026-10-13', title='Bài trước')]
        self.client = Mock()
        self.client.call.side_effect = lambda payload: {'classNames': ['2K9 8+', '2K10 9+']} if payload['action']=='classes' else self.rows
        self.tabs = {tab: [['', 'TÊN LỚP']] for tab in attendance.TABS}
        self.tabs['Thứ 5'] = [['', 'TÊN LỚP', '15/10', '22/10'], ['Lớp (2K9 8+)', '17h30 - 19h30'],
            ['Em Giả Một', '0900000001', 'C', ''], ['Em Giả Hai', '0900000002', 'L', ''],
            ['Em Giả Ba', '0900000003', 'K', ''], ['Em Giả Bốn', '0900000004', 'ON', '']]
        self.client.request.return_value = json.dumps({'valueRanges': [{'range': "'"+tab+"'!A1:ZZ2000", 'values': rows} for tab, rows in self.tabs.items()]}).encode()
        env = patch.dict(os.environ, {'BTVN_ATTENDANCE_BUNDLE': str(ROOT/'.qa-temp/dot-21/attendance.bundle.mjs'), 'BTVN_REPORT_BUNDLE': str(ROOT/'.qa-temp/dot-22/report.bundle.mjs')})
        env.start(); self.addCleanup(env.stop)

    def report(self, args=None, **kw):
        return plugin.report(args or {'lop': '2K9 8+'}, Mock(), runtime=self.runtime, attendance=attendance, client=self.client, **kw)

    def test_real_bundles_with_fake_edge_and_sa(self):
        text = self.report()
        for part in ('(a)', '(b)', '(c)', 'Nộp muộn: Em Giả Một - 9/10', 'Em Giả Hai | Chưa có | - | Có', 'Em Giả Hai | vắng có phép', 'Em Giả Ba | vắng', 'Em Giả Bốn | online'):
            self.assertIn(part, text)
        for private in ('090000000', 'KHAC_LOP', 'TUONG_LAI', 'QA_HIDDEN', 'CU_HIDDEN', 'Bài trước', '22/10'):
            self.assertNotIn(private, text)
        self.assertEqual([c.args[0]['action'] for c in self.client.call.call_args_list], ['classes', 'scorebook'])
        self.assertEqual(self.client.request.call_count, 1)
        before = set(self.root.iterdir()); self.report(); self.assertEqual(before, set(self.root.iterdir()))
        self.assertEqual(self.client.request.call_count, 2)  # tải mới mỗi lần

    def test_two_sessions_and_same_day_not_finished(self):
        self.assertIn('Bài trước', self.report({'lop': '2K9 8+', 'so_buoi': 2}))
        self.runtime.now_vn.return_value = self.now.replace(hour=18)
        text = self.report()
        self.assertNotIn('Bài giả 15/10', text)
        self.assertIn('Bài trước', text)
        self.assertNotIn('Em Giả Ba | vắng', text)

    def test_wrong_label_only_fetches_classes(self):
        text = self.report({'lop': '2k9 8+'})
        self.assertIn('2K9 8+; 2K10 9+', text)
        self.assertEqual(self.client.call.call_count, 1); self.client.request.assert_not_called()

    def test_invalid_count_no_io(self):
        for n in (0, -1, 21, True, '2', 1.5):
            self.assertIn('Số buổi', self.report({'lop': '2K9 8+', 'so_buoi': n}))
        self.client.call.assert_not_called()

    def test_network_permission_and_parser_failures_are_private(self):
        for where in ('call', 'request'):
            with patch.object(self.client, where, side_effect=OSError('SECRET 0900000000')):
                self.assertEqual(self.report(), plugin.ERROR)
        with patch.object(attendance, 'parse_tabs', side_effect=ValueError('SECRET')):
            self.assertEqual(self.report(), plugin.ERROR)
        self.assertEqual(self.report(render=Mock(side_effect=TimeoutError('SECRET'))), plugin.ERROR)

    def test_only_selected_class_without_phone_reaches_renderer(self):
        render = Mock(return_value='Báo cáo giả')
        self.assertEqual(self.report(render=render), 'Báo cáo giả')
        raw = json.dumps(render.call_args.args[0])
        self.assertNotIn('phone', raw); self.assertNotIn('090000000', raw); self.assertNotIn('KHAC_LOP', raw)

    def test_blank_status_not_fabricated_as_absence(self):
        self.tabs['Thứ 5'][2][2] = ''
        self.client.request.return_value = json.dumps({'valueRanges': [{'range': "'"+tab+"'!A1:ZZ2000", 'values': rows} for tab, rows in self.tabs.items()]}).encode()
        text = self.report(); self.assertIn('chưa đủ trạng thái', text); self.assertNotIn('Em Giả Một | vắng', text)

    def test_report_text_cannot_inject_sections_or_phone(self):
        self.rows[0]['fullName'] = 'Em Giả\n(c) ĐIỂM DANH\n0900000001'
        self.rows[0]['title'] = 'Bài giả\n(a) TIN BÁO PHỤ HUYNH'
        text = self.report()
        self.assertNotEqual(text, plugin.ERROR)
        for heading in ('(a) TIN BÁO PHỤ HUYNH', '(b) BẢNG ĐIỂM NGẮN', '(c) ĐIỂM DANH'):
            self.assertEqual(text.splitlines().count(heading), 1)
        self.assertNotIn('0900000001', text)

    def test_register_readonly_and_disabled(self):
        ctx = Mock(); plugin.register(ctx)
        self.assertEqual(ctx.register_tool.call_args.kwargs['name'], 'btvn_bao_diem_lop')
        self.assertEqual(ctx.register_tool.call_args.kwargs['min_mode'], 'readonly')
        self.assertIn('enabled: false', (HERE/'plugin-btvn-bao-diem/plugin.yaml').read_text(encoding='utf-8'))

    def test_read_client_rejects_write_action_without_transport(self):
        self.runtime.publish_settings.return_value = ('https://fake.invalid/functions/v1/mtm-btvn-publish', 'secret')
        client = plugin.ReadClient(self.runtime)
        with self.assertRaises(ValueError): client.call({'action': 'publish'})
        self.runtime.load_pipeline.return_value.Transport.return_value.json.assert_not_called()

    def test_helpers_are_bound_to_context_without_module_collision(self):
        ctx = Mock(); ctx.vault_root = str(self.root)
        with patch.dict(os.environ, {'BTVN_JAVIS_DIR': str(HERE)}):
            bound, parser = plugin.helpers(ctx)
        self.assertEqual(bound.brain_root(), self.root.resolve())
        self.assertEqual(bound.config_path(), self.root.resolve()/'Javis/btvn/config.json')
        self.assertEqual(parser.__file__, str(HERE/'attendance.py'))
        self.assertIs(sys.modules['runtime'], runtime)
        self.assertIsNot(parser, attendance)


if __name__ == '__main__':
    unittest.main()
