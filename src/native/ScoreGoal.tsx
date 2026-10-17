import {useEffect,useId,useRef,useState} from 'react';
import {Link} from '../migration/navigation';
import {createScoreGoal,goalDays,goalMinutes,goalTracks,type GoalInput,type ScoreGoalPlan} from './score-goal';
import './score-goal.css';

export default function ScoreGoal({grade}:{grade:string}){
  const id=useId(),revision=useRef(0),result=useRef<HTMLDivElement>(null),currentInput=useRef<HTMLInputElement>(null);
  const track=goalTracks.find(item=>item.id===grade)??goalTracks[0];
  const [input,setInput]=useState<GoalInput>(()=>({grade:track.id,chapter:track.chapters[0].id,current:'',target:'',days:3,minutes:20}));
  const [plan,setPlan]=useState<ScoreGoalPlan|null>(null),[checked,setChecked]=useState<number[]>([]),[error,setError]=useState('');
  useEffect(()=>{if(plan)result.current?.focus();},[plan]);
  const version=revision.current;
  function change(patch:Partial<GoalInput>){if(version!==revision.current)return;revision.current++;setInput(previous=>({...previous,...patch}));setPlan(null);setChecked([]);setError('');}
  return <section className="score-goal" aria-labelledby={id+'-heading'}>
    <h2 id={id+'-heading'}>Mục tiêu điểm, kế hoạch một tuần</h2>
    <p>Chọn chương đang học và quỹ thời gian phù hợp. Em nhận một lộ trình tự học để tiến về mục tiêu của mình.</p>
    <form noValidate onSubmit={event=>{event.preventDefault();if(version!==revision.current)return;if(plan){result.current?.focus();return;}const next=createScoreGoal(input);revision.current++;setPlan(next);setChecked([]);setError(next?'':'Nhập hai mức điểm từ 0 đến 10. Mục tiêu cần bằng hoặc cao hơn mức hiện tại.');if(!next)currentInput.current?.focus();}}>
      <div className="score-goal-fields">
        <label>Chương đang học, {track.label}<select value={input.chapter} onChange={event=>change({chapter:event.target.value})}>{track.chapters.map(chapter=><option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label>
        <label>Điểm em tự đánh giá<input ref={currentInput} inputMode="decimal" autoComplete="off" maxLength={5} value={input.current} placeholder="Ví dụ: 6,5" aria-invalid={!!error} aria-describedby={id+'-help'+(error?' '+id+'-error':'')} onChange={event=>change({current:event.target.value})}/></label>
        <label>Điểm em hướng tới<input inputMode="decimal" autoComplete="off" maxLength={5} value={input.target} placeholder="Ví dụ: 8" aria-invalid={!!error} aria-describedby={id+'-help'+(error?' '+id+'-error':'')} onChange={event=>change({target:event.target.value})}/></label>
        <label>Số buổi trong tuần<select value={input.days} onChange={event=>change({days:Number(event.target.value)})}>{goalDays.map(days=><option key={days} value={days}>{days} buổi</option>)}</select></label>
        <label>Thời gian mỗi buổi<select value={input.minutes} onChange={event=>change({minutes:Number(event.target.value)})}>{goalMinutes.map(minutes=><option key={minutes} value={minutes}>{minutes} phút</option>)}</select></label>
      </div>
      <p id={id+'-help'} className="score-goal-note">Dùng dấu phẩy hoặc dấu chấm cho điểm lẻ. Đổi lựa chọn sẽ bỏ kế hoạch và các dấu tự đánh giá đang có.</p>
      {error&&<p id={id+'-error'} role="alert">{error}</p>}
      <button className="mig-button" type="submit">{plan?'Xem lộ trình đã tạo':'Tạo lộ trình của em'}</button>
    </form>
    {plan&&<div className="score-goal-result" ref={result} tabIndex={-1} role="region" aria-label="Lộ trình mục tiêu điểm">
      <h3>{plan.current.toLocaleString('vi-VN')} → {plan.target.toLocaleString('vi-VN')} điểm · {plan.grade}</h3>
      <p>{plan.chapter} · {plan.sessions.length} buổi · {plan.total} phút cả tuần.</p>
      <p role="status">Em tự đánh dấu: {checked.length}/{plan.sessions.length} buổi.</p>
      <ol>{plan.sessions.map((session,index)=><li key={index}>
        <h4>Buổi {index+1}: {session.title}</h4><p>{session.detail}</p>
        <p>{session.foundation} phút ôn nền · {session.practice} phút tự giải · {session.review} phút đối chiếu.</p>
        <Link href={session.href} target="_blank" rel="noopener noreferrer">Mở chương để học <span className="score-goal-note">(thẻ mới)</span></Link>
        <label className="score-goal-check"><input type="checkbox" checked={checked.includes(index)} onChange={event=>{if(version!==revision.current)return;const done=event.target.checked;setChecked(previous=>done?[...new Set([...previous,index])]:previous.filter(value=>value!==index));}}/>Em đã tự học buổi {index+1}</label>
      </li>)}</ol>
    </div>}
    <p className="score-goal-note">Đây là gợi ý phân bổ thời gian, không cam kết đạt điểm. Giữ tab này để tự đánh dấu; rời hoặc tải lại trang sẽ xóa kế hoạch. Điểm tự nhập và dấu hoàn thành không gửi lên máy chủ hay tính vào kết quả học tập.</p>
    <small>MTM sưu tầm và biên soạn</small>
  </section>;
}
