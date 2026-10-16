/** Adapter của hợp đồng PracticeExam sang bộ chấm MTM phân số.
 * Chỉ rubric có tên chính xác này đi qua adapter; thang cũ giữ nguyên. */
import type {Assessment,ScoreResult,Validation} from './assessment';
import {MtmScoringCatalog,lockMtmAttempt,scoreMtmAttempt,MTM_SCORING_VERSION,
  type Fraction,type MtmIssue,type MtmScore} from './mtm-scoring';

const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==='string'&&!!v.trim();
const sha=(v:unknown)=>typeof v==='string'&&/^[a-fA-F0-9]{64}$/.test(v);
export function isMtmQuestionPoints(value:unknown,count:number):value is Fraction {
  if(!record(value)||!Number.isSafeInteger(count)||count<1)return false;
  const n=value.numerator,d=value.denominator;
  return typeof n==='string'&&typeof d==='string'&&/^[1-9]\d{0,30}$/.test(n)&&/^[1-9]\d{0,30}$/.test(d)
    &&BigInt(n)*BigInt(count)===10n*BigInt(d);
}
/** maxMillipoints chỉ phục vụ các thành phần giao diện tương thích.
 * Mọi phép cộng và làm tròn chính thức đều do mtm-scoring thực hiện. */
export const fractionMillipoints=(value:Fraction)=>Number(value.numerator)/Number(value.denominator)*1000;

export function validateMtmEqualAssessment(input:unknown):Validation {
  const errors:string[]=[];
  if(!record(input))return {valid:false,errors:['exam: object required']};
  if(input.rubricVersion!==MTM_SCORING_VERSION)errors.push('exam: explicit MTM rubric required');
  if(input.responseMode!==undefined)errors.push('exam: question-only transport cannot be scored');
  if(!text(input.id)||!text(input.sourceRef)||!sha(input.sourceHash)||!sha(input.versionHash))errors.push('exam: source and locked exam version required');
  if(!text(input.answerKeyVersion)||input.answerKeyVersion.length>160)errors.push('exam: answerKeyVersion required');
  if(input.answerKeyVerified!==true||input.rubricVerified!==true)errors.push('exam: verified answer key and rubric required');
  if(input.sourceComplete!==undefined&&typeof input.sourceComplete!=='boolean')errors.push('exam: invalid sourceComplete');
  if(input.issues!==undefined&&(!Array.isArray(input.issues)||!Array.from(input.issues).every(text)))errors.push('exam: invalid source issues');
  if(!Array.isArray(input.questions)||!input.questions.length)return {valid:false,errors:[...errors,'exam: complete questions required']};
  const count=input.questions.length;
  if(input.questionCount!==count||!Number.isSafeInteger(input.questionCount))errors.push('exam: questionCount mismatch');
  const ids=new Set<string>();
  for(const [index,q] of input.questions.entries()){
    const prefix='question '+(index+1)+': ';
    if(!record(q)){errors.push(prefix+'object required');continue;}
    if(!text(q.id)||q.id!==q.id.trim()||ids.has(q.id))errors.push(prefix+'unique unpadded id required');else ids.add(q.id);
    if(!text(q.sourceRef))errors.push(prefix+'sourceRef required');
    if(!isMtmQuestionPoints(q.maxPoints,count))errors.push(prefix+'maxPoints must equal exact 10/N');
    if(q.maxMillipoints!==10000/count)errors.push(prefix+'maxMillipoints must be derived 10000/N');
    if(!['mc','tf','short'].includes(q.kind as string))errors.push(prefix+'MTM supports mc/tf/short only');
    if(q.kind==='mc'&&(!Array.isArray(q.choices)||q.choices.length!==4||!Array.from(q.choices).every(text)||new Set(q.choices).size!==4))errors.push(prefix+'four distinct choices required');
    if(q.kind==='short'&&!['numeric','rational','exact'].includes(q.mode as string))errors.push(prefix+'explicit short mode required');
    // Khóa thiếu/mâu thuẫn, DS sai số ý hoặc shortRule chưa xác minh được
    // giữ nguyên câu trong N. Engine trả pending, không coi là bài làm sai.
  }
  return {valid:errors.length===0,errors};
}

/** So nhãn và nội dung theo kind đã khóa, không suy loại từ nhãn trong đề.
 * Prompt và text đều phải nhất quán khi chúng chép lại phương án hoặc ý DS. */
function sourceStructureConflict(q:Record<string,unknown>):boolean {
  const alphabet=q.kind==='mc'?'ABCDEFGHIJKLMNOPQRSTUVWXYZ':q.kind==='tf'?'abcdefghijklmnopqrstuvwxyz':null;
  if(alphabet===null)return false;
  const structure=q.kind==='mc'?q.choices:q.statements;
  const expected=Array.isArray(structure)?structure.length:4;
  const normalized=(value:string)=>value.trim().replace(/\s+/gu,' ');
  return [q.prompt,q.text].some(content=>{
    if(typeof content!=='string')return false;
    const parts=[...content.matchAll(new RegExp('(?:^|[\\n;:])[\\t ]*(['+alphabet+'])[).:][\\t ]*','g'))];
    if(!parts.length)return false;
    return parts.length!==expected||parts.map(part=>part[1]).join('')!==alphabet.slice(0,parts.length)||
      Array.isArray(structure)&&parts.some((part,index)=>{
        const body=content.slice(part.index!+part[0].length,parts[index+1]?.index??content.length);
        return typeof structure[index]!=='string'||normalized(body)!==normalized(structure[index]);
      });
  });
}

/** Nguồn ảnh/PDF dùng để định vị bốn ý DS. Không nhập data.ts vì vòng import.
 * PDF toàn đề chỉ đủ khi câu có locator trang tường minh nằm trong các trang đề. */
function verifiedQuestionSource(exam:Record<string,unknown>,q:Record<string,unknown>):boolean {
  const pdf=exam.sourcePdf;
  if(record(pdf)&&pdf.verified===true&&sha(pdf.sha256)&&typeof pdf.url==='string'&&
    Number.isSafeInteger(pdf.bytes)&&(pdf.bytes as number)>=8&&(pdf.bytes as number)<=15*1024*1024&&
    Number.isSafeInteger(pdf.totalPages)&&(pdf.totalPages as number)>=1&&(pdf.totalPages as number)<=200&&
    Array.isArray(pdf.questionPages)&&pdf.questionPages.length>0&&new Set(pdf.questionPages).size===pdf.questionPages.length&&
    Array.from(pdf.questionPages).every(page=>Number.isSafeInteger(page)&&page>=1&&page<=(pdf.totalPages as number))){
    const urlValid=pdf.sha256===String(pdf.sha256).toLowerCase()&&
      [`/exam-assets/${pdf.sha256}.pdf`,`/qa-exam-assets/${pdf.sha256}.pdf`].includes(pdf.url);
    if(urlValid&&Number.isSafeInteger(q.sourcePdfPage)&&pdf.questionPages.includes(q.sourcePdfPage))return true;
  }
  const content=q.sourceContent;
  return record(content)&&Array.isArray(content.questions)&&content.questions.length>0&&content.questions.length<=12&&
    content.questions.every(segment=>record(segment)&&typeof segment.path==='string'&&segment.path.length<=300&&
      /^[a-zA-Z0-9][a-zA-Z0-9_/-]*\.png$/.test(segment.path)&&!segment.path.includes('//')&&!segment.path.split('/').includes('..')&&sha(segment.sha256)&&
      Number.isSafeInteger(segment.sourcePage)&&((segment.sourcePage as number)>=1||segment.mtmAuthored===true&&segment.sourcePage===0)&&
      Number.isSafeInteger(segment.width)&&(segment.width as number)>=1&&(segment.width as number)<=20000&&
      Number.isSafeInteger(segment.height)&&(segment.height as number)>=1&&(segment.height as number)<=30000)&&
    new Set(content.questions.map(segment=>(segment as Record<string,unknown>).path)).size===content.questions.length;
}

/** kind của PracticeExam là loại đã khóa; nhãn a), b) trong prompt không đổi loại.
 * Giữ câu gốc ở practiceQuestion của snapshot nội bộ. Bốn chuỗi DS khi không có
 * statements là locator đến nguồn ảnh/PDF, không phải câu được biên soạn thêm. */
function scoringQuestion(exam:Record<string,unknown>,q:Record<string,unknown>):Record<string,unknown> {
  const issues=q.issues===undefined?[]:Array.isArray(q.issues)?[...q.issues]:['Danh sách lỗi nguồn của câu không hợp lệ.'];
  const hasSource=verifiedQuestionSource(exam,q);
  if(!text(q.prompt)&&!text(q.text)&&!hasSource)issues.push('Thiếu nội dung câu hoặc nguồn trình bày đã kiểm.');
  const adapted:Record<string,unknown>={...q,practiceQuestion:q,prompt:'Nội dung theo PracticeExam đã khóa.',text:undefined,
    sourceStructureConflict:sourceStructureConflict(q)};
  if(q.kind==='tf'&&!Object.hasOwn(q,'statements'))adapted.statements=hasSource?
    ['a','b','c','d'].map(label=>String(q.sourceRef)+' | ý '+label):[];
  if(q.kind==='short'){
    adapted.responseFormat='short';
    const rule=q.shortRule;
    if(record(rule)&&rule.mode!==({numeric:'decimal',rational:'rational',exact:'exact'} as Record<string,string>)[String(q.mode)])
      issues.push('Chế độ nhập TLN không khớp quy tắc chấp nhận đã khóa.');
  }
  if(issues.length)adapted.issues=issues;
  return adapted;
}

/** Gate xuất bản/mở lượt. Chấm từng phần vẫn giữ câu lỗi trong N; đường ghi
 * phải chờ đủ nguồn, khóa và quy tắc trước khi tạo lượt mới. Chỉ dành rubric MTM. */
export function mtmPracticeGradingReadiness(input:unknown):Validation {
  try{
    const gate=validateMtmEqualAssessment(input);
    if(!gate.valid)return gate;
    const scored=scoreMtmEqualAssessment(input,{},'grading-readiness');
    if(!scored.ok)return {valid:false,errors:scored.errors};
    const mtm=scored.mtm;
    if(!mtm||mtm.officialTotal===null||mtm.pending.length)return {valid:false,errors:
      mtm?.pending.length?mtm.pending.map(error=>'MTM_GRADING_NOT_READY: '+error.code+(error.questionId?' ('+error.questionId+')':'')):
      ['MTM_GRADING_NOT_READY: missing official total']};
    return {valid:true,errors:[]};
  }catch{return {valid:false,errors:['MTM_GRADING_NOT_READY: invalid locked source']};}
}

export function scoreMtmEqualAssessment(input:unknown,submitted:unknown,attemptId='assessment'):ScoreResult {
  const gate=validateMtmEqualAssessment(input);
  if(!gate.valid)return {ok:false,errors:gate.errors};
  if(!record(submitted))return {ok:false,errors:['answers: object required']};
  const exam=input as Assessment;
  const known=new Set(exam.questions.map(q=>q.id));
  const unknown=Object.keys(submitted).filter(id=>!known.has(id));
  if(unknown.length)return {ok:false,errors:unknown.map(id=>'answers: unknown question '+id)};
  const snapshot=new MtmScoringCatalog().prepare({...exam,examId:exam.id,examVersion:exam.versionHash,
    questions:exam.questions.map(q=>scoringQuestion(exam as unknown as Record<string,unknown>,q as unknown as Record<string,unknown>))});
  const ids=new Map(snapshot.questions.map((q,i)=>[q.id,exam.questions[i].id]));
  const answers=Object.fromEntries(snapshot.questions.filter((_,i)=>Object.hasOwn(submitted,exam.questions[i].id))
    .map(q=>[q.id,submitted[ids.get(q.id)!]]));
  const scored=scoreMtmAttempt(lockMtmAttempt(snapshot,attemptId),answers);
  const remap=(issue:MtmIssue):MtmIssue=>issue.questionId?{...issue,questionId:ids.get(issue.questionId)??issue.questionId}:issue;
  const mtm:MtmScore={...scored,pending:scored.pending.map(remap),rows:scored.rows.map(row=>({...row,id:ids.get(row.id)!,issues:row.issues.map(remap)}))};
  const rows=mtm.rows.map(row=>({id:row.id,earnedMillipoints:row.earned===null?null:fractionMillipoints(row.earned),maxMillipoints:10000/exam.questions.length}));
  return {ok:true,mtm,earnedMillipoints:fractionMillipoints(mtm.rawTotal),maxMillipoints:10000,
    finalMillipoints:mtm.officialDisplayTotal===null?null:Number(mtm.officialDisplayTotal.replace('.',''))*10,
    manualPending:[...new Set(mtm.pending.map(p=>p.questionId??'exam'))],rows};
}
