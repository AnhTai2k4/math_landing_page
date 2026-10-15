import datetime as dt
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock,patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import attendance as a
import runtime as r

NOW=dt.datetime(2026,10,15,14,tzinfo=r.VN)
ROW={'label':'2K9 9+','fullName':'Em Giả Một','phone':'0900000001','source':'Thứ 5#1'}

class AttendanceTests(unittest.TestCase):
    def setUp(self):
        for target in ('socket.create_connection','urllib.request.OpenerDirector.open'):
            guard=patch(target,side_effect=AssertionError('Không được mở mạng trong test'))
            guard.start();self.addCleanup(guard.stop)
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
        self.tabs={tab:[['','TÊN LỚP','15/10'],['Lớp (2K9 9+)','17h30 - 19h30'],['Em Giả Một','0900000001','C']] for tab in a.TABS}
        self.transport=Mock();self.transport.request.return_value=json.dumps({'valueRanges':[{'range':"'"+tab+"'!A1:ZZ2000",'values':rows} for tab,rows in self.tabs.items()]}).encode()
        self.publisher=Mock();self.publisher.call.side_effect=[{'ok':True,'invalid':0,'applied':False},{'ok':True,'invalid':0,'applied':True},{'applied':True},[{'kind':'dang_nhap_that_bai','className':'2K9 9+','fullName':'KHONG_LOG','phone':'0900000001'},{'kind':'tu_dong_them','className':'2K9 9+'}]]
        self.parsed={'roster':{'rows':[ROW],'skippedMixedBlocks':0},'due':{'sessions':[],'pending':[]}}

    def test_fake_sheet_sync_and_private_summary(self):
        emit=Mock();parse=Mock(return_value=self.parsed)
        result=a.run_attendance({'attendance_map':'fake.json'},self.transport,self.publisher,self.root,NOW,parse,emit)
        self.assertEqual(result['sync'],'da_dong_bo');self.assertEqual(parse.call_args.args[0],self.tabs)
        self.assertEqual([c.args[0]['action'] for c in self.publisher.call.call_args_list],['sync_attendance','sync_attendance','sync_due','support_report'])
        self.assertFalse(self.publisher.call.call_args_list[0].args[0]['apply'])
        self.assertTrue(self.publisher.call.call_args_list[1].args[0]['apply'])
        self.assertEqual(self.publisher.call.call_args.args[0]['since'],(NOW-dt.timedelta(hours=1)).isoformat())
        emit.assert_called_once_with('BTVN hỗ trợ đăng nhập: 2K9 9+: 1 lần')
        self.assertIn(a.SHEET,self.transport.request.call_args.args[0]);self.assertIn('values:batchGet',self.transport.request.call_args.args[0])
        self.assertNotIn('KHONG_LOG',json.dumps(result));self.assertFalse(list(self.root.iterdir()))

    def test_download_error_once_per_vn_day_support_continues(self):
        self.transport.request.side_effect=OSError('PRIVATE');self.publisher.call.side_effect=None;self.publisher.call.return_value=[]
        emit=Mock()
        for hour in (14,15):a.run_attendance({'attendance_map':'fake'},self.transport,self.publisher,self.root,NOW.replace(hour=hour),emit=emit)
        self.assertEqual(emit.call_count,1);self.assertNotIn('PRIVATE',str(emit.call_args))
        a.run_attendance({'attendance_map':'fake'},self.transport,self.publisher,self.root,NOW+dt.timedelta(days=1),emit=emit)
        self.assertEqual(emit.call_count,2);self.assertEqual(self.publisher.call.call_count,3)

    def test_pending_or_empty_roster_blocks_both_writes(self):
        for parsed in [dict(self.parsed,due={'pending':[{}]}),dict(self.parsed,roster={'rows':[]})]:
            pub=Mock();pub.call.return_value=[]
            result=a.run_attendance({'attendance_map':'fake'},self.transport,pub,self.root,NOW,lambda *args:parsed,Mock())
            self.assertEqual(result['sync'],'loi_dong_bo');self.assertEqual(pub.call.call_count,1);self.assertEqual(pub.call.call_args.args[0]['action'],'support_report')

    def test_bad_rpc_confirmation_stops_due_but_reports(self):
        pub=Mock();pub.call.side_effect=[{'ok':True,'applied':False,'invalid':1},[]]
        result=a.run_attendance({'attendance_map':'fake'},self.transport,pub,self.root,NOW,lambda *args:self.parsed,Mock())
        self.assertEqual(result['sync'],'loi_dong_bo');self.assertEqual(pub.call.call_count,2)

    def test_untrusted_class_and_zero_events(self):
        self.assertIsNone(a.support_summary([]));self.assertIsNone(a.support_summary([{'kind':'tu_dong_them'}]))
        line=a.support_summary([{'kind':'dang_nhap_that_bai','className':'PRIVATE 0900000000'}, {'kind':'dang_nhap_that_bai','className':'2K9 HSA (CN)'}])
        self.assertNotIn('PRIVATE',line);self.assertNotIn('0900000000',line);self.assertIn('Lớp chưa xác định: 1 lần',line)

    def test_real_node_bundle_with_fake_tabs(self):
        mapping=self.root/'map.json';mapping.write_text(json.dumps({'schoolYear':2026,'classes':{'2k9 9+':'2K9 9+'}}),encoding='utf-8')
        bundle=Path(__file__).resolve().parents[3]/'.qa-temp/dot-21/attendance.bundle.mjs'
        with patch.dict(os.environ,{'BTVN_ATTENDANCE_BUNDLE':str(bundle)}):result=a.parse_tabs(self.tabs,mapping,NOW)
        self.assertEqual(len(result['roster']['rows']),1);self.assertEqual(len(result['due']['sessions']),7);self.assertEqual(result['due']['pending'],[])
        for rows in self.tabs.values():
            rows[0].append('16/10');rows[2].append('')
        with patch.dict(os.environ,{'BTVN_ATTENDANCE_BUNDLE':str(bundle)}):future=a.parse_tabs(self.tabs,mapping,NOW)
        self.assertEqual(len(future['due']['sessions']),14)
        self.assertTrue(any(s['startsAt'].startswith('2026-10-16') and s['attendees'][0]['status']=='' for s in future['due']['sessions']))

    def test_batch_calls_attendance_after_items_and_when_source_fails(self):
        import worker as w
        from offline import fixtures
        f=fixtures();config=w.p.load_config(r.pipeline_dir()/'config.example.json')
        config.update(classes={},periods=[])
        for fail in (False,True):
            with patch.object(w.p,'read_material_rows',side_effect=ValueError('FAKE') if fail else None,return_value=[]),patch.object(w,'report_error'),patch.object(w,'retry_errors'),patch.object(w,'flush_notifications'),patch.object(w,'run_attendance',return_value={'sync':'fake'}) as sync:
                receipt=w.run_batch(config,f.FakeTransport(),f.FakePublisher(),self.root,NOW)
            sync.assert_called_once();self.assertEqual(receipt['attendance_sync'],{'sync':'fake'})

    def test_truncated_or_missing_tab_rejected(self):
        for value in [{'valueRanges':[]},{'valueRanges':[{'values':[]}]*7},{'valueRanges':[{'values':[['x']]*2000}]*7}]:
            self.transport.request.return_value=json.dumps(value).encode()
            with self.assertRaises(ValueError):a.download_tabs(self.transport)

if __name__=='__main__':unittest.main()
