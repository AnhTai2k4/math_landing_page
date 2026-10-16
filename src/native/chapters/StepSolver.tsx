import {useEffect,useId,useRef,useState} from 'react';
import {solverProblems} from './step-solver';
import './step-solver.css';

type Session={problemId:string;index:number;answer:string|null;hints:number[];mistakes:number[];done:boolean};
export default function StepSolver(){
  const id=useId(),[selected,setSelected]=useState(solverProblems[0].id),[session,setSession]=useState<Session|null>(null);
  const title=useRef<HTMLHeadingElement>(null),heading=useRef<HTMLHeadingElement>(null),feedback=useRef<HTMLDivElement>(null),hint=useRef<HTMLParagraphElement>(null);
  const focus=useRef<'title'|'heading'|'feedback'|'hint'|null>(null);
  useEffect(()=>{if(focus.current){({title,heading,feedback,hint}[focus.current]).current?.focus();focus.current=null;}},[session]);
  const problem=solverProblems.find(p=>p.id===(session?.problemId??selected))??solverProblems[0],step=session?problem.steps[session.index]:null;
  const begin=()=>{focus.current='heading';setSession({problemId:selected,index:0,answer:null,hints:[],mistakes:[],done:false});};
  const leave=()=>{focus.current='title';setSession(null);};
  const choose=(answer:string)=>{
    focus.current='feedback';
    setSession(old=>!old||old!==session||old.done||old.answer!==null||!step?.choices.some(c=>c.id===answer)?old:{...old,answer,mistakes:answer===step.correctId||old.mistakes.includes(old.index)?old.mistakes:[...old.mistakes,old.index]});
  };
  const retry=()=>{focus.current='heading';setSession(old=>!old||old!==session||old.done||old.answer===null||old.answer===step?.correctId?old:{...old,answer:null});};
  const next=()=>{
    focus.current='heading';
    setSession(old=>!old||old!==session||old.done||old.answer!==step?.correctId?old:{...old,index:old.index+1===problem.steps.length?old.index:old.index+1,answer:null,done:old.index+1===problem.steps.length});
  };
  return <section className="cp-step-solver" aria-labelledby={id+'-title'}>
    <h3 id={id+'-title'} ref={title} tabIndex={-1}>Giải từng bước</h3>
    <p>Chọn một bài đại số, tự chọn từng bước rồi xem vì sao đúng. Hai bài phương trình nền tảng và một bài thử sức dành cho em đã học căn bậc hai. Có gợi ý khi em cần, không bấm giờ.</p>
    {!session?<>
      <label htmlFor={id+'-problem'}>Bài muốn tự luyện</label>
      <select id={id+'-problem'} value={selected} onChange={event=>setSelected(event.target.value)}>{solverProblems.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select>
      <p className="cp-step-formula">{problem.statement}</p>
      <button type="button" className="cp-step-primary" onClick={begin}>Bắt đầu giải từng bước</button>
    </>:session.done?<div className="cp-step-card">
      <h4 ref={heading} tabIndex={-1}>Đã đi hết {problem.steps.length} bước · {problem.title}</h4>
      <p role="status">Em đã hoàn thành bài này. Có {session.hints.length} bước dùng gợi ý và {session.mistakes.length} bước đã thử lại. Đây là tự luyện, không tính điểm.</p>
      <p className="cp-step-formula">{problem.statement}</p><p>{problem.condition}</p>
      <ol>{problem.steps.map((s,i)=>{const correct=s.choices.find(c=>c.id===s.correctId)!;return <li key={i}><h5>Bước {i+1}: {s.title}</h5><p>{s.from}</p><p className="cp-step-formula">{correct.text}</p><p>{correct.explanation}</p></li>;})}</ol>
      <p className="cp-step-conclusion"><strong>{problem.conclusion}</strong></p>
      <div className="cp-step-actions"><button type="button" onClick={begin}>Giải lại bài này</button><button type="button" onClick={leave}>Chọn bài khác hoặc kết thúc</button></div>
    </div>:step?<div className="cp-step-card">
      <p className="cp-step-formula">{problem.statement}</p><p>{problem.condition}</p>
      <h4 ref={heading} tabIndex={-1}>Bước {session.index+1}/{problem.steps.length}: {step.title}</h4>
      <p>{step.from}</p><p>Chọn bước đúng trong ba cách dưới đây.</p>
      <button type="button" aria-controls={id+'-hint'} aria-expanded={session.hints.includes(session.index)} disabled={session.hints.includes(session.index)} onClick={()=>{focus.current='hint';setSession(old=>!old||old!==session||old.done||old.hints.includes(old.index)?old:{...old,hints:[...old.hints,old.index]});}}>Xem gợi ý bước này</button>
      <p id={id+'-hint'} ref={hint} tabIndex={-1} hidden={!session.hints.includes(session.index)} className="cp-step-hint">Gợi ý: {step.hint}</p>
      <div className="cp-step-choices" role="group" aria-label={'Chọn bước '+(session.index+1)}>{step.choices.map((choice,i)=><button type="button" key={choice.id} disabled={session.answer!==null} aria-pressed={session.answer===choice.id} onClick={()=>choose(choice.id)}><span aria-hidden="true">{String.fromCharCode(65+i)}. </span>{choice.text}</button>)}</div>
      {session.answer!==null&&<>
        <div ref={feedback} tabIndex={-1} className="cp-step-feedback" role="group" aria-label="Giải thích bước đã chọn" aria-describedby={id+'-verdict '+id+'-reason'}><p id={id+'-verdict'}><strong>{session.answer===step.correctId?'Bước này chính xác!':'Em xem lại cách biến đổi nhé.'}</strong></p><p id={id+'-reason'}>{step.choices.find(c=>c.id===session.answer)?.explanation}</p></div>
        {session.answer===step.correctId?<button type="button" className="cp-step-primary" onClick={next}>{session.index+1===problem.steps.length?'Xem lời giải đầy đủ':'Sang bước tiếp theo'}</button>:<button type="button" onClick={retry}>Thử lại bước này</button>}
      </>}
      <p><button type="button" onClick={leave}>Dừng và chọn bài khác</button></p>
    </div>:null}
    <p className="cp-step-note">MTM sưu tầm và biên soạn. Ba bài tự luyện này không thuộc đề đã đăng, không tính điểm thi hoặc xếp hạng. Tiến độ chỉ giữ khi còn ở trang; dừng, đổi chương hoặc tải lại sẽ bắt đầu lại.</p>
  </section>;
}
