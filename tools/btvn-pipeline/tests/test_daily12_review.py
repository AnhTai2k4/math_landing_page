"""Sau phản biện ngày 16/10: chỉ nguồn GIẢ, không mạng hoặc cấu hình vận hành."""
import copy
import csv
import importlib.util
import io
import json
from pathlib import Path
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('pipeline_daily12_review', ROOT/'pipeline.py')
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
COLUMNS = dict(class_name='Class', lesson_date='Date', title='Title', document='Document',
               handout='Handout', video='Video', homework='Homework', answers='Answers')
SHEET = dict(id='fake-material-only', name='TAB GIẢ', columns=COLUMNS,
             url='https://example.invalid/material.csv')


def source(day='2026-10-15', name='LỚP GIẢ A', title='Bài GIẢ', file='hs.pdf'):
    return dict(zip(COLUMNS, [name, day, title, '', '', '',
                            'https://example.invalid/'+file, 'https://example.invalid/gv.pdf']))


def extra(day='', file='extra.pdf'):
    return source(day, '', '', file)


def csv_bytes(rows):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(COLUMNS.values())
    writer.writerows([[row.get(key, '') for key in COLUMNS] for row in rows])
    return output.getvalue().encode('utf-8')


class Daily12ReviewTests(unittest.TestCase):
    def setUp(self):
        for target in ('socket.create_connection', 'socket.getaddrinfo', 'urllib.request.OpenerDirector.open'):
            block = patch(target, side_effect=AssertionError('Cấm mạng trong hồi quy GIẢ'))
            block.start()
            self.addCleanup(block.stop)

    def test_shared_calendar_contract(self):
        fixtures = ROOT.parents[1]/'tests/fixtures/btvn-material-dates.json'
        for case in json.loads(fixtures.read_text(encoding='utf-8')):
            with self.subTest(name=case['name']):
                school = case.get('schoolYear')
                sheet = {'school_year': {'start_year': school['startYear'], 'start_month': school['startMonth']}} if school else {}
                if case['name'] == 'thiếu năm không có cấu hình':
                    with self.assertRaisesRegex(p.GateError, '^Ngày thiếu năm cần cấu hình năm học$'):
                        p.material_date(case['value'], sheet)
                else:
                    self.assertEqual(p.material_date(case['value'], sheet), case['expected'])

    def test_invalid_extra_discards_whole_unit_and_keeps_other_units(self):
        for bad in ('31/02/2026', '16/10'):
            with self.subTest(bad=bad):
                rows = [source('2026-10-14', 'LỚP GIẢ TRƯỚC'), source(), extra(),
                        extra(bad, 'bad.pdf'), extra('', 'last.pdf'),
                        source('2026-10-16', 'LỚP GIẢ SAU')]
                errors = []
                result = p.sheet_rows(csv_bytes(rows), SHEET, errors)
                self.assertEqual([row['class_name'] for row in result], ['LỚP GIẢ TRƯỚC', 'LỚP GIẢ SAU'])
                self.assertEqual(len(errors), 1)
                self.assertEqual(errors[0]['cell'], 'B5')
                self.assertEqual(errors[0]['parent_cell'], 'B3')
                self.assertEqual(errors[0]['status'], 'loi')
                self.assertEqual(errors[0]['tab'], 'TAB GIẢ')
                self.assertNotIn('https://', json.dumps(errors))
                self.assertNotIn(bad, json.dumps(errors))
                self.assertFalse(any('extra.pdf' in url or 'last.pdf' in url
                                     for row in result for url in row['homework_urls']))

    def test_invalid_final_extra_also_discards_parent(self):
        errors = []
        self.assertEqual(p.sheet_rows(csv_bytes([source(), extra(), extra('31/02/2026')]), SHEET, errors), [])
        self.assertEqual(errors[0]['parent_cell'], 'B2')
        self.assertEqual(errors[0]['cell'], 'B4')

    def test_good_unit_keeps_all_files_and_normalized_date(self):
        rows = [source(), extra(), extra('15. 10. 2026', 'last.pdf')]
        errors = []
        result = p.sheet_rows(csv_bytes(rows), SHEET, errors)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['homework_urls'], ['https://example.invalid/hs.pdf',
                                                    'https://example.invalid/extra.pdf',
                                                    'https://example.invalid/last.pdf'])
        self.assertEqual(errors, [])

    def test_bad_date_without_error_collector_raises(self):
        for bad in ('31/02/2026', '16/10', '2026-W42-4'):
            for rows in ([source(bad)], [source(), extra(bad)]):
                with self.subTest(bad=bad, count=len(rows)), self.assertRaises(p.GateError) as failure:
                    p.sheet_rows(csv_bytes(rows), SHEET)
                self.assertNotIn(bad, str(failure.exception))
                self.assertNotIn('https://', str(failure.exception))

    def test_missing_year_does_not_abort_good_tabs_with_collector(self):
        second = {**SHEET, 'id': 'fake-second', 'name': 'TAB GIẢ 2',
                  'url': 'https://example.invalid/second.csv'}
        transport = Mock()
        transport.request.side_effect = [csv_bytes([source()]),
                                         csv_bytes([source('16/10'), source('2026-10-16')])]
        errors = []
        result = p.read_material_rows({'sheets': [SHEET, second]}, transport, errors)
        self.assertEqual([row['lesson_date'] for row in result], ['2026-10-15', '2026-10-16'])
        self.assertEqual(errors, [{'status': 'loi', 'reason': 'Ngày thiếu năm cần cấu hình năm học',
                                   'tab': 'TAB GIẢ 2', 'cell': 'B2'}])
        self.assertEqual(transport.request.call_count, 2)

    def test_attachment_error_coordinates_grid_and_xlsx(self):
        rows = [source(), extra('31/02/2026')]
        table = [[{'text': name, 'links': []} for name in COLUMNS.values()]]
        table += [[{'text': row[key], 'links': [row[key]]} for key in COLUMNS] for row in rows]
        sheet = {**SHEET, 'format': 'xlsx', 'range': 'B4:I8'}
        errors = []
        with patch.object(p, 'xlsx_rows', return_value=copy.deepcopy(table)):
            self.assertEqual(p.sheet_rows(b'fake-xlsx', sheet, errors), [])
        self.assertEqual(errors[0]['parent_cell'], 'C5')
        self.assertEqual(errors[0]['cell'], 'C6')
        grid = {'sheets': [{'data': [{'startRow': 3, 'startColumn': 1,
                                    'rowData': [{'values': [{'formattedValue': cell['text'], 'hyperlink': cell['text'] if cell['text'].startswith('https://') else None} for cell in row]}
                                                for row in table]}]}]}
        errors = []
        self.assertEqual(p.sheet_rows(json.dumps(grid).encode(), {**sheet, 'format': 'grid'}, errors), [])
        self.assertEqual(errors[0]['parent_cell'], 'C5')
        self.assertEqual(errors[0]['cell'], 'C6')

    def test_invalid_school_year_is_a_safe_gate(self):
        for school in ({'start_year': 2026, 'start_month': 0},
                       {'start_year': 2026, 'start_month': True},
                       {'start_year': True, 'start_month': 9},
                       {'start_year': 10000, 'start_month': 9}, 'not-an-object'):
            with self.subTest(school=school), self.assertRaisesRegex(p.GateError, '^Ngày thiếu năm cần cấu hình năm học$'):
                p.material_date('15/10', {'school_year': school})


if __name__ == '__main__':
    unittest.main()
