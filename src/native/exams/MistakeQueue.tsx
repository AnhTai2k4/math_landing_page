import React,{lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import ExamReview from './ExamReview';
import {mistakeSummary,type ReviewHistory,type MistakeItem,type MistakeStatus} from './mistake-summary';
import {STATUS_LABELS} from './review';
import {HISTORY_LIMIT} from './store';
import {erratumFor,originalExamId} from './practice-errata';
import {SOURCE_HOLDS} from './source-holds';
const QuestionPdf=lazy(()=>import('./QuestionPdf'));

export default function MistakeQueue({history}:{history:ReviewHistory}) {
  const summary=useMemo(()=>mistakeSummary(history),[history]);
  const [filter,setFilter]=useState<'all'|MistakeStatus>('all'),[limit,setLimit]=useState(20),[selected,setSelected]=useState<MistakeItem|null>(null),[pdfOpen,setPdfOpen]=useState(false);
  const items=summary.items.filter(item=>filter==='all'||item.status===filter);
  const active=selected&&summary.items.find(item=>item.key===selected.key&&item.draft.attemptId===selected.draft.attemptId);
  const opener=useRef<HTMLButtonElement|null>(null),heading=useRef<HTMLHeadingElement|null>(null),hadActive=useRef(false);
  const returnFocus=()=>{(opener.current?.isConnected?opener.current:heading.current)?.focus();};
  useEffect(()=>{if(hadActive.current&&!active)returnFocus();hadActive.current=!!active;},[active]);
  const uncertain=history.messages.length>0||summary.excluded>0;
  return <section className="ep-card ep-mistake-queue" aria-labelledby="ep-mistake-heading">
    <h2 id="ep-mistake-heading" ref={heading} tabIndex={-1}>Câu cần ôn trên trình duyệt này</h2>
    <p>Tổng hợp các lượt đã nộp còn lưu ở đây, không phụ thuộc bộ lọc đề phía trên. Mỗi phiên bản dùng đáp án của chính phiên bản đó; câu đạt đủ điểm ở lượt gần nhất sẽ rời danh sách.</p>
    <p>Chỉ đọc lịch sử, giữ nguyên điểm và bài làm. Chưa đồng bộ sang thiết bị khác. Kho lưu lượt cũ có giới hạn {HISTORY_LIMIT} lượt; danh sách không đại diện cho toàn bộ quá trình học.</p>
    {history.messages.map((message,index)=><p key={index} className="ep-notice" role="status">{message}</p>)}
    {summary.excluded>0&&<p className="ep-notice">Có {summary.excluded} bản lưu chưa đủ điều kiện đối chiếu; chưa tính vào danh sách.</p>}
    {!!summary.items.length&&<>
      <div className="ep-review-filters" role="group" aria-label="Lọc câu cần ôn">{(['all','wrong','partial','unanswered']as const).map(value=><button type="button" key={value} aria-pressed={filter===value} onClick={()=>{setFilter(value);setLimit(20);}}>{value==='all'?'Tất cả':STATUS_LABELS[value]} ({summary.items.filter(item=>value==='all'||item.status===value).length})</button>)}</div>
      <p role="status" aria-live="polite">Đang xem {Math.min(items.length,limit)}/{items.length} câu · {summary.attempts} lượt hợp lệ đã đối chiếu.</p>
      <ul className="ep-mistake-list">{items.slice(0,limit).map(item=><li key={item.key} className="ep-mistake-item">
        <h3>{item.exam.title}</h3><p><strong>{item.part} · Câu {item.questionNumber}</strong> <span className={`ep-verdict ep-verdict-${item.status}`}>{STATUS_LABELS[item.status]}</span></p>
        <p>Gần nhất: {new Date(item.draft.submittedAt!).toLocaleString('vi-VN')} · {item.attemptCount} lượt cùng phiên bản.</p>
        <p>Trong lịch sử còn lưu: chưa đúng {item.occurrences.wrong} lượt · đúng một phần {item.occurrences.partial} lượt · bỏ trống {item.occurrences.unanswered} lượt.</p>
        <button type="button" aria-label={`Xem bài làm và lời giải: ${item.exam.title}, ${item.part}, câu ${item.questionNumber}`} onClick={event=>{opener.current=event.currentTarget;setPdfOpen(false);setSelected(item);}}>Xem bài làm và lời giải</button>
      </li>)}</ul>
      {items.length>limit&&<button type="button" onClick={()=>setLimit(previous=>previous+20)}>Xem thêm {Math.min(20,items.length-limit)} câu</button>}
      {!items.length&&<p>Không có câu thuộc trạng thái đang chọn.</p>}
    </>}
    {!summary.items.length&&<p role="status">{uncertain?'Chưa đủ dữ liệu để kết luận các câu cần ôn.':summary.attempts?'Trong các lượt hợp lệ còn lưu, không còn câu chưa đủ điểm ở lần nộp gần nhất của từng phiên bản.':'Chưa có lượt đã nộp hợp lệ để tổng hợp. Làm và nộp một đề để xem các câu cần ôn.'}</p>}
    {active&&<div className="ep-mistake-review" aria-label="Lượt làm dùng để ôn lại">
      <p><strong>Đang đối chiếu:</strong> {active.exam.title} · {new Date(active.draft.submittedAt!).toLocaleString('vi-VN')}</p>
      <p>Nguồn: {active.exam.sourceMaterial.title} · {active.exam.sourceMaterial.version}</p>
      {active.exam.answerVerificationNote&&<p>{active.exam.answerVerificationNote}</p>}
      {erratumFor(active.exam.id)&&<p className="ep-notice">{active.exam.id===originalExamId(active.exam.id)?'Lượt trước đính chính: điểm giữ theo khóa cũ.':'Lượt theo điều kiện đính chính MTM.'} {erratumFor(active.exam.id)!.condition}</p>}
      {SOURCE_HOLDS[active.exam.id]&&<p className="ep-notice">Điểm lượt cũ dùng khóa trước khi phát hiện vấn đề: {SOURCE_HOLDS[active.exam.id]}</p>}
      {active.exam.id.startsWith('mtm-custom-')?<p>Đề tự đăng: dùng hai nút PDF bên dưới để đọc đề và lời giải đầy đủ của đúng phiên bản đã nộp. Mỗi lần mở sẽ lấy liên kết mới; không dùng lại liên kết tạm trong bản lưu.</p>:active.exam.sourcePdf&&<details open={pdfOpen} onToggle={event=>setPdfOpen(event.currentTarget.open)}><summary>Đọc đề PDF đúng phiên bản này</summary>{pdfOpen&&<Suspense fallback={<p role="status">Đang mở bản đề đã lưu…</p>}><QuestionPdf key={active.exam.sourcePdf.sha256} file={active.exam.sourcePdf} title={active.exam.title} onReady={()=>{}}/></Suspense>}</details>}
      <button type="button" onClick={()=>setSelected(null)}>Đóng bài đang ôn</button>
      <ExamReview key={active.key+active.draft.attemptId} exam={active.exam} draft={active.draft} initialQuestionId={active.questionId}/>
    </div>}
  </section>;
}
