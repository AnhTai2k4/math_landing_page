import {useEffect,useState} from 'react';
import {useReducedMotion} from 'motion/react';
import type {PracticeExam} from './data';
import type {Draft} from './store';
import {examSections} from './flexible-profile';
import {reviewRows,formatPoints,STATUS_LABELS,type ReviewStatus} from './review';
import './result-summary.css';

export default function ResultSummary({exam,draft}:{exam:PracticeExam;draft:Draft}){
 const rows=reviewRows(exam,draft),unscored=rows.some(r=>r.status==='unscored');
 const total=rows.reduce((sum,r)=>sum+r.earned,0),maximum=rows.reduce((sum,r)=>sum+r.q.maxMillipoints,0);
 const reduced=useReducedMotion(),[animated,setAnimated]=useState(total);
 useEffect(()=>{if(reduced){setAnimated(total);return;}let frame=0;const start=performance.now();setAnimated(0);const tick=(time:number)=>{const t=Math.min(1,Math.max(0,(time-start)/700));setAnimated(Math.round(total*(1-(1-t)**3)));if(t<1)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[total,reduced]);
 if(draft.submittedAt===null)return null;
 const seconds=Math.max(0,Math.floor((Math.min(draft.submittedAt,draft.deadline)-draft.startedAt)/1000));
 const statuses:ReviewStatus[]=['correct','partial','wrong','unanswered'];
 const fraction=maximum>0&&!unscored?Math.min(1,Math.max(0,total/maximum)):0;
 return <section className="ep-summary" aria-label="Tóm tắt kết quả">
  <div className="ep-summary-top">
   <div className="ep-score-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle className="ep-ring-track" cx="60" cy="60" r="52"/><circle className="ep-ring-value" cx="60" cy="60" r="52" pathLength="100" strokeDasharray={`${fraction*100} 100`}/></svg><div><span className="ep-summary-score" aria-hidden="true">{unscored?'—':formatPoints(animated)}</span><small aria-hidden="true">/ {formatPoints(maximum)} điểm</small><span className="ep-sr-only">{unscored?'Chưa tính được điểm':`Tổng điểm ${formatPoints(total)} trên ${formatPoints(maximum)}`}</span></div></div>
   <div className="ep-summary-caption"><p className="ep-summary-eyebrow">KẾT QUẢ LƯỢT LÀM</p><h2>Kết quả của bạn</h2><p>{unscored?'Giữ bài làm để đối chiếu khóa chấm.':rows.every(r=>r.status==='correct')?'Bạn đã trả lời đúng toàn bộ các câu trong lượt này.':'Xem những câu chưa đủ điểm, đọc cách giải và thử lại khi sẵn sàng.'}</p><p className="ep-summary-time">Thời gian lượt làm: {Math.floor(seconds/60)} phút {seconds%60} giây<span> · {rows.filter(r=>r.status!=='unanswered').length}/{rows.length} câu có câu trả lời</span></p><small>Thời gian tính từ lúc bắt đầu, kể cả khi rời trang. Kết quả phản ánh lượt này.</small></div>
  </div>
  <div className="ep-summary-parts" aria-label="Điểm từng phần">{examSections(exam).map(part=>{
   const section=rows.slice(part.from,part.to),earned=section.reduce((sum,r)=>sum+r.earned,0),max=section.reduce((sum,r)=>sum+r.q.maxMillipoints,0);
   return <div className="ep-part-score" key={part.label}><h3>{part.label}</h3><p>{unscored?'Chưa tính được':<><strong>{formatPoints(earned)}</strong> / {formatPoints(max)} điểm</>}</p><div className="ep-part-meter" role="progressbar" aria-label={`Điểm ${part.label}`} aria-valuemin={0} aria-valuemax={max/1000} aria-valuenow={unscored?undefined:earned/1000} aria-valuetext={unscored?'Chưa tính được':`${formatPoints(earned)} trên ${formatPoints(max)} điểm`}><span style={{width:unscored||max===0?'0%':`${earned/max*100}%`}}/></div><small>{section.filter(r=>r.status==='correct').length}/{section.length} câu đúng toàn bộ</small></div>;
  })}</div>
  <dl className="ep-summary-status">{statuses.map(status=><div key={status} className={`ep-stat-${status}`}><dt>{STATUS_LABELS[status]}</dt><dd>{rows.filter(r=>r.status===status).length}<small> câu</small></dd></div>)}</dl>
 </section>;
}
