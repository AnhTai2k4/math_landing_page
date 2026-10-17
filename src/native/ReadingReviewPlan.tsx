import {useEffect,useId,useRef,useState} from 'react';
import {createReadingReviewPlan,FIRST_REVIEW_DATE,latestReviewDate,localReviewToday,READING_REVIEW_RHYTHMS,readingReviewStatus,reviewDateLabel,type ReadingReviewMilestone,type ReadingReviewRhythm} from './reading-review-plan';
import './reading-review-plan.css';

type PlanState={date:string;rhythm:ReadingReviewRhythm;today:string;version:number;plan:ReadingReviewMilestone[]|null;checked:boolean[];invalid:boolean};
const statusLabels={checked:'Em đã tự đánh dấu ôn mốc này',today:'Hôm nay là mốc gợi ý',available:'Đã tới mốc gợi ý, em có thể ôn khi phù hợp',upcoming:'Mốc sắp tới',invalid:'Chưa đối chiếu được ngày của mốc này'};

export default function ReadingReviewPlan(){
 const id=useId(),dateInput=useRef<HTMLInputElement>(null),result=useRef<HTMLDivElement>(null),version=useRef(0);
 const [state,setState]=useState<PlanState>(()=>({date:latestReviewDate(),rhythm:'1-3-7',today:localReviewToday(),version:0,plan:null,checked:[],invalid:false}));
 useEffect(()=>{if(state.plan)result.current?.focus();},[state.plan]);
 const maximum=latestReviewDate(localReviewToday(),state.rhythm),currentVersion=state.version;
 function changeDate(value:string){
  if(version.current!==currentVersion)return;
  const next=++version.current;
  setState({...state,date:value,version:next,plan:null,checked:[],invalid:false});
 }
 function changeRhythm(value:string){
  if(version.current!==currentVersion||!READING_REVIEW_RHYTHMS.some(item=>item.id===value))return;
  setState({...state,rhythm:value as ReadingReviewRhythm,version:++version.current,plan:null,checked:[],invalid:false});
 }
 function createPlan(){
  if(version.current!==currentVersion)return;
  const today=localReviewToday(),plan=createReadingReviewPlan(state.date,today,state.rhythm),next=++version.current;
  setState({...state,today,version:next,plan,checked:plan?[false,false,false]:[],invalid:!plan});
  if(!plan)dateInput.current?.focus();
 }
 function reset(){
  if(version.current!==currentVersion)return;
  setState({...state,date:maximum,today:localReviewToday(),version:++version.current,plan:null,checked:[],invalid:false});
  dateInput.current?.focus();
 }
 function refreshToday(){
  if(version.current!==currentVersion)return;
  const today=localReviewToday(),next=++version.current;
  setState(previous=>previous.version!==currentVersion?previous:{...previous,today,version:next});
 }
 return <section className="reading-review-plan" aria-labelledby={id+'-heading'} data-version="2">
  <h2 id={id+'-heading'}>Tạo kế hoạch tự ôn</h2>
  <p>Em tự chọn một phần vừa đọc để ôn. Chọn ngày đã đọc và nhịp phù hợp để có ba ngày gợi ý, rồi tự đánh dấu từng lần ôn.</p>
  <p id={id+'-scope'}>Kế hoạch chỉ giữ trong bộ nhớ khi em ở danh sách tài liệu này, kể cả lúc đổi bộ lọc. Rời trang hoặc tải lại sẽ xóa. Công cụ không lưu lịch, không gửi nhắc nhở và không ghi nhận hoàn thành PDF hay điểm số.</p>
  <form noValidate onSubmit={event=>{event.preventDefault();createPlan();}}>
   <label htmlFor={id+'-date'}>Ngày em đã đọc</label>
   <input ref={dateInput} id={id+'-date'} type="date" required min={FIRST_REVIEW_DATE} max={maximum} value={state.date} aria-invalid={state.invalid} aria-describedby={id+'-date-help'+(state.invalid?' '+id+'-error':'')} onChange={event=>changeDate(event.target.value)}/>
   <p id={id+'-date-help'}>Chọn ngày từ 01/01/2000 đến {reviewDateLabel(maximum)}. Đổi ngày sẽ xóa các mốc và dấu tự ôn hiện tại.</p>
   <label htmlFor={id+'-rhythm'}>Chọn nhịp tự ôn</label>
   <select id={id+'-rhythm'} value={state.rhythm} aria-describedby={id+'-rhythm-help'} onChange={event=>changeRhythm(event.target.value)}>{READING_REVIEW_RHYTHMS.map(rhythm=><option key={rhythm.id} value={rhythm.id}>{rhythm.label}</option>)}</select>
   <p id={id+'-rhythm-help'}>Nhịp ôn là gợi ý, em chọn theo lịch học và mức độ cần đọc lại. Đổi nhịp sẽ xóa các mốc và dấu tự ôn hiện tại. Bấm tạo lại cũng xóa các dấu này.</p>
   {state.invalid&&<p id={id+'-error'} role="alert">Ngày chưa hợp lệ hoặc ở tương lai. Em chọn lại ngày đã đọc rồi tạo mốc ôn.</p>}
   <div className="reading-review-plan-actions"><button type="submit">Tạo ba mốc ôn</button><button type="button" onClick={reset}>Xóa kế hoạch tự ôn</button></div>
  </form>
  {state.plan&&<div ref={result} tabIndex={-1} className="reading-review-plan-result" role="region" aria-labelledby={id+'-result'}>
   <h3 id={id+'-result'}>Ba mốc gợi ý sau ngày {reviewDateLabel(state.date)}</h3>
   <p>Đây là gợi ý để em tự ôn, có thể điều chỉnh theo lịch học. Dấu tích là em tự ghi nhận lần ôn, không phải kết quả chấm bài.</p>
   <div className="reading-review-date-status"><p>Ngày đối chiếu trên thiết bị: <time dateTime={state.today}>{reviewDateLabel(state.today)}</time>. Khi xem lại vào ngày khác, em có thể cập nhật trạng thái bên dưới.</p><button type="button" onClick={refreshToday}>Cập nhật ngày đối chiếu</button></div>
   <ul>{state.plan.map((milestone,index)=>{const status=readingReviewStatus(milestone.date,state.checked[index],state.today);return <li key={milestone.days} className={'is-'+status}><label htmlFor={id+'-day-'+milestone.days}>
    <input id={id+'-day-'+milestone.days} type="checkbox" checked={state.checked[index]} onChange={event=>{
     const checked=event.target.checked;
     if(version.current!==currentVersion)return;
     setState(previous=>previous.version!==currentVersion||!previous.plan?previous:{...previous,checked:previous.checked.map((value,i)=>i===index?checked:value)});
    }}/><span><b>Sau {milestone.days} ngày: <time dateTime={milestone.date}>{reviewDateLabel(milestone.date)}</time></b><span>{milestone.prompt}</span><small className="reading-review-milestone-status">{statusLabels[status]}</small></span>
   </label></li>;})}</ul>
   <p role="status" aria-live="polite" aria-atomic="true">Em đã tự đánh dấu {state.checked.filter(Boolean).length}/3 mốc ôn. Ngày đối chiếu: {reviewDateLabel(state.today)}. {state.plan.filter((milestone,index)=>!state.checked[index]&&['today','available'].includes(readingReviewStatus(milestone.date,false,state.today))).length} mốc đã tới ngày gợi ý và chưa tự đánh dấu. Em có thể điều chỉnh lịch, không cần làm bù cả ba mốc cùng lúc.</p>
  </div>}
 </section>;
}
