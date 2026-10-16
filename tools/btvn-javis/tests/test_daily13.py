"""Hồi quy vòng 13, chỉ dữ liệu GIẢ và không gọi dịch vụ thật."""
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
import runtime as r
import worker as w

p = w.p
NOW = dt.datetime(2026, 10, 16, 13, tzinfo=r.VN)


def config():
    return {'classes': {'LỚP GIẢ A': {'enabled': True, 'dates': ['2026-10-06', '2026-10-12']}},
            'periods': [{'start': '2026-10-05', 'end': '2026-10-12', 'period': 'GK1'}],
            'extractor': {}, 'reviewer': {}}


def source(day='2026-10-06'):
    return {'class_name': 'LỚP GIẢ A', 'lesson_date': day, 'lesson_key': 'fake-'+day,
            'title': 'Bài GIẢ', 'homework': 'https://example.invalid/hs.pdf',
            'homework_urls': ['https://example.invalid/hs.pdf'], 'answers': 'https://example.invalid/gv.pdf',
            'homework_note': '', 'homework_scope': ''}


class Daily13Tests(unittest.TestCase):
    def setUp(self):
        for target in ('socket.create_connection', 'socket.getaddrinfo', 'urllib.request.OpenerDirector.open'):
            block = patch(target, side_effect=AssertionError('Cấm mạng trong kiểm vòng 13'))
            block.start()
            self.addCleanup(block.stop)

    def test_period_dates_match_routing_before_download(self):
        for start, end in [('2026-10-05', '2026-10-12'), ('05/10/2026', '12/10/2026'),
                           ('5.10.,2026', '12.10.2026'), ('20261005', '20261012')]:
            conf = config()
            conf['periods'][0].update(start=start, end=end)
            original = copy.deepcopy(conf)
            row = w.route_rows([source()], conf, NOW)[0]
            instance = w.VersionWorker.__new__(w.VersionWorker)
            instance.config = conf
            # Chỉ đến biên tải; không tạo DB, AI, publisher hoặc tải dữ liệu.
            sentinel = RuntimeError('BIÊN TẢI GIẢ')
            instance.transport = Mock()
            with patch.object(p, 'download_homework', side_effect=sentinel) as download:
                with self.assertRaisesRegex(RuntimeError, 'BIÊN TẢI GIẢ'):
                    instance.process(row)
            download.assert_called_once()
            self.assertEqual(instance.config['period'], 'GK1')
            original['period'] = 'GK1'
            self.assertEqual(conf, original, 'Không sửa mốc kỳ cấu hình để kiểm qua')

    def test_bad_periods_stop_before_download(self):
        cases = [[], [{'start':'2026-10-07','end':'2026-10-12','period':'GK1'}],
                 config()['periods'] * 2,
                 [{'start':'2026-10-12','end':'2026-10-05','period':'GK1'}],
                 [{'start':'31/02/2026','end':'2026-10-12','period':'GK1'}],
                 [{'start':'2026-10-05','end':'31/02/2026','period':'GK1'}],
                 [{'start':'2026-10-05','end':'2026-10-12','period':'SAI'}], [{}], None]
        for periods in cases:
            instance = w.VersionWorker.__new__(w.VersionWorker)
            instance.config = {**config(), 'periods': periods}
            with patch.object(p, 'download_homework') as download, self.assertRaises(p.GateError):
                instance.process(source())
            download.assert_not_called()

    def batch(self, rows, conf=None, worker=None):
        conf = config() if conf is None else conf
        if worker is None:
            worker = Mock(last_key='fake-processed', last_source_version=None, last_reason=None)
            worker.process.return_value = 'already_published'
        publisher = Mock()
        with tempfile.TemporaryDirectory() as directory, patch.object(w, 'VersionWorker', return_value=worker), \
             patch.object(p, 'read_material_rows', return_value=rows), patch.object(w, 'retry_errors'), \
             patch.object(w, 'report_error'), patch.object(w, 'flush_notifications'), \
             patch.object(w, 'run_attendance', return_value={'sync':'fake-offline'}), patch.object(r, 'now_vn', return_value=NOW):
            result = w.run_batch(conf, Mock(), publisher, Path(directory), NOW)
            saved = json.loads(next((Path(directory)/'receipts').glob('*.json')).read_text(encoding='utf-8'))
            self.assertEqual(saved, result)
        self.assertEqual(publisher.mock_calls, [])
        return result, worker

    def test_duplicate_source_conflict_is_isolated_with_fixed_reason(self):
        for field, value, code in [('homework_scope', 'Phạm vi GIẢ câu 1-3', 'khac_pham_vi'),
                                   ('homework_note', 'Ghi chú GIẢ', 'khac_ghi_chu'),
                                   ('homework_urls', ['https://example.invalid/other.pdf'], 'khac_danh_sach_tep'),
                                   ('answers', 'https://example.invalid/other-gv.pdf', 'khac_dap_an')]:
            first = source()
            other = {**first, field: value}
            for duplicates in ([first, other], [other, first]):
                with self.subTest(field=field, reverse=duplicates[0] is other):
                    rows = [*duplicates, source('2026-10-12')]
                    original = copy.deepcopy(rows)
                    result, worker = self.batch(rows)
                    self.assertNotIn('status', result)
                    self.assertEqual([item['status'] for item in result['items']], ['loi', 'already_published'])
                    self.assertEqual(result['items'][0]['reason'], 'Hai dòng chung bài xung đột: '+code)
                    self.assertEqual(worker.process.call_count, 1)
                    self.assertEqual(worker.process.call_args.args[0]['lesson_date'], '2026-10-12')
                    self.assertEqual(rows, original)
                    serialized = json.dumps(result, ensure_ascii=False)
                    self.assertNotIn('https://', serialized)
                    self.assertNotIn(str(value), serialized)

    def test_same_downloads_ignore_unused_primary_and_process_once(self):
        for urls in (['https://example.invalid/hs.pdf'],
                     ['https://example.invalid/hs.pdf', 'https://example.invalid/hs2.pdf']):
            first = {**source(), 'homework_urls': urls}
            other = {**first, 'homework': 'https://example.invalid/unused-primary.pdf'}
            for rows in ([first, other], [other, first]):
                original = copy.deepcopy(rows)
                result, worker = self.batch(rows)
                self.assertEqual([item['status'] for item in result['items']], ['already_published'])
                worker.process.assert_called_once()
                self.assertEqual(len(w.route_rows(rows, config(), NOW)), 1)
                self.assertEqual(rows, original)

    def test_primary_is_checked_when_download_list_is_empty_or_missing(self):
        for urls in ([], None, 'missing'):
            first = source()
            if urls == 'missing':
                first.pop('homework_urls')
            else:
                first['homework_urls'] = urls
            other = {**first, 'homework': 'https://example.invalid/another-primary.pdf'}
            result, worker = self.batch([first, other, source('2026-10-12')])
            self.assertEqual(result['items'][0]['reason'], 'Hai dòng chung bài xung đột: khac_danh_sach_tep')
            self.assertEqual(worker.process.call_count, 1)
            self.assertNotIn('https://', json.dumps(result))

    def test_download_order_and_all_conflict_fields_are_preserved(self):
        urls = ['https://example.invalid/hs1.pdf', 'https://example.invalid/hs2.pdf']
        first = {**source(), 'homework_urls': urls}
        other = {**first, 'homework_urls': list(reversed(urls)), 'homework_scope': 'Phạm vi GIẢ'}
        third = {**first, 'homework_note': 'Ghi chú GIẢ', 'answers': 'https://example.invalid/other-gv.pdf'}
        for rows in ([first, other, third], [third, other, first]):
            result, worker = self.batch(rows)
            self.assertEqual(result['items'][0]['reason'],
                             'Hai dòng chung bài xung đột: khac_danh_sach_tep, khac_dap_an, khac_ghi_chu, khac_pham_vi')
            worker.process.assert_not_called()
            serialized = json.dumps(result, ensure_ascii=False)
            for sensitive in ('https://', 'Phạm vi GIẢ', 'Ghi chú GIẢ'):
                self.assertNotIn(sensitive, serialized)

    def test_bad_lesson_period_is_isolated_without_batch_failure_status(self):
        cases = [[{'start':'2026-10-05','end':'2026-10-05','period':'GK1'},
                  {'start':'2026-10-12','end':'2026-10-12','period':'GK1'}],
                 [*config()['periods'], {'start':'2026-10-06','end':'2026-10-06','period':'GK1'}]]
        for periods in cases:
            conf = {**config(), 'periods': periods}
            instance = w.VersionWorker.__new__(w.VersionWorker)
            instance.config, instance.transport, instance.db = conf, Mock(), Mock()
            instance.db.execute.return_value = []
            with patch.object(p, 'download_homework', return_value=b'FAKE HS') as hs, \
                 patch.object(p, 'download_pdf', return_value=b'FAKE GV') as gv, \
                 patch.object(w, 'material', return_value={'title':'GIẢ'}), \
                 patch.object(p.Worker, 'process', return_value='already_published') as process:
                result, _ = self.batch([source(), source('2026-10-12')], conf, instance)
            self.assertNotIn('status', result)
            self.assertEqual([item['status'] for item in result['items']], ['loi', 'already_published'])
            self.assertEqual(result['items'][0]['reason'], 'Buổi học chưa thuộc đúng một kỳ đã cấu hình')
            self.assertEqual(result['items'][1]['classes'], {'LỚP GIẢ A':'2026-10-12'})
            hs.assert_called_once()
            gv.assert_called_once()
            process.assert_called_once()
            self.assertEqual(process.call_args.args[0]['lesson_date'], '2026-10-12')
            instance.db.close.assert_called_once()

    def test_identical_rows_still_process_once_without_mutation(self):
        rows = [source(), source()]
        original = copy.deepcopy(rows)
        result, worker = self.batch(rows)
        self.assertEqual([item['status'] for item in result['items']], ['already_published'])
        worker.process.assert_called_once()
        self.assertEqual(rows, original)

    def test_route_list_does_not_merge_different_scopes(self):
        first = source()
        second = {**first, 'homework_note':'Ghi chú GIẢ'}
        self.assertEqual(len(w.route_rows([first, second], config(), NOW)), 2)


if __name__ == '__main__':
    unittest.main()
