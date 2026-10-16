"""Vòng 15: lịch nhận bài mâu thuẫn dùng fixture GIẢ, khóa toàn bộ mạng."""
import copy
import datetime as dt
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


def config():
    return {'classes': {name: {'enabled': True, 'dates': ['2026-10-06', '2026-10-07', '2026-10-12']}
                        for name in ('LỚP GIẢ A', 'LỚP GIẢ B', 'LỚP GIẢ C', 'LỚP GIẢ D')},
            'periods': [{'start': '2026-10-05', 'end': '2026-10-12', 'period': 'GK1'}],
            'extractor': {}, 'reviewer': {}, 'shared_lessons': [
                {'source_class': 'LỚP GIẢ A', 'source_date': '2026-10-06',
                 'classDates': {'LỚP GIẢ B': '2026-10-07'}},
                {'source_class': 'LỚP GIẢ A', 'source_date': '2026-10-06',
                 'classDates': {'LỚP GIẢ B': '2026-10-12'}}]}


def source(name='LỚP GIẢ A', day='2026-10-06'):
    return {'class_name': name, 'lesson_date': day, 'lesson_key': 'fake-'+name+'-'+day,
            'title': 'Bài GIẢ', 'homework': 'https://example.invalid/hs.pdf',
            'homework_urls': ['https://example.invalid/hs.pdf'],
            'answers': 'https://example.invalid/gv.pdf', 'homework_note': '', 'homework_scope': ''}


def sessions(event):
    return {(item['class_name'], item['lesson_date']) for item in event['sessions']}


class Daily15Tests(unittest.TestCase):
    def setUp(self):
        for target in ('socket.create_connection', 'socket.getaddrinfo', 'urllib.request.OpenerDirector.open'):
            block = patch(target, side_effect=AssertionError('Cấm mạng trong kiểm vòng 15'))
            block.start()
            self.addCleanup(block.stop)

    def batch(self, rows, conf):
        original = copy.deepcopy(conf)
        worker = Mock(last_key='fake-processed', last_source_version=None, last_reason=None)
        worker.process.return_value = 'already_published'
        publisher = Mock()
        TEMP.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=TEMP) as directory, \
             patch.object(w, 'VersionWorker', return_value=worker), \
             patch.object(p, 'read_material_rows', return_value=rows), \
             patch.object(w, 'retry_errors'), patch.object(w, 'report_error') as report, \
             patch.object(w, 'flush_notifications'), \
             patch.object(w, 'run_attendance', return_value={'sync': 'fake-offline'}), \
             patch.object(w.r, 'now_vn', return_value=NOW):
            result = w.run_batch(conf, Mock(), publisher, Path(directory), NOW)
            saved = json.loads(next((Path(directory)/'receipts').glob('*.json')).read_text(encoding='utf-8'))
            self.assertEqual(saved, result)
        self.assertEqual(conf, original)
        self.assertEqual(publisher.mock_calls, [])
        worker.db.close.assert_called_once()
        return result, worker, report

    def test_shared_date_conflict_has_no_order_dependent_winner(self):
        expected = {('LỚP GIẢ A', '2026-10-06'), ('LỚP GIẢ B', '2026-10-07'),
                    ('LỚP GIẢ B', '2026-10-12')}
        for reverse in (False, True):
            conf = config()
            if reverse:
                conf['shared_lessons'].reverse()
            original = copy.deepcopy(conf)
            events = []
            self.assertEqual(w.route_rows([source()], conf, NOW, events), [])
            self.assertEqual(len(events), 1)
            self.assertEqual(events[0]['scope'], 'lich_chung_xung_dot')
            self.assertEqual(sessions(events[0]), expected)
            self.assertEqual(conf, original)
            with self.assertRaisesRegex(p.GateError, 'Lịch nhận bài chung xung đột'):
                w.route_rows([source()], conf, NOW)

    def test_all_target_dates_and_dependents_are_held_other_class_runs(self):
        for reverse_config in (False, True):
            for reverse_rows in (False, True):
                conf = config()
                conf['shared_lessons'].append({'source_class': 'LỚP GIẢ B',
                                              'source_date': '2026-10-07',
                                              'classDates': {'LỚP GIẢ C': '2026-10-12'}})
                if reverse_config:
                    conf['shared_lessons'].reverse()
                rows = [source(), source('LỚP GIẢ B', '2026-10-07'),
                        source('LỚP GIẢ B', '2026-10-12'),
                        source('LỚP GIẢ C', '2026-10-12'), source('LỚP GIẢ D', '2026-10-12')]
                if reverse_rows:
                    rows.reverse()
                result, worker, report = self.batch(rows, conf)
                self.assertNotIn('status', result)
                self.assertEqual(sum(item['status'] == 'loi' for item in result['items']), 4)
                self.assertEqual(sum(item['status'] == 'already_published' for item in result['items']), 1)
                worker.process.assert_called_once()
                self.assertEqual(worker.process.call_args.args[0]['class_name'], 'LỚP GIẢ D')
                text = '\n'.join(call.args[3] for call in report.call_args_list)
                self.assertIn('LỚP GIẢ B; 2026-10-07', text)
                self.assertIn('LỚP GIẢ B; 2026-10-12', text)
                for forbidden in ('https://', 'hs.pdf', 'gv.pdf'):
                    self.assertNotIn(forbidden, text+json.dumps(result, ensure_ascii=False))

    def test_repeated_equivalent_shared_date_stays_valid_and_key_unchanged(self):
        conf = config()
        conf['shared_lessons'] = [conf['shared_lessons'][0]]
        expected = w.route_rows([source()], conf, NOW)[0]
        conf['shared_lessons'].append({**conf['shared_lessons'][0],
                                      'source_date': '6.10.,2026',
                                      'classDates': {'LỚP GIẢ B': '7/10/2026'}})
        events = []
        self.assertEqual(w.route_rows([source()], conf, NOW, events), [expected])
        self.assertEqual(events, [])

    def test_share_cannot_replace_source_own_date(self):
        conf = config()
        conf['shared_lessons'] = [{'source_class': 'LỚP GIẢ A', 'source_date': '2026-10-06',
                                  'classDates': {'LỚP GIẢ A': '2026-10-12'}}]
        events = []
        self.assertEqual(w.route_rows([source()], conf, NOW, events), [])
        self.assertEqual(sessions(events[0]), {('LỚP GIẢ A', '2026-10-06'), ('LỚP GIẢ A', '2026-10-12')})

    def test_explicit_date_cannot_overwrite_tuesday_shared_rule(self):
        conf = config()
        for name in ('2K10 9+', '2K10 Thứ 3, 6'):
            conf['classes'][name] = {'enabled': True, 'dates': ['2026-10-06', '2026-10-12']}
        conf['shared_lessons'] = [{'source_class': '2K10 9+', 'source_date': '2026-10-06',
                                  'classDates': {'2K10 Thứ 3, 6': '2026-10-12'}}]
        events = []
        self.assertEqual(w.route_rows([source('2K10 9+')], conf, NOW, events), [])
        self.assertEqual(sessions(events[0]), {('2K10 9+', '2026-10-06'),
                                              ('2K10 Thứ 3, 6', '2026-10-06'),
                                              ('2K10 Thứ 3, 6', '2026-10-12')})


if __name__ == '__main__':
    unittest.main()
