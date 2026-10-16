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

export function scoreMtmEqualAssessment(input:unknown,submitted:unknown,attemptId='assessment'):ScoreResult {
  const gate=validateMtmEqualAssessment(input);
  if(!gate.valid)return {ok:false,errors:gate.errors};
  if(!record(submitted))return {ok:false,errors:['answers: object required']};
  const exam=input as Assessment;
  const known=new Set(exam.questions.map(q=>q.id));
  const unknown=Object.keys(submitted).filter(id=>!known.has(id));
  if(unknown.length)return {ok:false,errors:unknown.map(id=>'answers: unknown question '+id)};
  const snapshot=new MtmScoringCatalog().prepare({...exam,examId:exam.id,examVersion:exam.versionHash,
    questions:exam.questions.map(q=>q.kind==='short'?{...q,responseFormat:'short',
      ...(q.shortRule&&q.shortRule.mode!==({numeric:'decimal',rational:'rational',exact:'exact'} as const)[q.mode]?
        {issues:[...(Array.isArray(q.issues)?q.issues:q.issues===undefined?[]:['Danh sách lỗi nguồn của câu không hợp lệ.']),'Chế độ nhập TLN không khớp quy tắc chấp nhận đã khóa.']}:{})}:{...q})});
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
