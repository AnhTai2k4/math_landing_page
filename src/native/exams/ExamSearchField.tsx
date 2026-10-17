import {useId,useRef} from 'react';
import './exam-search-ux.css';

export default function ExamSearchField({query,onChange,onSearch}:{query:string;onChange:(query:string)=>void;onSearch:()=>void}){
 const id=useId(),input=useRef<HTMLInputElement>(null);
 return <div className="ep-exam-search">
  <label htmlFor={id+'-input'}>Tìm theo tên đề</label>
  <input ref={input} id={id+'-input'} type="search" maxLength={120} value={query} placeholder="Nhập tên đề…" enterKeyHint="search" aria-describedby={id+'-help'} onChange={event=>onChange(event.target.value)} onKeyDown={event=>{
   if(event.nativeEvent?.isComposing||event.altKey||event.ctrlKey||event.metaKey)return;
   if(event.key==='Enter'){event.preventDefault();onSearch();}
   else if(event.key==='Escape'&&query){event.preventDefault();onChange('');input.current?.focus();}
  }}/>
  <p id={id+'-help'}>Enter để đến số đề tìm được. Esc xóa tên đề, giữ lớp và kỳ kiểm tra.</p>
  <div className="ep-exam-search-actions"><button type="button" onClick={onSearch}>Xem đề tìm được</button>{query&&<button type="button" onClick={()=>{onChange('');input.current?.focus();}}>Xóa tên đề</button>}</div>
 </div>;
}
