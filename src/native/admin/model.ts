import {canonicalNumeric,normalizedShort} from '../exams/assessment';
import {FLEX_RUBRIC} from '../exams/flexible-profile';
import {validLayout,pointsFor,tfSchedule,layoutRows,type FlexibleFields} from './layout';
import {validatePracticeExam,type PracticeExam,type PracticeQuestion,type Grade,type Period} from '../exams/data';
export type PdfAsset={path:string;sha256:string;bytes:number;totalPages:number;name:string};
export type AdminDraft=FlexibleFields&{id:string;title:string;grade:Grade;period:Period;durationMinutes:number;publisher:string;version:string;sourceUrl:string;mc:string[];tf:string[][];short:string[];solutions:string[];questionPdf?:PdfAsset;solutionPdf?:PdfAsset;questionsOnly:boolean;keyReviewed:boolean;rightsConfirmed:boolean;solutionsComplete:boolean};
export function newDraft():AdminDraft{return {id:crypto.randomUUID(),title:'',grade:10,period:'GK1',durationMinutes:90,publisher:'Minh Thành Math',version:'',sourceUrl:'https://www.minhthanhmath.vn/thi-thu',mc:Array(12).fill(''),tf:Array.from({length:4},()=>Array(4).fill('')),short:Array(6).fill(''),solutions:Array(22).fill(''),questionsOnly:false,keyReviewed:false,rightsConfirmed:false,solutionsComplete:false};}
const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
export function validAsset(x:unknown):x is PdfAsset{const a=x as PdfAsset;return !!a&&typeof a==='object'&&/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f]{64}-(questions|solutions)\.pdf$/.test(a.path)&&/^[0-9a-f]{64}$/.test(a.sha256)&&a.path.endsWith(a.sha256+'-'+(a.path.endsWith('-questions.pdf')?'questions':'solutions')+'.pdf')&&Number.isInteger(a.bytes)&&a.bytes>=8&&a.bytes<=15*1024*1024&&Number.isInteger(a.totalPages)&&a.totalPages>=1&&a.totalPages<=200&&text(a.name,300);}
export function draftErrors(x:AdminDraft):string[]{const errors:string[]=[];
 if(!/^[0-9a-f-]{36}$/.test(x.id))errors.push('Mã bản nháp không hợp lệ.');
 if(!text(x.title,300))errors.push('Cần tên đề (tối đa 300 ký tự).');
 if(![10,11,12].includes(x.grade)||!['GK1','CK1','GK2','CK2'].includes(x.period))errors.push('Lớp hoặc kỳ kiểm tra chưa hợp lệ.');
 if(!Number.isInteger(x.durationMinutes)||x.durationMinutes<1||x.durationMinutes>1440)errors.push('Thời gian phải từ 1 đến 1440 phút.');
 if(!text(x.publisher,1000)||!text(x.version,1000))errors.push('Cần đơn vị ra đề và phiên bản/mã đề.');
 try{const url=new URL(x.sourceUrl);if(url.protocol!=='https:'||url.username||url.password)throw Error();}catch{errors.push('Đường dẫn nguồn phải là HTTPS.');}
 if(!validAsset(x.questionPdf))errors.push('Cần PDF câu hỏi đã tải và kiểm tra.');
 if(x.solutionPdf&&!validAsset(x.solutionPdf))errors.push('PDF lời giải chưa hợp lệ.');
 const flexible=x.layout!==undefined,layout=validLayout(x.layout)?x.layout:null;
 if(flexible&&!layout)errors.push('Cấu trúc cần 1–12 phần, mỗi phần có số câu nguyên dương, tổng tối đa 300.');
 const rows=layout?layoutRows(layout):null,counts={mc:rows?.filter(r=>r.kind==='mc').length??12,tf:rows?.filter(r=>r.kind==='tf').length??4,short:rows?.filter(r=>r.kind==='short').length??6},count=rows?.length??22;
 if(!Array.isArray(x.mc)||x.mc.length!==counts.mc||x.mc.some(a=>!['A','B','C','D'].includes(a)))errors.push(`Cần đủ ${counts.mc} đáp án A/B/C/D.`);
 if(!Array.isArray(x.tf)||x.tf.length!==counts.tf||x.tf.some(a=>!Array.isArray(a)||a.length!==4||a.some(v=>!['D','S'].includes(v))))errors.push(`Cần đủ ${counts.tf*4} ý Đúng/Sai.`);
 if(!Array.isArray(x.short)||x.short.length!==counts.short||x.short.some(a=>typeof a!=='string'||a.length>100||normalizedShort(flexible?x.shortMode??'numeric':'numeric',a)===null||!a.trim()))errors.push(`Cần đủ ${counts.short} đáp án ngắn đúng định dạng đã chọn.`);
 if(flexible){const points=layout?pointsFor(x):[];if(!['auto','manual','preset'].includes(x.pointMode??'')||points.length!==count||points.some(n=>!Number.isInteger(n)||n<1||n>10000)||points.reduce((n,p)=>n+p,0)!==10000)errors.push('Điểm từng câu phải dương, chính xác đến 0,001; tổng phải bằng 10.');if(!['thpt','equal','all'].includes(x.tfScoring??'')||!['numeric','rational','exact'].includes(x.shortMode??''))errors.push('Cần quy tắc chấm Đ/S và định dạng trả lời ngắn.');}
 if(!Array.isArray(x.solutions)||x.solutions.length!==count||x.solutions.some(a=>typeof a!=='string'||a.length>20000))errors.push('Lời giải mỗi câu tối đa 20.000 ký tự.');
 else if(!x.solutionPdf&&x.solutions.some(a=>a.trim().length<20))errors.push(`Nhập đủ lời giải ${count} câu hoặc tải PDF lời giải đầy đủ.`);
 if(!x.questionsOnly)errors.push('Cần xác nhận PDF đề chỉ chứa câu hỏi, không chứa đáp án.');
 if(!x.keyReviewed)errors.push('Cần đối chiếu khóa chấm với đáp án nguồn.');
 if(!x.rightsConfirmed)errors.push('Cần xác nhận quyền sử dụng đề và lời giải.');
 if(!x.solutionsComplete)errors.push('Cần xác nhận lời giải đầy đủ, đúng mã đề.');
 return errors;
}
export function buildExam(d:AdminDraft,hash:string,assetUrl:(path:string)=>string):PracticeExam{
 const errors=draftErrors(d);if(errors.length)throw Error(errors.join('\n'));if(!/^[0-9a-f]{64}$/.test(hash))throw Error('Thiếu hash phiên bản.');
 const flexible=!!d.layout,rows=layoutRows(d.layout??[{label:'Phần I',kind:'mc',count:12},{label:'Phần II',kind:'tf',count:4},{label:'Phần III',kind:'short',count:6}]),points=flexible?pointsFor(d):[...Array(12).fill(250),...Array(4).fill(1000),...Array(6).fill(500)];
 const questions:PracticeQuestion[]=rows.map(r=>({id:'q'+(r.index+1),sourceRef:`${r.label} · Câu ${r.number}`,solution:d.solutions[r.index].trim()||'Xem lời giải đầy đủ trong PDF đáp án sau khi nộp bài.',maxMillipoints:points[r.index],...(r.kind==='mc'?{kind:'mc' as const,choices:['A','B','C','D'] as [string,string,string,string],answer:d.mc[r.kindIndex] as 'A'|'B'|'C'|'D'}:r.kind==='tf'?{kind:'tf' as const,answer:d.tf[r.kindIndex].map(v=>v==='D') as [boolean,boolean,boolean,boolean],pointsByCorrectCount:tfSchedule(points[r.index],flexible?d.tfScoring:'thpt')}:{kind:'short' as const,mode:flexible?d.shortMode??'numeric':'numeric' as const,acceptedAnswers:[d.short[r.kindIndex].trim()]})}));
 const pdf=d.questionPdf!;const exam:PracticeExam={id:`mtm-custom-${d.id}-${hash}`,sourceHash:pdf.sha256,sourceRef:d.version,questionCount:22,answerKeyVerified:true,rubricVerified:true,grade:d.grade,period:d.period,title:d.title.trim(),durationMinutes:d.durationMinutes,versionHash:hash,rubricVersion:'MTM-12MC-4TF-6SHORT-v1',sourceUrl:d.sourceUrl,publicationVerified:true,questionDisplayVerified:true,sourceMaterial:{title:d.title.trim(),publisher:d.publisher.trim(),version:d.version.trim(),locator:'PDF đề riêng · Phần I/II/III'},answerVerificationNote:'Đề và khóa chấm do quản trị MTM đối chiếu và xác nhận. Tự luyện theo thang điểm I:3, II:4, III:3.',sourcePdf:{url:assetUrl(pdf.path),verified:true,sha256:pdf.sha256,bytes:pdf.bytes,totalPages:pdf.totalPages,questionPages:Array.from({length:pdf.totalPages},(_,i)=>i+1)},questions};
 if(flexible){exam.questionCount=questions.length;exam.rubricVersion=FLEX_RUBRIC;exam.sections=d.layout;exam.answerVerificationNote='Khóa và lời giải do quản trị MTM đối chiếu nguồn. Điểm luyện tập MTM thang 10; cách chia điểm hiển thị theo từng phần/câu, không phải điểm khảo thí chính thức HSA/TSA.';}
 const gate=validatePracticeExam(exam);if(!gate.valid)throw Error(gate.errors.join('\n'));return exam;
}
export function fullAnswers(exam:PracticeExam):Record<string,unknown>{return Object.fromEntries(exam.questions.map(q=>[q.id,q.kind==='mc'?q.answer:q.kind==='tf'?q.answer:q.acceptedAnswers[0]]));}
export function parseKeyPaste(text:string):{mc:string[];tf:string[][];short:string[]}{
 const lines=text.trim().split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(lines.length!==3)throw Error('Dán đúng 3 dòng: 12 chữ A/B/C/D; 4 nhóm Đ/S; 6 số ngăn cách bằng dấu chấm phẩy.');
 const mc=lines[0].toUpperCase().replace(/[\s,;]+/g,'').split(''),tf=lines[1].toUpperCase().replace(/Đ/g,'D').split(/[\s;]+/).filter(Boolean).map(s=>s.split('')),short=lines[2].split(';').map(s=>s.trim());
 if(mc.length!==12||mc.some(a=>!/[ABCD]/.test(a))||tf.length!==4||tf.some(a=>a.length!==4||a.some(v=>!/[DS]/.test(v)))||short.length!==6||short.some(a=>canonicalNumeric(a)===null))throw Error('Khóa chấm thiếu hoặc sai định dạng. Đáp án ngắn dùng dấu chấm phẩy để giữ số thập phân có dấu phẩy.');return{mc,tf,short};
}
