import {useId,useRef,useState} from 'react';
import {planHomeworkTime,questionPace,type HomeworkTimePlan as Plan} from './time-plan';
import './time-plan.css';

export default function HomeworkTimePlan(){
  const id=useId(),[minutes,setMinutes]=useState('30'),[questions,setQuestions]=useState('10');
  const [plan,setPlan]=useState<Plan|null>(null),[error,setError]=useState('');
  const result=useRef<HTMLDivElement>(null);
  const change=(value:string,kind:'minutes'|'questions')=>{
    (kind==='minutes'?setMinutes:setQuestions)(value);setPlan(null);setError('');
  };
  return <section className="btvn-time-plan" aria-labelledby={id+'-title'}>
    <h2 id={id+'-title'}>Chia chặng làm BTVN</h2>
    <p>Dành thời gian đọc đề, làm câu vừa sức rồi soát bài trước khi nộp.</p>
    <details><summary>Lập kế hoạch thời gian của em</summary>
      <p id={id+'-help'}>Nhập số phút em dự định dành và số câu trong bài. Gợi ý này không đổi thời lượng, hạn nộp hay đồng hồ thật; mở lượt vẫn tính một lần làm.</p>
      <form noValidate onSubmit={event=>{
        event.preventDefault();const next=planHomeworkTime(minutes,questions);
        setPlan(next);setError(next?'':'Nhập số phút nguyên từ 5 đến 180 và số câu nguyên từ 1 đến 100.');
        // Focus sau khi React đã dựng phần kết quả, không dùng bộ đếm giờ.
        if(next)requestAnimationFrame(()=>result.current?.focus());
      }} aria-describedby={id+'-help'}>
        <div className="btvn-time-fields">
          <label htmlFor={id+'-minutes'}>Số phút dự định dành<input id={id+'-minutes'} type="text" inputMode="numeric" maxLength={3} value={minutes} onChange={event=>change(event.target.value,'minutes')} aria-invalid={!!error} aria-describedby={error?id+'-error':undefined}/></label>
          <label htmlFor={id+'-questions'}>Số câu trong bài<input id={id+'-questions'} type="text" inputMode="numeric" maxLength={3} value={questions} onChange={event=>change(event.target.value,'questions')} aria-invalid={!!error} aria-describedby={error?id+'-error':undefined}/></label>
        </div>
        <button type="submit">Chia thời gian</button>
      </form>
      {error&&<p id={id+'-error'} role="alert">{error}</p>}
      {plan&&<div className="btvn-time-result" ref={result} tabIndex={-1} role="region" aria-labelledby={id+'-result'}>
        <h3 id={id+'-result'}>Kế hoạch {plan.minutes} phút cho {plan.questions} câu</h3>
        <ol>
          <li><b>{plan.readMinutes} phút đọc đề:</b> nhìn toàn bài, đánh dấu câu vừa sức.</li>
          <li><b>{plan.solveMinutes} phút làm bài:</b> ưu tiên câu em biết cách làm; câu khó đánh dấu để quay lại.</li>
          <li><b>{plan.reviewMinutes} phút soát bài:</b> kiểm điều kiện, dấu, đơn vị và các ô trả lời trước khi nộp.</li>
        </ol>
        <p>Mốc gợi ý: đọc đến phút {plan.readMinutes}, làm đến phút {plan.minutes-plan.reviewMinutes}, soát đến phút {plan.minutes} tính từ lúc em bắt đầu.</p>
        <p>Trung bình khoảng <b>{questionPace(plan.secondsPerQuestion)}/câu</b> trong chặng làm bài. Chia linh hoạt theo độ khó; đây không phải giới hạn từng câu.</p>
        <p>Chỉ là kế hoạch trong tab này, chưa bắt đầu hay lưu lượt BTVN. Rời hoặc tải lại trang sẽ bỏ kế hoạch.</p>
      </div>}
    </details>
  </section>;
}
