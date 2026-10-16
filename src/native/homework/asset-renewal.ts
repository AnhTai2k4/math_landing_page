import type {HomeworkState} from './btvn-contract';
import type {PracticeExam} from '../exams/data';
import type {SourceSegment} from '../exams/MtmSourceContent';

/** Cùng độ lệch đồng hồ với phòng làm bài, dựa trên mốc server vừa nhận. */
export function homeworkServerNow(state:Pick<HomeworkState,'serverNow'|'clientReceivedAt'>,clientNow=Date.now()):number{
  return Number.isFinite(state.serverNow)&&Number.isFinite(state.clientReceivedAt)?state.serverNow!+Math.max(0,clientNow-state.clientReceivedAt!):clientNow;
}
function renewSegments(before:SourceSegment[]|undefined,after:SourceSegment[]|undefined):SourceSegment[]|undefined{
  return before?.map(segment=>{
    const fresh=after?.find(item=>item.path===segment.path&&item.sha256===segment.sha256&&item.sourcePage===segment.sourcePage&&item.width===segment.width&&item.height===segment.height);
    return fresh?{...segment,privateUrl:fresh.privateUrl,privateUnavailable:fresh.privateUnavailable}:segment;
  });
}
/** Bản đang làm chỉ nhận chữ ký mới cho tài sản đã có. Không nhập khóa,
 * lời giải, prompt hoặc dữ liệu kết quả từ snapshot đã công bố. */
function renewQuestionAssets(before:PracticeExam|null,after:PracticeExam|null):PracticeExam|null{
  if(!before||!after)return before;
  const exam={...before,assetWarnings:after.assetWarnings,sourceInstructions:renewSegments(before.sourceInstructions,after.sourceInstructions),questions:before.questions.map(question=>{
    const fresh=after.questions.find(item=>item.id===question.id);
    return fresh&&question.sourceContent?{...question,sourceContent:{...question.sourceContent,questions:renewSegments(question.sourceContent.questions,fresh.sourceContent?.questions)!}}:question;
  })};
  if(before.sourcePdf&&after.sourcePdf&&before.sourcePdf.sha256===after.sourcePdf.sha256)exam.sourcePdf={...before.sourcePdf,url:after.sourcePdf.url};
  if(before.mtmDocuments&&after.mtmDocuments&&before.mtmDocuments.questions.sha256===after.mtmDocuments.questions.sha256)exam.mtmDocuments={...before.mtmDocuments,questions:{...before.mtmDocuments.questions,url:after.mtmDocuments.questions.url}};
  return exam;
}

export const ASSET_RENEW_WINDOW_MS=30*60*1000;
/** Tab hiện lại cũng phải kiểm hạn; lỗi ảnh được thử sớm, chống bão request. */
export function createAssetRenewal(refresh:()=>Promise<void>,clock=Date.now){
  let pending:Promise<void>|null=null,lastAttempt=-Infinity;
  return (expiresAt:number|undefined,imageFailed=false)=>{
    const now=clock();
    if(!imageFailed&&(!Number.isFinite(expiresAt)||expiresAt!-now>ASSET_RENEW_WINDOW_MS))return Promise.resolve();
    if(pending)return pending;
    if(!imageFailed&&now-lastAttempt<30000)return Promise.resolve();
    lastAttempt=now;
    pending=refresh().finally(()=>{pending=null;});return pending;
  };
}
/** Phản hồi save không có đề. Giữ nguyên ảnh, hạn chữ ký và lượt hiện tại. */
export function mergeHomeworkSave(previous:HomeworkState,next:HomeworkState):HomeworkState{
  if(!next.saveOnly)return next;
  if(previous.lessonCode!==next.lessonCode||previous.draft?.attemptId!==next.draft?.attemptId)return previous;
  return {...previous,serverNow:next.serverNow,clientReceivedAt:next.clientReceivedAt,draft:next.draft,revision:next.revision,receipts:next.receipts,bestScore:next.bestScore,attemptsUsed:next.attemptsUsed};
}

/** Nhận cùng snapshot gia hạn, không lấy dữ liệu của lượt/bản đề khác hoặc lùi kết quả.
 * Bản đang làm thuộc ManagedAttempt và saver; refresh ảnh không được thay đáp án đó. */
export function mergeHomeworkRenewal(previous:HomeworkState,next:HomeworkState):HomeworkState{
  if(next.saveOnly||previous.lessonCode!==next.lessonCode)return previous;
  const before=previous.draft,after=next.draft;
  if(!!before!==!!after)return previous;
  if(before&&after&&(before.attemptId!==after.attemptId||before.examId!==after.examId||
    before.examVersionHash!==after.examVersionHash||before.rubricVersion!==after.rubricVersion||
    before.answerKeyVersion!==after.answerKeyVersion||before.startedAt!==after.startedAt||before.deadline!==after.deadline))return previous;
  if(previous.exam&&!next.exam)return previous;
  if(previous.exam&&next.exam&&(previous.exam.id!==next.exam.id||previous.exam.versionHash!==next.exam.versionHash||
    previous.exam.sourceHash!==next.exam.sourceHash||previous.exam.rubricVersion!==next.exam.rubricVersion||
    previous.exam.answerKeyVersion!==next.exam.answerKeyVersion))return previous;
  if(after&&next.exam&&(after.examId!==next.exam.id||after.examVersionHash!==next.exam.versionHash||
    after.rubricVersion!==next.exam.rubricVersion||after.answerKeyVersion!==next.exam.answerKeyVersion))return previous;
  if(Number.isFinite(previous.serverNow)&&Number.isFinite(next.serverNow)&&next.serverNow!<previous.serverNow!)return previous;
  if(Number.isSafeInteger(previous.revision)&&Number.isSafeInteger(next.revision)&&next.revision!<previous.revision!)return previous;
  if(before&&after&&before.submittedAt!==null&&(after.submittedAt!==before.submittedAt||
    after.revision<before.revision||after.updatedAt<before.updatedAt))return previous;
  // Một phản hồi đã giấu điểm hoặc thiếu biên nhận không được che lại kết quả đã công bố.
  if(previous.solutionsAvailable===true&&next.solutionsAvailable===false)return previous;
  if(previous.receipts.some(receipt=>typeof receipt.score==='number'&&Number.isFinite(receipt.score)&&
    !next.receipts.some(candidate=>candidate.attemptId===receipt.attemptId&&typeof candidate.score==='number'&&Number.isFinite(candidate.score))))return previous;
  if(before?.submittedAt===null)return {...previous,exam:renewQuestionAssets(previous.exam,next.exam),
    assetWarnings:next.assetWarnings,assetsExpiresAt:next.assetsExpiresAt,
    serverNow:next.serverNow,clientReceivedAt:next.clientReceivedAt};
  return {...previous,exam:next.exam,assetWarnings:next.assetWarnings,lessons:next.lessons,
    assetsExpiresAt:next.assetsExpiresAt,canStart:next.canStart,solutionsAvailable:next.solutionsAvailable,
    serverNow:next.serverNow,clientReceivedAt:next.clientReceivedAt,revision:next.revision,
    receipts:next.receipts,bestScore:next.bestScore,attemptsUsed:next.attemptsUsed,
    draft:before?.submittedAt===null?before:after};
}
