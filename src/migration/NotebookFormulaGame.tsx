import {useEffect,useRef,useState} from 'react';
import {FORMULA_DECKS} from './notebook-formula-game';

export default function NotebookFormulaGame(){
 const [deckId,setDeckId]=useState(FORMULA_DECKS[0].id),[selected,setSelected]=useState<string|null>(null);
 const [matched,setMatched]=useState<string[]>([]),[mistakes,setMistakes]=useState<string[]>([]),[reviewIds,setReviewIds]=useState<string[]|null>(null),[feedback,setFeedback]=useState('');
 const [recallMode,setRecallMode]=useState(false),[revealed,setRevealed]=useState<string|null>(null);
 const session=useRef(0),selectedRef=useRef<string|null>(null),matchedRef=useRef<string[]>([]),pendingFocus=useRef(false),revealedRef=useRef<string|null>(null),flipRef=useRef<HTMLButtonElement>(null);
 const nextExpressionRef=useRef<HTMLButtonElement>(null),summaryRef=useRef<HTMLHeadingElement>(null),firstAnswerRef=useRef<HTMLButtonElement>(null),revision=session.current;
 const deck=FORMULA_DECKS.find(item=>item.id===deckId)!,pairs=reviewIds?deck.pairs.filter(pair=>reviewIds.includes(pair.id)):deck.pairs;
 const complete=matched.length===pairs.length;
 const nextExpression=pairs.find(pair=>!matched.includes(pair.id));
 const answers=[...pairs.slice(1),pairs[0]];
 useEffect(()=>{if(!pendingFocus.current)return;pendingFocus.current=false;if(complete)summaryRef.current?.focus();else nextExpressionRef.current?.focus();},[deckId,matched,reviewIds]);
 function reset(nextDeck=deckId){if(revision!==session.current)return;session.current++;selectedRef.current=null;matchedRef.current=[];revealedRef.current=null;pendingFocus.current=true;setDeckId(nextDeck);setSelected(null);setMatched([]);setMistakes([]);setReviewIds(null);setRevealed(null);setFeedback('');}
 useEffect(()=>{if(!recallMode||!selected)return;(revealed===selected?firstAnswerRef:flipRef).current?.focus();},[recallMode,selected,revealed]);
 function chooseExpression(id:string){if(revision!==session.current||matchedRef.current.includes(id)||selectedRef.current===id)return;session.current++;selectedRef.current=id;revealedRef.current=null;setRevealed(null);setSelected(id);const pair=pairs.find(item=>item.id===id)!;setFeedback('Đã chọn '+pair.expression+(recallMode?'. Tự đọc hoặc viết công thức và điều kiện, rồi lật để đối chiếu.':'. Chọn công thức tương ứng.'));}
 function flip(){if(revision!==session.current||!selected||selectedRef.current!==selected||matchedRef.current.includes(selected))return;revealedRef.current=selected;setRevealed(selected);setFeedback('Đã lật các công thức. Chọn cặp phù hợp và đối chiếu điều kiện với phần em vừa nhớ.');}
 function chooseAnswer(answerId:string){
  const active=selectedRef.current;
  if(revision!==session.current||!active||matchedRef.current.includes(active)||matchedRef.current.includes(answerId)||recallMode&&revealedRef.current!==active)return;
  const pair=pairs.find(item=>item.id===active);if(!pair)return;
  if(active===answerId){const next=[...matchedRef.current,active];matchedRef.current=next;selectedRef.current=null;pendingFocus.current=true;setMatched(next);setSelected(null);setFeedback('Ghép đúng: '+pair.expression+' = '+pair.answer+'. '+pair.condition+' '+pair.explanation);}
  else{setMistakes(previous=>previous.includes(active)?previous:[...previous,active]);setFeedback('Cặp này chưa khớp. Với '+pair.expression+', hãy tìm '+pair.answer+'. '+pair.condition+' '+pair.explanation);}
 }
 function reviewMistakes(){if(revision!==session.current||!mistakes.length||matchedRef.current.length!==pairs.length)return;session.current++;selectedRef.current=null;matchedRef.current=[];revealedRef.current=null;pendingFocus.current=true;setReviewIds([...mistakes]);setMatched([]);setMistakes([]);setSelected(null);setRevealed(null);setFeedback('Bắt đầu ôn các cặp từng nhầm.');}
 return <div className="mig-formula-game" data-version="2">
  <fieldset className="mig-formula-decks"><legend>Chọn bộ công thức</legend><div>{FORMULA_DECKS.map(item=><button key={item.id} type="button" aria-pressed={deck.id===item.id} onClick={()=>reset(item.id)}>{item.title}</button>)}</div></fieldset>
  <div className="mig-formula-recall"><button type="button" aria-pressed={recallMode} onClick={()=>{if(revision!==session.current)return;reset();setRecallMode(value=>!value);}}>Tự nhớ trước khi ghép</button><p>{recallMode?'Đang bật tự nhớ: công thức được che cho đến khi em chủ động lật. Đổi chế độ bắt đầu lại lượt.':'Bật tự nhớ để thử đọc công thức và điều kiện trước khi nhìn các đáp án. Đổi chế độ bắt đầu lại lượt.'}</p></div>
  <p>Chọn một biểu thức ở cột thứ nhất, rồi chọn công thức tương ứng ở cột thứ hai. Đọc cả điều kiện để dùng đúng.</p>
  <p className="mig-formula-progress" role="status">{reviewIds?'Đang ôn các cặp từng nhầm. ':''}Đã ghép {matched.length}/{pairs.length} cặp.</p>
  <div className="mig-formula-columns">
   <div role="group" aria-label="Biểu thức cần ghép"><h3>1. Biểu thức</h3>{pairs.map(pair=><button key={pair.id} id={'formula-expression-'+pair.id} ref={nextExpression?.id===pair.id?nextExpressionRef:undefined} type="button" disabled={matched.includes(pair.id)} aria-pressed={selected===pair.id} aria-label={'Chọn biểu thức '+pair.expression} onClick={()=>chooseExpression(pair.id)}><b>{pair.expression}</b><small>{matched.includes(pair.id)?'Đã ghép đúng':'Chọn để ghép'}</small></button>)}</div>
   <div role="group" aria-label="Công thức và điều kiện"><h3>2. Công thức và điều kiện</h3>{recallMode&&(!selected||revealed!==selected)?<div className="mig-formula-recall-cover"><p>{selected?'Hãy tự nhớ cả công thức và điều kiện sử dụng trước khi lật.':'Chọn một biểu thức để bắt đầu tự nhớ.'}</p>{selected&&<button type="button" id="formula-recall-flip" ref={flipRef} onClick={flip}>Lật công thức để đối chiếu</button>}</div>:answers.map(pair=><button key={pair.id} id={'formula-answer-'+pair.id} ref={answers.find(item=>!matched.includes(item.id))?.id===pair.id?firstAnswerRef:undefined} type="button" disabled={!selected||matched.includes(pair.id)} aria-label={'Ghép với '+pair.answer} onClick={()=>chooseAnswer(pair.id)}><b>{pair.answer}</b><small>{pair.condition}</small></button>)}</div>
  </div>
  <p className="mig-formula-feedback" role="status" aria-live="polite">{feedback||'Không hẹn giờ. Em có thể đọc và thử lại theo nhịp của mình.'}</p>
  {matched.length>0&&<div className="mig-formula-solutions"><h3>Lời giải các cặp đã ghép</h3><ul>{pairs.filter(pair=>matched.includes(pair.id)).map(pair=><li key={pair.id}><b>{pair.expression} = {pair.answer}</b><p>{pair.condition} {pair.explanation}</p></li>)}</ul></div>}
  {complete&&<div className="mig-formula-summary"><h3 id="formula-summary-title" tabIndex={-1} ref={summaryRef}>Em đã ghép xong {pairs.length} cặp</h3><p>{mistakes.length?`Có ${mistakes.length} cặp từng nhầm trong lượt này. Em có thể ôn riêng để nhớ điều kiện.`:'Các cặp trong lượt này đều được ghép đúng ngay. Hãy thử giải thích công thức bằng lời của em.'}</p><div>{mistakes.length>0&&<button type="button" onClick={reviewMistakes}>Ôn cặp từng nhầm</button>}<button type="button" onClick={()=>reset()}>Chơi lại cả bộ</button></div></div>}
  <p className="mig-formula-caption">MTM sưu tầm và biên soạn. Trò chơi ôn kiến thức THCS, không tính điểm thi. Phần tự nhớ do em tự đối chiếu, không được chấm tự động. Kết quả chỉ giữ trong lần mở trò chơi này.</p>
 </div>;
}
