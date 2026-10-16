import {useState} from 'react';
import type {HomeworkState,HomeworkLesson} from './btvn-contract';
import {homeworkTitle,homeworkLessonCaption,displayClassName} from './presentation';
import ExamReview from '../exams/ExamReview';
import {LessonVideo} from './LessonCards';
import HomeworkRetry from './HomeworkRetry';
import {reviewRows} from '../exams/review';
import {hasReadableTfStatements} from '../exams/question-statements';

export const homeworkDate=(at:number)=>new Date(at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',weekday:'long',day:'2-digit',month:'2-digit'});
export function HomeworkDeadline({lesson,dueAt}:{lesson?:HomeworkLesson;dueAt:number|null}){
  return <p className="btvn-deadline">{dueAt!==null?'Hạn: trước '+homeworkDate(dueAt)+' (theo lịch lớp)':lesson?.expectedDueAt!=null?'Hạn dự kiến: trước '+homeworkDate(lesson.expectedDueAt)+' (theo lịch lớp)':'Hạn: chờ xác minh lịch lớp và ca học'} (giờ Việt Nam).</p>;
}
export default function HomeworkOverview({state,busy,onStart}:{state:HomeworkState;busy:boolean;onStart:()=>void}){
  const [solutions,setSolutions]=useState(false),[video,setVideo]=useState(false);
  const lesson=state.lessons?.find(l=>l.lessonCode===state.lessonCode);
  const receipts=[...state.receipts].sort((a,b)=>b.attemptNumber-a.attemptNumber);
  const current=receipts.find(r=>r.attemptId===state.draft?.attemptId)??receipts[0];
  const best=state.bestScore===null?'Chưa có':state.bestScore.toLocaleString('vi-VN')+'/10';
  const remaining=Math.max(0,state.maxAttempts-state.attemptsUsed);
  const monthly=state.kind==='kiem-tra-thang',canReview=state.solutionsAvailable!==false;
  const unavailableRetry=canReview&&state.exam&&state.draft?.submittedAt!=null&&state.draft.examId===state.exam.id&&state.draft.examVersionHash===state.exam.versionHash&&state.receipts.some(r=>r.attemptId===state.draft!.attemptId&&Number.isFinite(r.score))
    ?reviewRows(state.exam,state.draft).filter(({q,status})=>q.kind==='tf'&&(status==='wrong'||status==='partial')&&!hasReadableTfStatements(q)).length:0;
  return <div id="btvn-summary" className="btvn-detail">
    <div className="btvn-heading"><p className="btvn-eyebrow">{displayClassName(state)} · {current?(monthly?'KẾT QUẢ KIỂM TRA THÁNG':'KẾT QUẢ BTVN'):'CHUẨN BỊ LÀM BÀI'}</p><h1>{homeworkTitle(state)}</h1>{homeworkLessonCaption(state)&&<p className="btvn-sub">{homeworkLessonCaption(state)}</p>}</div>
    {current&&<div className="btvn-result-meta"><span>Bài đã nộp và lưu kết quả.</span><strong className="btvn-chip success">Điểm cao nhất: {best}</strong></div>}
    {monthly&&<p role="status">Kiểm tra cuối tháng · Chỉ 1 lượt. Mở: {state.opensAt&&homeworkDate(state.opensAt)}. Đóng: {state.closesAt&&homeworkDate(state.closesAt)} (giờ Việt Nam). {!canReview&&'Lời giải chỉ mở sau giờ đóng.'}</p>}
    {!monthly&&state.canStart===false&&state.opensAt!==undefined&&<p role="status">Mở làm sau buổi học: {homeworkDate(state.opensAt)} (giờ Việt Nam).</p>}
    <div className="btvn-detail-grid">
      <article className="btvn-sheet">
        {current?<><div className="btvn-result-top"><span className="btvn-check">✓</span><div><h2>Em đã hoàn thành lượt {current.attemptNumber}</h2><p>{current.late===null?'Chờ xác minh hạn nộp':current.late?'Nộp muộn':'Đúng hạn'}{current.timedOut?' · Hết giờ tự nộp':''}</p></div></div><div className="btvn-score-big"><strong>{current.score.toLocaleString('vi-VN')}<small>/10</small></strong><p>Điểm lượt này</p></div></>:<h2>Trước khi bắt đầu</h2>}
        <div className="btvn-stats"><div><small>Đã dùng</small><strong>{state.attemptsUsed}/{state.maxAttempts} lượt</strong></div><div><small>Điểm cao nhất</small><strong>{best}</strong></div><div><small>{current?'Còn lại':'Thời gian'}</small><strong>{current?remaining+' lượt':state.exam?state.exam.durationMinutes+' phút/lượt':'Chờ mở bài'}</strong></div></div>
        {!current&&<>{!monthly&&<HomeworkDeadline lesson={lesson} dueAt={state.dueAt}/>}<p>Em có tối đa {state.maxAttempts} lượt{state.exam&&<>, mỗi lượt {state.exam.durationMinutes} phút, gồm {state.exam.questions.length} câu</>}. Mở lượt tính ngay là một lần làm.</p><p>{monthly?'Bài tự nộp khi hết thời gian làm hoặc đến giờ đóng.':'Điểm cao nhất tính cả lần nộp muộn. Hết thời gian, bài tự nộp.'}</p></>}
        <div className="btvn-overview-actions">{current&&canReview&&state.draft?.submittedAt!=null&&<button className="btvn-btn primary" aria-expanded={solutions} aria-controls="btvn-solutions" onClick={()=>setSolutions(!solutions)}>{solutions?'Đóng lời giải':'Xem lời giải'}</button>}{remaining>0?<button className={'btvn-btn'+(current?'':' primary')} disabled={busy||state.canStart===false} onClick={onStart}>{current?'Làm lượt tiếp':'Bắt đầu làm bài'}</button>:<p>Em đã dùng hết {state.maxAttempts} lượt.</p>}</div>
        {current&&canReview&&!monthly&&<p className="btvn-footnote">Lượt làm sau khi đã xem lời giải vẫn tính vào điểm cao nhất của BTVN.</p>}
        {remaining>0&&state.exam&&<p className="btvn-footnote">Lượt tiếp theo: lượt {state.attemptsUsed+1} · {state.exam.durationMinutes} phút</p>}
      </article>
      <aside className="btvn-sheet btvn-history">{current?<><h2>Các lượt em đã làm</h2>{receipts.map(r=><div className="btvn-history-row" key={r.attemptId}><div><b>Lượt {r.attemptNumber}</b><small>{homeworkDate(r.submittedAt)} · {r.late===null?'Chờ xác minh hạn':r.late?'Nộp muộn':'Đúng hạn'}{r.timedOut?' · Hết giờ':''}</small></div><strong>{r.score.toLocaleString('vi-VN')}/10</strong></div>)}<HomeworkDeadline lesson={lesson} dueAt={state.dueAt}/></>:<><p className="btvn-eyebrow">SẴN SÀNG RỒI CHỨ?</p><h2>Đến lượt em thử sức.</h2><p>Chuẩn bị giấy nháp và máy tính. Chọn một nơi yên tĩnh để tập trung làm bài.</p></>}
        {lesson&&(lesson.videoId||lesson.videoUrl)&&<button className="btvn-btn" aria-expanded={video} onClick={()=>setVideo(!video)}>{video?'Đóng video':'▷ Xem video buổi học'}</button>}
      </aside>
    </div>
    {state.assetWarnings?.map(warning=><p key={warning} role="status">{warning}</p>)}
    {unavailableRetry>0&&<p className="btvn-footnote">Có {unavailableRetry} câu Đúng/Sai chưa đủ điểm chưa đưa vào phần ôn vì màn này thiếu văn bản các mệnh đề. Em xem lại đề gốc và lời giải để đối chiếu.</p>}
    <HomeworkRetry state={state}/>
    {video&&lesson&&<div className="btvn-sheet"><LessonVideo lesson={lesson} demo={state.demo}/></div>}
    {solutions&&canReview&&state.exam&&state.draft?.submittedAt!=null&&<div id="btvn-solutions" className="btvn-sheet"><ExamReview exam={state.exam} draft={state.draft} showSummary={false}/></div>}
  </div>;
}
