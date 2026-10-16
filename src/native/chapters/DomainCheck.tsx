import {useEffect,useId,useRef,useState} from 'react';
import {domainQuestions,type DomainQuestion} from './domain-check';
import './domain-check.css';

type Session={questions:DomainQuestion[];answers:(string|null)[];index:number;done:boolean;retry:boolean};
const start=(questions:DomainQuestion[],retry=false):Session=>({questions,answers:questions.map(()=>null),index:0,done:false,retry});

export default function DomainCheck(){
  const id=useId(),[session,setSession]=useState<Session|null>(null);
  const title=useRef<HTMLHeadingElement>(null),heading=useRef<HTMLHeadingElement>(null),feedback=useRef<HTMLDivElement>(null),focus=useRef<'title'|'heading'|'feedback'|null>(null);
  useEffect(()=>{if(focus.current){({title,heading,feedback}[focus.current]).current?.focus();focus.current=null;}},[session]);
  const begin=(questions:DomainQuestion[],retry=false)=>{focus.current='heading';setSession(start(questions,retry));};
  const leave=()=>{focus.current='title';setSession(null);};
  const question=session?.questions[session.index],answer=session?.answers[session.index];
  const choose=(choice:string)=>{
    focus.current='feedback';
    setSession(old=>!old||old!==session||old.done||old.answers[old.index]!==null||!question?.choices.some(c=>c.id===choice)?old:{...old,answers:old.answers.map((v,i)=>i===old.index?choice:v)});
  };
  const next=()=>{
    focus.current='heading';
    setSession(old=>!old||old!==session||old.done||old.answers[old.index]===null?old:{...old,index:old.index+1===old.questions.length?old.index:old.index+1,done:old.index+1===old.questions.length});
  };
  return <section className="cp-domain-check" aria-labelledby={id+'-title'}>
    <h3 id={id+'-title'} ref={title} tabIndex={-1}>Soi điều kiện</h3>
    <p>4 câu ôn nền tảng THCS dành cho em đã học căn bậc hai. Chọn đầy đủ các giá trị x để biểu thức xác định trong ℝ, rồi xem lời giải. Không bấm giờ.</p>
    {!session?<button type="button" className="cp-domain-primary" onClick={()=>begin(domainQuestions)}>Bắt đầu soi 4 điều kiện</button>:session.done?<div className="cp-domain-card">
      <h4 ref={heading} tabIndex={-1}>Hoàn thành {session.questions.length} câu{session.retry?' ôn lại':''}</h4>
      <p role="status">Em chọn đúng {session.questions.filter((q,i)=>session.answers[i]===q.correctId).length}/{session.questions.length} câu trong lượt này.</p>
      {session.questions.map((q,i)=><details key={q.id}><summary>Câu {i+1}: {q.expression} · {session.answers[i]===q.correctId?'Đúng':'Cần ôn lại'}</summary><p>Em đã chọn: {q.choices.find(c=>c.id===session.answers[i])?.text}.</p><ol>{q.solution.map((line,j)=><li key={j}>{line}</li>)}</ol><p>Mẹo nhớ: {q.tip}</p></details>)}
      <div className="cp-domain-actions">
        {session.questions.some((q,i)=>session.answers[i]!==q.correctId)&&<button type="button" onClick={()=>begin(session.questions.filter((q,i)=>session.answers[i]!==q.correctId),true)}>Ôn riêng điều kiện đã chọn sai</button>}
        <button type="button" onClick={()=>begin(domainQuestions)}>Luyện lại cả 4 câu</button>
        <button type="button" onClick={leave}>Kết thúc soi điều kiện</button>
      </div>
    </div>:question?<div className="cp-domain-card">
      <p>{session.retry?'Ôn lại · ':''}Câu {session.index+1}/{session.questions.length}</p>
      <h4 ref={heading} tabIndex={-1}>Điều kiện xác định của biểu thức này là gì?</h4>
      <p className="cp-domain-expression">{question.expression}</p>
      <div className="cp-domain-choices" role="group" aria-label="Chọn đầy đủ điều kiện xác định">{question.choices.map((choice,i)=><button type="button" key={choice.id} disabled={answer!==null} aria-pressed={answer===choice.id} onClick={()=>choose(choice.id)}>{String.fromCharCode(65+i)}. {choice.text}</button>)}</div>
      {answer!==null&&<>
        <div ref={feedback} tabIndex={-1} role="group" aria-label="Giải thích điều kiện đã chọn" aria-describedby={id+'-verdict '+id+'-reason '+id+'-solution'} className="cp-domain-feedback">
          <p id={id+'-verdict'}><strong>{answer===question.correctId?'Đúng rồi, em đã xét đủ điều kiện!':'Em xem lại điều kiện xác định trong lời giải nhé.'}</strong></p>
          <p id={id+'-reason'}>{question.choices.find(c=>c.id===answer)?.reason}</p>
          <ol id={id+'-solution'}>{question.solution.map((line,i)=><li key={i}>{line}</li>)}</ol><p>Mẹo nhớ: {question.tip}</p>
        </div>
        <button type="button" className="cp-domain-primary" onClick={next}>{session.index+1===session.questions.length?'Xem tổng kết điều kiện':'Điều kiện tiếp theo'}</button>
      </>}
      <p><button type="button" onClick={leave}>Dừng soi điều kiện</button></p>
    </div>:null}
    <p className="cp-domain-note">MTM sưu tầm và biên soạn. Bộ câu tự luyện do MTM biên soạn, không thuộc đề đã đăng, không tính điểm thi hoặc xếp hạng. Tiến độ chỉ giữ ở trang này; đổi chương hoặc tải lại sẽ bắt đầu lại.</p>
  </section>;
}
