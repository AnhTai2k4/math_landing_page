import base64,copy,importlib.util,io,json,os,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image,ImageChops

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('pipeline',ROOT/'pipeline.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)

def row():
    return dict(lesson_key='btvn-fake-1',class_name='LỚP GIẢ',lesson_date='2026-10-15',title='Bài giả 1',document='',handout='',video='',homework='https://pdf.example.invalid/hs.pdf',answers='https://pdf.example.invalid/gv.pdf')

def extracted():
    return {'certain':True,'question_only':True,'coverage_complete':True,'weightPolicy':'source','grade':12,'sections':[{'label':'I','kind':'mc','count':1},{'label':'II','kind':'tf','count':1},{'label':'III','kind':'short','count':1}], 'questions':[
        {'id':'q1','sourceRef':'I Câu 1','kind':'mc','prompt':'1+1 bằng bao nhiêu?','choices':['1','2','3','4'],'answer':'B','solution':'1+1=2','maxMillipoints':3000,'questionCrops':[{'page':1,'x':0,'y':0,'width':100,'height':30}],'solutionCrops':[{'page':1,'x':0,'y':0,'width':100,'height':30}]},
        {'id':'q2','sourceRef':'II Câu 1','kind':'tf','prompt':'Kiểm bốn mệnh đề.','statements':['1=1','1=2','2=2','2=1'],'answer':[True,False,True,False],'solution':'Kiểm từng đẳng thức.','maxMillipoints':4000,'pointsByCorrectCount':[0,400,1000,2000,4000],'questionCrops':[{'page':1,'x':0,'y':30,'width':100,'height':30}],'solutionCrops':[{'page':1,'x':0,'y':30,'width':100,'height':30}]},
        {'id':'q3','sourceRef':'III Câu 1','kind':'short','prompt':'5/2 viết dạng thập phân?','mode':'numeric','acceptedAnswers':['2.5'],'solution':'5 chia 2 bằng 2.5','maxMillipoints':3000,'questionCrops':[{'page':1,'x':0,'y':60,'width':100,'height':30}],'solutionCrops':[{'page':1,'x':0,'y':60,'width':100,'height':30}]}
    ]}

def review():
    return {'certain':True,'coverage_complete':True,'question_only':True,'display_complete':True,'answers':{'q1':'B','q2':[True,False,True,False],'q3':'2,50'},'reasoning':{'q1':'Cộng hai đơn vị cho kết quả 2.','q2':'Đối chiếu từng đẳng thức độc lập: Đ S Đ S.','q3':'5 chia 2 được 2,5 chính xác, không làm tròn.'}}

class FakeAI:
    def __init__(self,result):self.result=result;self.calls=[]
    def ask(self,*args):
        self.calls.append(args)
        if 'Trả JSON {conversion_checks:' in args[0]:
            return {'conversion_checks':{k:True for k in self.result.get('answers',{})},'reasoning':{k:'Mock đối chiếu lời giải nguồn giả, không phải AI thật.' for k in self.result.get('answers',{})}}
        return copy.deepcopy(self.result)

class FakeTransport:
    def __init__(self):self.calls=[]
    def request(self,url,headers=None):self.calls.append(url);return b'%PDF-FAKE HS 123' if url.endswith('hs.pdf') else b'%PDF-FAKE GV 456'
    def json(self,*args):raise AssertionError('No network in tests')

class FakePublisher:
    def __init__(self):self.rows={};self.payloads=[];self.errors=[];self.lookups=[];self.updates=[]
    def update_material(self,key,patch):
        self.updates.append((key,copy.deepcopy(patch)));return {'status':'updated'}
    def lookup(self,key):self.lookups.append(key);return self.rows.get(key)
    def publish(self,payload):
        key=payload['lesson_key']
        if self.rows.get(key)=='da_dang':return {'status':'already_published'}
        self.rows[key]='da_dang';self.payloads.append(copy.deepcopy(payload));return {'status':'da_dang'}
    def error(self,payload):
        key=payload['lesson_key']
        if self.rows.get(key)=='da_dang':return {'status':'already_published'}
        self.rows[key]='loi';self.errors.append(payload);return {'status':'loi'}

def fake_pdf(raw,directory,tag):
    image=Image.new('RGB',(120,100),'white')
    # Each source differs, so production complete-fragment gate can compare hashes.
    for x in range(100):
        for y in range(90):image.putpixel((x,y),(x,y,10 if tag=='hs' else 200))
    path=directory/(tag+'-1.png');image.save(path)
    return 'Cau 1. de gia test offline', [path]

class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.config=p.load_config(ROOT/'config.example.json')
        self.transport=FakeTransport();self.publisher=FakePublisher()
        self.primary=FakeAI(extracted());self.independent=FakeAI(review())
    def worker(self,**kwargs):
        worker=p.Worker(self.config,self.transport,self.publisher,str(Path(self.temp.name)/'state.sqlite'),self.primary,self.independent,extract_pdf_fn=fake_pdf,**kwargs)
        self.addCleanup(worker.db.close);return worker

    def test_sheet_only_allowed_columns_and_stable_identity(self):
        sheet=self.config['sheets'][0]
        csv='Lớp,Ngày,Bài,Tài liệu,Handout,Video xem lại,BTVN,Đáp án BTVN\nLỚP GIẢ,15/10/2026,Bài 1,,,,https://pdf.example.invalid/hs.pdf,https://pdf.example.invalid/gv.pdf\n'
        a=p.sheet_rows(csv.encode(),sheet)
        b=p.sheet_rows(csv.replace('/hs.pdf','/updated.pdf').encode(),sheet)
        self.assertEqual(a[0]['lesson_key'],b[0]['lesson_key']);self.assertEqual(a[0]['lesson_date'],'2026-10-15')
        changed=p.sheet_rows(csv.replace('Bài 1','Tiêu đề mới').encode(),self.config['sheets'][1])
        self.assertEqual(a[0]['lesson_key'],changed[0]['lesson_key'])
        self.assertEqual(len(p.merge_rows(a+changed)),1)
        with self.assertRaises(p.GateError):p.merge_rows(a+b)
        with self.assertRaises(p.GateError):p.sheet_rows(csv.replace('Bài,','SĐT HS,').encode(),sheet)
        with self.assertRaises(p.GateError):p.sheet_rows(csv.replace('15/10/2026','15/10').encode(),sheet)

    def test_two_sheets_many_tabs_inherit_scope_and_columns(self):
        config=copy.deepcopy(self.config)
        config['sheets'][0]['program_key']='stable-program'
        config['sheets'][1]['program_key']='stable-program'
        config['sheets'][0]['tabs']=[{'name':'Lớp giả 1','url':'https://sheets.example.invalid/tab-1.csv'},{'name':'Lớp giả 2','url':'https://sheets.example.invalid/tab-2.csv','columns':{'title':'Tên bài'}}]
        config['sheets'][1]['tabs']=[{'name':'Lớp giả 3','url':'https://sheets.example.invalid/tab-3.csv'}]
        sources=p.sheet_sources(config)
        self.assertEqual(len(sources),3);self.assertEqual(sources[1]['columns']['title'],'Tên bài')
        self.assertEqual(sources[1]['columns']['homework'],'BTVN');self.assertEqual(sources[1]['program_key'],'stable-program')
        self.assertEqual(sources[1]['id'],config['sheets'][0]['id'])
        class SheetsAPI:
            def __init__(self):self.calls=[]
            def request(self,url,headers=None):
                self.calls.append((url,headers));n=int(url.split('tab-')[1][0]);title='Tên bài' if n==2 else 'Bài'
                return (f'Lớp,Ngày,{title},Tài liệu,Handout,Video xem lại,BTVN,Đáp án BTVN\nLỚP GIẢ {n},2026-10-15,Bài giả,,,,https://pdf.example.invalid/hs.pdf,https://pdf.example.invalid/gv.pdf\n').encode()
        api=SheetsAPI()
        with patch.dict(os.environ,{'BTVN_SHEET_READ_TOKEN':'FAKE-READ-ONLY'}):rows=p.read_material_rows(config,api)
        self.assertEqual(len(rows),3);self.assertEqual(len(api.calls),3)
        self.assertEqual(api.calls[1][1]['Authorization'],'Bearer FAKE-READ-ONLY')
        self.assertNotIn('FAKE-READ-ONLY',json.dumps(rows))
        config['sheets'][0]['tabs'][0]['id']='forbidden-override'
        with self.assertRaises(p.GateError):p.sheet_sources(config)

    def test_drive_download_mapping_and_bearer_isolation(self):
        config=copy.deepcopy(self.config);config['allowed_hosts'].append('www.googleapis.com')
        config['source']={'pdf_download_url_template':'https://www.googleapis.com/drive/v3/files/{id}?alt=media','pdf_bearer_env':'BTVN_PDF_READ_TOKEN','pdf_auth_hosts':['www.googleapis.com']}
        class DownloadsAPI:
            def __init__(self):self.calls=[]
            def request(self,url,headers=None):self.calls.append((url,headers));return b'%PDF-FAKE 12345'
        api=DownloadsAPI();file_id='fake-drive-file-123'
        with patch.dict(os.environ,{'BTVN_PDF_READ_TOKEN':'FAKE-PDF-READ-ONLY'}):
            p.download_pdf('https://drive.google.com/file/d/'+file_id+'/view?usp=sharing',config,api)
            self.assertEqual(api.calls[-1],('https://www.googleapis.com/drive/v3/files/'+file_id+'?alt=media',{'Authorization':'Bearer FAKE-PDF-READ-ONLY'}))
            p.download_pdf('https://drive.google.com/open?id='+file_id,config,api)
            self.assertEqual(api.calls[-1][1]['Authorization'],'Bearer FAKE-PDF-READ-ONLY')
            p.download_pdf('https://pdf.example.invalid/hs.pdf',config,api)
            self.assertEqual(api.calls[-1][1],{})
            for url in ('https://drive.google.com/drive/folders/'+file_id,'https://drive.google.com/file/d/short/view','https://drive.google.com/open?id='+file_id+'&id=second-file-123'):
                with self.assertRaises(p.GateError):p.download_pdf(url,config,api)
        del config['source']['pdf_download_url_template']
        with self.assertRaises(p.GateError) as e:p.download_pdf('https://drive.google.com/file/d/'+file_id+'/view',config,api)
        self.assertNotIn(file_id,str(e.exception));self.assertNotIn('FAKE-PDF',str(e.exception))

    def test_live_requires_scoped_notification_config(self):
        with patch.dict(os.environ,{'BTVN_NOTIFY_URL':''}):
            with self.assertRaises(p.GateError):p.require_notifier(self.config)
        with patch.dict(os.environ,{'BTVN_NOTIFY_URL':'https://notify.example.invalid/fake'}):p.require_notifier(self.config)
        with patch.dict(os.environ,{'BTVN_NOTIFY_URL':'https://unapproved.example.invalid/fake'}):
            with self.assertRaises(p.GateError):p.require_notifier(self.config)

    def test_full_worker_real_validator_crop_and_no_key_leak(self):
        w=self.worker();self.assertEqual(w.process(row()),'da_dang')
        payload=self.publisher.payloads[0]
        self.assertEqual(len(payload['verification']['slots']),6)
        self.assertEqual(payload['verification']['slots'][-1]['actual'],'2,50')
        self.assertEqual(payload['material']['classNames'],['LỚP GIẢ'])
        self.assertEqual(payload['material']['lessonCode'],payload['lesson_key'])
        text=self.independent.calls[0][1]
        for secret_name in ('"answer":','"acceptedAnswers":','"solution":'):
            self.assertNotIn(secret_name,text)
        self.assertEqual(len(self.independent.calls[0][2]),4) # HS whole page + 3 actual crop previews
        self.assertEqual(w.process(row()),'already_published');self.assertEqual(len(self.primary.calls),1)
        self.assertEqual(len(self.publisher.payloads),1)
        self.assertIn('source_version',json.loads(w.db.execute('SELECT receipt FROM receipts').fetchone()[0]))
        qasset=next(a for a in payload['assets'] if '/q1-' in a['path'])
        decoded=base64.b64decode(qasset['data_base64']);self.assertEqual(p.digest(decoded),qasset['sha256'])
        im=Image.open(io.BytesIO(decoded));self.assertEqual(im.getpixel((51,21)),(51,21,10))

    def test_server_prevents_overwrite_even_new_worker_state(self):
        self.publisher.rows[row()['lesson_key']]='da_dang'
        self.assertEqual(self.worker().process(row()),'updated')
        self.assertEqual(self.transport.calls,[])
        self.assertFalse(self.publisher.payloads)
        self.assertEqual(len(self.publisher.updates),1)

    def test_round18_update_video_only_without_reextract_or_republish(self):
        worker=self.worker();source=row()
        self.assertEqual(worker.process(source),'da_dang')
        calls=len(self.primary.calls)
        source['video']='https://youtu.be/abcdefghijk'
        source['handout']='https://pdf.example.invalid/new.pdf'
        self.assertEqual(worker.process(source),'updated')
        key,patch_=self.publisher.updates[0]
        self.assertEqual(key,source['lesson_key'])
        self.assertEqual(patch_,{'videoId':'abcdefghijk','videoUrl':None,'handoutUrl':source['handout']})
        self.assertEqual(worker.process(source),'already_published')
        source['video']=''
        self.assertEqual(worker.process(source),'already_published')
        self.assertEqual(len(self.primary.calls),calls)
        self.assertEqual(len(self.publisher.payloads),1)

    def test_round18_updates_retry_without_losing_published_receipt(self):
        worker=self.worker();source=row();self.assertEqual(worker.process(source),'da_dang')
        source['video']='https://youtu.be/abcdefghijk'
        with patch.object(self.publisher,'update_material',side_effect=p.GateError('Tạm lỗi')):
            self.assertEqual(worker.process(source),'loi')
        self.assertEqual(worker.db.execute('SELECT status FROM receipts').fetchone()[0],'da_dang')
        self.assertEqual(worker.process(source),'updated')

    def test_round18_answer_same_drive_id_or_hs_label_blocked_before_download(self):
        for answer in ('https://drive.google.com/open?id=abc123456789', 'https://pdf.example.invalid/De_HS.pdf'):
            source=row();source['homework']='https://drive.google.com/file/d/abc123456789/view';source['answers']=answer
            self.assertEqual(self.worker().process(source),'loi')
        source=row();source['answers_label']='Đề toán_HS.pdf'
        self.assertEqual(self.worker().process(source),'loi')
        source=row();source['document']='https://drive.google.com/file/d/document123456/view'
        source['answers']='https://drive.google.com/open?id=document123456'
        self.assertNotEqual(source['answers'],source['homework'])
        self.assertEqual(self.worker().process(source),'loi')
        self.assertFalse(self.transport.calls)
        self.assertFalse(self.publisher.payloads)

    def test_round18_class_opens_at_per_class_and_fallback(self):
        source=row();source['class_dates']={'Lớp A':'2026-10-16','Lớp B':'2026-10-18','Lớp thiếu':'2026-10-16'}
        schedule=Path(self.temp.name)/'schedule.json'
        schedule.write_text(json.dumps({'Lớp A':[{'weekday':5,'start':'17:30','end':'19:30'}],'Lớp B':[{'weekday':7,'start':'10:00','end':'12:00'}]}),encoding='utf-8')
        with patch.dict(os.environ,{'BTVN_CLASS_SCHEDULE':str(schedule)}):
            self.assertEqual(p.material(source)['classOpensAt'],{'Lớp A':'2026-10-16T19:30:00+07:00','Lớp B':'2026-10-18T12:00:00+07:00','Lớp thiếu':'2026-10-16T21:30:00+07:00'})

    def test_publisher_down_preserves_receipt_and_continues_next_row(self):
        w=self.worker()
        def unavailable(*args):raise p.GateError('Máy chủ đang lỗi')
        self.publisher.lookup=unavailable;self.publisher.error=unavailable
        self.assertEqual(w.process(row()),'loi')
        second=row();second['lesson_key']='btvn-fake-2'
        self.assertEqual(w.process(second),'loi')
        self.assertEqual(w.db.execute('SELECT count(*) FROM receipts').fetchone()[0],2)
        self.assertEqual(self.transport.calls,[])

    def test_publish_payload_budget_rejects_before_network(self):
        publisher=p.Publisher(p.Transport(),'https://publisher.example.invalid')
        with patch.object(p,'encoded',return_value=b'x'*(48*1024*1024+1)):
            with self.assertRaises(p.GateError):publisher.publish({'assets':[]})

    def test_notification_and_ai_actual_receipt_offline(self):
        class FakeAPI:
            def __init__(self):self.calls=[];self.response={'id':'fake-response-id','model':'actual-model-version','usage':{'prompt_tokens':12,'completion_tokens':8},'choices':[{'message':{'content':'{"certain":true}'}}]}
            def json(self,*args):self.calls.append(args);return copy.deepcopy(self.response)
        api=FakeAPI();ai=p.AI(api,self.config['reviewer'])
        with patch.dict(os.environ,{'BTVN_REVIEWER_API_KEY':'FAKE-KEY-NOT-A-SECRET'}):
            self.assertTrue(ai.ask('fake instruction','fake source',[])['certain'])
            self.assertEqual(ai.last_receipt['actual_model'],'actual-model-version')
            self.assertEqual(ai.last_receipt['usage']['completion_tokens'],8)
            self.assertNotIn('FAKE-KEY',json.dumps(ai.last_receipt))
            del api.response['model']
            with self.assertRaises(p.GateError):ai.ask('fake','fake',[])
        with patch.dict(os.environ,{'BTVN_NOTIFY_URL':'https://notify.example.invalid/fake','BTVN_NOTIFY_SECRET':'FAKE-NOTIFY'}):
            p.notify(self.config,api,'btvn-fake','Thiếu khóa độc lập')
        payload=api.calls[-1][1];self.assertEqual(payload['event'],'btvn_error')
        self.assertEqual(set(payload),{'event','lesson_key','reason'})

    def test_tf_one_slot_mismatch_blocks_publish_and_reports_error(self):
        self.independent.result['answers']['q2'][2]=False
        self.assertEqual(self.worker().process(row()),'loi')
        self.assertEqual(self.publisher.payloads,[]);self.assertEqual(len(self.publisher.errors),1)
        self.assertIn('q2.3',self.publisher.errors[0]['reason'])

    def test_extra_slot_and_missing_reasoning_block(self):
        exam={'questions':extracted()['questions']}
        r=review();r['answers']['extra']='A'
        with self.assertRaises(p.GateError):p.compare(exam,r)
        r=review();del r['reasoning']['q3']
        with self.assertRaises(p.GateError):p.compare(exam,r)
        r=review();r['answers']['q2']=[1,0,1,0]
        with self.assertRaises(p.GateError):p.compare(exam,r)

    def test_uncertain_review_and_bad_rubric_fail_closed(self):
        self.independent.result['certain']=False
        self.assertEqual(self.worker().process(row()),'loi')
        self.independent.result=review();self.primary.result['questions'][0]['maxMillipoints']=-1
        self.assertEqual(self.worker().process(row()),'loi')
        self.assertEqual(self.publisher.payloads,[])
        self.assertIn('positive integer',self.publisher.errors[-1]['reason'])

    def test_malformed_crop_and_missing_answer_source_block(self):
        self.primary.result['questions'][0]['questionCrops'][0]['width']=999
        self.assertEqual(self.worker().process(row()),'loi');self.assertEqual(self.independent.calls,[])
        r=row();r['answers']=''
        self.assertEqual(self.worker().process(r),'loi')

    def test_scan_failure_and_validator_unavailable_block(self):
        w=self.worker()
        def scan(*args):raise p.GateError('PDF scan chưa kiểm thủ công')
        w.extract_pdf=scan
        self.assertEqual(w.process(row()),'loi');self.assertEqual(self.primary.calls,[])
        w.extract_pdf=fake_pdf
        with patch.dict(os.environ,{'BTVN_NODE':'no-such-node-executable'}):
            self.assertEqual(w.process(row()),'loi')
        self.assertEqual(self.publisher.payloads,[])

    def test_offline_transport_and_host_gate(self):
        with patch.dict(os.environ,{'BTVN_ALLOW_NETWORK':'0'}):
            with self.assertRaises(p.GateError):p.Transport(True,['pdf.example.invalid']).request('https://pdf.example.invalid/hs.pdf')
        with patch.dict(os.environ,{'BTVN_ALLOW_NETWORK':'1'}):
            for url in ('http://pdf.example.invalid/hs.pdf','https://evil.invalid/a','https://u:p@pdf.example.invalid/a'):
                with self.assertRaises(p.GateError):p.Transport(True,['pdf.example.invalid']).request(url)

    def test_real_poppler_source_pack_and_lossless_crop(self):
        repo=ROOT.parents[1]
        catalog=json.loads((repo/'src/native/exams/catalog.json').read_text(encoding='utf-8'))
        fixture=repo/'public'/catalog[0]['sourcePdf']['url'].lstrip('/')
        from pypdf import PdfReader
        source=PdfReader(str(fixture));single=io.BytesIO()
        from pypdf import PdfWriter
        writer=PdfWriter()
        page=next(pg for pg in source.pages if p.re.search(r'(?:Câu|Cau)\s*\d+',pg.extract_text() or ''))
        writer.add_page(page);writer.write(single)
        text,pages=p.extract_pdf(single.getvalue(),Path(self.temp.name),'hs-real')
        self.assertTrue(text.strip());self.assertEqual(len(pages),1)
        assets=[];segments=p.crop_segments([{'page':1,'x':20,'y':20,'width':200,'height':150}],pages,'btvn/fake/q1',assets)
        original=Image.open(pages[0]).crop((20,20,220,170))
        cropped=Image.open(io.BytesIO(base64.b64decode(assets[0]['data_base64'])))
        self.assertIsNone(ImageChops.difference(original,cropped).getbbox())
        self.assertEqual(segments[0]['width'],200)

if __name__=='__main__':unittest.main()
