import {useEffect,useId,useRef,useState} from 'react';
import {createIntervalRound,intervalDescription,intervalSetText,type Interval,type IntervalQuestion} from './interval-game';
import './interval-game.css';

type Session={questions:IntervalQuestion[];answers:(string|null)[];index:number;done:boolean;retry:boolean};
type Game={round:number;session:Session|null};
const start=(questions:IntervalQuestion[],retry=false):Session=>({questions,answers:questions.map(()=>null),index:0,done:false,retry});
const mathText=(value:string)=>value.replace(/-(?=\d)/g,'−');
const sentence=(value:string)=>mathText(value.charAt(0).toLocaleUpperCase('vi')+value.slice(1));

export function IntervalAxis({parts,min,max,label}:{parts:Interval[];min:number;max:number;label:string}){
  const id=useId(),x=(n:number)=>44+(n-min)/(max-min)*432;
  const labels=[...new Set(parts.length?parts.flatMap(part=>[part.from,part.to]):[min,max])].sort((a,b)=>a-b).reduce<{n:number;lower:boolean}[]>((items,n)=>{
    const previous=items.at(-1);items.push({n,lower:!!previous&&n-previous.n===1&&!previous.lower});return items;
  },[]);
  return <figure className="cp-interval-axis">
    {!parts.length&&<p className="cp-interval-empty" aria-hidden="true">∅ · Không có phần tử</p>}
    <div className="cp-interval-diagram"><svg viewBox="0 0 520 62" role="img" aria-labelledby={id+'-axis-title '+id+'-axis-desc'}>
    <title id={id+'-axis-title'}>{label+': '+mathText(intervalSetText(parts))}</title><desc id={id+'-axis-desc'}>{mathText(intervalDescription(parts))+'. Chấm kín là lấy đầu mút, chấm rỗng là không lấy đầu mút.'}</desc>
    <line x1="26" x2="496" y1="36" y2="36" stroke="#9daac4" strokeWidth="2"/><path d="M490 31 L497 36 L490 41" fill="none" stroke="#9daac4" strokeWidth="2"/>
    {Array.from({length:max-min+1},(_,i)=>min+i).map(n=><line key={n} x1={x(n)} x2={x(n)} y1="32" y2="41" stroke="#9daac4"/>)}
    {parts.map((part,i)=><g key={i}>{part.from!==part.to&&<line x1={x(part.from)} x2={x(part.to)} y1="36" y2="36" stroke="#213269" strokeWidth="6"/>}{(part.from===part.to?[{n:part.from,closed:true}]:[{n:part.from,closed:part.leftClosed},{n:part.to,closed:part.rightClosed}]).map((point,j)=><circle key={j} cx={x(point.n)} cy="36" r="6" stroke="#213269" strokeWidth="3" fill={point.closed?'#213269':'#fff'}/>)}</g>)}
    </svg><div className={'cp-interval-axis-labels'+(labels.some(point=>point.lower)?' has-close-labels':'')} aria-hidden="true">{labels.map(({n,lower})=><span key={n} className={lower?'is-lower':undefined} style={{left:x(n)/520*100+'%'}}>{mathText(String(n))}</span>)}</div></div>
    <figcaption><strong>{label}: {mathText(intervalSetText(parts))}</strong><span>{sentence(intervalDescription(parts))}.</span></figcaption></figure>;
}

export default function IntervalGame(){
  const id=useId(),[game,setGame]=useState<Game>({round:0,session:null}),session=game.session;
  const title=useRef<HTMLHeadingElement>(null),heading=useRef<HTMLHeadingElement>(null),feedback=useRef<HTMLDivElement>(null),focus=useRef<'title'|'heading'|'feedback'|null>(null);
  useEffect(()=>{if(focus.current){({title,heading,feedback}[focus.current]).current?.focus();focus.current=null;}},[game]);
  const move=(next:Session|null,target:'title'|'heading'|'feedback',round=game.round)=>setGame(old=>{if(old!==game)return old;focus.current=target;return {round,session:next};});
  const question=session?.questions[session.index],answer=session?.answers[session.index];
  const choose=(choice:string)=>{if(session&&!session.done&&answer===null&&question?.choices.some(c=>c.id===choice))move({...session,answers:session.answers.map((v,i)=>i===session.index?choice:v)},'feedback');};
  const next=()=>{if(session&&!session.done&&answer!==null)move({...session,index:session.index+1===session.questions.length?session.index:session.index+1,done:session.index+1===session.questions.length},'heading');};
  const min=question?Math.min(question.a.from,question.b.from)-1:0,max=question?Math.max(question.a.to,question.b.to)+1:1;
  return <section className="cp-interval" aria-labelledby={id+'-title'}>
    <h3 id={id+'-title'} ref={title} tabIndex={-1}>Tập nghiệm trên trục số</h3>
    <p>5 câu ôn giao, hợp của hai khoảng hoặc đoạn hữu hạn. Không bấm giờ, em có thể dùng giấy nháp. Nền tảng lớp 10, phù hợp ôn lại ở lớp 11, 12.</p>
    <p className="cp-interval-note">Giao ∩: thuộc cả hai tập. Hợp ∪: thuộc ít nhất một tập. Ngoặc vuông và chấm kín lấy đầu mút; ngoặc tròn và chấm rỗng không lấy đầu mút. ∅ là tập rỗng; {'{a}'} chỉ gồm số a.</p>
    {!session?<button type="button" className="cp-interval-primary" onClick={()=>move(start(createIntervalRound(game.round)),'heading')}>Bắt đầu 5 câu tập nghiệm</button>:session.done?<div className="cp-interval-card">
      <h4 ref={heading} tabIndex={-1}>Hoàn thành {session.questions.length} câu{session.retry?' ôn lại':''}</h4>
      <p role="status">Em chọn đúng {session.questions.filter((q,i)=>session.answers[i]===q.correctId).length}/{session.questions.length} câu trong lượt tự luyện.</p>
      {session.questions.map((q,i)=><details key={q.id}><summary>Câu {i+1}: {q.operation==='intersection'?'Giao':'Hợp'} · {session.answers[i]===q.correctId?'Đúng':'Cần ôn lại'}</summary><p>A = {mathText(intervalSetText([q.a]))}; B = {mathText(intervalSetText([q.b]))}. Em đã chọn: {mathText(q.choices.find(c=>c.id===session.answers[i])?.text??'')}.</p><ol>{q.steps.map((line,j)=><li key={j}>{mathText(line)}</li>)}</ol></details>)}
      <div className="cp-interval-actions">
        {session.questions.some((q,i)=>session.answers[i]!==q.correctId)&&<button type="button" onClick={()=>move(start(session.questions.filter((q,i)=>session.answers[i]!==q.correctId),true),'heading')}>Ôn lại câu tập nghiệm đã chọn sai</button>}
        <button type="button" onClick={()=>move(start(createIntervalRound(game.round+1)),'heading',game.round+1)}>Thử bộ 5 câu tập nghiệm khác</button>
        <button type="button" onClick={()=>move(null,'title',game.round+1)}>Kết thúc tập nghiệm</button>
      </div>
    </div>:question?<div className="cp-interval-card">
      <p>{session.retry?'Ôn lại · ':''}Câu {session.index+1}/{session.questions.length}</p>
      <h4 ref={heading} tabIndex={-1}>Chọn {question.operation==='intersection'?'giao A ∩ B':'hợp A ∪ B'}</h4>
      <IntervalAxis parts={[question.a]} min={min} max={max} label="Tập A"/><IntervalAxis parts={[question.b]} min={min} max={max} label="Tập B"/>
      <div className="cp-interval-choices" role="group" aria-label="Chọn tập kết quả">{question.choices.map((choice,i)=>{
        const correct=answer!==null&&choice.id===question.correctId,wrong=answer===choice.id&&!correct,status=correct?(answer===choice.id?'Em chọn đúng':'Đáp án đúng'):wrong?'Em chọn sai':'';
        return <button type="button" key={choice.id} className={correct?'is-correct':wrong?'is-wrong':undefined} disabled={answer!==null} aria-pressed={answer===choice.id} aria-label={String.fromCharCode(65+i)+'. '+mathText(choice.text)+'. '+sentence(intervalDescription(choice.value))+(status?'. '+status:'')} onClick={()=>choose(choice.id)}>{String.fromCharCode(65+i)}. {mathText(choice.text)}{status&&<span className="cp-interval-choice-status">{status}</span>}</button>;
      })}</div>
      {answer!==null&&<>
        <div ref={feedback} tabIndex={-1} role="group" aria-label="Lời giải tập nghiệm" className="cp-interval-feedback">
          <p role="status"><strong>{answer===question.correctId?'Đúng rồi!':'Chưa đúng. Em đối chiếu phần trục số và các đầu mút nhé.'}</strong></p>
          <IntervalAxis parts={question.result} min={min} max={max} label="Kết quả"/><ol>{question.steps.map((line,i)=><li key={i}>{mathText(line)}</li>)}</ol>
        </div>
        <button type="button" className="cp-interval-primary" onClick={next}>{session.index+1===session.questions.length?'Xem tổng kết tập nghiệm':'Câu tập nghiệm tiếp theo'}</button>
      </>}
      <p><button type="button" onClick={()=>move(null,'title')}>Dừng lượt tập nghiệm</button></p>
    </div>:null}
    <p className="cp-interval-note">Dữ kiện tự biên soạn, không thuộc đề gốc. MTM sưu tầm và biên soạn. Không tính điểm thi, xếp hạng hoặc lưu lịch sử. Lượt chỉ giữ ở trang này; đổi chương hoặc tải lại sẽ bắt đầu lại. Có 6 bộ luân phiên.</p>
  </section>;
}
