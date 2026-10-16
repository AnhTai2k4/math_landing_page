import {useEffect,useId,useRef,useState} from 'react';
import {graphRound,graphExplanation,lineFormula,lineKey,lineSegment,type GraphQuestion,type Line} from './line-graph';
import './line-graph.css';

type Session={questions:GraphQuestion[];answers:(string|null)[];index:number;done:boolean;retry:boolean};
const start=(questions:GraphQuestion[],retry=false):Session=>({questions,answers:questions.map(()=>null),index:0,done:false,retry});

function LinePlot({line}:{line:Line}){
  const id=useId(),px=(n:number)=>150+24*n,py=(n:number)=>150-24*n,[p,q]=lineSegment(line);
  return <svg className="cp-graph-plot" viewBox="0 0 300 300" role="img" aria-labelledby={id+'-title '+id+'-desc'}>
    <title id={id+'-title'}>Đồ thị đường thẳng trên hệ trục tọa độ</title>
    <desc id={id+'-desc'}>Hai trục cùng đơn vị. Đường thẳng đi qua hai điểm được đánh dấu: P(0; {line.b}) và Q(1; {line.a+line.b}). Mỗi ô lưới ứng với 1 đơn vị.</desc>
    <g className="cp-graph-grid">{[-5,-4,-3,-2,-1,0,1,2,3,4,5].map(n=><g key={n}><line x1={px(n)} y1="30" x2={px(n)} y2="270"/><line x1="30" y1={py(n)} x2="270" y2={py(n)}/></g>)}</g>
    <g className="cp-graph-axis"><path d="M 25 150 H 278 M 273 146 L 278 150 L 273 154 M 150 275 V 22 M 146 27 L 150 22 L 154 27"/>
      {[-4,-3,-2,-1,1,2,3,4].map(n=><g key={n}><line x1={px(n)} y1="147" x2={px(n)} y2="153"/><line x1="147" y1={py(n)} x2="153" y2={py(n)}/></g>)}
    </g>
    <g className="cp-graph-ticks" aria-hidden="true">{[-4,-3,-2,-1,1,2,3,4].map(n=><g key={n}><text x={px(n)} y="166" textAnchor="middle">{n}</text><text x="143" y={py(n)+4} textAnchor="end">{n}</text></g>)}<text x="139" y="164">O</text><text x="281" y="145">x</text><text x="157" y="23">y</text></g>
    <line className="cp-graph-line" x1={px(p.x)} y1={py(p.y)} x2={px(q.x)} y2={py(q.y)}/>
    <g className="cp-graph-points"><circle cx={px(0)} cy={py(line.b)} r="4"/><circle cx={px(1)} cy={py(line.a+line.b)} r="4"/></g>
    <g className="cp-graph-point-labels" aria-hidden="true"><text x={px(0)+7} y={py(line.b)-7}>P</text><text x={px(1)+7} y={py(line.a+line.b)-7}>Q</text></g>
  </svg>;
}

export default function LineGraphGame(){
  const id=useId(),[round,setRound]=useState(0),[session,setSession]=useState<Session|null>(null);
  const title=useRef<HTMLHeadingElement>(null),heading=useRef<HTMLHeadingElement>(null),feedback=useRef<HTMLDivElement>(null),focus=useRef<'title'|'heading'|'feedback'|null>(null);
  useEffect(()=>{if(focus.current){({title,heading,feedback}[focus.current]).current?.focus();focus.current=null;}},[session]);
  const begin=(questions:GraphQuestion[],retry=false)=>{focus.current='heading';setSession(start(questions,retry));};
  const question=session?.questions[session.index],answer=session?.answers[session.index];
  const choose=(line:Line)=>{
    focus.current='feedback';
    setSession(old=>!old||old!==session||old.done||old.answers[old.index]!==null?old:{...old,answers:old.answers.map((v,i)=>i===old.index?lineKey(line):v)});
  };
  const next=()=>{
    focus.current='heading';
    setSession(old=>!old||old!==session||old.done||old.answers[old.index]===null?old:{...old,index:old.index+1===old.questions.length?old.index:old.index+1,done:old.index+1===old.questions.length});
  };
  return <section className="cp-graph-game" aria-labelledby={id+'-title'}>
    <h3 id={id+'-title'} ref={title} tabIndex={-1}>Đọc đồ thị đường thẳng</h3>
    <p>5 câu ôn kiến thức hàm số bậc nhất đã học ở THCS. Đọc đồ thị rồi chọn hàm số phù hợp, không cần bấm giờ.</p>
    <p className="cp-graph-note">Câu tự luyện do MTM biên soạn, không thuộc đề kiểm tra. Không tính điểm thi hoặc xếp hạng. MTM sưu tầm và biên soạn.</p>
    {!session?<button type="button" className="cp-graph-primary" onClick={()=>begin(graphRound(round))}>Bắt đầu đọc 5 đồ thị</button>:session.done?<div className="cp-graph-card">
      <h4 ref={heading} tabIndex={-1}>Đã hoàn thành {session.questions.length} câu{session.retry?' ôn lại':''}</h4>
      <p role="status">Em chọn đúng {session.questions.filter((q,i)=>session.answers[i]===q.id).length}/{session.questions.length} câu trong lượt này.</p>
      {session.questions.map((q,i)=><details key={q.id}><summary>Câu {i+1}: {lineFormula(q.line)} · {session.answers[i]===q.id?'Đúng':'Cần ôn lại'}</summary><LinePlot line={q.line}/>{graphExplanation(q.line).map((line,j)=><p key={j}>{line}</p>)}</details>)}
      <div className="cp-graph-actions">
        {session.questions.some((q,i)=>session.answers[i]!==q.id)&&<button type="button" onClick={()=>begin(session.questions.filter((q,i)=>session.answers[i]!==q.id),true)}>Ôn lại đồ thị đã chọn sai</button>}
        <button type="button" onClick={()=>{const n=round+1;setRound(n);begin(graphRound(n));}}>Thử lượt 5 câu tiếp</button>
        <button type="button" onClick={()=>{focus.current='title';setSession(null);setRound(round+1);}}>Kết thúc tự luyện đồ thị</button>
      </div><p>Em có thể nghỉ ở đây hoặc chọn bài luyện của chương.</p>
    </div>:question?<div className="cp-graph-card">
      <p>{session.retry?'Ôn lại · ':''}Câu {session.index+1}/{session.questions.length}</p>
      <h4 ref={heading} tabIndex={-1}>Đồ thị này biểu diễn hàm số nào?</h4>
      <p>Mỗi ô lưới là 1 đơn vị. Hai điểm P và Q được đánh dấu để em đọc tọa độ.</p>
      <LinePlot line={question.line}/>
      <div className="cp-graph-choices" role="group" aria-label="Chọn hàm số">{question.choices.map((line,i)=><button key={lineKey(line)} type="button" disabled={answer!==null} aria-pressed={answer===lineKey(line)} onClick={()=>choose(line)}>{String.fromCharCode(65+i)}. {lineFormula(line)}</button>)}</div>
      {answer!==null&&<>
        <div ref={feedback} tabIndex={-1} role="group" aria-label="Phản hồi đọc đồ thị" className="cp-graph-feedback"><p><strong>{answer===question.id?'Chính xác! Em đã đọc đúng đồ thị.':'Em đối chiếu hai điểm để nhận ra hàm số đúng nhé.'}</strong></p>{graphExplanation(question.line).map((line,i)=><p key={i}>{line}</p>)}</div>
        <button type="button" className="cp-graph-primary" onClick={next}>{session.index+1===session.questions.length?'Xem tổng kết đồ thị':'Đồ thị tiếp theo'}</button>
      </>}
    </div>:null}
    <p className="cp-graph-note">Lượt tự luyện chỉ giữ khi còn ở trang này. Rời trang hoặc tải lại sẽ bắt đầu lại.</p>
  </section>;
}
