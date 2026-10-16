import {useId,useRef,useState} from 'react';
import {Link} from './navigation';
import {makeStudyPlan,studyDurations,studyGoals,type StudyPlan} from './study-compass';
import './study-compass.css';

export default function StudyCompass(){
  const id=useId(),[goal,setGoal]=useState<string>('understand'),[minutes,setMinutes]=useState(20);
  const [plan,setPlan]=useState<StudyPlan|null>(null),[error,setError]=useState('');
  const result=useRef<HTMLDivElement>(null);
  return <section className="mg-card study-compass" aria-labelledby={id+'-title'}>
    <h2 id={id+'-title'}>Hôm nay học gì?</h2>
    <p>Chọn điều em muốn cải thiện và quỹ thời gian để có ba bước học cụ thể.</p>
    <form onSubmit={event=>{
      event.preventDefault();const next=makeStudyPlan(goal,minutes);setPlan(next);
      setError(next?'':'Em chọn một mục tiêu và quỹ thời gian trong danh sách nhé.');
      if(next)requestAnimationFrame(()=>result.current?.focus());
    }} aria-describedby={id+'-help'}>
      <div className="study-compass-fields">
        <label htmlFor={id+'-goal'}>Mục tiêu hôm nay<select id={id+'-goal'} value={goal} onChange={event=>{setGoal(event.target.value);setPlan(null);setError('');}}>{studyGoals.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label htmlFor={id+'-minutes'}>Em có khoảng<select id={id+'-minutes'} value={minutes} onChange={event=>{setMinutes(Number(event.target.value));setPlan(null);setError('');}}>{studyDurations.map(value=><option key={value} value={value}>{value} phút</option>)}</select></label>
      </div>
      <button type="submit">Gợi ý việc học</button>
    </form>
    <p id={id+'-help'} className="study-compass-note">Số phút là gợi ý, không bấm giờ hoặc yêu cầu hoàn thành cả đề thi. Em có thể nghỉ và tiếp tục khi phù hợp.</p>
    {error&&<p role="alert">{error}</p>}
    {plan&&<div className="study-compass-result" ref={result} tabIndex={-1} role="region" aria-labelledby={id+'-result'}>
      <h3 id={id+'-result'}>{plan.goal} trong {plan.minutes} phút</h3>
      <ol>{plan.steps.map((step,index)=><li key={index}><h4>{step.minutes} phút · {step.title}</h4><p>{step.detail}</p><Link href={step.href}>{step.link}</Link></li>)}</ol>
      <p className="study-compass-note">Kế hoạch chỉ ở tab này, chưa ghi vào Sổ tay và chưa xác nhận em đã học xong. Rời hoặc tải lại trang sẽ bỏ lựa chọn.</p>
    </div>}
  </section>;
}
