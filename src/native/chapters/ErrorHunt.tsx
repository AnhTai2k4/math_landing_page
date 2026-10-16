import {useEffect,useId,useRef,useState} from 'react';
import {errorHuntRound,type ErrorHuntCard} from './error-hunt';
import './error-hunt.css';

type Session={cards:ErrorHuntCard[];answers:(boolean|null)[];index:number;done:boolean;retry:boolean};
const start=(cards:ErrorHuntCard[],retry=false):Session=>({cards,answers:cards.map(()=>null),index:0,done:false,retry});

export default function ErrorHunt(){
  const id=useId(),[round,setRound]=useState(0),[session,setSession]=useState<Session|null>(null);
  const title=useRef<HTMLHeadingElement>(null),heading=useRef<HTMLHeadingElement>(null),feedback=useRef<HTMLDivElement>(null),focus=useRef<'title'|'heading'|'feedback'|null>(null);
  useEffect(()=>{if(focus.current){({title,heading,feedback}[focus.current]).current?.focus();focus.current=null;}},[session]);
  const begin=(cards:ErrorHuntCard[],retry=false)=>{focus.current='heading';setSession(start(cards,retry));};
  const leave=()=>{focus.current='title';setSession(null);};
  const choose=(valid:boolean)=>{
    focus.current='feedback';
    setSession(old=>!old||old!==session||old.done||old.answers[old.index]!==null?old:{...old,answers:old.answers.map((answer,i)=>i===old.index?valid:answer)});
  };
  const next=()=>{
    focus.current='heading';
    setSession(old=>!old||old!==session||old.done||old.answers[old.index]===null?old:{...old,index:old.index+1===old.cards.length?old.index:old.index+1,done:old.index+1===old.cards.length});
  };
  const card=session?.cards[session.index],answer=session?.answers[session.index];
  return <section className="cp-error-hunt" aria-labelledby={id+'-title'}>
    <h3 id={id+'-title'} ref={title} tabIndex={-1}>Săn lỗi biến đổi</h3>
    <p>5 câu ôn nền tảng đại số THCS. Đọc điều kiện, nhận xét khẳng định rồi xem quy tắc và phản ví dụ, không cần bấm giờ.</p>
    <p className="cp-error-note">Ký hiệu ⇔ nghĩa là hai phương trình hoặc bất phương trình có cùng tập nghiệm trong điều kiện đã nêu.</p>
    <p className="cp-error-note">Câu tự luyện do MTM biên soạn, không thuộc đề kiểm tra, không tính điểm thi hoặc xếp hạng. MTM sưu tầm và biên soạn.</p>
    {!session?<button className="cp-error-primary" type="button" onClick={()=>begin(errorHuntRound(round))}>Bắt đầu săn lỗi 5 câu</button>:session.done?<div className="cp-error-card">
      <h4 ref={heading} tabIndex={-1}>Đã hoàn thành {session.cards.length} câu{session.retry?' ôn lại':''}</h4>
      <p role="status">Em nhận xét đúng {session.cards.filter((q,i)=>session.answers[i]===q.valid).length}/{session.cards.length} câu trong lượt này.</p>
      {session.cards.map((q,i)=><details key={q.id}><summary>Câu {i+1}: {q.topic} · {session.answers[i]===q.valid?'Đúng':'Cần ôn lại'}</summary>
        <p>{q.condition}</p><p className="cp-error-formula">{q.statement}</p><p>Khẳng định: {q.valid?'Đúng':'Sai'}. Em đã chọn: {session.answers[i]?'Đúng':'Sai'}.</p>{q.explanation.map((line,j)=><p key={j}>{line}</p>)}
      </details>)}
      <div className="cp-error-actions">
        {session.cards.some((q,i)=>session.answers[i]!==q.valid)&&<button type="button" onClick={()=>begin(session.cards.filter((q,i)=>session.answers[i]!==q.valid),true)}>Ôn lại câu nhận xét sai</button>}
        <button type="button" onClick={()=>{const n=round+1;setRound(n);begin(errorHuntRound(n));}}>Chơi lượt khác trong 10 thẻ</button>
        <button type="button" onClick={leave}>Kết thúc săn lỗi</button>
      </div><p>Em có thể nghỉ ở đây hoặc chọn bài luyện của chương.</p>
    </div>:card?<div className="cp-error-card">
      <p>{session.retry?'Ôn lại · ':''}Câu {session.index+1}/{session.cards.length} · {card.topic}</p>
      <h4 ref={heading} tabIndex={-1}>Khẳng định này đúng với mọi giá trị thỏa điều kiện hay không?</h4>
      <p>{card.condition}</p><p className="cp-error-formula">{card.statement}</p>
      <div className="cp-error-actions" role="group" aria-label="Nhận xét khẳng định">{[true,false].map(value=><button type="button" key={String(value)} disabled={answer!==null} aria-pressed={answer===value} onClick={()=>choose(value)}>{value?'Đúng':'Sai'}</button>)}</div>
      {answer!==null&&<>
        <div ref={feedback} tabIndex={-1} role="group" aria-label="Phản hồi săn lỗi" className="cp-error-feedback"><p><strong>{answer===card.valid?'Em nhận xét chính xác!':'Em đối chiếu quy tắc và điều kiện nhé.'}</strong></p><p>Khẳng định đã cho là {card.valid?'đúng':'sai'}.</p>{card.explanation.map((line,i)=><p key={i}>{line}</p>)}</div>
        <button className="cp-error-primary" type="button" onClick={next}>{session.index+1===session.cards.length?'Xem tổng kết săn lỗi':'Khẳng định tiếp theo'}</button>
      </>}
      <p><button type="button" onClick={leave}>Dừng lượt tự luyện</button></p>
    </div>:null}
    <p className="cp-error-note">Có 10 thẻ trong bộ này, lượt khác có thể gặp lại thẻ cũ. Lựa chọn chỉ giữ khi còn ở trang. Dừng lượt, đổi chương hoặc tải lại sẽ bắt đầu lại.</p>
  </section>;
}
