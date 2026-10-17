import {useEffect,useRef,useState} from 'react';
import {SOLUTION_PUZZLES,stepChoices} from './notebook-step-order';

export default function NotebookStepOrder(){
 const [puzzleId,setPuzzleId]=useState(SOLUTION_PUZZLES[0].id),[placed,setPlaced]=useState<string[]>([]),[feedback,setFeedback]=useState('');
 const session=useRef(0),placedRef=useRef<string[]>([]),pendingFocus=useRef(false),questionRef=useRef<HTMLHeadingElement>(null),summaryRef=useRef<HTMLHeadingElement>(null);
 const revision=session.current,puzzle=SOLUTION_PUZZLES.find(item=>item.id===puzzleId)!,complete=placed.length===puzzle.steps.length;
 useEffect(()=>{if(!pendingFocus.current)return;pendingFocus.current=false;(complete?summaryRef:questionRef).current?.focus();},[puzzleId,placed]);
 function reset(id=puzzleId){if(revision!==session.current)return;session.current++;placedRef.current=[];pendingFocus.current=true;setPuzzleId(id);setPlaced([]);setFeedback('');}
 function choose(id:string){
  if(revision!==session.current||placedRef.current.includes(id)||placedRef.current.length===puzzle.steps.length)return;
  const expected=puzzle.steps[placedRef.current.length];
  if(id!==expected.id){setFeedback('Chưa đúng vị trí theo lộ trình này. '+expected.hint);return;}
  // Mỗi lần đặt làm hết hiệu lực callback của màn hình trước, kể cả bấm nhanh.
  session.current++;const next=[...placedRef.current,id];placedRef.current=next;pendingFocus.current=true;setPlaced(next);setFeedback('Đúng bước '+next.length+'. '+expected.reason);
 }
 function undo(){if(revision!==session.current||!placedRef.current.length)return;session.current++;const next=placedRef.current.slice(0,-1);placedRef.current=next;pendingFocus.current=true;setPlaced(next);setFeedback('Đã trả bước cuối về các thẻ chưa xếp.');}
 return <div className="mig-formula-game" data-version="1">
  <fieldset className="mig-formula-decks"><legend>Chọn bài xếp lời giải</legend><div>{SOLUTION_PUZZLES.map(item=><button key={item.id} type="button" aria-pressed={puzzleId===item.id} onClick={()=>reset(item.id)}>{item.title}</button>)}</div></fieldset>
  <h3 id="step-order-question" tabIndex={-1} ref={questionRef}>{puzzle.problem}</h3>
  <p><b>Lộ trình cần xếp:</b> {puzzle.route}</p><p>Chọn thẻ cho bước tiếp theo. Trò chơi dùng lộ trình trên; những cách giải tương đương khác vẫn có thể đúng.</p>
  <p className="mig-formula-progress" role="status">Đã xếp {placed.length}/{puzzle.steps.length} bước.</p>
  <div className="mig-step-cards" role="group" aria-label="Các bước chưa xếp">{stepChoices(puzzle).filter(step=>!placed.includes(step.id)).map(step=><button key={step.id} type="button" aria-label={'Đặt bước: '+step.text} onClick={()=>choose(step.id)}>{step.text}</button>)}</div>
  <p className="mig-formula-feedback" role="status" aria-live="polite">{feedback||'Không hẹn giờ. Em có thể thử, lùi một bước và suy nghĩ lại.'}</p>
  {placed.length>0&&<div className="mig-formula-solutions"><h3>Lời giải em đã xếp</h3><ol>{puzzle.steps.slice(0,placed.length).map(step=><li key={step.id}><b>{step.text}</b><p>{step.reason}</p></li>)}</ol></div>}
  {complete&&<div className="mig-formula-summary"><h3 id="step-order-summary" tabIndex={-1} ref={summaryRef}>Em đã xếp đúng cả lời giải</h3><p>Đọc lại điều kiện và phép thử. Sau đó thử viết lời giải bằng lời của em.</p></div>}
  <div className="mig-step-actions"><button type="button" disabled={!placed.length} onClick={undo}>Lùi một bước</button><button type="button" onClick={()=>reset()}>Xếp lại bài</button></div>
  <p className="mig-formula-caption">MTM sưu tầm và biên soạn. Dữ kiện tự biên soạn, không thuộc đề gốc. Ôn kiến thức THCS, không tính điểm thi. Kết quả chỉ giữ trong lần mở trò chơi này.</p>
 </div>;
}
