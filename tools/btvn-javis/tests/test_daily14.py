"""Vòng 14: nguồn GIẢ, cô lập xung đột và chặn nhóm giao cùng buổi."""
import copy
import csv
import datetime as dt
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import worker as w

p = w.p
NOW = dt.datetime(2026, 10, 16, 14, tzinfo=w.r.VN)
COLUMNS = dict(class_name='Class', lesson_date='Date', title='Title', document='Document',
               handout='Handout', video='Video', homework='Homework', answers='Answers')
SHEET = dict(id='fake-material-only', name='TAB GIẢ', columns=COLUMNS,
             url='https://example.invalid/material.csv')
TEMP = HERE.parents[1]/'.qa-temp/hang-ngay/20261016-14/python-temp'


def source(name='LỚP GIẢ A', day='2026-10-06', file='hs.pdf'):
    return dict(zip(COLUMNS, [name, day, 'Bài GIẢ', '', '', '',
                            'https://example.invalid/'+file, 'https://example.invalid/gv.pdf']))


def csv_bytes(rows):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(COLUMNS.values())
    writer.writerows([[row.get(key, '') for key in COLUMNS] for row in rows])
    return output.getvalue().encode('utf-8')


def config():
    return {'classes': {name: {'enabled': True, 'dates': ['2026-10-06', '2026-10-07', '2026-10-12']}
                        for name in ('LỚP GIẢ A', 'LỚP GIẢ B', 'LỚP GIẢ C', 'LỚP GIẢ D')},
            'periods': [{'start': '2026-10-05', 'end': '2026-10-12', 'period': 'GK1'}],
            'extractor': {}, 'reviewer': {}, 'sheets': [SHEET]}


class Daily14Tests(unittest.TestCase):
    def setUp(self):
        for target in ('socket.create_connection', 'socket.getaddrinfo', 'urllib.request.OpenerDirector.open'):
            block = patch(target, side_effect=AssertionError('Cấm mạng trong kiểm vòng 14'))
            block.start()
            self.addCleanup(block.stop)

    def batch(self, sheet_rows, conf=None, payloads=None):
        conf = config() if conf is None else conf
        original = copy.deepcopy(conf)
        transport = Mock()
        transport.request.side_effect = payloads or [csv_bytes(sheet_rows)]
        worker = Mock(last_key='fake-processed', last_source_version=None, last_reason=None)
        worker.process.return_value = 'already_published'
        publisher = Mock()
        TEMP.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=TEMP) as directory, patch.object(w, 'VersionWorker', return_value=worker), \
             patch.object(w, 'retry_errors'), patch.object(w, 'report_error') as error_report, \
             patch.object(w, 'flush_notifications'), patch.object(w, 'run_attendance', return_value={'sync':'fake-offline'}), \
             patch.object(w.r, 'now_vn', return_value=NOW):
            # read_material_rows, sheet_rows, merge_rows và route_rows đều chạy thật.
            result = w.run_batch(conf, transport, publisher, Path(directory), NOW)
            saved = json.loads(next((Path(directory)/'receipts').glob('*.json')).read_text(encoding='utf-8'))
            self.assertEqual(saved, result)
        worker.error_report = error_report
        self.assertEqual(conf, original)
        self.assertEqual(publisher.mock_calls, [])
        worker.db.close.assert_called_once()
        return result, worker

    def test_conflicting_source_rows_keep_independent_row_in_real_batch(self):
        first, other, independent = source(), source(file='other.pdf'), source('LỚP GIẢ C', '2026-10-12')
        for rows in ([first, other, independent], [other, first, independent]):
            with self.subTest(reverse=rows[0] is other):
                original = copy.deepcopy(rows)
                result, worker = self.batch(rows)
                self.assertNotIn('status', result)
                self.assertEqual([item['status'] for item in result['items']], ['loi', 'already_published'])
                self.assertEqual(result['items'][0]['scope'], 'nguon_trung')
                self.assertEqual(result['items'][0]['reason'], 'Cùng lớp/ngày nhưng nguồn BTVN xung đột; chưa đăng')
                worker.process.assert_called_once()
                self.assertEqual(worker.process.call_args.args[0]['class_name'], 'LỚP GIẢ C')
                self.assertNotIn('https://', json.dumps(result))
                self.assertEqual(rows, original)

    def test_blocked_key_cannot_return_from_later_tab(self):
        conf = config()
        conf['sheets'].append({**SHEET, 'id':'fake-second', 'name':'TAB GIẢ 2', 'url':'https://example.invalid/second.csv'})
        first = source()
        result, worker = self.batch([], conf, [csv_bytes([first, source(file='other.pdf')]),
                                               csv_bytes([first, source('LỚP GIẢ C', '2026-10-12')])])
        self.assertNotIn('status', result)
        self.assertEqual([item['status'] for item in result['items']], ['loi', 'already_published'])
        worker.process.assert_called_once()
        self.assertEqual(worker.process.call_args.args[0]['class_name'], 'LỚP GIẢ C')

    def test_conflict_between_tabs_keeps_all_unrelated_rows(self):
        conf = config()
        conf['sheets'].append({**SHEET, 'id':'fake-second', 'name':'TAB GIẢ 2', 'url':'https://example.invalid/second.csv'})
        result, worker = self.batch([], conf, [csv_bytes([source(), source('LỚP GIẢ C', '2026-10-12')]),
                                               csv_bytes([source(file='other.pdf'), source('LỚP GIẢ D', '2026-10-12')])])
        self.assertNotIn('status', result)
        self.assertEqual([item['status'] for item in result['items']], ['loi', 'already_published', 'already_published'])
        self.assertEqual([call.args[0]['class_name'] for call in worker.process.call_args_list], ['LỚP GIẢ C', 'LỚP GIẢ D'])

    def test_conflict_without_collector_still_fails_closed(self):
        with self.assertRaisesRegex(p.GateError, '^Cùng lớp/ngày nhưng nguồn BTVN xung đột; chưa đăng$'):
            p.sheet_rows(csv_bytes([source(), source(file='other.pdf')]), SHEET)

    def test_identical_source_repeated_across_tabs_processes_once(self):
        conf = config()
        conf['sheets'].append({**SHEET, 'id':'fake-second', 'name':'TAB GIẢ 2', 'url':'https://example.invalid/second.csv'})
        result, worker = self.batch([], conf, [csv_bytes([source()]), csv_bytes([source()])])
        self.assertEqual([item['status'] for item in result['items']], ['already_published'])
        worker.process.assert_called_once()

    def test_shared_and_direct_session_both_held_independent_session_runs(self):
        conf = config()
        conf['shared_lessons'] = [{'source_class':'LỚP GIẢ A', 'source_date':'2026-10-06',
                                   'classDates':{'LỚP GIẢ B':'2026-10-07'}}]
        first, second = source(), source('LỚP GIẢ B', '2026-10-07')
        for rows in ([first, second], [second, first]):
            result, worker = self.batch([*rows, source('LỚP GIẢ C', '2026-10-12')], conf)
            self.assertNotIn('status', result)
            self.assertEqual([item['status'] for item in result['items']], ['loi', 'loi', 'already_published'])
            self.assertTrue(all(item['reason'] == 'Buổi học xuất hiện trong nhiều nhóm bài; giữ các nhóm liên quan'
                                for item in result['items'][:2]))
            worker.process.assert_called_once()
            self.assertEqual(worker.process.call_args.args[0]['class_name'], 'LỚP GIẢ C')
            self.assertNotIn('https://', json.dumps(result))

    def test_transitive_overlapping_groups_are_all_held(self):
        conf = config()
        conf['shared_lessons'] = [
            {'source_class':'LỚP GIẢ A', 'source_date':'2026-10-06', 'classDates':{'LỚP GIẢ B':'2026-10-07'}},
            {'source_class':'LỚP GIẢ B', 'source_date':'2026-10-07', 'classDates':{'LỚP GIẢ C':'2026-10-12'}}]
        result, worker = self.batch([source(), source('LỚP GIẢ B', '2026-10-07'),
                                     source('LỚP GIẢ C', '2026-10-12'), source('LỚP GIẢ D', '2026-10-12')], conf)
        self.assertEqual([item['status'] for item in result['items']], ['loi', 'loi', 'loi', 'already_published'])
        worker.process.assert_called_once()
        self.assertEqual(worker.process.call_args.args[0]['class_name'], 'LỚP GIẢ D')

    def test_same_class_other_day_and_other_class_same_day_stay_independent(self):
        rows = [source(), source(day='2026-10-07'), source('LỚP GIẢ B')]
        result, worker = self.batch(rows)
        self.assertEqual([item['status'] for item in result['items']], ['already_published']*3)
        self.assertEqual(worker.process.call_count, 3)
        expected = [item['lesson_key'] for item in w.route_rows(p.sheet_rows(csv_bytes(rows), SHEET, []), config(), NOW)]
        self.assertEqual([call.args[0]['lesson_key'] for call in worker.process.call_args_list], expected)

    def test_overlap_with_source_conflicting_routed_group_is_also_held(self):
        conf = config()
        conf['shared_lessons'] = [
            {'source_class':'LỚP GIẢ A', 'source_date':'2026-10-06', 'classDates':{'LỚP GIẢ B':'2026-10-07'}},
            {'source_class':'LỚP GIẢ B', 'source_date':'2026-10-07', 'classDates':{'LỚP GIẢ A':'2026-10-06'}},
            {'source_class':'LỚP GIẢ C', 'source_date':'2026-10-12', 'classDates':{'LỚP GIẢ B':'2026-10-07'}}]
        result, worker = self.batch([source(), source('LỚP GIẢ B', '2026-10-07', 'other.pdf'),
                                     source('LỚP GIẢ C', '2026-10-12'), source('LỚP GIẢ D', '2026-10-12')], conf)
        self.assertNotIn('status', result)
        self.assertEqual([item['status'] for item in result['items']], ['loi', 'loi', 'already_published'])
        self.assertEqual(result['items'][0]['reason'], 'Hai dòng chung bài xung đột: khac_danh_sach_tep')
        self.assertEqual(result['items'][1]['reason'], 'Buổi học xuất hiện trong nhiều nhóm bài; giữ các nhóm liên quan')
        worker.process.assert_called_once()
        self.assertEqual(worker.process.call_args.args[0]['class_name'], 'LỚP GIẢ D')

    def test_shared_target_of_source_conflict_cannot_return_as_direct_row(self):
        first, other = source(), source(file='other.pdf')
        target, independent = source('LỚP GIẢ B', '2026-10-07'), source('LỚP GIẢ C', '2026-10-12')
        payload_sets = [
            [csv_bytes([first, other, target, independent])],
            [csv_bytes([target, independent, other, first])],
            [csv_bytes([first]), csv_bytes([other, target, independent])],
            [csv_bytes([target, independent, other]), csv_bytes([first])],
            [csv_bytes([first, other]), csv_bytes([target, independent])]]
        for payloads in payload_sets:
            with self.subTest(tabs=len(payloads), source_first=payloads is payload_sets[0]):
                conf = config()
                if len(payloads)>1:
                    conf['sheets'].append({**SHEET, 'id':'fake-second', 'name':'TAB GIẢ 2',
                                           'url':'https://example.invalid/second.csv'})
                conf['shared_lessons'] = [{'source_class':'LỚP GIẢ A', 'source_date':'2026-10-06',
                                           'classDates':{'LỚP GIẢ B':'2026-10-07'}}]
                result, worker = self.batch([], conf, payloads)
                self.assertNotIn('status', result)
                self.assertEqual([item['status'] for item in result['items']], ['loi', 'loi', 'already_published'])
                self.assertEqual(result['items'][0]['scope'], 'nguon_trung')
                self.assertEqual(result['items'][1]['classes'], {'LỚP GIẢ B':'2026-10-07'})
                self.assertEqual(result['items'][1]['reason'], 'Buổi học xuất hiện trong nhiều nhóm bài; giữ các nhóm liên quan')
                worker.process.assert_called_once()
                self.assertEqual(worker.process.call_args.args[0]['class_name'], 'LỚP GIẢ C')
                self.assertNotIn('https://', json.dumps(result))


    def test_conflict_locations_keep_every_tab_and_date_cell_without_source_content(self):
        conf = config()
        conf['sheets'].extend([
            {**SHEET, 'id':'fake-second', 'name':'TAB GIẢ 2', 'url':'https://example.invalid/second.csv'},
            {**SHEET, 'id':'fake-third', 'name':'TAB GIẢ 3', 'url':'https://example.invalid/third.csv'}])
        result, worker = self.batch([], conf, [
            csv_bytes([source(), source()]), csv_bytes([source(file='other.pdf')]),
            csv_bytes([source(), source('LỚP GIẢ C', '2026-10-12')])])
        error = result['items'][0]
        self.assertEqual(error['scope'], 'nguon_trung')
        self.assertEqual(error['source_locations'], [
            {'tab':'TAB GIẢ', 'cell':'B2'}, {'tab':'TAB GIẢ', 'cell':'B3'},
            {'tab':'TAB GIẢ 2', 'cell':'B2'}, {'tab':'TAB GIẢ 3', 'cell':'B2'}])
        text = worker.error_report.call_args_list[0].args[3]
        for position in error['source_locations']:
            self.assertIn(position['tab']+'!'+position['cell'], text)
        self.assertIn('LỚP GIẢ A; 2026-10-06', text)
        for forbidden in ('https://', 'hs.pdf', 'other.pdf', 'gv.pdf', 'Bài GIẢ'):
            self.assertNotIn(forbidden, json.dumps(result, ensure_ascii=False)+text)
        worker.process.assert_called_once()

    def test_source_locations_keep_absolute_grid_and_xlsx_coordinates(self):
        table = [[{'text':value, 'links':[value]} for value in COLUMNS.values()]]
        table.extend([[{'text':row.get(key, ''), 'links':[row.get(key, '')]} for key in COLUMNS]
                      for row in [source(), source(file='other.pdf')]])
        grid = {'sheets':[{'data':[{'startRow':7, 'startColumn':3,
                'rowData':[{'values':[{'formattedValue':cell['text'], 'hyperlink':cell['text']} for cell in row]} for row in table]}]}]}
        for format_ in ('grid', 'xlsx'):
            with self.subTest(format=format_), patch.object(p, 'xlsx_rows', return_value=table):
                errors = []
                raw = json.dumps(grid).encode('utf-8') if format_ == 'grid' else b'fake-xlsx'
                parsed = p.sheet_rows(raw, {**SHEET, 'format':format_, 'range':'D8:K10'}, errors)
                self.assertEqual(parsed, [])
                self.assertEqual(errors[0]['source_locations'], [
                    {'tab':'TAB GIẢ', 'cell':'E9'}, {'tab':'TAB GIẢ', 'cell':'E10'}])

    def test_source_conflict_target_is_held_when_source_route_raises_gate_error(self):
        conf = config()
        conf['classes']['LỚP GIẢ A']['dates'] = ['2026-10-12']
        conf['shared_lessons'] = [{'source_class':'LỚP GIẢ A', 'source_date':'2026-10-06',
                                   'classDates':{'LỚP GIẢ B':'2026-10-07'}}]
        with self.assertRaisesRegex(p.GateError, 'Ngày buổi chưa khớp lịch lớp'):
            w.route_rows(p.sheet_rows(csv_bytes([source()]), SHEET), conf, NOW)
        result, worker = self.batch([source(), source(file='other.pdf'),
                                     source('LỚP GIẢ B', '2026-10-07'),
                                     source('LỚP GIẢ C', '2026-10-12')], conf)
        self.assertEqual([item['status'] for item in result['items']], ['loi', 'loi', 'already_published'])
        self.assertEqual(result['items'][1]['classes'], {'LỚP GIẢ B':'2026-10-07'})
        worker.process.assert_called_once()
        self.assertEqual(worker.process.call_args.args[0]['class_name'], 'LỚP GIẢ C')

    def test_tuesday_source_conflict_holds_2k10_shared_target(self):
        conf = config()
        for name in ('2K10 9+', '2K10 Thứ 3, 6'):
            conf['classes'][name] = {'enabled':True, 'dates':['2026-10-06']}
        # Cổng lịch nguồn từ chối, nhưng quy tắc thứ Ba vẫn phải chặn lớp nhận.
        conf['classes']['2K10 9+']['dates'] = ['2026-10-12']
        result, worker = self.batch([source('2K10 9+'), source('2K10 9+', file='other.pdf'),
                                     source('2K10 Thứ 3, 6'), source('LỚP GIẢ C', '2026-10-12')], conf)
        self.assertEqual([item['status'] for item in result['items']], ['loi', 'loi', 'already_published'])
        self.assertEqual(result['items'][1]['classes'], {'2K10 Thứ 3, 6':'2026-10-06'})
        worker.process.assert_called_once()
        self.assertEqual(worker.process.call_args.args[0]['class_name'], 'LỚP GIẢ C')

    def test_source_conflict_blocks_transitive_targets_even_without_middle_row(self):
        conf = config()
        conf['classes']['LỚP GIẢ A']['dates'] = ['2026-10-12']
        conf['shared_lessons'] = [
            {'source_class':'LỚP GIẢ A', 'source_date':'2026-10-06', 'classDates':{'LỚP GIẢ B':'2026-10-07'}},
            {'source_class':'LỚP GIẢ B', 'source_date':'2026-10-07',
             'classDates':{'LỚP GIẢ C':'2026-10-12', 'LỚP GIẢ A':'2026-10-06'}}]
        result, worker = self.batch([source(), source(file='other.pdf'),
                                     source('LỚP GIẢ C', '2026-10-12'),
                                     source('LỚP GIẢ D', '2026-10-12')], conf)
        self.assertEqual([item['status'] for item in result['items']], ['loi', 'loi', 'already_published'])
        self.assertEqual(result['items'][1]['classes'], {'LỚP GIẢ C':'2026-10-12'})
        worker.process.assert_called_once()
        self.assertEqual(worker.process.call_args.args[0]['class_name'], 'LỚP GIẢ D')

    def test_tuesday_shared_rule_participates_in_transitive_conflict_blocking(self):
        conf = config()
        for name in ('2K10 9+', '2K10 Thứ 3, 6'):
            conf['classes'][name] = {'enabled':True, 'dates':['2026-10-06']}
        conf['shared_lessons'] = [{'source_class':'2K10 Thứ 3, 6', 'source_date':'2026-10-06',
                                   'classDates':{'LỚP GIẢ B':'2026-10-07'}}]
        result, worker = self.batch([source('2K10 9+'), source('2K10 9+', file='other.pdf'),
                                     source('LỚP GIẢ B', '2026-10-07'),
                                     source('LỚP GIẢ C', '2026-10-12')], conf)
        self.assertEqual([item['status'] for item in result['items']], ['loi', 'loi', 'already_published'])
        worker.process.assert_called_once()
        self.assertEqual(worker.process.call_args.args[0]['class_name'], 'LỚP GIẢ C')

    def test_overlap_notifications_include_each_class_and_its_date(self):
        conf = config()
        conf['shared_lessons'] = [{'source_class':'LỚP GIẢ A', 'source_date':'2026-10-06',
                                   'classDates':{'LỚP GIẢ B':'2026-10-07'}}]
        result, worker = self.batch([source(), source('LỚP GIẢ B', '2026-10-07')], conf)
        self.assertEqual([item['status'] for item in result['items']], ['loi', 'loi'])
        notifications = [call.args[3] for call in worker.error_report.call_args_list]
        self.assertEqual(len(notifications), 2)
        self.assertIn('LỚP GIẢ A; 2026-10-06', notifications[0])
        self.assertIn('LỚP GIẢ B; 2026-10-07', notifications[0])
        self.assertIn('LỚP GIẢ B; 2026-10-07', notifications[1])
        self.assertTrue(all('https://' not in text for text in notifications))
        worker.process.assert_not_called()


    def test_source_conflict_holds_all_dates_of_one_shared_target(self):
        conf = config()
        conf['shared_lessons'] = [
            {'source_class':'LỚP GIẢ A', 'source_date':'2026-10-06', 'classDates':{'LỚP GIẢ B':'2026-10-07'}},
            {'source_class':'LỚP GIẢ A', 'source_date':'2026-10-06', 'classDates':{'LỚP GIẢ B':'2026-10-12'}}]
        result, worker = self.batch([source(), source(file='other.pdf'),
                                     source('LỚP GIẢ B', '2026-10-07'), source('LỚP GIẢ B', '2026-10-12'),
                                     source('LỚP GIẢ C', '2026-10-12')], conf)
        self.assertEqual([item['status'] for item in result['items']], ['loi', 'loi', 'loi', 'already_published'])
        self.assertEqual([item['classes'] for item in result['items'][1:3]], [
            {'LỚP GIẢ B':'2026-10-07'}, {'LỚP GIẢ B':'2026-10-12'}])
        worker.process.assert_called_once()
        self.assertEqual(worker.process.call_args.args[0]['class_name'], 'LỚP GIẢ C')

    def test_tuesday_source_conflict_keeps_explicit_target_dates_and_tuesday_date(self):
        conf = config()
        for name in ('2K10 9+', '2K10 Thứ 3, 6'):
            conf['classes'][name] = {'enabled':True, 'dates':['2026-10-06', '2026-10-07', '2026-10-12']}
        conf['shared_lessons'] = [
            {'source_class':'2K10 9+', 'source_date':'2026-10-06', 'classDates':{'2K10 Thứ 3, 6':'2026-10-07'}},
            {'source_class':'2K10 9+', 'source_date':'2026-10-06', 'classDates':{'2K10 Thứ 3, 6':'2026-10-12'}}]
        result, worker = self.batch([source('2K10 9+'), source('2K10 9+', file='other.pdf'),
                                     source('2K10 Thứ 3, 6', '2026-10-06'),
                                     source('2K10 Thứ 3, 6', '2026-10-07'),
                                     source('2K10 Thứ 3, 6', '2026-10-12'),
                                     source('LỚP GIẢ C', '2026-10-12')], conf)
        self.assertEqual([item['status'] for item in result['items']], ['loi']*4+['already_published'])
        self.assertEqual([item['classes'] for item in result['items'][1:4]], [
            {'2K10 Thứ 3, 6':day} for day in ('2026-10-06', '2026-10-07', '2026-10-12')])
        worker.process.assert_called_once()
        self.assertEqual(worker.process.call_args.args[0]['class_name'], 'LỚP GIẢ C')


if __name__ == '__main__':
    unittest.main()
