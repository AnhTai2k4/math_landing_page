import {useEffect,useId,useRef,useState} from 'react';
import MathText from '../math/MathText';
import {formulaDecks,formulaRound,type FormulaQuestion} from './formula-match';
import type {RecallCard,RecallDeck} from './quick-recall';
import './quick-recall.css';
import './formula-match.css';

type Session={questions:FormulaQuestion[];answers:(string|null)[];index:number;done:boolean;retry:boolean};
const start=(questions:FormulaQuestion[],retry=false):Session=>({questions,answers:questions.map(()=>null),index:0,done:false,retry});
// Hai thẻ này có điều kiện áp dụng nằm trong lời nhắc của nguồn.
const promptNeedsUsage=new Set(['g12-c1:derivative-trig','g12-c1:extrema']);
function FormulaContent({card,usage=false}:{card:RecallCard;usage?:boolean}){
  return <>
    {card.context.map((context,index)=><aside key={index} className="cp-recall-context"><h4>Ký hiệu và điều kiện: {context.topic}</h4>{[...context.formulaLines,...context.usageLines].map((line,i)=><p key={i}><MathText text={line}/></p>)}</aside>)}
    {card.notes.map((line,i)=><p key={'note-'+i}><MathText text={line}/></p>)}
    {!usage&&promptNeedsUsage.has(card.id)&&<aside className="cp-recall-context"><h4>Điều kiện và lưu ý</h4>{card.usageLines.map((line,i)=><p key={i}><MathText text={line}/></p>)}</aside>}
    {card.formulaLines.map((line,i)=><p key={i}><MathText text={line}/></p>)}
    {usage&&<><h4>Cách dùng và điều cần nhớ</h4>{card.usageLines.map((line,i)=><p key={i}><MathText text={line}/></p>)}</>}
  </>;
}
function FormulaSession({deck}:{deck:RecallDeck}){
  const [round,setRound]=useState(0),[session,setSession]=useState<Session|null>(null),id=useId();
  const heading=useRef<HTMLHeadingElement>(null),feedback=useRef<HTMLDivElement>(null),focus=useRef<'heading'|'feedback'|null>(null);
  useEffect(()=>{if(focus.current){(focus.current==='heading'?heading:feedback).current?.focus();focus.current=null;}},[session]);
  const begin=(questions:FormulaQuestion[],retry=false)=>{focus.current='heading';setSession(start(questions,retry));};
  const question=session?.questions[session.index],answer=session?.answers[session.index];
  const choose=(choice:string)=>{
    if(!session||!question||session.done||answer!==null||!question.choices.some(item=>item.id===choice))return;
    focus.current='feedback';
    setSession(old=>old&&old.questions===session.questions&&old.index===session.index&&!old.done&&old.answers[old.index]===null?{...old,answers:old.answers.map((value,i)=>i===old.index?choice:value)}:old);
  };
  const next=()=>{
    if(!session||answer==null||session.done)return;
    focus.current='heading';
    setSession(old=>old===session?{...old,index:old.index+1===old.questions.length?old.index:old.index+1,done:old.index+1===old.questions.length}:old);
  };
  return <div className="cp-recall-session">
    <h3 ref={heading} tabIndex={-1}>{!session?'Nhận diện công thức':session.done?'Đã hoàn thành '+session.questions.length+' câu':(session.retry?'Ôn lại · ':'')+'Câu '+(session.index+1)+'/'+session.questions.length}</h3>
    {!session?<><p>Ghép bộ công thức với đúng tên thẻ. Mỗi lượt 5 câu, không bấm giờ. Em chọn một tên rồi đọc lại cách dùng.</p><button type="button" className="cp-recall-reveal" onClick={()=>begin(formulaRound(deck,round))}>Bắt đầu nhận diện 5 câu</button></>:session.done?<>
      <p role="status">Em chọn đúng {session.questions.filter((q,i)=>session.answers[i]===q.card.id).length}/{session.questions.length} câu trong lượt này.</p>
      {session.questions.map((q,i)=><details key={q.card.id} className="cp-formula-review"><summary>Câu {i+1}: {q.card.topic} · {session.answers[i]===q.card.id?'Đúng':'Cần ôn lại'}</summary><FormulaContent card={q.card} usage/></details>)}
      <div className="cp-recall-actions">
        {session.questions.some((q,i)=>session.answers[i]!==q.card.id)&&<button type="button" onClick={()=>begin(session.questions.filter((q,i)=>session.answers[i]!==q.card.id),true)}>Ôn lại câu ghép sai</button>}
        <button type="button" onClick={()=>{setRound(round+1);begin(formulaRound(deck,round+1));}}>Chơi lại 5 câu</button>
        <button type="button" onClick={()=>{focus.current='heading';setSession(null);}}>Kết thúc lượt chơi</button>
      </div><p>Em có thể nghỉ ở đây hoặc chọn bài luyện của chương.</p>
    </>:question&&<>
      <p>Bộ công thức sau khớp với tên thẻ nào trong bộ <b>{deck.title}</b>?</p>
      <div className="cp-recall-answer"><FormulaContent card={question.card}/></div>
      <div className="cp-formula-choices" role="group" aria-label="Chọn tên thẻ phù hợp">{question.choices.map(choice=><button key={choice.id} type="button" disabled={answer!==null} aria-pressed={answer===choice.id} onClick={()=>choose(choice.id)}>{choice.topic}</button>)}</div>
      {answer!==null&&<>
        <div ref={feedback} tabIndex={-1} className="cp-recall-answer" role="group" aria-labelledby={id+'-feedback'}><h4 id={id+'-feedback'}>{answer===question.card.id?'Chính xác!':'Em xem lại tên thẻ nhé.'}</h4><p>Tên thẻ khớp: <b>{question.card.topic}</b>.</p><h4>Cách dùng và điều cần nhớ</h4>{question.card.usageLines.map((line,i)=><p key={i}><MathText text={line}/></p>)}</div>
        <button type="button" className="cp-recall-reveal" onClick={next}>{session.index+1===session.questions.length?'Xem tổng kết ghép thẻ':'Câu tiếp theo'}</button>
      </>}
    </>}
  </div>;
}
export default function FormulaMatch({track,chapter}:{track:string;chapter:string}){
  const decks=formulaDecks(track),defaultDeck=decks.find(deck=>String(deck.chapter)===chapter),scope=track+':'+chapter,id=useId();
  const [selection,setSelection]=useState({scope,id:defaultDeck?.id??''});
  const selected=selection.scope===scope?selection.id:defaultDeck?.id??'',deck=decks.find(item=>item.id===selected);
  return <section className="cp-recall cp-formula-game" aria-label="Nhận diện công thức">
    {!defaultDeck&&<p role="status">Chương này chưa có bộ nhận diện công thức. Em có thể chọn một phần đã học trong danh sách.</p>}
    <label htmlFor={id+'-deck'}>Chọn bộ công thức lớp {track}</label>
    <select id={id+'-deck'} value={deck?.id??''} onChange={event=>setSelection({scope,id:event.target.value})}><option value="" disabled>Chọn bộ hiện có</option>{decks.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select>
    {deck&&<><p className="cp-recall-note">Nguồn: bảng lý thuyết Luyện tập MTM, {deck.title}. MTM sưu tầm và biên soạn. Mỗi bộ có 5 thẻ đã chọn; chơi lại đổi thứ tự câu và lựa chọn.</p><FormulaSession key={scope+':'+deck.id} deck={deck}/></>}
    <p className="cp-recall-note">Trò tự ôn, không tính điểm hoặc xếp hạng. Lượt chơi chỉ giữ khi em còn ở trang này.</p>
  </section>;
}
