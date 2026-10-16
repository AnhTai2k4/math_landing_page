import {useEffect,useId,useRef,useState} from 'react';
import MathText from '../math/MathText';
import {recallBatch,recallDecks,type RecallCard,type RecallDeck} from './quick-recall';
import './quick-recall.css';

type HistoryItem={card:RecallCard;remembered:boolean};
type Session={cards:RecallCard[];index:number;revealed:boolean;review:RecallCard[];history:HistoryItem[];done:boolean;revisiting:boolean};
const start=(cards:RecallCard[],revisiting=false):Session=>({cards,index:0,revealed:false,review:[],history:[],done:false,revisiting});

function CardContent({card}:{card:RecallCard}){
  return <>
    {card.context.map((context,index)=><aside key={index} className="cp-recall-context"><h4>Ký hiệu và điều kiện: {context.topic}</h4>{[...context.formulaLines,...context.usageLines].map((line,i)=><p key={i}><MathText text={line}/></p>)}</aside>)}
    {card.notes.map((line,i)=><p key={'note-'+i}><MathText text={line}/></p>)}
    {card.formulaLines.map((line,i)=><p key={i}><MathText text={line}/></p>)}
    <h4>Cách dùng và điều cần nhớ</h4>
    {card.usageLines.map((line,i)=><p key={i}><MathText text={line}/></p>)}
  </>;
}

function RecallHistory({items,onReturn,done}:{items:HistoryItem[];onReturn:()=>void;done:boolean}){
  const [selected,setSelected]=useState(0),id=useId(),panel=useRef<HTMLDetailsElement>(null);
  const item=items[selected]??items[0];
  return <details className="cp-recall-history" ref={panel}>
    <summary>Xem lại thẻ vừa ôn ({items.length})</summary>
    <p>Xem lại không thay đổi tự đánh giá hoặc tiến độ của lượt ôn.</p>
    <label htmlFor={id+'-history'}>Chọn thẻ đã ôn</label>
    <select id={id+'-history'} value={selected} onChange={event=>setSelected(Number(event.target.value))}>{items.map(({card},index)=><option key={card.id} value={index}>{index+1}. {card.topic}</option>)}</select>
    <h4>{item.card.topic}</h4><p>Em đã đánh dấu: {item.remembered?'Em đã nhớ':'Cần ôn lại'}.</p>
    <div className="cp-recall-answer"><CardContent card={item.card}/></div>
    <button type="button" onClick={()=>{if(panel.current)panel.current.open=false;onReturn();}}>{done?'Về tổng kết lượt ôn':'Về thẻ đang ôn'}</button>
  </details>;
}

function RecallSession({deck}:{deck:RecallDeck}){
  const id=useId(),[offset,setOffset]=useState(0),[session,setSession]=useState(()=>start(recallBatch(deck,0)));
  const heading=useRef<HTMLHeadingElement>(null),answer=useRef<HTMLDivElement>(null),focusNext=useRef(false),focusAnswer=useRef(false);
  useEffect(()=>{if(focusAnswer.current){answer.current?.focus();focusAnswer.current=false;}else if(focusNext.current){heading.current?.focus();focusNext.current=false;}},[session]);
  const move=(remembered:boolean)=>{
    if(!session.revealed||session.done)return;
    const review=remembered?session.review:[...session.review,session.cards[session.index]];
    focusNext.current=true;
    setSession({...session,review,history:[...session.history,{card:session.cards[session.index],remembered}],index:session.index+1,revealed:false,done:session.index+1===session.cards.length});
  };
  const restart=(cards:RecallCard[],revisiting=false)=>{focusNext.current=true;setSession(start(cards,revisiting));};
  if(!session.cards.length)return <p>Chưa có thẻ cho phần này.</p>;
  const card=session.cards[session.index];
  return <div className="cp-recall-session">
    {session.done?<>
      <h3 ref={heading} tabIndex={-1}>Đã xem hết {session.cards.length} thẻ</h3>
      <p role="status">Em tự đánh dấu {session.cards.length-session.review.length} thẻ đã nhớ và {session.review.length} thẻ cần ôn lại. Đây là tự đánh giá, không tính điểm.</p>
      <div className="cp-recall-actions">
        {!!session.review.length&&<button type="button" onClick={()=>restart(session.review,true)}>Ôn lại {session.review.length} thẻ cần nhớ</button>}
        <button type="button" onClick={()=>{const next=offset+5<deck.cards.length?offset+5:0;setOffset(next);restart(recallBatch(deck,next));}}>{offset+5<deck.cards.length?Math.min(5,deck.cards.length-offset-5)+' thẻ tiếp theo':'Ôn lại từ đầu'}</button>
      </div>
      <p>Em có thể dừng ở đây hoặc chọn bài luyện bên dưới để áp dụng.</p>
    </>:<>
      <p className="cp-recall-count">{session.revisiting?'Ôn lại · ':''}Thẻ {session.index+1}/{session.cards.length}</p>
      <h3 ref={heading} tabIndex={-1}>{card.topic}</h3>
      <p>Em thử nhắc lại công thức cùng điều kiện trước khi mở thẻ.</p>
      <button type="button" className="cp-recall-reveal" aria-expanded={session.revealed} aria-controls={id+'-answer'} onClick={()=>{focusAnswer.current=!session.revealed;setSession({...session,revealed:!session.revealed});}}>{session.revealed?'Ẩn công thức':'Lật thẻ xem công thức'}</button>
      <div ref={answer} id={id+'-answer'} hidden={!session.revealed} className="cp-recall-answer" tabIndex={-1} role="region" aria-label={'Công thức: '+card.topic}>
        <CardContent card={card}/>
      </div>
      {session.revealed&&<div className="cp-recall-actions"><button type="button" onClick={()=>move(false)}>Cần ôn lại</button><button type="button" onClick={()=>move(true)}>Em đã nhớ</button></div>}
    </>}
    {!!session.history.length&&<RecallHistory items={session.history} done={session.done} onReturn={()=>heading.current?.focus()}/>}
  </div>;
}

export default function QuickRecall({track,chapter}:{track:string;chapter:string}){
  const decks=recallDecks(track),defaultDeck=decks.find(deck=>String(deck.chapter)===chapter),scope=track+':'+chapter;
  const [selection,setSelection]=useState({scope,id:defaultDeck?.id??''}),id=useId();
  // Lựa chọn ở chương cũ không được đi theo khi đổi nhóm hoặc chương.
  const selected=selection.scope===scope?selection.id:defaultDeck?.id??'';
  const deck=decks.find(item=>item.id===selected);
  if(!decks.length)return <p>Chưa có bộ thẻ cho nhóm này. Em chọn chương để luyện theo đề hiện có.</p>;
  return <section className="cp-recall" aria-label="Ôn nhanh công thức">
    <p>Tối đa 5 thẻ mỗi lượt, khoảng 5 phút. Chọn phần em đang học, lật thẻ rồi tự đánh dấu điều đã nhớ.</p>
    {!defaultDeck&&<p role="status">Chương này chưa có bộ thẻ. Em có thể chọn một bộ hiện có dưới đây để ôn phần khác.</p>}
    <label htmlFor={id+'-deck'}>Bộ thẻ lớp {decks[0].grade}</label>
    <select id={id+'-deck'} value={deck?.id??''} onChange={event=>setSelection({scope,id:event.target.value})}><option value="" disabled>Chọn bộ thẻ hiện có</option>{decks.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select>
    {deck&&<>
      <p className="cp-recall-note">Nguồn: bảng lý thuyết Luyện tập MTM, {deck.title}. MTM sưu tầm và biên soạn. Bộ thẻ hiện có cho những phần trong danh sách.</p>
      <RecallSession key={deck.id} deck={deck}/>
    </>}
    <p className="cp-recall-note">Tự ôn, không tính điểm hoặc xếp hạng. Tiến độ chỉ giữ khi em còn ở trang này.</p>
  </section>;
}
