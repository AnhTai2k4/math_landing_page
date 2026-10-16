"""Vòng 15: cô lập nguyên buổi GIẢ có tệp phụ hỏng, không mở mạng."""
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
NOW = dt.datetime(2026, 10, 16, 15, tzinfo=w.r.VN)
TEMP = HERE.parents[1]/'.qa-temp/hang-ngay/20261016-15/python-temp'
COLUMNS = dict(class_name='Class', lesson_date='Date', title='Title', document='Document',
               handout='Handout', video='Video', homework='Homework', answers='Answers', homework_scope='Scope')
SHEET = dict(id='fake-source', name='TAB GIẢ', columns=COLUMNS, url='https://example.invalid/material.csv')


def source(name='LỚP GIẢ A', day='2026-10-06'):
    return {'class_name': name, 'lesson_date': day, 'title': 'Bài GIẢ',
            'homework': 'https://example.invalid/hs.pdf', 'answers': 'https://example.invalid/gv.pdf',
            'homework_scope': 'Câu 1-3'}


def csv_bytes(rows):
    text = io.StringIO()
    writer = csv.writer(text)
    writer.writerow(COLUMNS.values())
    writer.writerows([[row.get(key, '') for key in COLUMNS] for row in rows])
    return text.getvalue().encode('utf-8')


def bad_extra(kind):
    if kind == 'scope':
        return {'homework': 'https://example.invalid/extra.pdf', 'homework_scope': 'Câu 4-6'}
    if kind == 'date':
        return {'lesson_date': '31/02/2026', 'homework': 'https://example.invalid/extra.pdf',
                'homework_scope': 'Câu 1-3'}
    return {'homework': 'Tệp GIẢ thiếu liên kết', 'homework_scope': 'Câu 1-3'}


class Daily15PipelineTests(unittest.TestCase):
    def setUp(self):
        for target in ('socket.create_connection', 'socket.getaddrinfo', 'urllib.request.OpenerDirector.open'):
            block = patch(target, side_effect=AssertionError('Cấm mạng trong kiểm vòng 15'))
            block.start()
            self.addCleanup(block.stop)

    def test_bad_extra_holds_whole_parent_but_keeps_other_unit(self):
        for kind in ('scope', 'url', 'date'):
            errors = []
            result = p.sheet_rows(csv_bytes([source(), bad_extra(kind),
                                            {'homework': 'https://example.invalid/later.pdf'},
                                            source('LỚP GIẢ C', '2026-10-12')]), SHEET, errors)
            self.assertEqual([row['class_name'] for row in result], ['LỚP GIẢ C'])
            self.assertEqual(len(errors), 1)
            self.assertEqual(errors[0]['scope'], 'nguon_hong')
            self.assertEqual(errors[0]['classes'], {'LỚP GIẢ A': '2026-10-06'})
            self.assertEqual(errors[0]['parent_cell'], 'B2')
            self.assertEqual(errors[0]['source_locations'], [{'tab': 'TAB GIẢ', 'cell': 'B2'},
                                                             {'tab': 'TAB GIẢ', 'cell': 'B3'},
                                                             {'tab': 'TAB GIẢ', 'cell': 'B4'}])
            self.assertNotIn('https://', json.dumps(errors))
            with self.assertRaises(p.GateError):
                p.sheet_rows(csv_bytes([source(), bad_extra(kind)]), SHEET)

    def test_error_receipt_keeps_every_attachment_before_and_after_first_failure(self):
        valid_extra = {'homework': 'https://example.invalid/extra-ok.pdf', 'homework_scope': 'Câu 1-3'}
        for kind in ('scope', 'url', 'date'):
            with self.subTest(kind=kind):
                errors = []
                rows = [source(), valid_extra, bad_extra(kind),
                        {'homework': 'https://example.invalid/later.pdf'}, bad_extra('date'),
                        source('LỚP GIẢ C', '2026-10-12'), valid_extra]
                result = p.sheet_rows(csv_bytes(rows), SHEET, errors)
                self.assertEqual([row['class_name'] for row in result], ['LỚP GIẢ C'])
                self.assertEqual(len(errors), 1)
                self.assertEqual(errors[0]['parent_cell'], 'B2')
                self.assertEqual(errors[0]['scope'], 'nguon_hong')
                self.assertEqual(errors[0]['source_locations'],
                                 [{'tab': 'TAB GIẢ', 'cell': 'B'+str(row)} for row in range(2, 7)])
                self.assertEqual(result[0]['source_locations'],
                                 [{'tab': 'TAB GIẢ', 'cell': 'B7'}, {'tab': 'TAB GIẢ', 'cell': 'B8'}])
                self.assertEqual(result[0]['homework_urls'], [source()['homework'], valid_extra['homework']])
                for forbidden in ('https://', 'extra-ok.pdf', 'later.pdf', '31/02/2026', 'Câu 4-6'):
                    self.assertNotIn(forbidden, json.dumps(errors, ensure_ascii=False))

    def test_bad_parent_cannot_return_in_later_tab_and_shared_target_is_held(self):
        for kind in ('scope', 'url', 'date'):
            for bad_tab_first in (True, False):
                conf = {'classes': {name: {'enabled': True, 'dates': ['2026-10-06', '2026-10-07', '2026-10-12']}
                                    for name in ('LỚP GIẢ A', 'LỚP GIẢ B', 'LỚP GIẢ C')},
                        'periods': [{'start': '2026-10-05', 'end': '2026-10-12', 'period': 'GK1'}],
                        'extractor': {}, 'reviewer': {}, 'sheets': [SHEET, {**SHEET, 'name': 'TAB GIẢ 2',
                            'id': 'fake-second', 'url': 'https://example.invalid/second.csv'}],
                        'shared_lessons': [{'source_class': 'LỚP GIẢ A', 'source_date': '2026-10-06',
                                            'classDates': {'LỚP GIẢ B': '2026-10-07'}}]}
                bad = [source(), bad_extra(kind)]
                good = [source(), source('LỚP GIẢ B', '2026-10-07'), source('LỚP GIẢ C', '2026-10-12')]
                payloads = [csv_bytes(bad), csv_bytes(good)] if bad_tab_first else [csv_bytes(good), csv_bytes(bad)]
                original = copy.deepcopy(conf)
                transport = Mock()
                transport.request.side_effect = payloads
                worker = Mock(last_key='fake-processed', last_source_version=None, last_reason=None)
                worker.process.return_value = 'already_published'
                publisher = Mock()
                TEMP.mkdir(parents=True, exist_ok=True)
                with tempfile.TemporaryDirectory(dir=TEMP) as directory, \
                     patch.object(w, 'VersionWorker', return_value=worker), \
                     patch.object(w, 'retry_errors'), patch.object(w, 'report_error') as report, \
                     patch.object(w, 'flush_notifications'), \
                     patch.object(w, 'run_attendance', return_value={'sync': 'fake-offline'}), \
                     patch.object(w.r, 'now_vn', return_value=NOW):
                    result = w.run_batch(conf, transport, publisher, Path(directory), NOW)
                    saved = json.loads(next((Path(directory)/'receipts').glob('*.json')).read_text(encoding='utf-8'))
                    self.assertEqual(saved, result)
                self.assertEqual(conf, original)
                self.assertNotIn('status', result)
                self.assertEqual([item['status'] for item in result['items']], ['loi', 'loi', 'already_published'])
                self.assertEqual(result['items'][0]['scope'], 'nguon_hong')
                positions = result['items'][0]['source_locations']
                self.assertEqual(len(positions), 3)
                self.assertEqual(len({(item['tab'], item['cell']) for item in positions}), 3)
                self.assertEqual(result['items'][1]['classes'], {'LỚP GIẢ B': '2026-10-07'})
                worker.process.assert_called_once()
                self.assertEqual(worker.process.call_args.args[0]['class_name'], 'LỚP GIẢ C')
                self.assertEqual(publisher.mock_calls, [])
                worker.db.close.assert_called_once()
                text = '\n'.join(call.args[3] for call in report.call_args_list)
                for position in positions:
                    self.assertIn(position['tab']+'!'+position['cell'], text)
                for forbidden in ('https://', 'hs.pdf', 'extra.pdf', 'Tệp GIẢ thiếu liên kết', 'Câu 4-6'):
                    self.assertNotIn(forbidden, text+json.dumps(result, ensure_ascii=False))

    def test_bad_extra_date_keeps_legacy_coordinates_and_holds_repeated_parent(self):
        for bad_date in ('31/02/2026', '16/10'):
            extra = {'lesson_date': bad_date, 'homework': 'https://example.invalid/extra.pdf'}
            errors = []
            result = p.sheet_rows(csv_bytes([source(), extra, source(),
                                            source('LỚP GIẢ C', '2026-10-12')]), SHEET, errors)
            self.assertEqual([row['class_name'] for row in result], ['LỚP GIẢ C'])
            self.assertEqual(len(errors), 1)
            self.assertEqual(errors[0]['tab'], 'TAB GIẢ')
            self.assertEqual(errors[0]['cell'], 'B3')
            self.assertEqual(errors[0]['parent_cell'], 'B2')
            self.assertEqual(errors[0]['scope'], 'nguon_hong')
            self.assertEqual(errors[0]['classes'], {'LỚP GIẢ A': '2026-10-06'})
            self.assertEqual(errors[0]['source_locations'], [{'tab': 'TAB GIẢ', 'cell': 'B2'},
                                                             {'tab': 'TAB GIẢ', 'cell': 'B3'},
                                                             {'tab': 'TAB GIẢ', 'cell': 'B4'}])
            with self.assertRaises(p.GateError):
                p.sheet_rows(csv_bytes([source(), extra]), SHEET)

    def test_valid_extra_preserves_scope_all_files_and_same_identity(self):
        row = source()
        first = p.sheet_rows(csv_bytes([row]), SHEET)[0]
        errors = []
        extra = {'homework': 'https://example.invalid/extra.pdf', 'homework_scope': 'Câu 1-3'}
        parsed = p.sheet_rows(csv_bytes([row, extra]), SHEET, errors)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]['homework_urls'], [row['homework'], extra['homework']])
        self.assertEqual(parsed[0]['homework_scope'], row['homework_scope'])
        self.assertEqual(parsed[0]['lesson_key'], first['lesson_key'])
        self.assertEqual(parsed[0]['source_locations'], [{'tab': 'TAB GIẢ', 'cell': 'B2'},
                                                       {'tab': 'TAB GIẢ', 'cell': 'B3'}])
        self.assertEqual(errors, [])


if __name__ == '__main__':
    unittest.main()
