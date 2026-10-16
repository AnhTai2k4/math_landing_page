"""Hồi quy vòng 12: chỉ dữ liệu GIẢ, khóa socket, không đọc cấu hình thật."""
import copy
import csv
import datetime as dt
import io
import json
from pathlib import Path
import runpy
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import runtime as r
import worker as w

p = w.p
NOW = dt.datetime(2026, 10, 16, 12, tzinfo=r.VN)
COLUMNS = dict(class_name='Class', lesson_date='Date', title='Title', document='Document',
               handout='Handout', video='Video', homework='Homework', answers='Answers')


def source(day='2026-10-06', name='LỚP GIẢ A', title='Bài GIẢ'):
    return dict(zip(COLUMNS, [name, day, title, '', '', '', 'https://example.invalid/hs.pdf', 'https://example.invalid/gv.pdf']))


def csv_bytes(rows):
    text = io.StringIO()
    writer = csv.writer(text)
    writer.writerow(COLUMNS.values())
    writer.writerows([[row.get(key, '') for key in COLUMNS] for row in rows])
    return text.getvalue().encode('utf-8')


def config():
    return {'classes': {'LỚP GIẢ A': {'enabled': True, 'dates': ['2026-10-06', '2026-10-09', '2026-10-12']},
                        'LỚP GIẢ B': {'enabled': True, 'dates': ['2026-10-07', '2026-10-12']}},
            'periods': [{'start': '2026-10-05', 'end': '2026-10-12', 'period': 'GK1'}],
            'extractor': {}, 'reviewer': {}, 'sheets': [dict(id='fake-source', name='TAB GIẢ', columns=COLUMNS, url='https://example.invalid/material.csv')]}


def routed_source(day='2026-10-06'):
    row = source(day)
    row['lesson_key'] = 'fake-'+day
    row['homework_urls'] = [row['homework']]
    return row


class Daily12Tests(unittest.TestCase):
    def setUp(self):
        for target in ('socket.create_connection', 'socket.getaddrinfo', 'urllib.request.OpenerDirector.open'):
            block = patch(target, side_effect=AssertionError('Cấm mạng trong hồi quy GIẢ'))
            block.start()
            self.addCleanup(block.stop)

    def test_date_punctuation_and_real_calendar(self):
        for value in ('15.10.,2026', '15.10.2026', '15/10/2026', '2026-10-15', ' 15.10.,2026 '):
            self.assertEqual(p.material_date(value, {}), '2026-10-15')
        self.assertEqual(p.material_date('29.02.,2028', {}), '2028-02-29')
        for value in ('31.02.,2026', '29/02/2026', '00/10/2026', '15/13/2026', 'không phải ngày'):
            self.assertIsNone(p.material_date(value, {}))
        with self.assertRaises(p.GateError):
            p.material_date('15/10', {})
        school = {'school_year': {'start_year': 2026, 'start_month': 9}}
        self.assertEqual(p.material_date('15.10', school), '2026-10-15')
        self.assertEqual(p.material_date('15.01', school), '2027-01-15')

    def test_bad_row_isolated_and_breaks_parent_chain(self):
        rows = [source(), source('31/02/2026'), source('', '', ''), source('2026-10-12')]
        rows[2]['homework'] = 'https://example.invalid/orphan.pdf'
        errors = []
        result = p.sheet_rows(csv_bytes(rows), config()['sheets'][0], errors)
        self.assertEqual([row['lesson_date'] for row in result], ['2026-10-06', '2026-10-12'])
        self.assertEqual(result[0]['homework_urls'], ['https://example.invalid/hs.pdf'])
        self.assertEqual(errors, [{'status': 'loi', 'reason': 'Ngày học không hợp lệ', 'tab': 'TAB GIẢ', 'cell': 'B3'}])
        self.assertNotIn('31/02', json.dumps(errors))
        self.assertNotIn('https://', json.dumps(errors))
        with self.assertRaises(p.GateError):
            p.sheet_rows(csv_bytes(rows), config()['sheets'][0])

    def test_normalized_date_produces_same_identity(self):
        sheet = config()['sheets'][0]
        a = p.sheet_rows(csv_bytes([source('15.10.,2026')]), sheet)[0]
        b = p.sheet_rows(csv_bytes([source('2026-10-15')]), sheet)[0]
        self.assertEqual(a['lesson_key'], b['lesson_key'])
        self.assertEqual(len(p.merge_rows([a, b])), 1)

    def test_grid_and_xlsx_coordinates(self):
        table = [[{'text': name, 'links': []} for name in COLUMNS.values()],
                 [{'text': value, 'links': [value]} for value in source('31/02/2026').values()]]
        sheet = {**config()['sheets'][0], 'format': 'xlsx', 'range': 'B4:I8'}
        errors = []
        with patch.object(p, 'xlsx_rows', return_value=copy.deepcopy(table)):
            self.assertEqual(p.sheet_rows(b'fake-xlsx', sheet, errors), [])
        self.assertEqual(errors[0]['cell'], 'C5')
        grid = {'sheets': [{'data': [{'startRow': 3, 'startColumn': 1,
                                    'rowData': [{'values': [{'formattedValue': cell['text']} for cell in row]} for row in table]}]}]}
        errors = []
        self.assertEqual(p.sheet_rows(json.dumps(grid).encode(), {**sheet, 'format': 'grid'}, errors), [])
        self.assertEqual(errors[0]['cell'], 'C5')

    def test_read_sources_preserves_good_tabs_and_errors(self):
        conf = config()
        conf['sheets'].append({**conf['sheets'][0], 'id': 'fake-second', 'name': 'TAB GIẢ 2', 'url': 'https://example.invalid/second.csv'})
        transport = Mock()
        transport.request.side_effect = [csv_bytes([source('31/02/2026'), source('15.10.,2026')]), csv_bytes([source('2026-10-12')])]
        errors = []
        result = p.read_material_rows(conf, transport, errors)
        self.assertEqual([row['lesson_date'] for row in result], ['2026-10-15', '2026-10-12'])
        self.assertEqual(errors[0]['cell'], 'B2')
        self.assertEqual(transport.request.call_count, 2)
        errors = []
        self.assertEqual(p.sheet_rows(csv_bytes([source('15/10')]), conf['sheets'][0], errors), [])
        self.assertEqual(errors[0]['cell'], 'B2')
        self.assertIn('năm', errors[0]['reason'])

    def test_week_before_15_source_and_shared_filters(self):
        conf = config()
        rows = [routed_source(day) for day in ('2026-10-06', '2026-10-09', '2026-10-12')]
        self.assertEqual(len(w.route_rows(rows, conf, NOW)), 3)
        conf['shared_lessons'] = [{'source_class': 'LỚP GIẢ A', 'source_date': '2026-10-06', 'classDates': {'LỚP GIẢ B': '2026-10-07'}}]
        self.assertEqual(w.route_rows(rows, conf, NOW)[0]['class_dates']['LỚP GIẢ B'], '2026-10-07')
        self.assertEqual(w.route_rows([routed_source('2026-10-04'), routed_source('2027-10-16')], conf, NOW), [])
        with self.assertRaises(p.GateError):
            w.route_rows([routed_source('2026-10-08')], conf, NOW)
        conf['shared_lessons'][0]['classDates']['LỚP GIẢ B'] = '2026-10-04'
        with self.assertRaises(p.GateError):
            w.route_rows(rows, conf, NOW)
        conf['material_start_date'] = '2026-10-10'
        self.assertEqual([row['lesson_date'] for row in w.route_rows(rows, conf, NOW)], ['2026-10-12'])

    def batch(self, conf, rows, row_errors=()):
        fake_worker = Mock(last_key='fake-processed', last_source_version=None, last_reason=None)
        fake_worker.process.return_value = 'already_published'
        def read(_config, _transport, errors):
            errors.extend(copy.deepcopy(row_errors))
            return rows
        publisher = Mock()
        with tempfile.TemporaryDirectory() as directory, patch.object(w, 'VersionWorker', return_value=fake_worker), \
             patch.object(p, 'read_material_rows', side_effect=read), patch.object(w, 'retry_errors'), \
             patch.object(w, 'report_error') as report, patch.object(w, 'flush_notifications'), \
             patch.object(w, 'run_attendance', return_value={'sync': 'fake-offline'}), patch.object(r, 'now_vn', return_value=NOW):
            result = w.run_batch(conf, Mock(), publisher, Path(directory), NOW)
            saved = json.loads(next((Path(directory)/'receipts').glob('*.json')).read_text(encoding='utf-8'))
            self.assertEqual(saved, result)
        publisher.assert_not_called()
        self.assertEqual(publisher.mock_calls, [])
        return result, fake_worker, report

    def test_batch_receipt_keeps_bad_date_and_processes_good_row(self):
        error = {'status': 'loi', 'reason': 'Ngày học không hợp lệ', 'tab': 'TAB GIẢ', 'cell': 'B3'}
        result, worker, report = self.batch(config(), [routed_source()], [error])
        self.assertNotIn('status', result)
        self.assertEqual(result['items'][0], error)
        self.assertEqual(result['items'][1]['status'], 'already_published')
        worker.process.assert_called_once()
        self.assertIn('TAB GIẢ!B3', report.call_args.args[3])

    def test_held_source_or_shared_stops_entire_publish_unit(self):
        for name, day, target_day in [('LỚP GIẢ A', '2026-10-06', '2026-10-07'), ('LỚP GIẢ B', '2026-10-07', '2026-10-07'),
                                      ('LỚP GIẢ B', '2026-10-07', '20261007')]:
            conf = config()
            conf['shared_lessons'] = [{'source_class': 'LỚP GIẢ A', 'source_date': '2026-10-06', 'classDates': {'LỚP GIẢ B': target_day}}]
            conf['held_lessons'] = [{'class_name': name, 'lesson_date': day}]
            result, worker, _ = self.batch(conf, [routed_source(), routed_source('2026-10-12')])
            self.assertEqual([item['status'] for item in result['items']], ['cho_hoc_lieu', 'already_published'])
            self.assertEqual(result['items'][0]['classes']['LỚP GIẢ B'], '2026-10-07')
            worker.process.assert_called_once()
            self.assertEqual(worker.process.call_args.args[0]['lesson_date'], '2026-10-12')

    def test_invalid_hold_config_records_error_before_worker_and_runs_attendance(self):
        for holds in (None, {}, [{'class_name': 'LỚP GIẢ A'}], [{'class_name': 'LỚP GIẢ A', 'lesson_date': '31/02/2026'}],
                      [{'class_name': ' LỚP GIẢ A ', 'lesson_date': '2026-10-06'}],
                      [{'class_name': 'LỚP KHÔNG CÓ', 'lesson_date': '2026-10-06'}]):
            conf = config()
            conf['held_lessons'] = holds
            with tempfile.TemporaryDirectory() as directory, patch.object(w, 'VersionWorker') as factory, \
                 patch.object(w, 'run_attendance', return_value={'sync':'fake-offline'}) as attendance, \
                 patch.object(w, 'report_error'), patch.object(w, 'flush_notifications'):
                result = w.run_batch(conf, Mock(), Mock(), Path(directory), NOW)
                saved = json.loads(next((Path(directory)/'receipts').glob('*.json')).read_text(encoding='utf-8'))
                self.assertEqual(saved, result)
            self.assertEqual(result['status'], 'loi_cau_hinh')
            self.assertEqual(result['items'][0]['status'], 'loi')
            attendance.assert_called_once()
            factory.assert_not_called()

    def test_held_dates_use_sheet_parser(self):
        for day in ('6.10.2026', '6/10/2026', '20261006'):
            conf = config()
            conf['held_lessons'] = [{'class_name':'LỚP GIẢ A','lesson_date':day}]
            result, worker, _ = self.batch(conf, [routed_source()])
            self.assertEqual(result['items'][0]['status'], 'cho_hoc_lieu')
            worker.process.assert_not_called()

    def test_shared_source_and_target_dates_are_canonical(self):
        for source_day in ('20261006', '6.10.2026', '6/10/2026'):
            conf = config()
            conf['material_start_date'] = '05/10/2026'
            conf['shared_lessons'] = [{'source_class':'LỚP GIẢ A','source_date':source_day,
                                       'classDates':{'LỚP GIẢ B':'7.10.2026'}}]
            row = w.route_rows([routed_source()],conf,NOW)[0]
            self.assertEqual(row['class_dates'], {'LỚP GIẢ A':'2026-10-06','LỚP GIẢ B':'2026-10-07'})

    def test_invalid_share_is_isolated_without_partial_target_map(self):
        for source_day, target_day in [('không phải ngày','2026-10-07'), ('2026-10-06','31/02/2026')]:
            conf = config()
            conf['shared_lessons'] = [{'source_class':'LỚP GIẢ A','source_date':source_day,
                                       'classDates':{'LỚP GIẢ A':'2026-10-06','LỚP GIẢ B':target_day}}]
            result, worker, _ = self.batch(conf,[routed_source(),routed_source('2026-10-12')])
            errors = [item for item in result['items'] if item['status']=='loi']
            self.assertTrue(errors)
            self.assertTrue(all(item['scope']=='bai_chung' for item in errors))
            self.assertEqual(worker.process.call_count, 2)
            self.assertEqual(worker.process.call_args_list[0].args[0]['class_dates'], {'LỚP GIẢ A':'2026-10-06'})

    def test_skipped_before_start_and_backfill_are_visible_in_receipt(self):
        conf = config()
        result, worker, _ = self.batch(conf,[routed_source('2026-10-04'),routed_source()])
        self.assertEqual(result['items'][0]['status'], 'bo_qua')
        self.assertEqual(result['items'][0]['classes'], {'LỚP GIẢ A':'2026-10-04'})
        self.assertTrue(result['items'][1]['backfill'])
        worker.process.assert_called_once()
        self.assertNotIn('https://',json.dumps(result))

    def test_discovery_gate_reason_is_kept_without_raw_exception(self):
        for error, expected in [(p.GateError('Ngày thiếu năm cần cấu hình năm học'),'Ngày thiếu năm cần cấu hình năm học'),
                                (ValueError('https://example.invalid/private'), 'Không đọc hoặc ghép được Sheet/lịch lớp')]:
            with tempfile.TemporaryDirectory() as directory, patch.object(w,'VersionWorker') as factory, \
                 patch.object(p,'read_material_rows',side_effect=error), patch.object(w,'retry_errors'), \
                 patch.object(w,'report_error'), patch.object(w,'flush_notifications'), \
                 patch.object(w,'run_attendance',return_value={'sync':'fake-offline'}) as attendance:
                result = w.run_batch(config(),Mock(),Mock(),Path(directory),NOW)
            self.assertEqual(result['reason'],expected)
            self.assertNotIn('https://',json.dumps(result))
            factory.return_value.process.assert_not_called()
            attendance.assert_called_once()

    def test_period_gaps_and_overlap_still_stop_before_download(self):
        for periods in ([], [{'start': '2026-10-05', 'end': '2026-10-06', 'period': 'GK1'},
                             {'start': '2026-10-08', 'end': '2026-10-12', 'period': 'GK1'}],
                        [{'start': '2026-10-05', 'end': '2026-10-12', 'period': 'GK1'}]*2):
            instance = w.VersionWorker.__new__(w.VersionWorker)
            instance.config = {**config(), 'periods': periods}
            row = routed_source('2026-10-07')
            with patch.object(p, 'download_homework') as download, self.assertRaises(p.GateError):
                instance.process(row)
            download.assert_not_called()

    def test_launcher_live_is_explicit_and_exclusive_without_running(self):
        with patch.object(r, 'in_window', return_value=False), patch.object(r, 'preflight', side_effect=AssertionError('Không đọc cấu hình thật')):
            for flags in ([], ['--live']):
                with patch.object(sys, 'argv', ['btvn-tu-dang.py', *flags]), patch('builtins.print'):
                    runpy.run_path(str(HERE/'btvn-tu-dang.py'), run_name='__main__')
            with patch.object(sys, 'argv', ['btvn-tu-dang.py', '--live', '--dry-run']), patch('sys.stderr', io.StringIO()):
                with self.assertRaises(SystemExit) as error:
                    runpy.run_path(str(HERE/'btvn-tu-dang.py'), run_name='__main__')
            self.assertEqual(error.exception.code, 2)


if __name__ == '__main__':
    unittest.main()
