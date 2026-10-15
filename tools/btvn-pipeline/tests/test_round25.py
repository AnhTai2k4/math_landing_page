"""Đợt 25: offline, synthetic sources and AI; never contacts providers."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from test_pipeline import p, row, FakePublisher, FakeTransport, FakeAI, extracted, review, fake_pdf


class TitleTests(unittest.TestCase):
    def setUp(self):
        temp=tempfile.TemporaryDirectory();self.addCleanup(temp.cleanup)
        self.config=p.load_config(Path(__file__).resolve().parents[1]/'config.example.json')
        self.api=Mock();self.api.last_receipt=None;self.api.ask.return_value={'title':'Phương trình lượng giác cơ bản','confidence':.94,'sources_used':['homework']}
        self.publisher=FakePublisher();self.transport=FakeTransport()
        self.worker=p.Worker(self.config,self.transport,self.publisher,Path(temp.name)/'state.sqlite',self.api,FakeAI(review()),validator=lambda _:None,extract_pdf_fn=fake_pdf)
        self.addCleanup(self.worker.db.close)
        self.source=row();self.source.update(title='',sheet_title='',homework_labels=['Đề lượng giác số 1'])

    def test_specific_sheet_unchanged_no_ai_or_downloads(self):
        self.source.update(sheet_title='  Tích vô hướng của hai vectơ  ')
        self.worker.resolve_title(self.source)
        self.assertEqual(self.source['title'],self.source['sheet_title'])
        self.assertEqual(self.source['titleSource'],'sheet');self.api.ask.assert_not_called()
        self.assertEqual(self.transport.calls,[])

    def test_blank_calls_ai_once_and_persists_across_restart(self):
        with patch.object(p,'pdf_title_text',return_value='Phương trình sin x = a'):
            self.worker.resolve_title(self.source)
            again=copy.deepcopy(self.source);self.worker.resolve_title(again)
        self.assertEqual(self.source['title'],'Phương trình lượng giác cơ bản')
        self.assertEqual(self.source['titleSource'],'auto');self.assertEqual(self.api.ask.call_count,1)
        self.assertIn('homework',json.loads(self.api.ask.call_args.args[1]))
        self.assertEqual(self.api.ask.call_args.args[2],[])
        clone=p.Worker(self.config,self.transport,self.publisher,self.worker.db.execute('PRAGMA database_list').fetchone()[2],self.api,FakeAI(review()))
        try:
            with patch.object(p,'pdf_title_text',return_value='Phương trình sin x = a'):clone.resolve_title(copy.deepcopy(self.source))
        finally:clone.db.close()
        self.assertEqual(self.api.ask.call_count,1)

    def test_ai_failure_low_confidence_and_bad_contract_fallback(self):
        for result in (RuntimeError('fake-only'),{'title':'Phương trình lượng giác','confidence':.2,'sources_used':['homework']},{'title':'Bịa','confidence':1,'sources_used':['not-present']},{'title':'Tên bài học hợp lệ','confidence':True,'sources_used':['homework']},{'title':'Tên bài học hợp lệ','confidence':float('nan'),'sources_used':['homework']}):
            with self.subTest(result=str(result)):
                self.worker.db.execute('DELETE FROM title_sync')
                self.api.ask.side_effect=result if isinstance(result,Exception) else None
                self.api.ask.return_value=result
                with patch.object(p,'pdf_title_text',return_value='Nội dung Toán giả'):
                    self.worker.resolve_title(self.source)
                self.assertEqual(self.source['title'],'Đề lượng giác số 1')

    def test_no_sources_no_ai_and_date_last_fallback(self):
        self.source['homework_labels']=['https://fake.invalid/hs.pdf']
        with patch.object(p,'pdf_title_text',side_effect=ValueError):self.worker.resolve_title(self.source)
        self.assertEqual(self.source['title'],'Buổi học 2026-10-15');self.api.ask.assert_not_called()

    def test_first_publish_uses_auto_title_without_changing_question_content(self):
        extract_ai=FakeAI(extracted())
        def ask(instruction,*args):
            if instruction==p.TITLE_PROMPT:return {'title':'Phương trình lượng giác cơ bản','confidence':.9,'sources_used':['homework']}
            return extract_ai.ask(instruction,*args)
        self.api.ask.side_effect=ask
        self.assertEqual(self.worker.process(self.source),'da_dang')
        payload=self.publisher.payloads[0]
        self.assertEqual(payload['material']['titleSource'],'auto')
        self.assertEqual(payload['material']['title'],'Phương trình lượng giác cơ bản')
        self.assertEqual(payload['exam']['questions'][0]['answer'],'B')
        self.assertEqual(len(payload['exam']['questions']),3)
        calls=self.api.ask.call_count
        with patch.object(p,'pdf_title_text',return_value='Khác khoảng trắng so với PDFium'):
            self.assertEqual(self.worker.process(self.source),'already_published')
        self.assertEqual(self.api.ask.call_count,calls)

    def test_handout_and_video_can_be_only_usable_sources(self):
        for key in ('handout','document','video'):
            with self.subTest(key=key):
                source=copy.deepcopy(self.source);source['lesson_key']+='-'+key
                source[key]='https://pdf.example.invalid/handout.pdf' if key!='video' else 'https://youtu.be/abcdefghijk'
                self.api.ask.return_value={'title':'Phương trình lượng giác cơ bản','confidence':.9,'sources_used':[key]}
                with patch.object(p,'pdf_title_text',side_effect=['','Phương trình lượng giác'] if key!='video' else ['']),patch.object(p,'video_title',return_value='Phương trình lượng giác'):
                    self.worker.resolve_title(source)
                self.assertEqual(source['title'],'Phương trình lượng giác cơ bản')
                self.assertEqual(list(json.loads(self.api.ask.call_args.args[1])),[key])

    def test_generic_titles_only(self):
        for title in ('','chữa BTVN','Buổi 1','buổi học 12','ôn tập','Luyện tập','BTVN'):
            self.assertTrue(p.generic_title(title),title)
        for title in ('Ôn tập hàm số','Chữa BTVN lượng giác','Tích vô hướng của hai vectơ'):
            self.assertFalse(p.generic_title(title),title)

    def test_sheet_parser_retains_blank(self):
        csv='Lớp,Ngày,Bài,Tài liệu,Handout,Video xem lại,BTVN,Đáp án BTVN\nLỚP GIẢ,2026-10-15,,,,,https://pdf.example.invalid/hs.pdf,https://pdf.example.invalid/gv.pdf\n'
        parsed=p.sheet_rows(csv.encode(),self.config['sheets'][0])[0]
        self.assertEqual(parsed['sheet_title'],'')

    def test_published_generic_title_only_patch_retry_and_no_exam_change(self):
        source=self.source;source['title']='chữa BTVN'
        self.publisher.rows[source['lesson_key']]='da_dang'
        old=p.material(source)
        self.worker.save_material(source)
        with patch.object(p,'pdf_title_text',return_value='Phương trình lượng giác'):
            with patch.object(self.publisher,'update_material',side_effect=p.GateError('Lỗi giả')):
                self.assertEqual(self.worker.process(source),'loi')
            self.assertEqual(self.worker.process(source),'updated')
            self.assertEqual(self.worker.process(source),'already_published')
        self.assertEqual(self.publisher.updates,[(source['lesson_key'],{'title':'Phương trình lượng giác cơ bản','titleSource':'auto'})])
        self.assertEqual(self.api.ask.call_count,1);self.assertEqual(self.publisher.payloads,[])
        self.assertEqual(self.publisher.errors,[])
        self.assertEqual(old['title'],'chữa BTVN')

    def test_late_handout_video_and_same_url_pdf_changes(self):
        with patch.object(p,'pdf_title_text',return_value='Lượng giác'),patch.object(p,'video_title',return_value='Phương trình lượng giác'):
            self.worker.resolve_title(self.source)
            self.source['handout']='https://pdf.example.invalid/handout.pdf'
            self.worker.resolve_title(self.source);self.assertEqual(self.api.ask.call_count,2)
            self.source['video']='https://youtu.be/abcdefghijk'
            self.worker.resolve_title(self.source);self.assertEqual(self.api.ask.call_count,3)
            self.worker.resolve_title(self.source);self.assertEqual(self.api.ask.call_count,3)
            with patch.object(self.transport,'request',return_value=b'%PDF-CHANGED CONTENT'):
                self.worker.resolve_title(self.source);self.assertEqual(self.api.ask.call_count,4)
        text=json.loads(self.api.ask.call_args.args[1]);self.assertIn('handout',text);self.assertIn('video',text)

    def test_sheet_title_never_renamed_when_sheet_cleared(self):
        self.source.update(title='Tích vô hướng của hai vectơ',titleSource='sheet')
        self.worker.save_material(self.source)
        self.worker.resolve_title(self.source)
        self.assertEqual(self.source['title'],'Tích vô hướng của hai vectơ');self.api.ask.assert_not_called()

    def test_temporary_download_failure_keeps_auto_title(self):
        with patch.object(p,'pdf_title_text',return_value='Phương trình lượng giác'):
            self.worker.resolve_title(self.source)
            with patch.object(self.transport,'request',side_effect=OSError('fake outage')):
                self.worker.resolve_title(self.source)
            self.worker.resolve_title(self.source)
        self.assertEqual(self.source['title'],'Phương trình lượng giác cơ bản')
        self.assertEqual(self.api.ask.call_count,1)

    def test_video_metadata_hosts_and_scoped_auth(self):
        transport=Mock();transport.request.return_value=b'{"title":"Phuong trinh luong giac"}'
        self.assertEqual(p.video_title('https://youtu.be/abcdefghijk',self.config,transport),'Phuong trinh luong giac')
        url=transport.request.call_args.args[0];self.assertTrue(url.startswith('https://www.youtube.com/oembed?'))
        self.assertEqual(transport.request.call_args.kwargs['headers'],{})
        config=copy.deepcopy(self.config);config['allowed_hosts'].remove('www.youtube.com')
        transport.reset_mock()
        with self.assertRaises(p.GateError):p.video_title('https://youtu.be/abcdefghijk',config,transport)
        transport.request.assert_not_called()
        config['allowed_hosts'].append('www.googleapis.com')
        transport.request.return_value=b'{"name":"Tich vo huong hai vecto"}'
        self.assertEqual(p.video_title('https://drive.google.com/file/d/fake-video-123/view',config,transport),'Tich vo huong hai vecto')
        self.assertIn('?fields=name',transport.request.call_args.args[0])
        with self.assertRaises(p.GateError):p.video_title('https://drive.google.com/drive/folders/fake-folder-123',config,transport)
        self.assertEqual(p.video_title('https://evil.invalid/video',config,transport),'')


if __name__=='__main__':unittest.main()
