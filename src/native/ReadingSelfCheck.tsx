import {useEffect,useId,useRef,useState} from 'react';
import './reading-self-check.css';

const prompts=[
  {label:'Công thức hoặc ý chính cùng điều kiện áp dụng',hint:'Viết bằng lời điều em vừa nhớ, kể cả điều kiện để dùng được.'},
  {label:'Một cách dùng hoặc ví dụ em tự nghĩ',hint:'Nêu cách làm và vì sao có thể áp dụng ý vừa đọc.'},
  {label:'Điều em còn vướng',hint:'Ghi câu cần đọc lại. Nếu chưa có, em có thể viết “Chưa có”.'},
];
type Rating=''|'sure'|'review';
export default function ReadingSelfCheck(){
  const id=useId(),[notes,setNotes]=useState(['','','']),[ratings,setRatings]=useState<Rating[]>(['','','']);
  const [phase,setPhase]=useState<'write'|'compare'>('write'),[error,setError]=useState(''),[reset,setReset]=useState(false);
  const result=useRef<HTMLDivElement>(null),first=useRef<HTMLTextAreaElement>(null),second=useRef<HTMLTextAreaElement>(null),third=useRef<HTMLTextAreaElement>(null),restart=useRef<HTMLButtonElement>(null),confirm=useRef<HTMLButtonElement>(null),nextFocus=useRef<'result'|'first'|'restart'|'confirm'|null>(null);
  const noteRefs=[first,second,third];
  useEffect(()=>{if(nextFocus.current==='result')result.current?.focus();if(nextFocus.current==='first')first.current?.focus();if(nextFocus.current==='restart')restart.current?.focus();if(nextFocus.current==='confirm')confirm.current?.focus();nextFocus.current=null;},[phase,reset]);
  const submit=()=>{
    const missing=notes.findIndex(note=>!note.trim());
    if(missing!==-1){setError('Em điền cả ba mục trước khi đối chiếu. Mục còn vướng có thể ghi “Chưa có”.');noteRefs[missing].current?.focus();return;}
    setError('');setReset(false);nextFocus.current='result';setPhase('compare');
  };
  const reviewed=ratings.filter(Boolean).length,again=ratings.filter(r=>r==='review').length;
  return <section className="reading-self-check" aria-label="Tự kiểm sau khi đọc">
    <p>Chọn một đoạn ngắn vừa đọc, tạm gấp phần PDF rồi thử nhớ lại trong 2 phút. Sau đó mở lại bản gốc để đối chiếu cả công thức và điều kiện.</p>
    <p className="reading-self-check-note">Phiếu chỉ giữ trong lần mở trang này, không lưu hoặc gửi đi. Đổi tài liệu hay tải lại trang sẽ bỏ phiếu.</p>
    {phase==='write'?<form onSubmit={event=>{event.preventDefault();submit();}}>
      {prompts.map((prompt,index)=><div className="reading-self-check-field" key={prompt.label}>
        <label htmlFor={id+'-note-'+index}>{index+1}. {prompt.label}</label>
        <p id={id+'-hint-'+index}>{prompt.hint}</p>
        <textarea ref={noteRefs[index]} id={id+'-note-'+index} aria-invalid={!!error&&!notes[index].trim()} aria-describedby={id+'-hint-'+index+(error&&!notes[index].trim()?' '+id+'-error':'')} rows={3} maxLength={1200} value={notes[index]} onChange={event=>{setNotes(previous=>previous.map((note,i)=>i===index?event.target.value.slice(0,1200):note));setRatings(['','','']);setError('');}}/>
      </div>)}
      {error&&<p id={id+'-error'} role="alert">{error}</p>}
      <button type="submit">Mở phiếu đối chiếu</button>
    </form>:<div ref={result} tabIndex={-1} role="region" aria-labelledby={id+'-result'}>
      <h3 id={id+'-result'}>Đối chiếu với tài liệu gốc</h3>
      <p>Đọc lại đoạn đã chọn trong PDF phía trên. Đây là tự đánh giá, web không chấm đúng sai hoặc xác nhận em đã hiểu bài.</p>
      {prompts.map((prompt,index)=><div className="reading-self-check-field" key={prompt.label}>
        <h4>{index+1}. {prompt.label}</h4><p className="reading-self-check-answer">{notes[index]}</p>
        <label htmlFor={id+'-rating-'+index}>Tự đánh giá mục {index+1}</label>
        <select id={id+'-rating-'+index} value={ratings[index]} onChange={event=>setRatings(previous=>previous.map((rating,i)=>i===index?event.target.value as Rating:rating))}>
          <option value="">Chưa chọn</option><option value="sure">Đã chắc sau đối chiếu</option><option value="review">Cần đọc lại</option>
        </select>
      </div>)}
      <p role="status" aria-live="polite" aria-atomic="true">{reviewed<3?`Em đã tự đánh giá ${reviewed}/3 mục.`:again?`Em chọn ${again} mục cần đọc lại. Hãy chọn một mục để gỡ trước, rồi tự kiểm lại.`:'Em tự đánh dấu cả ba mục đã chắc sau đối chiếu. Có thể chọn bài luyện để thử áp dụng.'}</p>
      <div className="reading-self-check-actions">
        <button type="button" onClick={()=>{setReset(false);nextFocus.current='first';setPhase('write');}}>Sửa điều vừa nhớ</button>
        <button ref={restart} type="button" onClick={()=>{nextFocus.current='confirm';setReset(true);}}>Lượt tự kiểm mới</button>
      </div>
    </div>}
    {reset&&<div className="reading-self-check-reset" role="group" aria-label="Xác nhận bỏ phiếu hiện tại">
      <p>Bắt đầu lượt mới sẽ xóa ba ghi chú và tự đánh giá đang có.</p>
      <div className="reading-self-check-actions"><button ref={confirm} type="button" onClick={()=>{setNotes(['','','']);setRatings(['','','']);setError('');nextFocus.current='first';setReset(false);setPhase('write');}}>Xác nhận lượt mới</button><button type="button" onClick={()=>{nextFocus.current='restart';setReset(false);}}>Giữ phiếu hiện tại</button></div>
    </div>}
  </section>;
}
