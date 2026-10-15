import copy
import unittest
from unittest.mock import Mock,patch
import test_javis as fixture
w,f=fixture.w,fixture.f


class VersionTitleTests(unittest.TestCase):
    setUp=fixture.JavisTests.setUp

    def test_version_key_retained_title_only_no_republish(self):
        source=f.row();source.update(sheet_title='',title='chữa BTVN',homework_labels=['Đề lượng giác'])
        source['class_dates']={source['class_name']:source['lesson_date']}
        publisher=f.FakePublisher();transport=f.FakeTransport()
        ai=Mock();ai.last_receipt=None;ai.ask.return_value={'title':'Phương trình lượng giác cơ bản','confidence':.9,'sources_used':['homework']}
        worker=w.VersionWorker(self.config,transport,publisher,self.root/'title.sqlite',ai,f.FakeAI(f.review()),validator=lambda _:None,extract_pdf_fn=f.fake_pdf)
        self.addCleanup(worker.db.close)
        key=source['lesson_key']+'-v-'+'a'*40
        hs=w.p.download_homework(source,self.config,transport);gv=w.p.download_pdf(source['answers'],self.config,transport)
        version=w.p.digest(hs+gv)
        worker.db.execute('INSERT INTO receipts VALUES (?,?,?,?)',(key,'da_dang',version,'{}'));worker.db.commit()
        old=copy.deepcopy(source);old['lesson_key']=key;worker.save_material(old)
        with patch.object(w.p,'pdf_title_text',return_value='Phương trình lượng giác'):
            self.assertEqual(worker.process(source),'updated')
            self.assertEqual(worker.process(source),'already_published')
        self.assertEqual(worker.last_key,key)
        self.assertEqual(publisher.updates,[(key,{'title':'Phương trình lượng giác cơ bản','titleSource':'auto'})])
        self.assertEqual(publisher.payloads,[]);self.assertEqual(ai.ask.call_count,1)

    def test_google_video_metadata_sa_host_only(self):
        transport=w.GoogleTransport(['www.googleapis.com','www.youtube.com'],'FAKE-SA-NOT-READ')
        config={'allowed_hosts':['www.googleapis.com','www.youtube.com']}
        with patch.object(w,'google_token',return_value='FAKE-ONLY') as token,patch.object(w.p.Transport,'request',return_value=b'{"name":"Phuong trinh luong giac"}') as request:
            self.assertEqual(w.p.video_title('https://drive.google.com/file/d/fake-video-123/view',config,transport),'Phuong trinh luong giac')
            token.assert_called_once();self.assertEqual(request.call_args.args[2]['Authorization'],'Bearer FAKE-ONLY')
            request.return_value=b'{"title":"Tich vo huong hai vecto"}'
            with patch.object(w.p,'material',side_effect=AssertionError('Không phụ thuộc hook material')):
                w.p.video_title('https://youtu.be/abcdefghijk',config,transport)
            self.assertNotIn('Authorization',request.call_args.args[2])


if __name__=='__main__':unittest.main()
