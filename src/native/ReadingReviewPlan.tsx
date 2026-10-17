import {useEffect,useId,useRef,useState} from 'react';
import {createReadingReviewPlan,FIRST_REVIEW_DATE,latestReviewDate,localReviewToday,reviewDateLabel,type ReadingReviewMilestone} from './reading-review-plan';
import './reading-review-plan.css';

type PlanState={date:string;version:number;plan:ReadingReviewMilestone[]|null;checked:boolean[];invalid:boolean};

export default function ReadingReviewPlan(){
 const id=useId(),dateInput=useRef<HTMLInputElement>(null),result=useRef<HTMLDivElement>(null),version=useRef(0);
 const [state,setState]=useState<PlanState>(()=>({date:latestReviewDate(),version:0,plan:null,checked:[],invalid:false}));
 useEffect(()=>{if(state.plan)result.current?.focus();},[state.plan]);
 const maximum=latestReviewDate(),currentVersion=state.version;
 function changeDate(value:string){
  if(version.current!==currentVersion)return;
  const next=++version.current;
  setState({date:value,version:next,plan:null,checked:[],invalid:false});
 }
 function createPlan(){
  if(version.current!==currentVersion)return;
  const plan=createReadingReviewPlan(state.date,localReviewToday()),next=++version.current;
  setState({...state,version:next,plan,checked:plan?[false,false,false]:[],invalid:!plan});
  if(!plan)dateInput.current?.focus();
 }
 function reset(){
  if(version.current!==currentVersion)return;
  setState({date:maximum,version:++version.current,plan:null,checked:[],invalid:false});
  dateInput.current?.focus();
 }
 return <section className="reading-review-plan" aria-labelledby={id+'-heading'}>
  <h2 id={id+'-heading'}>Tạo kế hoạch tự ôn</h2>
  <p>Em tự chọn một phần vừa đọc để ôn. Chọn ngày đã đọc để có ba ngày gợi ý, rồi tự đánh dấu từng lần ôn.</p>
  <p id={id+'-scope'}>Kế hoạch chỉ giữ trong bộ nhớ khi em ở danh sách tài liệu này, kể cả lúc đổi bộ lọc. Rời trang hoặc tải lại sẽ xóa. Công cụ không lưu lịch, không gửi nhắc nhở và không ghi nhận hoàn thành PDF hay điểm số.</p>
  <form noValidate onSubmit={event=>{event.preventDefault();createPlan();}}>
   <label htmlFor={id+'-date'}>Ngày em đã đọc</label>
   <input ref={dateInput} id={id+'-date'} type="date" required min={FIRST_REVIEW_DATE} max={maximum} value={state.date} aria-invalid={state.invalid} aria-describedby={id+'-date-help'+(state.invalid?' '+id+'-error':'')} onChange={event=>changeDate(event.target.value)}/>
   <p id={id+'-date-help'}>Chọn ngày từ 01/01/2000 đến {reviewDateLabel(maximum)}. Đổi ngày sẽ xóa các mốc và dấu tự ôn hiện tại.</p>
   {state.invalid&&<p id={id+'-error'} role="alert">Ngày chưa hợp lệ hoặc ở tương lai. Em chọn lại ngày đã đọc rồi tạo mốc ôn.</p>}
   <div className="reading-review-plan-actions"><button type="submit">Tạo ba mốc ôn</button><button type="button" onClick={reset}>Xóa kế hoạch tự ôn</button></div>
  </form>
  {state.plan&&<div ref={result} tabIndex={-1} className="reading-review-plan-result" role="region" aria-labelledby={id+'-result'}>
   <h3 id={id+'-result'}>Ba mốc gợi ý sau ngày {reviewDateLabel(state.date)}</h3>
   <p>Đây là gợi ý để em tự ôn, có thể điều chỉnh theo lịch học. Dấu tích là em tự ghi nhận lần ôn, không phải kết quả chấm bài.</p>
   <ul>{state.plan.map((milestone,index)=><li key={milestone.days} className={state.checked[index]?'is-checked':undefined}><label htmlFor={id+'-day-'+milestone.days}>
    <input id={id+'-day-'+milestone.days} type="checkbox" checked={state.checked[index]} onChange={event=>{
     const checked=event.target.checked;
     if(version.current!==currentVersion)return;
     setState(previous=>previous.version!==currentVersion||!previous.plan?previous:{...previous,checked:previous.checked.map((value,i)=>i===index?checked:value)});
    }}/><span><b>Sau {milestone.days} ngày: <time dateTime={milestone.date}>{reviewDateLabel(milestone.date)}</time></b><span>{milestone.prompt}</span><small>{state.checked[index]?'Em đã tự đánh dấu ôn mốc này':'Chưa tự đánh dấu ôn mốc này'}</small></span>
   </label></li>)}</ul>
   <p role="status" aria-live="polite" aria-atomic="true">Em đã tự đánh dấu {state.checked.filter(Boolean).length}/3 mốc ôn.</p>
  </div>}
 </section>;
}
