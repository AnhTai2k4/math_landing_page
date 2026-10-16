import type {HomeworkReceipt,HomeworkState} from './btvn-contract';
import {MTM_SCORING_VERSION} from '../exams/mtm-scoring';

type SummaryState=Pick<HomeworkState,'draft'|'receipts'|'kind'>;
const MAX_TIME=253402300799999;
const validTime=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=MAX_TIME;
export const isMtmHomeworkReceipt=(receipt:HomeworkReceipt)=>receipt.rubricVersion===MTM_SCORING_VERSION||receipt.mtm?.versions?.rubricVersion===MTM_SCORING_VERSION;
const matchingMtmSnapshot=(receipt:HomeworkReceipt)=>receipt.rubricVersion===MTM_SCORING_VERSION&&receipt.mtm?.versions?.rubricVersion===MTM_SCORING_VERSION&&receipt.mtm.attemptId===receipt.attemptId;
export const pendingHomeworkReceipt=(receipt:HomeworkReceipt)=>matchingMtmSnapshot(receipt)&&receipt.score===null&&receipt.mtm!.officialTotal===null&&receipt.mtm!.officialDisplayTotal===null&&Array.isArray(receipt.mtm!.pending)&&receipt.mtm!.pending.length>0;
export function homeworkReceiptScore(receipt:HomeworkReceipt):string|null{
  if(pendingHomeworkReceipt(receipt)||receipt.score===null||!Number.isFinite(receipt.score)||receipt.score<0||receipt.score>10)return null;
  if(isMtmHomeworkReceipt(receipt)){
    if(receipt.mtm&&(!matchingMtmSnapshot(receipt)||receipt.mtm.officialTotal===null||receipt.mtm.officialDisplayTotal===null||!Array.isArray(receipt.mtm.pending)||receipt.mtm.pending.length>0))return null;
    return receipt.mtm?.officialDisplayTotal?.replace('.',',')??receipt.score.toLocaleString('vi-VN',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  return receipt.score.toLocaleString('vi-VN',{maximumFractionDigits:3});
}

/** Chỉ nhận biên nhận của chính bản nộp đang xem, không lấy lượt lịch sử thay thế. */
export function acknowledgedHomeworkReceipt(state:SummaryState):HomeworkReceipt|null{
  const {draft}=state;
  if(!draft||typeof draft.attemptId!=='string'||!draft.attemptId.trim()||!validTime(draft.submittedAt)||!Array.isArray(state.receipts))return null;
  const matching=state.receipts.filter(receipt=>receipt?.attemptId===draft.attemptId);
  if(matching.length!==1)return null;
  const receipt=matching[0];
  // Điểm đã xác nhận không phụ thuộc metadata thời gian dùng để tạo phiếu.
  return homeworkReceiptScore(receipt)!==null||pendingHomeworkReceipt(receipt)?receipt:null;
}

/** Phiếu tự gửi cần đủ metadata hợp lệ; thiếu phiếu không khóa điểm hoặc lượt tiếp. */
function shareableHomeworkReceipt(state:SummaryState):HomeworkReceipt|null{
  const receipt=acknowledgedHomeworkReceipt(state),draft=state.draft;
  if(!receipt||!draft||!validTime(draft.startedAt)||!validTime(draft.updatedAt)||!validTime(draft.submittedAt)||draft.submittedAt<draft.startedAt||draft.submittedAt>draft.updatedAt)return null;
  if(!Number.isSafeInteger(receipt.attemptNumber)||receipt.attemptNumber<1||!validTime(receipt.submittedAt)||receipt.submittedAt<draft.startedAt||!Number.isSafeInteger(receipt.elapsedSeconds)||receipt.elapsedSeconds<0||receipt.elapsedSeconds>Math.floor(MAX_TIME/1000)||(receipt.late!==null&&typeof receipt.late!=='boolean')||typeof receipt.timedOut!=='boolean')return null;
  return receipt;
}

/** Nội dung tự gửi chỉ có các trường kết quả được chọn rõ, không có trường văn bản riêng. */
export function createHomeworkResultSummary(state:SummaryState):string|null{
  const receipt=shareableHomeworkReceipt(state);
  if(!receipt)return null;
  const date=new Date(receipt.submittedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'});
  const minutes=Math.floor(receipt.elapsedSeconds/60),seconds=receipt.elapsedSeconds%60;
  return [
    'MINH THÀNH MATH',
    state.kind==='kiem-tra-thang'?'Kết quả kiểm tra cuối tháng':'Kết quả BTVN',
    'Lượt làm: '+receipt.attemptNumber,
    'Điểm: '+(homeworkReceiptScore(receipt)===null?'Chưa công bố tổng điểm':homeworkReceiptScore(receipt)+'/10'),
    ...(isMtmHomeworkReceipt(receipt)?['Tổng tính từ điểm gốc bằng phân số chính xác, làm tròn ROUND_HALF_UP đến 2 chữ số thập phân.']:[]),
    'Nộp lúc: '+date+' (giờ Việt Nam)',
    'Thời gian làm bài: '+minutes+' phút '+seconds+' giây',
    'Hạn nộp: '+(receipt.late===null?'Chờ xác minh':receipt.late?'Nộp muộn':'Đúng hạn'),
    ...(receipt.timedOut?['Kết thúc lượt: Hết giờ tự nộp']:[]),
    'Kết quả của lượt đã được máy chủ xác nhận.',
    'Phiếu này không được gửi tự động.',
  ].join('\n');
}
