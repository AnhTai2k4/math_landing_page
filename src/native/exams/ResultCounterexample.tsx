import {useEffect,useId,useRef,useState} from 'react';
import {checkCounterexample,counterexampleCards,COUNTEREXAMPLE_VERSION,type CounterexampleCheck} from './result-counterexample';
import './result-counterexample.css';

type Session={index:number;input:string;feedback:CounterexampleCheck|null;hint:boolean;revealed:boolean;selfFound:boolean;answers:boolean[];done:boolean};
const fresh=():Session=>({index:0,input:'',feedback:null,hint:false,revealed:false,selfFound:false,answers:[],done:false});
export default function ResultCounterexample(){
  const id=useId(),[session,setSession]=useState<Session|null>(null),[focus,setFocus]=useState<{target:'title'|'card'|'feedback'|'summary';revision:number}|null>(null);
  const title=useRef<HTMLHeadingElement>(null),heading=useRef<HTMLHeadingElement>(null),feedback=useRef<HTMLDivElement>(null),summary=useRef<HTMLHeadingElement>(null);
  const activeSession=useRef(session);activeSession.current=session;
  useEffect(()=>{if(focus)({title,card:heading,feedback,summary}[focus.target]).current?.focus();},[focus]);
  const moveFocus=(target:'title'|'card'|'feedback'|'summary')=>setFocus(value=>({target,revision:(value?.revision??0)+1}));
  const card=session&&!session.done?counterexampleCards[session.index]:null;
  const active=()=>activeSession.current===session;
  const update=(change:(value:Session)=>Session)=>setSession(value=>value&&value===session?change(value):value);
  const begin=()=>{if(!active())return;setSession(fresh());moveFocus('card');};
  const stop=()=>{if(!active())return;setSession(value=>value===session?null:value);moveFocus('title');};
  const next=()=>{if(!active()||!session||!card||!session.revealed)return;update(value=>({...fresh(),index:value.index+1,answers:[...value.answers,value.selfFound],done:value.index+1===counterexampleCards.length}));moveFocus(session.index+1===counterexampleCards.length?'summary':'card');};
  const submit=()=>{if(!active()||!card||!session||session.revealed)return;const checked=checkCounterexample(card,session.input);update(value=>({...value,feedback:checked,revealed:checked.ok&&checked.counterexample,selfFound:checked.ok&&checked.counterexample}));moveFocus('feedback');};
  return <section className="ep-card ep-counterexample" data-version={COUNTEREXAMPLE_VERSION} aria-labelledby={id+'-title'}>
    <p className="ep-counterexample-eyebrow">MINI GAME TƯ DUY · LỚP 10</p><h2 id={id+'-title'} ref={title} tabIndex={-1}>Phòng thử phản ví dụ</h2>
    <p>Một mệnh đề “nếu P thì Q” bị bác bỏ khi tìm được giá trị làm P đúng, Q sai. Em tự tìm một giá trị cho mỗi thẻ thay vì chỉ đoán Đúng/Sai.</p>
    <p className="ep-counterexample-note">4 thẻ tự luyện riêng do MTM biên soạn, gợi ý học trong 2 đến 3 phút. Không thuộc đề vừa thi, không thay điểm hoặc xếp hạng. Lượt chơi chỉ giữ trên trang này. MTM sưu tầm và biên soạn.</p>
    {!session?<button type="button" className="ep-counterexample-primary" onClick={begin}>Bắt đầu tìm phản ví dụ</button>:session.done?<div className="ep-counterexample-card">
      <h3 ref={summary} tabIndex={-1}>Em đã đối chiếu 4 mệnh đề</h3><p role="status">Tự tìm được trước khi xem mẫu: {session.answers.filter(Boolean).length}/4 thẻ. Các thẻ còn lại đã xem một phản ví dụ mẫu; đây không phải điểm bài thi.</p>
      <ol>{counterexampleCards.map((value,i)=><li key={value.id}>{value.topic}: {session.answers[i]?'Tự tìm được':'Đã xem mẫu'}</li>)}</ol>
      <p>Thói quen cần giữ: kiểm miền xét, kiểm điều kiện P đúng, rồi kiểm kết luận Q sai. Một ví dụ làm cả P và Q đúng chưa chứng minh mệnh đề với mọi giá trị.</p>
      <button type="button" onClick={begin}>Tự luyện lại 4 thẻ</button><button type="button" onClick={stop}>Kết thúc mini game</button>
    </div>:card&&<div className="ep-counterexample-card">
      <p>Thẻ {session.index+1}/4 · {card.topic}</p><h3 ref={heading} tabIndex={-1}>{card.statement}</h3><p>Miền xét: {card.domain} Trong lượt này, hãy tìm một giá trị nguyên từ {card.min} đến {card.max}.</p>
      <form onSubmit={event=>{event.preventDefault();submit();}}><label htmlFor={id+'-value'}>Giá trị {card.variable} em muốn thử</label><div className="ep-counterexample-input"><input id={id+'-value'} type="text" inputMode="text" autoComplete="off" maxLength={16} value={session.input} readOnly={session.revealed} onChange={event=>{if(!session.revealed)update(value=>({...value,input:event.target.value,feedback:null}));}} aria-describedby={id+'-rule'}/><button type="submit" className="ep-counterexample-primary" disabled={session.revealed}>Kiểm tra giá trị</button></div></form>
      <p id={id+'-rule'} className="ep-counterexample-note">Nhập số nguyên có thể mang dấu âm, không nhập phép tính. Miền nhập nhỏ chỉ giúp tự luyện; mệnh đề vẫn được xét trên toàn miền ghi ở thẻ.</p>
      {!session.revealed&&<><button type="button" aria-expanded={session.hint} onClick={()=>update(value=>({...value,hint:!value.hint}))}>{session.hint?'Ẩn gợi ý':'Cần một gợi ý'}</button>{session.hint&&<p>{card.hint}</p>}<button type="button" onClick={()=>{if(!active())return;update(value=>({...value,input:String(card.example),feedback:checkCounterexample(card,String(card.example)),revealed:true,selfFound:false}));moveFocus('feedback');}}>Xem một phản ví dụ mẫu</button></>}
      {session.feedback&&<div ref={feedback} tabIndex={-1} className="ep-counterexample-feedback" aria-label="Đối chiếu phản ví dụ"><p><strong>{!session.feedback.ok?session.feedback.message:session.feedback.counterexample?(session.selfFound?'Em đã tìm được một phản ví dụ.':'Đây là một phản ví dụ mẫu.'):!session.feedback.premise?'Chưa phải phản ví dụ: điều kiện P đang sai.':'Chưa phải phản ví dụ: kết luận Q vẫn đúng.'}</strong></p>{session.feedback.ok&&<><p>{session.feedback.detail}</p><p>P: {session.feedback.premise?'Đúng':'Sai'}. Q: {session.feedback.conclusion?'Đúng':'Sai'}. {session.feedback.counterexample?'P đúng, Q sai nên mệnh đề đã cho sai.':'Em cần P đúng và Q sai; hãy thử giá trị khác.'}</p></>}{session.revealed&&card.explanation.map((line,i)=><p key={i}>{line}</p>)}</div>}
      {session.revealed&&<button type="button" className="ep-counterexample-primary" onClick={next}>{session.index===3?'Xem tổng kết phản ví dụ':'Sang mệnh đề tiếp theo'}</button>}
      <button type="button" onClick={stop}>Dừng mini game</button>
    </div>}
  </section>;
}
