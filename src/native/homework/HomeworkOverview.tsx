import {useId,useState} from 'react';
import type {HomeworkState,HomeworkLesson} from './btvn-contract';
import {homeworkTitle,homeworkLessonCaption,displayClassName} from './presentation';
import ExamReview from '../exams/ExamReview';
import {LessonVideo} from './LessonCards';
import HomeworkRetry from './HomeworkRetry';
import HomeworkResultSummary from './HomeworkResultSummary';
import {acknowledgedHomeworkReceipt} from './result-summary';
import {reviewRows} from '../exams/review';
import {hasReadableTfStatements} from '../exams/question-statements';

export const homeworkDate=(at:number)=>Number.isSafeInteger(at)&&at>=0&&at<=253402300799999?new Date(at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',weekday:'long',day:'2-digit',month:'2-digit'}):'Chưa xác định thời điểm';
const validScore=(score:number)=>Number.isFinite(score)&&score>=0&&score<=10;
export function HomeworkDeadline({lesson,dueAt}:{lesson?:HomeworkLesson;dueAt:number|null}){
  return <p className="btvn-deadline">{dueAt!==null?'Hạn: trước '+homeworkDate(dueAt)+' (theo lịch lớp)':lesson?.expectedDueAt!=null?'Hạn dự kiến: trước '+homeworkDate(lesson.expectedDueAt)+' (theo lịch lớp)':'Hạn: chờ xác minh lịch lớp và ca học'} (giờ Việt Nam).</p>;
}
export default function HomeworkOverview({state,busy,onStart}:{state:HomeworkState;busy:boolean;onStart:()=>void}){
  const [solutions,setSolutions]=useState(false),[video,setVideo]=useState(false);
  const receiptStatusId=useId()+'-receipt-status';
  const lesson=state.lessons?.find(l=>l.lessonCode===state.lessonCode);
  const receipts=[...state.receipts].filter(Boolean).sort((a,b)=>b.attemptNumber-a.attemptNumber);
  const current=acknowledgedHomeworkReceipt(state);
  const awaitingReceipt=state.draft?.submittedAt!=null&&!current;
  const best=state.bestScore===null?'Chưa có':validScore(state.bestScore)?state.bestScore.toLocaleString('vi-VN')+'/10':'Chưa hiện được điểm';
  const remaining=Math.max(0,state.maxAttempts-state.attemptsUsed);
  const monthly=state.kind==='kiem-tra-thang',canReview=state.solutionsAvailable!==false;
  const hasAnswers=!!state.draft?.answers&&typeof state.draft.answers==='object'&&!Array.isArray(state.draft.answers);
  const reviewReady=!!current&&canReview&&hasAnswers&&!!state.exam&&!!state.draft&&state.draft.examId===state.exam.id&&state.draft.examVersionHash===state.exam.versionHash&&state.draft.rubricVersion===state.exam.rubricVersion;
  const unavailableRetry=reviewReady&&state.exam&&state.draft
    ?reviewRows(state.exam,state.draft).filter(({q,status})=>q.kind==='tf'&&(status==='wrong'||status==='partial'||status==='unanswered')&&!hasReadableTfStatements(q)).length:0;
  return <div id="btvn-summary" className="btvn-detail">
    <div className="btvn-heading"><p className="btvn-eyebrow">{displayClassName(state)} · {current?(monthly?'KẾT QUẢ KIỂM TRA THÁNG':'KẾT QUẢ BTVN'):awaitingReceipt?'ĐANG XÁC NHẬN KẾT QUẢ':'CHUẨN BỊ LÀM BÀI'}</p><h1>{homeworkTitle(state)}</h1>{homeworkLessonCaption(state)&&<p className="btvn-sub">{homeworkLessonCaption(state)}</p>}</div>
    {current&&<div className="btvn-result-meta"><span>Bài đã nộp và lưu kết quả.</span><strong className="btvn-chip success">Điểm cao nhất: {best}</strong></div>}
    {monthly&&<p role="status">Kiểm tra cuối tháng · Chỉ 1 lượt. Mở: {state.opensAt&&homeworkDate(state.opensAt)}. Đóng: {state.closesAt&&homeworkDate(state.closesAt)} (giờ Việt Nam). {!canReview&&'Lời giải chỉ mở sau giờ đóng.'}</p>}
    {!monthly&&state.canStart===false&&state.opensAt!==undefined&&<p role="status">Mở làm sau buổi học: {homeworkDate(state.opensAt)} (giờ Việt Nam).</p>}
    <div className="btvn-detail-grid">
      <article className="btvn-sheet">
        {current?<><div className="btvn-result-top"><span className="btvn-check">✓</span><div><h2>{Number.isSafeInteger(current.attemptNumber)&&current.attemptNumber>0?'Em đã hoàn thành lượt '+current.attemptNumber:'Em đã hoàn thành lượt này'}</h2><p>{typeof current.late!=='boolean'?'Chờ xác minh hạn nộp':current.late?'Nộp muộn':'Đúng hạn'}{current.timedOut===true?' · Hết giờ tự nộp':''}</p></div></div><div className="btvn-score-big"><strong>{current.score.toLocaleString('vi-VN')}<small>/10</small></strong><p>Điểm lượt này</p></div>{(!Number.isSafeInteger(current.elapsedSeconds)||current.elapsedSeconds<0)&&<p className="btvn-footnote">Chưa xác định được thời gian làm bài. Điểm lượt này đã được xác nhận.</p>}</>:awaitingReceipt?<><h2>Đang xác nhận lượt vừa nộp</h2><p id={receiptStatusId} role="status">Chưa có biên nhận hợp lệ của lượt vừa nộp. Em giữ trang và tải lại để kiểm tra kết quả.</p></>:<h2>Trước khi bắt đầu</h2>}
        <div className="btvn-stats"><div><small>Đã dùng</small><strong>{state.attemptsUsed}/{state.maxAttempts} lượt</strong></div><div><small>Điểm cao nhất</small><strong>{best}</strong></div><div><small>{current||awaitingReceipt?'Còn lại':'Thời gian'}</small><strong>{current||awaitingReceipt?remaining+' lượt':state.exam?state.exam.durationMinutes+' phút/lượt':'Chờ mở bài'}</strong></div></div>
        {!current&&!awaitingReceipt&&<>{!monthly&&<HomeworkDeadline lesson={lesson} dueAt={state.dueAt}/>}<p>Em có tối đa {state.maxAttempts} lượt{state.exam&&<>, mỗi lượt {state.exam.durationMinutes} phút, gồm {state.exam.questions.length} câu</>}. Mở lượt tính ngay là một lần làm.</p><p>{monthly?'Bài tự nộp khi hết thời gian làm hoặc đến giờ đóng.':'Điểm cao nhất tính cả lần nộp muộn. Hết thời gian, bài tự nộp.'}</p></>}
        <div className="btvn-overview-actions">{reviewReady&&<button className="btvn-btn primary" aria-expanded={solutions} aria-controls="btvn-solutions" onClick={()=>setSolutions(!solutions)}>{solutions?'Đóng lời giải':'Xem lời giải'}</button>}{remaining>0?<button className={'btvn-btn'+(!current&&!awaitingReceipt?' primary':'')} disabled={busy||state.canStart===false||awaitingReceipt} aria-describedby={awaitingReceipt?receiptStatusId:undefined} onClick={onStart}>{current||awaitingReceipt?'Làm lượt tiếp':'Bắt đầu làm bài'}</button>:<p>Em đã dùng hết {state.maxAttempts} lượt.</p>}</div>
        <HomeworkResultSummary state={state}/>
        {reviewReady&&!monthly&&<p className="btvn-footnote">Lượt làm sau khi đã xem lời giải vẫn tính vào điểm cao nhất của BTVN.</p>}
        {current&&!hasAnswers&&<p className="btvn-footnote">Chưa mở được phần ôn của bản nộp này. Điểm đã lưu và quyền làm lượt tiếp vẫn được giữ.</p>}
        {!awaitingReceipt&&remaining>0&&state.exam&&<p className="btvn-footnote">Lượt tiếp theo: lượt {state.attemptsUsed+1} · {state.exam.durationMinutes} phút</p>}
      </article>
      <aside className="btvn-sheet btvn-history">{awaitingReceipt&&<><p className="btvn-eyebrow">ĐANG CHỜ BIÊN NHẬN</p><h2>Đang chờ kết quả lượt vừa nộp</h2><p>Lượt tiếp sẽ mở khi có biên nhận của lượt này.</p></>}{receipts.length>0?<><h2>Các lượt em đã làm</h2>{receipts.map(r=><div className="btvn-history-row" key={r.attemptId}><div><b>{Number.isSafeInteger(r.attemptNumber)&&r.attemptNumber>0?'Lượt '+r.attemptNumber:'Lượt đã làm'}</b><small>{homeworkDate(r.submittedAt)} · {typeof r.late!=='boolean'?'Chờ xác minh hạn':r.late?'Nộp muộn':'Đúng hạn'}{r.timedOut===true?' · Hết giờ':''}</small></div>{validScore(r.score)?<strong>{r.score.toLocaleString('vi-VN')}/10</strong>:<span className="btvn-footnote">Chưa hiện được điểm lượt này</span>}</div>)}<HomeworkDeadline lesson={lesson} dueAt={state.dueAt}/></>:!awaitingReceipt&&<><p className="btvn-eyebrow">SẴN SÀNG RỒI CHỨ?</p><h2>Đến lượt em thử sức.</h2><p>Chuẩn bị giấy nháp và máy tính. Chọn một nơi yên tĩnh để tập trung làm bài.</p></>}
        {lesson&&(lesson.videoId||lesson.videoUrl)&&<button className="btvn-btn" aria-expanded={video} onClick={()=>setVideo(!video)}>{video?'Đóng video':'▷ Xem video buổi học'}</button>}
      </aside>
    </div>
    {state.assetWarnings?.map(warning=><p key={warning} role="status">{warning}</p>)}
    {unavailableRetry>0&&<p className="btvn-footnote">Có {unavailableRetry} câu Đúng/Sai chưa đủ điểm hoặc chưa trả lời chưa đưa vào phần ôn vì màn này thiếu văn bản các mệnh đề. Em xem lại đề gốc và lời giải để đối chiếu.</p>}
    <HomeworkRetry state={state}/>
    {video&&lesson&&<div className="btvn-sheet"><LessonVideo lesson={lesson} demo={state.demo}/></div>}
    {solutions&&reviewReady&&state.exam&&state.draft&&<div id="btvn-solutions" className="btvn-sheet"><ExamReview exam={state.exam} draft={state.draft} showSummary={false}/></div>}
  </div>;
}
