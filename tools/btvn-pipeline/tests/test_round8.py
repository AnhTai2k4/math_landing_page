import copy,json,unittest,tempfile,io
from pathlib import Path
from unittest.mock import patch
from test_pipeline import p,ROOT,extracted,review,row,FakeAI,FakeTransport,FakePublisher,fake_pdf

class Round8(unittest.TestCase):
    def sheet(self):
        return {'id':'FAKE','format':'grid','school_year':{'start_year':2026,'start_month':7},'columns':{'lesson_date':'Ngày Dạy','class_name':'Lớp','title':'Tên bài học','document':'Tài liệu buổi học (HS)','handout':'Handout','video':'Record','homework':'BTVN','answers':'Đáp án BTVN'}}
    def grid(self):
        headers=['Ngày Dạy','Giáo Viên','Lớp','Tên bài học','Trạng thái','Tài liệu buổi học (hs','Tài liệu buổi học (GV)','Handout','Record','BTVN','Đáp án BTVN','Link nộp btvn','bảng điểm']
        def chip(text,url=None):return {'formattedValue':text,**({'chipRuns':[{'chip':{'richLinkProperties':{'uri':url}}}]} if url else {})}
        rows=[list(map(chip,headers)),[chip('8/7'),chip('Giáo viên giả'),chip('2k10 8+ '),chip('Bài giả'),chip(''),chip('HS.pdf','https://pdf.example.invalid/hs.pdf'),chip('GV.pdf'),chip(''),{'formattedValue':'Zoom','hyperlink':'https://us02web.zoom.us/rec/share/fake'},chip('Phần trắc nghiệm trong phiếu'),chip('GV.pdf','https://pdf.example.invalid/gv.pdf')],[chip('8/7'),chip(''),chip(''),chip(''),chip(''),chip(''),chip(''),chip(''),chip(''),chip('pages 41 - 43, 50 - 52.pdf','https://pdf.example.invalid/cut.pdf')],[chip('\\'),chip(''),chip('2K10 8+'),chip('Rác'),chip(''),chip(''),chip(''),chip(''),chip(''),chip('x')]]
        return {'sheets':[{'data':[{'rowData':[{'values':r} for r in rows]}]}]}
    def test_grid_chip_hyperlink_columns_year_continuation_note_zoom(self):
        rows=p.sheet_rows(json.dumps(self.grid()).encode(),self.sheet());self.assertEqual(len(rows),1)
        r=rows[0];self.assertEqual(r['class_name'],'2K10 8+');self.assertEqual(r['lesson_date'],'2026-07-08');self.assertEqual(len(r['homework_urls']),2);self.assertEqual(r['homework_note'],'Phần trắc nghiệm trong phiếu')
        self.assertIn('pages 41 - 43, 50 - 52.pdf',r['homework_labels']);self.assertIsNone(p.material(r)['videoId']);self.assertIn('zoom.us',p.material(r)['videoUrl'])
        self.assertEqual(p.material_date('15/1',self.sheet()),'2027-01-15');self.assertEqual(p.material_class('2013',self.sheet()),'2K13');self.assertIsNone(p.material_date('31/2',self.sheet()))
    def test_column_order_absent_record_and_unresolved_chip(self):
        g=self.grid();data=g['sheets'][0]['data'][0]['rowData'];data=data[:2];g['sheets'][0]['data'][0]['rowData']=data
        for record in data:
            while len(record['values'])<13:record['values'].append({'formattedValue':''})
            record['values'].reverse()
        self.assertEqual(len(p.sheet_rows(json.dumps(g).encode(),self.sheet())),1)
        g=self.grid();g['sheets'][0]['data'][0]['rowData'][1]['values'][5]={'formattedValue':'HS.pdf'}
        with self.assertRaises(p.GateError):p.sheet_rows(json.dumps(g).encode(),self.sheet())
        s=self.sheet();s['columns']['video']=None;g=self.grid();g['sheets'][0]['data'][0]['rowData']=g['sheets'][0]['data'][0]['rowData'][:2]
        self.assertEqual(p.sheet_rows(json.dumps(g).encode(),s)[0]['video'],'')
    def test_conversion_compare_requires_original_solution_check(self):
        questions=extracted()['questions'];questions[2].update(convertedFrom='essay',acceptedAnswers=['6'])
        questions.append({'id':'q4','kind':'self','maxMillipoints':0,'sourceRef':'Câu giả 4','solution':'Hai số nguyên liên tiếp có một số chẵn.'})
        r=review();r['answers'].update(q3='6',q4='self');r['reasoning'].update(q3='Nhân hai vế với 2, x=6; thay lại 6/2=3.',q4='n nguyên, hai số liên tiếp có một số chẵn, tích chia hết 2.')
        with self.assertRaises(p.GateError):p.compare({'questions':questions},r)
        r['conversion_checks']={'q3':True,'q4':True};slots=p.compare({'questions':questions},r);self.assertEqual(slots[-1]['expected'],'self');self.assertTrue(slots[-2]['conversion_verified'])
        r['answers']['q3']='3'
        with self.assertRaises(p.GateError):p.compare({'questions':questions},r)
    def test_youtube_live_strict_host(self):
        r=row();r['video']='https://youtube.com/live/abcdefghijk';self.assertEqual(p.material(r)['videoId'],'abcdefghijk')
        r['video']='https://evil.invalid/watch?v=abcdefghijk';self.assertIsNone(p.material(r)['videoId'])

    def test_multiple_pdf_order_real_merger_offline(self):
        from pypdf import PdfReader,PdfWriter
        def source(width):
            writer=PdfWriter();writer.add_blank_page(width=width,height=300)
            buf=io.BytesIO();writer.write(buf);return buf.getvalue()
        r=row();r['homework_urls']=['https://pdf.example.invalid/hs.pdf','https://pdf.example.invalid/cut.pdf']
        class Download:
            def request(self,url,headers=None):return source(200 if url.endswith('hs.pdf') else 250)
        config=p.load_config(ROOT/'config.example.json');merged=p.download_homework(r,config,Download())
        pages=PdfReader(io.BytesIO(merged)).pages
        self.assertEqual(len(pages),2);self.assertEqual([float(x.mediabox.width) for x in pages],[200,250])
    def test_equal_policy_is_deterministic_btvn_only(self):
        e=extracted();e['weightPolicy']='equal-scored-question'
        with tempfile.TemporaryDirectory() as directory:
            hs,hs_pages=fake_pdf(b'%PDF-FAKE-HS',Path(directory),'hs')
            gv,gv_pages=fake_pdf(b'%PDF-FAKE-GV',Path(directory),'gv')
            exam,_=p.assemble(row(),p.load_config(ROOT/'config.example.json'),e,b'%PDF-FAKE-HS',b'%PDF-FAKE-GV',hs_pages,gv_pages)
            self.assertEqual([q['maxMillipoints'] for q in exam['questions']],[1000,1000,1000]);self.assertEqual(exam['questions'][1]['pointsByCorrectCount'],[0,250,500,750,1000]);p.validate(exam)
    def test_worker_preserves_two_review_receipts_and_requires_short_check(self):
        config=p.load_config(ROOT/'config.example.json');primary=FakeAI(extracted())
        class TwoStage:
            last_receipt=None
            def ask(self,instruction,*args):
                if 'Trả JSON {conversion_checks:' in instruction:
                    self.last_receipt={'response_id':'fake-conversion','actual_model':'fake-review-model'}
                    return {'conversion_checks':{'q3':True},'reasoning':{'q3':'Đối chiếu 5/2=2,5 với lời giải nguồn giả.'}}
                self.last_receipt={'response_id':'fake-solving','actual_model':'fake-review-model'}
                return review()
        with tempfile.TemporaryDirectory() as directory:
            worker=p.Worker(config,FakeTransport(),FakePublisher(),str(Path(directory)/'state.sqlite'),primary,TwoStage(),extract_pdf_fn=fake_pdf)
            try:
                self.assertEqual(worker.process(row()),'da_dang')
                receipt=json.loads(worker.db.execute('SELECT receipt FROM receipts').fetchone()[0])
                self.assertEqual(receipt['reviewer_response']['response_id'],'fake-solving')
                self.assertEqual(receipt['conversion_response']['response_id'],'fake-conversion')
                self.assertTrue(receipt['slots'][-1]['conversion_verified'])
            finally:worker.db.close()

if __name__=='__main__':unittest.main()
