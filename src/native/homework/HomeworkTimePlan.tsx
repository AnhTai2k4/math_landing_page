import {useEffect,useId,useRef,useState} from 'react';
import {planHomeworkTime,questionPace,type HomeworkTimeMode,type HomeworkTimePlan as Plan} from './time-plan';
import './time-plan.css';

export default function HomeworkTimePlan(){
  const id=useId(),[minutes,setMinutes]=useState('30'),[questions,setQuestions]=useState('10');
  const [mode,setMode]=useState<HomeworkTimeMode>('balanced');
  const [plan,setPlan]=useState<Plan|null>(null),[error,setError]=useState('');
  const [checked,setChecked]=useState<boolean[]>([false,false,false]);
  const result=useRef<HTMLDivElement>(null),minuteInput=useRef<HTMLInputElement>(null),questionInput=useRef<HTMLInputElement>(null),revision=useRef(0),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;revision.current++;};},[]);
  const version=revision.current;
  const validMinutes=!!planHomeworkTime(minutes,'1'),validQuestions=!!planHomeworkTime('30',questions);
  const invalidate=()=>{revision.current++;setPlan(null);setChecked([false,false,false]);setError('');};
  const change=(value:string,kind:'minutes'|'questions')=>{
    if(!alive.current||version!==revision.current)return;
    (kind==='minutes'?setMinutes:setQuestions)(value);invalidate();
  };
  return <section className="btvn-time-plan" aria-labelledby={id+'-title'} data-version="v3">
    <h2 id={id+'-title'}>Chia chặng làm BTVN</h2>
    <p>Dành thời gian đọc đề, làm câu vừa sức rồi soát bài trước khi nộp.</p>
    <details><summary>Lập kế hoạch thời gian của em</summary>
      <p id={id+'-help'}>Nhập số phút em dự định dành và số câu trong bài. Gợi ý này không đổi thời lượng, hạn nộp hay đồng hồ thật; mở lượt vẫn tính một lần làm.</p>
      <form noValidate onSubmit={event=>{
        event.preventDefault();if(!alive.current||version!==revision.current)return;
        const next=planHomeworkTime(minutes,questions,mode);
        setPlan(next);setError(next?'':'Nhập số phút nguyên từ 5 đến 180 và số câu nguyên từ 1 đến 100.');
        // Focus sau khi React đã dựng phần kết quả, không dùng bộ đếm giờ.
        if(next)requestAnimationFrame(()=>{if(alive.current&&version===revision.current)result.current?.focus();});
        else (!validMinutes?minuteInput:questionInput).current?.focus();
      }} aria-describedby={id+'-help'}>
        <div className="btvn-time-presets" role="group" aria-label="Chọn nhanh quỹ thời gian">
          {[15,30,45].map(value=><button key={value} type="button" aria-pressed={minutes===String(value)} onClick={()=>change(String(value),'minutes')}>{value} phút</button>)}
        </div>
        <div className="btvn-time-fields">
          <label htmlFor={id+'-minutes'}>Số phút dự định dành<input ref={minuteInput} id={id+'-minutes'} type="text" inputMode="numeric" maxLength={3} value={minutes} onChange={event=>change(event.target.value,'minutes')} aria-invalid={!!error&&!validMinutes} aria-describedby={error&&!validMinutes?id+'-error':undefined}/></label>
          <label htmlFor={id+'-questions'}>Số câu trong bài<input ref={questionInput} id={id+'-questions'} type="text" inputMode="numeric" maxLength={3} value={questions} onChange={event=>change(event.target.value,'questions')} aria-invalid={!!error&&!validQuestions} aria-describedby={error&&!validQuestions?id+'-error':undefined}/></label>
        </div>
        <fieldset className="btvn-time-modes"><legend>Chọn nhịp làm bài</legend>
          {([{value:'balanced',label:'Cân bằng'},{value:'review',label:'Tăng thời gian soát'}] as const).map(option=><label key={option.value}><input type="radio" name={id+'-mode'} value={option.value} checked={mode===option.value} onChange={()=>{if(!alive.current||version!==revision.current)return;setMode(option.value);invalidate();}}/>{option.label}</label>)}
          <p>Tăng thời gian soát để kiểm tra kỹ hơn ở cuối bài. Với quỹ chỉ 5 phút, hai nhịp có cùng cách chia.</p>
        </fieldset>
        <button type="submit">Chia thời gian</button>
      </form>
      {error&&<p id={id+'-error'} role="alert">{error}</p>}
      {plan&&<div className="btvn-time-result" ref={result} tabIndex={-1} role="region" aria-labelledby={id+'-result'}>
        <h3 id={id+'-result'}>Kế hoạch {plan.minutes} phút cho {plan.questions} câu</h3>
        <p>Nhịp: <b>{mode==='balanced'?'Cân bằng':'Tăng thời gian soát'}</b>.</p>
        <ol>
          <li><b>{plan.readMinutes} phút đọc đề:</b> nhìn toàn bài, đánh dấu câu vừa sức.</li>
          <li><b>{plan.solveMinutes} phút làm bài:</b> ưu tiên câu em biết cách làm; câu khó đánh dấu để quay lại.</li>
          <li><b>{plan.reviewMinutes} phút soát bài:</b> kiểm điều kiện, dấu, đơn vị và các ô trả lời trước khi nộp.</li>
        </ol>
        <p>Mốc gợi ý: đọc đến phút {plan.readMinutes}, làm đến phút {plan.minutes-plan.reviewMinutes}, soát đến phút {plan.minutes} tính từ lúc em bắt đầu.</p>
        <p>Trung bình khoảng <b>{questionPace(plan.secondsPerQuestion)}/câu</b> trong chặng làm bài. Chia linh hoạt theo độ khó; đây không phải giới hạn từng câu.</p>
        <fieldset className="btvn-time-stages"><legend>Em đã đi đến chặng nào?</legend><p>Đánh dấu theo việc em đã làm. Các dấu này không điều khiển đồng hồ BTVN.</p>
          {['Đã đọc và chọn câu làm trước','Đã tự giải và quay lại câu còn vướng','Đã soát điều kiện, dấu và ô trả lời'].map((label,index)=><label key={label}><input type="checkbox" checked={checked[index]} onChange={event=>{const value=event.target.checked;if(!alive.current||version!==revision.current)return;setChecked(previous=>previous.map((item,i)=>i===index?value:item));}}/><span>{label}</span></label>)}
          <p role="status" aria-live="polite">Em tự đánh dấu {checked.filter(Boolean).length}/3 chặng. {checked.every(Boolean)?'Đọc lại lần cuối trước khi tự nộp bài.':'Em có thể bỏ dấu nếu muốn làm lại một chặng.'}</p>
          <button type="button" disabled={!checked.some(Boolean)} onClick={()=>{if(alive.current&&version===revision.current)setChecked([false,false,false]);}}>Bỏ dấu ba chặng</button>
        </fieldset>
        <p>Chỉ là kế hoạch trong tab này, chưa bắt đầu hay lưu lượt BTVN. Rời hoặc tải lại trang sẽ bỏ kế hoạch.</p>
      </div>}
    </details>
  </section>;
}
