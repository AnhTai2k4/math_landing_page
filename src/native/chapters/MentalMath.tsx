import {useEffect,useId,useRef,useState} from 'react';
import {createMentalRound,mentalInteger,type MentalQuestion} from './mental-math';
import './mental-math.css';

type Entry={input:string;checked:boolean;correct:boolean;helped:boolean;invalid:boolean};
type Session={questions:MentalQuestion[];entries:Entry[];index:number;finished:boolean;retry:boolean};
const entry=():Entry=>({input:'',checked:false,correct:false,helped:false,invalid:false});
const start=(questions:MentalQuestion[],retry=false):Session=>({questions,entries:questions.map(entry),index:0,finished:false,retry});

export default function MentalMath(){
  const id=useId(),[round,setRound]=useState(0),[session,setSession]=useState<Session|null>(null);
  const title=useRef<HTMLHeadingElement>(null),heading=useRef<HTMLHeadingElement>(null),feedback=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null);
  const focus=useRef<'title'|'heading'|'feedback'|'input'|null>(null);
  useEffect(()=>{if(focus.current){({title,heading,feedback,input}[focus.current]).current?.focus();focus.current=null;}},[session]);
  const begin=(questions:MentalQuestion[],retry=false)=>{focus.current='heading';setSession(start(questions,retry));};
  const question=session?.questions[session.index],current=session?.entries[session.index];
  // Chặn sự kiện cũ cả khi lượt ôn mới dùng lại cùng câu hỏi.
  const revise=(patch:Partial<Entry>)=>setSession(old=>old&&!old.finished&&old.questions===session?.questions&&old.questions[old.index]?.id===question?.id?{...old,entries:old.entries.map((value,i)=>i===old.index?{...value,...patch}:value)}:old);
  const check=()=>{
    if(!question||!current||current.checked)return;
    const value=mentalInteger(current.input);
    focus.current=value===null?'input':'feedback';
    revise({invalid:value===null,checked:value!==null,correct:value===question.answer});
  };
  const next=()=>{
    if(!session||!current?.checked)return;
    focus.current='heading';
    setSession({...session,index:session.index+1===session.questions.length?session.index:session.index+1,finished:session.index+1===session.questions.length});
  };
  return <section className="cp-mental" aria-labelledby={id+'-title'}>
    <h3 id={id+'-title'} ref={title} tabIndex={-1}>Tính nhẩm 5 câu</h3>
    <p>Khoảng 2 đến 3 phút luyện tính nhanh, không cần bấm giờ. Em có thể dùng gợi ý hoặc giấy nháp.</p>
    <p className="cp-mental-note">Câu tự luyện sinh từ tính chất phân phối và hằng đẳng thức đã học ở THCS. Không thuộc đề kiểm tra. MTM sưu tầm và biên soạn.</p>
    {!session?<button type="button" className="cp-mental-primary" onClick={()=>begin(createMentalRound(round))}>Bắt đầu 5 câu tính nhẩm</button>:session.finished?<div className="cp-mental-card">
      <h4 ref={heading} tabIndex={-1}>Đã hoàn thành {session.questions.length} câu{session.retry?' ôn lại':''}</h4>
      <p>Em tự làm đúng {session.entries.filter(value=>value.correct&&!value.helped).length}/{session.questions.length} câu trước khi xem gợi ý hoặc lời giải.</p>
      <p>Đây là kết quả tự luyện trong lượt này, không tính điểm hoặc xếp hạng.</p>
      {session.questions.map((q,i)=><details key={q.id}><summary>Câu {i+1}: {q.prompt} · {session.entries[i].correct?(session.entries[i].helped?'Đúng sau hỗ trợ':'Tự làm đúng'):'Cần ôn lại'}</summary><p>Kết quả: {q.answer}.</p>{q.steps.map((line,j)=><p key={j}>{line}</p>)}</details>)}
      <div className="cp-mental-actions">
        {session.entries.some(value=>!value.correct||value.helped)&&<button type="button" onClick={()=>begin(session.questions.filter((_,i)=>!session.entries[i].correct||session.entries[i].helped),true)}>Ôn lại câu cần luyện</button>}
        <button type="button" onClick={()=>{const nextRound=round+1;setRound(nextRound);begin(createMentalRound(nextRound));}}>Thử bộ 5 câu khác</button>
        <button type="button" onClick={()=>{focus.current='title';setSession(null);setRound(round+1);}}>Kết thúc tự luyện</button>
      </div>
      <p>Em có thể nghỉ ở đây hoặc chọn bài luyện của chương.</p>
    </div>:question&&current?<div className="cp-mental-card">
      <p className="cp-mental-count">{session.retry?'Ôn lại · ':''}Câu {session.index+1}/{session.questions.length}</p>
      <h4 ref={heading} tabIndex={-1}><span className="cp-mental-sr">Tính: {question.spoken}</span><span aria-hidden="true">{question.prompt} = ?</span></h4>
      <form onSubmit={event=>{event.preventDefault();check();}}>
        <label htmlFor={id+'-answer'}>Kết quả em tính được</label>
        <input ref={input} id={id+'-answer'} type="text" inputMode="numeric" maxLength={18} autoComplete="off" spellCheck={false} readOnly={current.checked} value={current.input} aria-invalid={current.invalid||undefined} aria-describedby={id+'-format'+(current.invalid?' '+id+'-error':'')} onChange={event=>revise({input:event.target.value,invalid:false})}/>
        <p id={id+'-format'} className="cp-mental-note">Nhập số nguyên, không có dấu phân cách hàng nghìn, không nhập biểu thức.</p>
        {current.invalid&&<p id={id+'-error'} role="status">Em nhập một số nguyên đầy đủ rồi kiểm tra nhé.</p>}
        {!current.checked&&<button type="submit" className="cp-mental-primary">Kiểm tra kết quả</button>}
      </form>
      {!current.checked&&<details key={question.id+'-hint'} onToggle={event=>{if(event.currentTarget.open)revise({helped:true});}}><summary>Gợi ý cách tính</summary><p>{question.hint}</p></details>}
      {!current.checked&&<button type="button" onClick={()=>{focus.current='feedback';revise({checked:true,correct:false,helped:true,invalid:false});}}>Xem cách giải câu này</button>}
      {current.checked&&<>
        <div ref={feedback} tabIndex={-1} role="group" aria-label="Phản hồi tính nhẩm" className="cp-mental-feedback">
          <p>{current.correct?(current.helped?'Em đã tính đúng sau khi xem gợi ý.':'Chính xác! Em đã tự tính đúng câu này.'):'Kết quả là '+question.answer+'. Em đối chiếu cách tính dưới đây nhé.'}</p>
          <h5>Cách tính nhanh</h5>{question.steps.map((line,i)=><p key={i}>{line}</p>)}
        </div>
        <button type="button" className="cp-mental-primary" onClick={next}>{session.index+1===session.questions.length?'Xem tổng kết lượt này':'Câu tiếp theo'}</button>
      </>}
    </div>:null}
    <p className="cp-mental-note">Lượt tự luyện chỉ giữ khi em còn ở trang này. Em có thể đóng mục này để tạm dừng; rời trang hoặc tải lại sẽ bắt đầu lại.</p>
  </section>;
}
