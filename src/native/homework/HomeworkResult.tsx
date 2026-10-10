import {useEffect,useRef,useState} from 'react';
import DetailedSolution from '../exams/DetailedSolution';
import type {HomeworkApi,Result} from './types';
import {points,time,date} from './types';
import PdfViewer from './PrivatePdf';
export {PdfViewer};
const labels={correct:'Đúng',wrong:'Sai',partial:'Đúng một phần',blank:'Chưa trả lời'};
const answerText=(v:unknown)=>Array.isArray(v)?v.map((x,i)=>`${String.fromCharCode(97+i)}) ${x===true?'Đúng':x===false?'Sai':'—'}`).join('; '):String(v??'—');
export default function HomeworkResult({result,api,session,onBack}:{result:Result;api:HomeworkApi;session:string;onBack:()=>void}){
 const [pdf,setPdf]=useState<'questions'|'solutions'|null>(null),heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus();heading.current?.scrollIntoView({block:'start'});},[result.attemptId]);
 return <section className="hw-result"><h2 ref={heading} tabIndex={-1}>Kết quả BTVN</h2><h3>{result.title}</h3><p className="hw-score">{points(result.score.earnedMillipoints)} / 10</p><p>Lượt {result.attemptNumber} · {date(result.submittedAt)} · {time(result.elapsedMs)}</p><p>{result.qualifying?'Lượt này được tính xếp hạng.':result.late?'Nộp sau hạn: chấm bản máy chủ đã lưu, không tính xếp hạng.':'Lượt luyện lại hoặc không đủ điều kiện xếp hạng; lịch sử vẫn được giữ.'}</p>
 <div className="hw-table"><table><caption>Điểm từng phần</caption><thead><tr><th scope="col">Phần</th><th scope="col">Đạt / tối đa</th></tr></thead><tbody>{result.score.parts.map(p=><tr key={p.id}><th scope="row">{p.label}</th><td>{points(p.earnedMillipoints)} / {points(p.maxMillipoints)}</td></tr>)}</tbody></table></div>
 <h3>Tổng quan câu trả lời</h3><nav className="hw-grid" aria-label="Đúng sai từng câu">{result.score.rows.map((r,i)=><a className={'hw-state '+r.status} href={'#hw-review-'+r.id} key={r.id} onClick={e=>{e.preventDefault();document.getElementById('hw-review-'+r.id)?.scrollIntoView({block:'start'});}}>{i+1}<span>{labels[r.status]}</span></a>)}</nav>
 <div className="hw-actions"><button onClick={()=>setPdf('questions')}>Xem lại PDF đề</button>{result.solutionPdf&&<button onClick={()=>setPdf('solutions')}>Đọc toàn bộ PDF lời giải</button>}<button onClick={onBack}>Về BTVN và lịch sử</button></div>{pdf&&<PdfViewer key={pdf} api={api} session={session} attempt={result.attemptId} kind={pdf}/>}
 {result.reviewQuestions.map((q,i)=>{const row=result.score.rows.find(r=>r.id===q.id);return <article key={q.id} id={'hw-review-'+q.id} className="hw-review"><h3>{q.sourceRef||`Câu ${i+1}`} · {row?labels[row.status]:''}</h3><p>Bạn trả lời: <strong>{answerText(result.answers[q.id])}</strong></p><p>Đáp án: <strong>{answerText(q.kind==='short'?q.acceptedAnswers?.join(' hoặc '):q.answer)}</strong> · {points(row?.earnedMillipoints??0)} / {points(q.maxMillipoints)}</p>{q.solution&&<DetailedSolution examId="homework" versionHash="private" questionId={q.id} fallback={q.solution}/>}</article>;})}
 </section>;
}
