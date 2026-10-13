# Tạo src/native/chapters/mtm-question-pdfs.json: sha256 -> {bytes, totalPages} cho PDF đề MTM.
import json, hashlib, sys
from pathlib import Path
from pypdf import PdfReader
root = Path(__file__).resolve().parents[1]
bank = json.loads((root/'src/native/chapters/exact-tests.json').read_text('utf8'))
out = {}
for item in bank:
    docs = item['exam'].get('mtmDocuments')
    if not docs: continue
    q = docs['questions']
    f = root/'public'/q['url'].lstrip('/')
    data = f.read_bytes()
    h = hashlib.sha256(data).hexdigest()
    if h != q['sha256'].lower(): sys.exit(f'hash mismatch {f}')
    out[h] = {'bytes': len(data), 'totalPages': len(PdfReader(f).pages)}
(root/'src/native/chapters/mtm-question-pdfs.json').write_text(json.dumps(out, indent=2)+'\n', 'utf8')
print(len(out), 'pdfs')
