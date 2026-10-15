"""Đợt 26, chỉ dữ liệu giả và AI giả; không mạng."""
import copy
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from test_pipeline import p, row, extracted, review, FakeAI, FakePublisher, FakeTransport, fake_pdf

TEXT='Ly thuyet\nNoi dung ly thuyet gia.\nVi du\nCau 1. Vi du co loi giai mau.\nBTVN\n'+''.join(f'Cau {n}. Bai tap gia {n}.\n' for n in range(15,36))
GV='BTVN\n'+''.join(f'Cau {n}. Dap an gia {n}.\n' for n in range(15,36))

class ScopeTests(unittest.TestCase):
    def resolve(self,note='',text=TEXT,answer=None):
        r=row();r['homework_scope']=note
        ai=FakeAI(answer or {'start_question':15,'end_question':35,'heading':'btvn','confidence':.95})
        return p.resolve_scope(r,text,[Path('fake.png')],ai),r,ai

    def test_range_syntax(self):
        for note in ('Câu 15-35','câu 15 đến 35','Từ câu 15','15-35'):
            with self.subTest(note=note):
                scope,r,ai=self.resolve(note)
                self.assertEqual([q['number'] for q in scope['selected']],list(range(15,36)))
                self.assertEqual(r['homeworkScopeSource'],'sheet');self.assertFalse(ai.calls)
        scope,_,_=self.resolve('Câu 15-17, 21-23')
        self.assertEqual([q['number'] for q in scope['selected']],[15,16,17,21,22,23])

    def test_section_and_heading(self):
        for name in ('BTVN','Bài tập về nhà','Phần III'):
            text=TEXT.replace('BTVN',name)
            scope,_,_=self.resolve(name,text)
            self.assertEqual(len(scope['selected']),21)
        scope,_,_=self.resolve('Bài tập về nhà',TEXT.replace('BTVN','III. Bài tập về nhà'))
        self.assertEqual(len(scope['selected']),21)

    def test_pages(self):
        text='Cau 1. Test\fCau 2. Test\fCau 3. Test'
        scope=p.resolve_scope({'homework_scope':'Trang 2-3'},text,[0,0,0],FakeAI({}))
        self.assertEqual([q['number'] for q in scope['selected']],[2,3])

    def test_invalid_ranges_hold(self):
        for note in ('Câu 35-15','Câu 0-2','Câu 14-35','Trang 5-7','Phần IV','Câu 15-17, 17-20','15 xyz','Câu 999999'):
            with self.subTest(note=note),self.assertRaises(p.GateError):self.resolve(note)
        with self.assertRaises(p.GateError):self.resolve('Câu 1',TEXT+'Cau 1. Duplicate')

    def test_auto_and_low_confidence(self):
        scope,r,ai=self.resolve()
        self.assertEqual(scope['scope_source'],'auto');self.assertEqual(len(scope['selected']),21)
        self.assertNotIn('ĐÁP ÁN',ai.calls[0][1])
        scope,_,_=self.resolve(answer={'confidence':.4})
        self.assertEqual(scope['scope_source'],'whole_file')
        scope,_,ai=self.resolve(text='Cau 1. Exercise only\nCau 2. Exercise only')
        self.assertEqual(scope['scope_source'],'whole_file');self.assertFalse(ai.calls)
        with self.assertRaises(p.GateError):self.resolve(answer={'start_question':1,'end_question':35,'heading':'btvn','confidence':.99})

    def test_heading_variants_and_subsections(self):
        for heading in ('BÀI TẬP VỀ NHÀ','BTVN','Bài tập rèn luyện','Luyện tập về nhà','Phần bài tập'):
            scope,_,_=self.resolve(text=TEXT.replace('BTVN',heading),answer={'start_question':15,'end_question':35,'heading':p.scope_text(heading),'confidence':.9})
            self.assertEqual(scope['scope_source'],'auto')
        text=TEXT.replace('BTVN','BTVN\nPhần III')
        scope,_,_=self.resolve(text=text,answer={'start_question':15,'end_question':35,'heading':'phan iii','confidence':.9})
        self.assertEqual(len(scope['selected']),21)
        scope,_,_=self.resolve('BTVN',text)
        self.assertEqual(len(scope['selected']),21)

    def test_numbered_run_after_examples(self):
        text=TEXT.replace('BTVN\n','')
        scope,_,_=self.resolve(text=text,answer={'start_question':15,'end_question':35,'heading':'vi du','confidence':.93})
        self.assertEqual([q['number'] for q in scope['selected']],list(range(15,36)))
        self.assertEqual(scope['scope_source'],'auto')

    def test_confirmation_cannot_leak_keys_to_reviewer(self):
        scope,_,_=self.resolve(answer={'start_question':15,'end_question':35,'heading':'btvn','confidence':.95,'answers':{'q1':'B'}})
        self.assertNotIn('answers',scope['confirmation'])

    def test_no_null_scope_on_early_error_material(self):
        self.assertNotIn('homeworkScope',p.material(row()))
        self.assertNotIn('homeworkScopeSource',p.material(row()))

    def test_exercise_only_heading_is_whole_file(self):
        scope,_,ai=self.resolve(text='BTVN\nCau 1. Exercise only\nCau 2. Exercise only')
        self.assertEqual(scope['scope_source'],'whole_file');self.assertFalse(ai.calls)

    def test_named_section_includes_subsections(self):
        scope,_,_=self.resolve('Phần III','Phần III\nMục 1\nCau 15. Test\nMục 2\nCau 16. Test\nPhần IV\nCau 17. Outside')
        self.assertEqual([q['number'] for q in scope['selected']],[15,16])

    def test_sheet_headers_all_readers(self):
        config=p.load_config(Path(__file__).resolve().parents[1]/'config.example.json');sheet=config['sheets'][0]
        for header in ('Phạm vi BTVN','GHI CHÚ BTVN','btvn tu cau','PHAM VI'):
            csv=f'Lớp,Ngày,Bài,Tài liệu,Handout,Video xem lại,BTVN,Đáp án BTVN,{header}\nLỚP GIẢ,2026-10-15,Bài giả,,,,https://pdf.example.invalid/hs.pdf,https://pdf.example.invalid/gv.pdf,Câu 15-35\n'
            self.assertEqual(p.sheet_rows(csv.encode(),sheet)[0]['homework_scope'],'Câu 15-35')
            cells=[{'formattedValue':v} for v in csv.splitlines()[0].split(',')]
            values=[{'formattedValue':v,'hyperlink':v if v.startswith('https://') else None} for v in csv.splitlines()[1].split(',')]
            grid={'sheets':[{'data':[{'rowData':[{'values':cells},{'values':values}]}]}]}
            self.assertEqual(p.sheet_rows(json.dumps(grid).encode(),{**sheet,'format':'grid'})[0]['homework_scope'],'Câu 15-35')
        from openpyxl import Workbook
        book=Workbook();book.active.title='Fake';book.active.append(csv.splitlines()[0].split(','));book.active.append(csv.splitlines()[1].split(','))
        data=io.BytesIO();book.save(data);book.close()
        self.assertEqual(p.sheet_rows(data.getvalue(),{**sheet,'format':'xlsx','name':'Fake','range':'A1:I2','material_only_workbook':True})[0]['homework_scope'],'Câu 15-35')
        with self.assertRaises(p.GateError):p.sheet_rows(csv.replace(header,header+',Ghi chú BTVN').encode(),sheet)

    def test_answer_mapping_and_missing_count(self):
        scope,_,_=self.resolve('Câu 15-16')
        data={'questions':[{'source_number':n,'source_page':1,'answer_source_number':n,'answer_source_page':1} for n in (15,16)]}
        p.validate_scope(data,scope,GV)
        for bad in ({'questions':data['questions'][:1]}, {'questions':list(reversed(data['questions']))}):
            with self.assertRaises(p.GateError):p.validate_scope(bad,scope,GV)
        data['questions'][0]['answer_source_number']=1
        with self.assertRaises(p.GateError):p.validate_scope(data,scope,GV)
        data['questions'][0]['answer_source_number']=15
        with self.assertRaises(p.GateError):p.validate_scope(data,scope,GV.replace('Cau 15.','Cau 99.'))

    def test_actual_synthetic_pdf_positions(self):
        from reportlab.pdfgen import canvas
        with tempfile.TemporaryDirectory() as temp:
            raw=io.BytesIO();c=canvas.Canvas(raw,pagesize=(300,400))
            for y,line in zip(range(380,40,-20),['Ly thuyet','Noi dung ly thuyet gia day du chu.','Vi du','Cau 1. Vi du co loi giai mau.','BTVN','Cau 15. Bai tap ve nha gia.','Cau 16. Bai tap ve nha gia.']):c.drawString(10,y,line)
            c.save();text,pages=p.extract_pdf(raw.getvalue(),Path(temp),'hs')
            markers=json.loads((Path(temp)/'hs-markers.json').read_text(encoding='utf-8'))
            scope=p.resolve_scope({},text,pages,FakeAI({'start_question':15,'end_question':16,'heading':'btvn','confidence':.95}),markers)
            self.assertEqual(scope['scope_source'],'auto');self.assertIn('y',scope['selected'][0])
            data={'questions':[{'source_number':n,'source_page':1,'answer_source_number':n,'answer_source_page':1} for n in (15,16)]}
            p.validate_scope(data,scope,GV)
            p.validate_scope(data,scope,text,markers)
            data['questions'][0]['solutionCrops']=[{'page':1,'y':scope['selected'][1]['y'],'height':10}]
            with self.assertRaises(p.GateError):p.validate_scope(data,scope,text,markers)
            data['questions'][0].pop('solutionCrops')
            data['questions'][0]['questionCrops']=[{'page':1,'y':0,'height':10}]
            with self.assertRaises(p.GateError):p.validate_scope(data,scope,GV)

class ScopeWorkerTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.config=p.load_config(Path(__file__).resolve().parents[1]/'config.example.json')
        self.pub=FakePublisher();self.source=row();self.source['homework_scope']='Câu 15-17'
        self.data=extracted()
        for n,q in enumerate(self.data['questions'],15):q.update(source_number=n,source_page=1,answer_source_number=n,answer_source_page=1)
        self.ai=FakeAI(self.data);self.reviewer=FakeAI(review())
        def pdf(raw,d,tag):
            _,pages=fake_pdf(raw,d,tag)
            return ('BTVN\n'+''.join(f'Cau {n}. Synthetic question and answer.\n' for n in range(15,18))),pages
        self.worker=p.Worker(self.config,FakeTransport(),self.pub,Path(self.temp.name)/'state.sqlite',self.ai,self.reviewer,validator=lambda _:None,extract_pdf_fn=pdf)
        self.addCleanup(self.worker.db.close)

    def test_publish_selected_and_receipt(self):
        self.assertEqual(self.worker.process(self.source),'da_dang')
        payload=self.pub.payloads[0]
        self.assertEqual(payload['material']['homeworkScope'],'Câu 15-17')
        self.assertEqual(payload['material']['homeworkScopeSource'],'sheet')
        self.assertEqual([q['id'] for q in payload['exam']['questions']],['q1','q2','q3'])
        receipt=json.loads(self.worker.db.execute('SELECT receipt FROM receipts').fetchone()[0])
        self.assertEqual(receipt['scope_source'],'sheet')
        self.assertIn('chỉ giải',self.reviewer.calls[0][0].lower())
        self.assertEqual(self.worker.process(self.source),'already_published')
        self.source['homework_scope']='Câu 15-16'
        self.assertEqual(self.worker.process(self.source),'loi');self.assertEqual(len(self.pub.payloads),1)

    def test_invalid_scope_no_publish_no_review(self):
        self.source['homework_scope']='Câu 50-60'
        self.assertEqual(self.worker.process(self.source),'loi')
        self.assertFalse(self.pub.payloads);self.assertFalse(self.reviewer.calls)
        self.assertIn('Phạm vi',self.pub.errors[0]['reason'])

    def test_mismatched_answer_hold(self):
        self.data['questions'][0]['answer_source_number']=1
        self.assertEqual(self.worker.process(self.source),'loi');self.assertFalse(self.pub.payloads);self.assertFalse(self.reviewer.calls)

    def test_auto_worker_only_selected_questions(self):
        self.source.pop('homework_scope')
        original_pdf=self.worker.extract_pdf
        def mixed_pdf(raw,d,tag):
            text,pages=original_pdf(raw,d,tag)
            return ('Ly thuyet\nNoi dung gia.\nVi du\nCau 1. Vi du co loi giai mau.\n'+text if tag=='hs' else text),pages
        self.worker.extract_pdf=mixed_pdf
        original_ask=self.ai.ask
        def ask(instruction,*args):
            if instruction.startswith('Xác nhận ranh giới'):
                return {'start_question':15,'end_question':17,'heading':'btvn','confidence':.96}
            return original_ask(instruction,*args)
        self.ai.ask=ask
        self.assertEqual(self.worker.process(self.source),'da_dang')
        payload=self.pub.payloads[0]
        self.assertEqual(payload['material']['homeworkScopeSource'],'auto')
        self.assertEqual([q['source_number'] for q in payload['exam']['questions']],[15,16,17])

    def test_selected_count_mismatch_hold(self):
        self.source['homework_scope']='Câu 15-16'
        self.assertEqual(self.worker.process(self.source),'loi')
        self.assertIn('Số câu',self.pub.errors[0]['reason'])
        self.assertFalse(self.pub.payloads);self.assertFalse(self.reviewer.calls)

    def test_whole_file_receipt(self):
        self.source.pop('homework_scope')
        self.worker.extract_pdf=fake_pdf
        self.assertEqual(self.worker.process(self.source),'da_dang')
        receipt=json.loads(self.worker.db.execute('SELECT receipt FROM receipts').fetchone()[0])
        self.assertEqual(receipt['scope_source'],'whole_file')
        self.assertEqual(self.pub.payloads[0]['material']['homeworkScopeSource'],'whole_file')

if __name__=='__main__':unittest.main()
