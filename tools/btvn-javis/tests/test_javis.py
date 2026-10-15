import base64
import copy
import datetime as dt
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock,patch

HERE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(HERE))
import runtime as r
import worker as w
from offline import fixtures
spec=importlib.util.spec_from_file_location('launcher',HERE/'btvn-tu-dang.py')
launcher=importlib.util.module_from_spec(spec);spec.loader.exec_module(launcher)
f=fixtures()
NOW=dt.datetime(2026,10,15,14,tzinfo=r.VN)


class JavisTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        self.config=w.p.load_config(r.pipeline_dir()/'config.example.json')
        self.config.update(classes={'LỚP GIẢ':{'enabled':True,'dates':['2026-10-15']}},periods=[{'start':'2026-10-15','end':'2026-10-15','period':'GK1'}])

    def test_vn_window_and_end(self):
        for hour in (7,14,23):self.assertTrue(r.in_window(NOW.replace(hour=hour)))
        for hour in (0,6):self.assertFalse(r.in_window(NOW.replace(hour=hour)))
        self.assertTrue(r.in_window(dt.datetime(2027,10,15,23,59,tzinfo=r.VN)))
        self.assertFalse(r.in_window(dt.datetime(2027,10,16,7,tzinfo=r.VN)))
        self.assertTrue(r.in_window(dt.datetime(2026,10,15,0,tzinfo=dt.timezone.utc)))

    def test_launcher_outside_no_config_or_spawn(self):
        check=Mock();spawn=Mock()
        self.assertEqual(launcher.launch(NOW.replace(hour=6),self.root,spawn,check),'[SILENT]')
        check.assert_not_called();spawn.assert_not_called()

    def test_launcher_preflight_is_bounded_and_safe(self):
        import subprocess
        with patch.object(launcher.subprocess,'run',side_effect=subprocess.TimeoutExpired('fake',12)) as run,self.assertRaisesRegex(ValueError,'quá thời gian'):
            launcher.bounded_preflight()
        self.assertEqual(run.call_args.kwargs['timeout'],12)
        with patch.object(launcher.subprocess,'run',return_value=types.SimpleNamespace(returncode=1,stdout=b'sk-PRIVATE')),self.assertRaisesRegex(ValueError,'Không đọc được'):
            launcher.bounded_preflight()

    def test_launcher_real_config_child_under_20_seconds(self):
        import time
        started=time.monotonic()
        with patch.dict(os.environ,{'BTVN_CONFIG':str(self.root/'not-present.json')}):
            result=launcher.launch(NOW,self.root,check=launcher.bounded_preflight)
        self.assertIn('Thiếu cấu hình BTVN',result)
        self.assertLess(time.monotonic()-started,20)

    def test_real_lock_exclusion_and_release(self):
        a=r.FileLock(self.root/'lock');b=r.FileLock(self.root/'lock')
        try:
            self.assertTrue(a.acquire());self.assertFalse(b.acquire())
            a.close();self.assertTrue(b.acquire())
        finally:
            if not a.file.closed:a.close()
            b.close()

    def test_launcher_lock_busy_silent(self):
        lock=Mock();lock.acquire.return_value=False
        check=Mock();spawn=Mock()
        self.assertEqual(launcher.launch(NOW,self.root,spawn,check,lambda path:lock),'[SILENT]')
        check.assert_not_called();spawn.assert_not_called();lock.close.assert_called_once()

    def test_launcher_spawn_detached_passes_lock_and_logs(self):
        spawn=Mock()
        with patch.object(r,'brain_root',return_value=self.root):
            self.assertEqual(launcher.launch(NOW,self.root,spawn,lambda:None),'[SILENT]')
        argv=spawn.call_args.args[0];kwargs=spawn.call_args.kwargs
        self.assertIn('--lock-fd',argv);self.assertTrue(kwargs['start_new_session'])
        self.assertEqual(len(kwargs['pass_fds']),1)
        self.assertTrue((self.root/'logs/2026-10-15.log').exists())

    def test_config_error_once_daily_safe(self):
        def fail():raise ValueError('Thiếu khóa OpenAI hoặc Anthropic')
        spawn=Mock()
        first=launcher.launch(NOW,self.root,spawn,fail)
        self.assertIn('Thiếu khóa',first)
        self.assertEqual(launcher.launch(NOW,self.root,spawn,fail),'[SILENT]')
        self.assertNotEqual(launcher.launch(NOW+dt.timedelta(days=1),self.root,spawn,fail),'[SILENT]')
        spawn.assert_not_called()
        def unsafe():raise ValueError('sk-PRIVATE-KEY')
        self.assertNotIn('sk-',launcher.launch(NOW,self.root,spawn,unsafe))

    def test_read_keys_mock_config_no_output(self):
        config=types.SimpleNamespace(read_settings=lambda:{'model':{'openai_api_key':'fake-a','anthropic_api_key':'fake-b'}})
        with patch.dict(sys.modules,{'config':config}):self.assertEqual(r.read_keys(),('fake-a','fake-b'))
        config.read_settings=lambda:{'model':{}}
        with patch.dict(sys.modules,{'config':config}),self.assertRaises(ValueError):r.read_keys()

    def test_sa_selection_ambiguous_and_explicit(self):
        connector=self.root/'connector-files';connector.mkdir()
        a=connector/'a-service_account.json';a.write_text('{}')
        with patch.object(r,'state_root',return_value=self.root/'btvn'),patch.dict(os.environ,{},clear=True):
            self.assertEqual(r.service_account(),a)
            (connector/'b-service_account.json').write_text('{}')
            with self.assertRaises(ValueError):r.service_account()
            with patch.dict(os.environ,{'MTM_GOOGLE_SA_PATH':str(a)}):self.assertEqual(r.service_account(),a)

    def test_secret_priority_no_fallback_invalid_primary(self):
        primary=self.root/'btvn';primary.mkdir()
        fallback=self.root/'Javis/btvn';fallback.mkdir(parents=True)
        (fallback/'.publish.env').write_text('BTVN_PUBLISH_URL=https://fake.invalid\nBTVN_PUBLISH_SECRET='+'b'*32)
        with patch.object(r,'state_root',return_value=primary),patch.object(r,'brain_root',return_value=self.root):
            self.assertEqual(r.publish_settings()[1],'b'*32)
            (primary/'publish.env').write_text('BTVN_PUBLISH_URL=https://fake.invalid\nBTVN_PUBLISH_SECRET='+'a'*32)
            self.assertEqual(r.publish_settings()[1],'a'*32)
            (primary/'publish.env').write_text('bad')
            with self.assertRaises(ValueError):r.publish_settings()

    def test_route_scope_and_calendar(self):
        row=f.row()
        routed=w.route_rows([row],self.config,NOW)
        self.assertEqual(routed[0]['class_dates'],{'LỚP GIẢ':'2026-10-15'})
        row['class_name']='HSA';self.assertEqual(w.route_rows([row],self.config,NOW),[])
        row=f.row();row['lesson_date']='2026-10-16';self.assertEqual(w.route_rows([row],self.config,NOW),[])
        row['lesson_date']='2026-10-14';self.assertEqual(w.route_rows([row],self.config,NOW),[])
        self.config['classes']['LỚP GIẢ']['dates']=[]
        with self.assertRaises(w.p.GateError):w.route_rows([f.row()],self.config,NOW)

    def test_explicit_shared_class_dates_and_tuesday(self):
        self.config['classes'].update({'LỚP GIẢ 2':{'enabled':True,'dates':['2026-10-16']}})
        self.config['shared_lessons']=[{'source_class':'LỚP GIẢ','source_date':'2026-10-15','classDates':{'LỚP GIẢ 2':'2026-10-16'}}]
        row=w.route_rows([f.row()],self.config,NOW)[0]
        self.assertEqual(row['class_dates']['LỚP GIẢ 2'],'2026-10-16')
        config=json.loads((HERE/'config.example.json').read_text(encoding='utf-8'))
        row=f.row();row.update(class_name='2K10 9+',lesson_date='2026-10-20')
        result=w.route_rows([row],config,NOW.replace(day=20))[0]
        self.assertEqual(result['class_dates']['2K10 Thứ 3, 6'],'2026-10-20')

    def test_anthropic_native_and_receipt_no_teacher(self):
        image=self.root/'question.png';image.write_bytes(b'fake-question-only')
        class Transport:
            def json(inner,url,value,headers):
                self.assertEqual(url,'https://api.anthropic.com/v1/messages')
                self.assertIn('x-api-key',headers);self.assertNotIn('Authorization',headers)
                self.assertEqual(value['messages'][0]['content'][1]['type'],'image')
                self.assertNotIn('ĐÁP ÁN',json.dumps(value,ensure_ascii=False))
                return {'id':'msg_fake','model':'fake-actual','stop_reason':'end_turn','content':[{'type':'text','text':'{"certain":true}'}],'usage':{'input_tokens':2}}
        ai=w.NativeAI(Transport(),{'provider':'anthropic','model':'fake','url':'https://api.anthropic.com/v1/messages','key_env':'FAKE_KEY'})
        with patch.dict(os.environ,{'FAKE_KEY':'not-real'}):self.assertTrue(ai.ask('Giải độc lập','Câu giả',[image])['certain'])
        self.assertEqual(ai.last_receipt['actual_model'],'fake-actual')

    def test_anthropic_truncation_rejected(self):
        transport=Mock();transport.json.return_value={'stop_reason':'max_tokens'}
        ai=w.NativeAI(transport,{'provider':'anthropic','model':'fake','url':'https://api.anthropic.com/v1/messages','key_env':'FAKE_KEY'})
        with patch.dict(os.environ,{'FAKE_KEY':'not-real'}),self.assertRaises(w.p.GateError):ai.ask('','',[])
        transport.json.return_value={'stop_reason':'end_turn','id':'fake','model':'fake','content':[{'type':'text','text':'{"certain":true}'}]}
        with patch.dict(os.environ,{'FAKE_KEY':'not-real'}),self.assertRaisesRegex(w.p.GateError,'ảnh sạch'):
            ai.ask('Giải độc lập TOÀN BỘ đề','','')

    def test_version_dedup_content_change_and_independent_review(self):
        row=f.row();row['class_dates']={'LỚP GIẢ':'2026-10-15'}
        publisher=f.FakePublisher();reviewer=f.FakeAI(f.review())
        worker=w.VersionWorker(self.config,f.FakeTransport(),publisher,self.root/'db.sqlite',f.FakeAI(f.extracted()),reviewer,extract_pdf_fn=f.fake_pdf)
        self.addCleanup(worker.db.close)
        with patch.object(w.p,'material',w.material_base_wrapper):
            self.assertEqual(worker.process(row),'da_dang')
            self.assertEqual(worker.process(row),'already_published')
            class Changed(f.FakeTransport):
                def request(self,url,**kwargs):return super().request(url,**kwargs)+b' revised'
            worker.transport=Changed()
            self.assertEqual(worker.process(row),'da_dang')
        self.assertEqual(len(publisher.payloads),2)
        self.assertNotEqual(publisher.payloads[0]['lesson_key'],publisher.payloads[1]['lesson_key'])
        self.assertNotIn('ĐÁP ÁN:',reviewer.calls[0][1]);self.assertNotIn('acceptedAnswers',reviewer.calls[0][1])
        self.assertEqual(publisher.payloads[0]['material']['homeworkNote'],'BTVN: Bài giả 1')

    def test_mismatch_blocks_publish(self):
        review=f.review();review['answers']['q2'][1]=True
        row=f.row();row['class_dates']={'LỚP GIẢ':'2026-10-15'}
        publisher=f.FakePublisher()
        worker=w.VersionWorker(self.config,f.FakeTransport(),publisher,self.root/'db.sqlite',f.FakeAI(f.extracted()),f.FakeAI(review),extract_pdf_fn=f.fake_pdf)
        self.addCleanup(worker.db.close)
        self.assertEqual(worker.process(row),'loi');self.assertFalse(publisher.payloads)

    def test_strict_branding_and_lossless_crop(self):
        from PIL import Image,ImageChops
        _,hs=f.fake_pdf(b'',self.root,'hs');_,gv=f.fake_pdf(b'',self.root,'gv')
        original=Image.open(hs[0]).crop((0,0,100,30))
        extraction=f.extracted();extraction.update(branding_verified=True,source_format='worksheet',difficulty_order_verified=True,margin_redactions={'hs':[[]],'gv':[[]]})
        exam,assets=w.strict_assemble(f.row(),self.config,extraction,b'%PDF-fake HS',b'%PDF-fake GV',hs,gv)
        crop=next(a for a in assets if a['path'].endswith('/q1-1.png'))
        actual=Image.open(io.BytesIO(base64.b64decode(crop['data_base64'])))
        self.assertIsNone(ImageChops.difference(original,actual).getbbox())
        self.assertEqual(exam['sourceMaterial']['publisher'],'MTM sưu tầm và biên soạn')
        self.assertNotIn(base64.b64encode(b'%PDF-fake HS').decode(),[a['data_base64'] for a in assets])
        self.assertTrue(w.p.pdf(base64.b64decode(assets[-1]['data_base64'])))
        w.p.validate(exam)
        extraction['margin_redactions']['hs']=[[[0,0,100,10]]]
        with self.assertRaises(w.p.GateError):w.strict_assemble(f.row(),self.config,extraction,b'%PDF-fake HS',b'%PDF-fake GV',hs,gv)

    def test_missing_branding_and_more_than_22_fail(self):
        for mutation in ({},{'branding_verified':True,'source_format':'worksheet','questions':[{}]*23}):
            extraction=f.extracted();extraction.update(mutation)
            with self.assertRaises(w.p.GateError):w.strict_assemble(f.row(),self.config,extraction,b'',b'',[],[])

    def test_local_notify_contract_and_error_dedup(self):
        post=Mock(return_value={'ok':True})
        w.local_notify({'brain':'fake'},'Thông báo giả',post=post)
        self.assertEqual(post.call_args.args[0],{'brain':'fake','mode':'notify','delay_min':0,'text':'Thông báo giả'})
        notify=Mock()
        for _ in range(2):w.report_error({'brain':'fake'},self.root,'row','Lỗi giả',NOW,notify)
        notify.assert_called_once()

    def test_success_digest_only_at_23_no_empty_notice(self):
        notify=Mock();config={'brain':'fake'}
        w.flush_notifications(config,self.root,['Lớp giả; buổi giả'],NOW,notify)
        notify.assert_not_called()
        w.flush_notifications(config,self.root,[],NOW.replace(hour=23),notify)
        notify.assert_called_once()
        w.flush_notifications(config,self.root,[],NOW.replace(hour=23),notify)
        notify.assert_called_once()

    def test_failed_notice_stays_pending(self):
        notify=Mock(side_effect=OSError('fake'))
        w.flush_notifications({'brain':'fake'},self.root,['Bài giả'],NOW.replace(hour=23),notify)
        self.assertEqual(json.loads((self.root/'notifications.json').read_text(encoding='utf-8'))['success'],['Bài giả'])
        w.report_error({'brain':'fake'},self.root,'fake','Lỗi giả',NOW,notify)
        self.assertTrue((self.root/'notification-pending.json').is_file())

    def test_end_date_blocks_publish_again(self):
        transport=Mock()
        publisher=w.JavisPublisher(transport,'https://fake.invalid')
        with patch.object(r,'now_vn',return_value=dt.datetime(2027,10,16,7,tzinfo=r.VN)),self.assertRaises(w.p.GateError):publisher.publish({})
        transport.json.assert_not_called()

    def test_batch_writes_receipt_no_new_silent(self):
        with patch.object(w.p,'read_material_rows',return_value=[]),patch.object(w,'local_notify') as notify,patch.object(r,'now_vn',return_value=NOW):
            result=w.run_batch(self.config,f.FakeTransport(),f.FakePublisher(),self.root,NOW)
        self.assertEqual(result['items'],[]);notify.assert_not_called()
        self.assertEqual(len(list((self.root/'receipts').glob('*.json'))),1)

    def test_bad_calendar_does_not_block_independent_class(self):
        bad=f.row();bad['class_name']='LỚP LỖI';bad['lesson_key']='btvn-fake-bad'
        self.config['classes']['LỚP LỖI']={'enabled':True,'dates':[]}
        with patch.object(w.p,'read_material_rows',return_value=[bad,f.row()]),patch.object(w.VersionWorker,'process',return_value='already_published') as process,patch.object(w,'report_error'),patch.object(r,'now_vn',return_value=NOW):
            w.VersionWorker.last_key='fake';w.VersionWorker.last_reason=None;w.VersionWorker.last_source_version=None
            result=w.run_batch(self.config,f.FakeTransport(),f.FakePublisher(),self.root,NOW)
        self.assertEqual(process.call_count,1)
        self.assertEqual([x['status'] for x in result['items']],['loi','already_published'])

    def test_first_install_target_not_system(self):
        with patch.object(r.importlib,'import_module',side_effect=[ImportError()]+[Mock()]*5),patch.object(r.subprocess,'run',return_value=types.SimpleNamespace(returncode=0)) as run:
            r.ensure_dependencies(self.root)
        argv=run.call_args.args[0]
        self.assertIn('--target',argv);self.assertIn(str(self.root/'lib'),argv)

    def test_pdfium_200dpi_markers_and_exact_crop(self):
        from PIL import Image,ImageChops
        from pypdf import PdfReader,PdfWriter
        import pypdfium2 as pdfium
        repo=r.pipeline_dir().parents[1]
        catalog=json.loads((repo/'src/native/exams/catalog.json').read_text(encoding='utf-8'))
        source=PdfReader(str(repo/'public'/catalog[0]['sourcePdf']['url'].lstrip('/')))
        writer=PdfWriter();writer.add_page(next(pg for pg in source.pages if w.p.re.search(r'(?:Câu|Cau)\s*\d+',pg.extract_text() or '')))
        raw=io.BytesIO();writer.write(raw)
        text,pages=w.p.extract_pdf(raw.getvalue(),self.root,'real')
        with pdfium.PdfDocument(raw.getvalue()) as document:
            page=document[0]
            try:width,height=page.get_size()
            finally:page.close()
        with Image.open(pages[0]) as image:
            self.assertLess(abs(image.width-width*200/72),1.1)
            self.assertLess(abs(image.height-height*200/72),1.1)
            markers=json.loads((self.root/'real-markers.json').read_text(encoding='utf-8'))
            self.assertTrue(markers)
            self.assertTrue(all(0<=m['x']<image.width and 0<=m['y']<image.height for m in markers))
            assets=[];w.p.crop_segments([{'page':1,'x':20,'y':20,'width':200,'height':150}],pages,'btvn/fake/q1',assets)
            actual=Image.open(io.BytesIO(base64.b64decode(assets[0]['data_base64'])))
            self.assertIsNone(ImageChops.difference(image.crop((20,20,220,170)),actual).getbbox())

    def test_reviewer_whitelist_drops_unknown_teacher_fields(self):
        extraction=f.extracted();extraction['questions'][0]['teacherKey']='DO_NOT_LEAK'
        reviewer=f.FakeAI(f.review());row=f.row();row['class_dates']={'LỚP GIẢ':'2026-10-15'}
        worker=w.VersionWorker(self.config,f.FakeTransport(),f.FakePublisher(),self.root/'db.sqlite',f.FakeAI(extraction),reviewer,validator=lambda exam:None,extract_pdf_fn=f.fake_pdf)
        self.addCleanup(worker.db.close)
        self.assertEqual(worker.process(row),'da_dang')
        self.assertNotIn('DO_NOT_LEAK',reviewer.calls[0][1])

    def test_retry_error_outbox(self):
        w.report_error({'brain':'fake'},self.root,'a','Lỗi A',NOW,Mock(side_effect=OSError()))
        w.report_error({'brain':'fake'},self.root,'b','Lỗi B',NOW,Mock(side_effect=OSError()))
        notify=Mock();w.retry_errors({'brain':'fake'},self.root,notify)
        self.assertEqual(notify.call_count,2)
        self.assertEqual(json.loads((self.root/'notification-pending.json').read_text(encoding='utf-8')), {})


if __name__=='__main__':unittest.main()
