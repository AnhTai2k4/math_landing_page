// Sao chép gói mẫu đã có, giữ nguồn bất biến. Không tải dữ liệu học sinh.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
const source='T:/Work/MTM/Website-Native/work/claude-pkgs/g12-c2-k01';
const dossier='T:/Claude/SanPham/btvn-web-diem-danh/phieu-a';
const original=JSON.parse(readFileSync(join(source,'bank-entry.json'),'utf8'));
const exam=structuredClone(original.exam);
const sourceVersion=exam.versionHash;
exam.id='mtm-btvn-demo-g12-c2-k01-v1';exam.durationMinutes=120;
exam.title='BTVN mẫu · Vectơ trong không gian';exam.attribution='MTM sưu tầm và biên soạn';
exam.answerKeyVerified=true;exam.rubricVerified=true;exam.questionDisplayVerified=true;exam.publicationVerified=true;
exam.answerVerificationNote='Gói thử nội bộ: Codex đối chiếu 34 ô, kiểm số độc lập. Cờ publicationVerified chỉ tương thích bộ chấm, chưa phát hành; Claude chưa nghiệm thu.';
exam.sourceMaterial.version+=' · bản thử BTVN, không phải buổi học thật';
const assets=[];
for(const q of exam.questions){q.id=q.id.replace(original.exam.id,exam.id);}
for(const segment of [...(exam.sourceInstructions??[]),...(exam.solutionInstructions??[]),...exam.questions.flatMap(q=>[...q.sourceContent.questions,...q.sourceContent.solutions])]){
  const originalPath=segment.path;
  const bytes=readFileSync(join(source,'public/practice-media/source-crops',originalPath));
  const hash=createHash('sha256').update(bytes).digest('hex');
  if(hash!==segment.sha256)throw new Error('Ảnh sai hash: '+originalPath);
  segment.path=segment.path.replace('g12-c2-k01/','btvn-demo-g12-c2-k01/');
  const target=resolve('public/practice-media/source-crops',segment.path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes);
  assets.push({path:segment.path,sha256:hash,bytes:bytes.length});
}
// Không công khai PDF riêng, không nhập ngân hàng đề. Ảnh riêng không liên kết công khai.
delete exam.sourcePdf;delete exam.mtmDocuments;
exam.versionHash=createHash('sha256').update(JSON.stringify({...exam,versionHash:null})).digest('hex');
mkdirSync(dossier,{recursive:true});mkdirSync(resolve('server/btvn'),{recursive:true});
writeFileSync('server/btvn/demo-exam.json',JSON.stringify(exam,null,2)+'\n');
writeFileSync(join(dossier,'GOI-DE-MAU.json'),JSON.stringify({sourcePackage:source,sourceVersion,exam,assets,realSession:false,published:false},null,2)+'\n');
for(const name of ['KEY.json','SOLVE_LOG.md','SOURCE_META.json','PACKAGE_RECEIPT.md'])copyFileSync(join(source,name),join(dossier,'NGUON-'+name));
console.log(JSON.stringify({sourceVersion,versionHash:exam.versionHash,questions:exam.questions.length,assets:assets.length,published:false}));
