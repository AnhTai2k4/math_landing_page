import json
import unittest
from unittest.mock import patch
import test_javis as fixture
w,f=fixture.w,fixture.f


class VersionScopeTests(unittest.TestCase):
    setUp=fixture.JavisTests.setUp

    def make_worker(self):
        source=f.row();source['class_dates']={source['class_name']:source['lesson_date']}
        source['homework_scope']='Câu 15-17'
        data=f.extracted()
        for n,q in enumerate(data['questions'],15):q.update(source_number=n,source_page=1,answer_source_number=n,answer_source_page=1)
        def pdf(raw,d,tag):
            _,pages=f.fake_pdf(raw,d,tag)
            return 'BTVN\n'+''.join(f'Cau {n}. Synthetic exercise and answer.\n' for n in (15,16,17)),pages
        pub=f.FakePublisher()
        worker=w.VersionWorker(self.config,f.FakeTransport(),pub,self.root/'scope.sqlite',f.FakeAI(data),f.FakeAI(f.review()),validator=lambda _:None,extract_pdf_fn=pdf)
        self.addCleanup(worker.db.close)
        return source,data,pub,worker

    def test_scope_and_title_hooks_publish_then_retain_version(self):
        source,_,pub,worker=self.make_worker()
        with patch.object(w.p,'material',w.material_base_wrapper):
            self.assertEqual(worker.process(source),'da_dang');key=worker.last_key
            self.assertEqual(worker.process(source),'already_published');self.assertEqual(worker.last_key,key)
        self.assertEqual(len(pub.payloads),1)
        self.assertEqual(pub.payloads[0]['material']['homeworkScopeSource'],'sheet')
        self.assertEqual(pub.payloads[0]['material']['classDates'],source['class_dates'])
        receipt=json.loads(worker.db.execute('SELECT receipt FROM receipts').fetchone()[0])
        self.assertEqual(receipt['scope_source'],'sheet')

    def test_changed_scope_on_published_source_holds(self):
        source,_,pub,worker=self.make_worker()
        self.assertEqual(worker.process(source),'da_dang')
        source['homework_scope']='Câu 15-16'
        self.assertEqual(worker.process(source),'loi')
        self.assertIn('Phạm vi BTVN đã đổi',worker.last_reason)
        self.assertEqual(len(pub.payloads),1);self.assertEqual(pub.updates,[])

    def test_answer_mismatch_no_publish(self):
        source,data,pub,worker=self.make_worker()
        data['questions'][0]['answer_source_number']=1
        self.assertEqual(worker.process(source),'loi');self.assertEqual(pub.payloads,[])


if __name__=='__main__':unittest.main()
