import {useEffect,useId,useRef,useState} from 'react';
import {createEstimationRound,estimationNumber,type EstimationQuestion} from './estimation-game';
import './estimation-game.css';

type Session={questions:EstimationQuestion[];answers:(string|null)[];index:number;done:boolean;retry:boolean};
type Game={round:number;session:Session|null};
const start=(questions:EstimationQuestion[],retry=false):Session=>({questions,answers:questions.map(()=>null),index:0,done:false,retry});

export default function EstimationGame(){
  const id=useId(),[game,setGame]=useState<Game>({round:0,session:null}),session=game.session;
  const title=useRef<HTMLHeadingElement>(null),heading=useRef<HTMLHeadingElement>(null),feedback=useRef<HTMLDivElement>(null),focus=useRef<'title'|'heading'|'feedback'|null>(null);
  useEffect(()=>{if(focus.current){({title,heading,feedback}[focus.current]).current?.focus();focus.current=null;}},[game]);
  // Mọi chuyển trạng thái gắn với đúng bản lượt hiện tại, chặn cả sự kiện cũ và bấm đúp.
  const move=(next:Session|null,target:'title'|'heading'|'feedback',round=game.round)=>{focus.current=target;setGame(old=>old===game?{round,session:next}:old);};
  const question=session?.questions[session.index],answer=session?.answers[session.index];
  const choose=(choice:string)=>{if(session&&!session.done&&answer===null&&question?.choices.some(c=>c.id===choice))move({...session,answers:session.answers.map((v,i)=>i===session.index?choice:v)},'feedback');};
  const next=()=>{if(session&&!session.done&&answer!==null)move({...session,index:session.index+1===session.questions.length?session.index:session.index+1,done:session.index+1===session.questions.length},'heading');};
  return <section className="cp-estimation" aria-labelledby={id+'-title'}>
    <h3 id={id+'-title'} ref={title} tabIndex={-1}>Ước lượng rồi kiểm tra</h3>
    <p>5 câu trong khoảng 2 đến 3 phút, không bấm giờ. Em có thể dùng giấy nháp. Làm tròn chỉ giúp nhận ra cỡ của tích; nếu gần biên hoặc chưa phân biệt được khoảng, hãy tính nhẩm chính xác và kiểm tra hai biên trước khi chọn.</p>
    <p className="cp-estimation-note">Ký hiệu a ≤ kết quả &lt; b nghĩa là lấy đầu a, không lấy đầu b. Ôn số học THCS, phù hợp tự luyện nền tảng lớp 10 đến 12.</p>
    {!session?<button type="button" className="cp-estimation-primary" onClick={()=>move(start(createEstimationRound(game.round)),'heading')}>Bắt đầu 5 câu ước lượng</button>:session.done?<div className="cp-estimation-card">
      <h4 ref={heading} tabIndex={-1}>Hoàn thành {session.questions.length} câu{session.retry?' ôn lại':''}</h4>
      <p role="status">Em chọn đúng {session.questions.filter((q,i)=>session.answers[i]===q.correctId).length}/{session.questions.length} khoảng trong lượt này.</p>
      {session.questions.map((q,i)=><details key={q.id}><summary>Câu {i+1}: {q.a} × {q.b} · {session.answers[i]===q.correctId?'Đúng':'Cần ôn lại'}</summary><p>Em đã chọn: {q.choices.find(c=>c.id===session.answers[i])?.text}.</p><ol>{q.steps.map((line,j)=><li key={j}>{line}</li>)}</ol></details>)}
      <div className="cp-estimation-actions">
        {session.questions.some((q,i)=>session.answers[i]!==q.correctId)&&<button type="button" onClick={()=>move(start(session.questions.filter((q,i)=>session.answers[i]!==q.correctId),true),'heading')}>Ôn lại khoảng đã chọn sai</button>}
        <button type="button" onClick={()=>move(start(createEstimationRound(game.round+1)),'heading',game.round+1)}>Thử bộ 5 câu khác</button>
        <button type="button" onClick={()=>move(null,'title',game.round+1)}>Kết thúc ước lượng</button>
      </div>
    </div>:question?<div className="cp-estimation-card">
      <p>{session.retry?'Ôn lại · ':''}Câu {session.index+1}/{session.questions.length}</p>
      <h4 ref={heading} tabIndex={-1}>Tích {question.a} × {question.b} thuộc khoảng nào?</h4>
      <p>Ước lượng chỉ cho cỡ kết quả. Em có thể dùng giấy nháp, tính nhẩm chính xác và kiểm tra hai biên trước khi chọn khoảng.</p>
      <div className="cp-estimation-choices" role="group" aria-label="Chọn khoảng chứa kết quả">{question.choices.map((choice,i)=><button type="button" key={choice.id} disabled={answer!==null} aria-pressed={answer===choice.id} onClick={()=>choose(choice.id)}>{String.fromCharCode(65+i)}. {choice.text}</button>)}</div>
      {answer!==null&&<>
        <div ref={feedback} tabIndex={-1} role="group" aria-label="Lời giải ước lượng" aria-describedby={id+'-verdict '+id+'-steps'} className="cp-estimation-feedback">
          <p id={id+'-verdict'} role="status"><strong>{answer===question.correctId?'Đúng rồi! Khoảng này chứa kết quả '+estimationNumber(question.product)+'.':'Em đối chiếu hai biên và phép tính dưới đây nhé.'}</strong></p>
          <ol id={id+'-steps'}>{question.steps.map((line,i)=><li key={i}>{line}</li>)}</ol>
        </div>
        <button type="button" className="cp-estimation-primary" onClick={next}>{session.index+1===session.questions.length?'Xem tổng kết ước lượng':'Tích tiếp theo'}</button>
      </>}
      <p><button type="button" onClick={()=>move(null,'title')}>Dừng lượt ước lượng</button></p>
    </div>:null}
    <p className="cp-estimation-note">Bộ câu tự biên soạn MTM, không thuộc ngân hàng đề gốc, không tính điểm thi hoặc xếp hạng. Có 6 bộ luân phiên. Lượt chỉ giữ ở trang này; đổi chương hoặc tải lại sẽ bắt đầu lại.</p>
  </section>;
}
