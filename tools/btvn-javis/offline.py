"""Dữ liệu giả cố định, transport không thể gọi mạng."""
import importlib.util
import json
from pathlib import Path
import tempfile
from unittest.mock import patch
import runtime as r


def fixtures():
    spec = importlib.util.spec_from_file_location('offline_pipeline_fixtures', r.pipeline_dir()/'tests/test_pipeline.py')
    module = importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module


def dry_run():
    import worker as w
    f=fixtures()
    config=w.p.load_config(r.pipeline_dir()/'config.example.json')
    config.update(classes={'LỚP GIẢ':{'enabled':True,'dates':['2026-10-15']}},periods=[{'start':'2026-10-15','end':'2026-10-15','period':'GK1'}])
    row=f.row();row['class_dates']={'LỚP GIẢ':'2026-10-15'}
    repo=r.pipeline_dir().parents[1]
    catalog=json.loads((repo/'src/native/exams/catalog.json').read_text(encoding='utf-8'))
    from pypdf import PdfReader,PdfWriter
    import io
    source=PdfReader(str(repo/'public'/catalog[0]['sourcePdf']['url'].lstrip('/')))
    single=PdfWriter()
    single.add_page(next(page for page in source.pages if w.p.re.search(r'(?:Câu|Cau)\s*\d+',page.extract_text() or '')))
    raw=io.BytesIO();single.write(raw)
    with tempfile.TemporaryDirectory(prefix='btvn-offline-') as temp, patch('socket.create_connection',side_effect=AssertionError('Mạng bị cấm')), patch('urllib.request.OpenerDirector.open',side_effect=AssertionError('Mạng bị cấm')):
        root=Path(temp)
        text,pages=w.p.extract_pdf(raw.getvalue(),root,'fixture')
        assert pages and text and (root/'fixture-markers.json').is_file()
        publisher=f.FakePublisher()
        a=f.FakeAI(f.extracted());b=f.FakeAI(f.review())
        worker=w.VersionWorker(config,f.FakeTransport(),publisher,root/'state.sqlite',a,b,extract_pdf_fn=f.fake_pdf)
        try:
            first=worker.process(row);second=worker.process(row)
            assert first=='da_dang' and second=='already_published' and len(publisher.payloads)==1
            class Changed(f.FakeTransport):
                def request(self,url,**kwargs):return super().request(url,**kwargs)+b' changed'
            worker.transport=Changed()
            third=worker.process(row)
            assert third=='da_dang' and len(publisher.payloads)==2
        finally:worker.db.close()
        print(json.dumps({'mode':'offline','network':False,'pdfium_pages':len(pages),'statuses':[first,second,third],'ai':'giả','publisher':'giả','validator':'PracticeExam thật'},ensure_ascii=False))
