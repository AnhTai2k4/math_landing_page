import type {HomeworkState} from './btvn-contract';
export const ASSET_RENEW_WINDOW_MS=30*60*1000;
/** Tab hiện lại cũng phải kiểm hạn; lỗi ảnh được thử sớm, chống bão request. */
export function createAssetRenewal(refresh:()=>Promise<void>,clock=Date.now){
  let pending:Promise<void>|null=null,lastAttempt=-Infinity;
  return (expiresAt:number|undefined,imageFailed=false)=>{
    const now=clock();
    if(!imageFailed&&(!Number.isFinite(expiresAt)||expiresAt!-now>ASSET_RENEW_WINDOW_MS))return Promise.resolve();
    if(pending)return pending;
    if(now-lastAttempt<30000)return Promise.resolve();
    lastAttempt=now;
    pending=refresh().finally(()=>{pending=null;});return pending;
  };
}
/** Phản hồi save không có đề. Giữ nguyên ảnh, hạn chữ ký và lượt hiện tại. */
export function mergeHomeworkSave(previous:HomeworkState,next:HomeworkState):HomeworkState{
  if(!next.saveOnly)return next;
  if(previous.lessonCode!==next.lessonCode||previous.draft?.attemptId!==next.draft?.attemptId)return previous;
  return {...previous,draft:next.draft,revision:next.revision,receipts:next.receipts,bestScore:next.bestScore,attemptsUsed:next.attemptsUsed};
}
