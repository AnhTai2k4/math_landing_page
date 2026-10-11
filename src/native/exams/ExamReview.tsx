import ResultSummary from './ResultSummary';
import {examSections} from './flexible-profile';
import React,{lazy,Suspense,useEffect,useId,useState,type ReactNode} from 'react';
import type {PracticeExam,PracticeQuestion} from './data';
import type {Draft} from './store';
import {displayAnswer,formatPoints,reviewRows,statementLetters,STATUS_LABELS} from './review';
const DetailedSolution=lazy(()=>import('./DetailedSolution'));
const SolutionPdf=lazy(()=>import('../admin/SolutionPdf'));

export default function ExamReview({exam,draft,initialQuestionId,renderText,renderSolutionExtra,showSummary=true}:{exam:PracticeExam;draft:Draft;initialQuestionId?:string;showSummary?:boolean;renderText?:(text:string)=>ReactNode;renderSolutionExtra?:(q:PracticeQuestion)=>ReactNode}) {
  const [filter,setFilter]=useState<'all'|'mistakes'|'unanswered'>('all');
  const [expanded,setExpanded]=useState<Set<string>>(()=>new Set(draft.submittedAt!==null&&initialQuestionId?[initialQuestionId]:[]));
  const [focusQuestion,setFocusQuestion]=useState<number|null>(()=>{const index=exam.questions.findIndex(q=>q.id===initialQuestionId);return draft.submittedAt!==null&&index>=0?index:null;});
  const instance=useId();
  useEffect(()=>{if(focusQuestion!==null){const target=document.getElementById(`${instance}-card-${focusQuestion}`);target?.focus();target?.scrollIntoView({block:'start'});setFocusQuestion(null);}},[focusQuestion,instance]);
  if(draft.submittedAt===null)return null;
  const rows=reviewRows(exam,draft),visible=rows.filter(r=>filter==='all'||(filter==='mistakes'?r.status!=='correct':r.status==='unanswered'));
  const wrong=rows.filter(r=>r.status!=='correct').length,blank=rows.filter(r=>r.status==='unanswered').length;
  const allOpen=visible.length>0&&visible.every(r=>expanded.has(r.q.id));
  return <section className="ep-result-review" aria-label="Đối chiếu bài đã nộp">
    {exam.id.startsWith('mtm-custom-')&&<Suspense fallback={<p>Đang mở công cụ lời giải…</p>}><SolutionPdf examId={exam.id} kind="questions"/><SolutionPdf examId={exam.id}/></Suspense>}
    {showSummary&&<ResultSummary exam={exam} draft={draft}/>}
    <h2>Tổng quan câu trả lời</h2>
    <nav className="ep-question-nav ep-result-nav" aria-label="Tổng quan đúng sai">{rows.map(r=><button type="button" key={r.q.id} className={`ep-verdict-${r.status}`} aria-label={`Câu ${r.index+1}: ${STATUS_LABELS[r.status]}`} onClick={()=>{setFilter('all');setFocusQuestion(r.index);}}>{r.index+1}</button>)}</nav>
    <p>Đúng toàn bộ: {rows.filter(r=>r.status==='correct').length} · Đúng một phần: {rows.filter(r=>r.status==='partial').length} · Chưa đúng: {rows.filter(r=>r.status==='wrong').length} · Bỏ trống: {blank}.</p>
    <div className="ep-review-filters" role="group" aria-label="Lọc câu đã nộp">
      <button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>Tất cả câu ({rows.length})</button>
      <button type="button" aria-pressed={filter==='mistakes'} onClick={()=>setFilter('mistakes')}>Câu sai / chưa đủ điểm ({wrong})</button>
      <button type="button" aria-pressed={filter==='unanswered'} onClick={()=>setFilter('unanswered')}>Câu bỏ trống ({blank})</button>
      <button type="button" disabled={!visible.length} onClick={()=>setExpanded(previous=>{const next=new Set(previous);for(const r of visible)allOpen?next.delete(r.q.id):next.add(r.q.id);return next;})}>{allOpen?'Thu gọn lời giải':'Mở lời giải các câu đang xem'}</button>
    </div>
    <p role="status">Đang xem {visible.length}/{rows.length} câu. Câu đúng/sai được đối chiếu từng ý; câu đúng một phần vẫn nằm trong mục chưa đủ điểm.</p>
    {!visible.length&&<p>Không có câu trong mục này.</p>}
    {visible.map(({q,index,answer,earned,status,invalidNumeric})=><section className="ep-question ep-card" key={q.id} id={`${instance}-card-${index}`} tabIndex={-1} aria-labelledby={`${instance}-q-${index}`}>
      <h3 id={`${instance}-q-${index}`}>Câu {index+1} <small>({formatPoints(q.maxMillipoints)} điểm)</small></h3>
      <p className={`ep-verdict ep-verdict-${status}`}>{STATUS_LABELS[status]}</p>
      {(q.prompt||q.text)&&<p className="ep-source-text">{renderText?renderText(q.prompt??q.text!):q.prompt??q.text}</p>}
      <p className="ep-source-ref">{q.sourceRef}</p>
      <div className="ep-review">
        <p><strong>Bài làm:</strong> {displayAnswer(answer)}</p>
        <p><strong>Đáp án:</strong> {q.kind==='mc'?q.answer:q.kind==='tf'?q.answer.map((v,i)=>`${statementLetters[i]}) ${v?'Đúng':'Sai'}`).join('; '):q.acceptedAnswers.join(' hoặc ')}</p>
        {q.kind==='tf'&&<ul className="ep-statement-review">{q.answer.map((expected,i)=>{
          const value=Array.isArray(answer)?answer[i]:null;
          return <li key={i}><strong>Ý {statementLetters[i]}:</strong> {value===null?'Chưa trả lời':value===expected?'Khớp đáp án':'Chưa khớp đáp án'}{q.statements?.[i]&&<p>{renderText?renderText(q.statements[i]):q.statements[i]}</p>}</li>;
        })}</ul>}
        {invalidNumeric&&<p>Câu trả lời không đúng định dạng số: 0 điểm.</p>}
        <p><strong>Điểm câu này:</strong> {status==='unscored'?'Chưa tính được':formatPoints(earned)} / {formatPoints(q.maxMillipoints)}</p>
      </div>
      {q.solution&&<details className="ep-solution" open={expanded.has(q.id)} onToggle={event=>{const open=event.currentTarget.open;setExpanded(previous=>{if(previous.has(q.id)===open)return previous;const next=new Set(previous);open?next.add(q.id):next.delete(q.id);return next;});}}><summary>Lời giải câu {index+1}</summary>{expanded.has(q.id)&&<Suspense fallback={<p>Đang mở lời giải…</p>}><DetailedSolution examId={exam.id} versionHash={exam.versionHash} questionId={q.id} fallback={q.solution}/>{renderSolutionExtra?.(q)}</Suspense>}</details>}
    </section>)}
  </section>;
}
