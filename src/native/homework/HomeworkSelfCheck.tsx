import {useId,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {HOMEWORK_CHECKS,homeworkChecksForFocus,summarizeHomeworkChecks,type HomeworkCheckFocus} from './self-check';

export type HomeworkCheckSelection=[string[],Dispatch<SetStateAction<string[]>>];

export default function HomeworkSelfCheck({selection}:{selection?:HomeworkCheckSelection}={}){
  const id=useId(),localSelection=useState<string[]>([]);
  const [focus,setFocus]=useState<HomeworkCheckFocus>('all');
  const [selected,setSelected]=selection??localSelection,progress=summarizeHomeworkChecks(selected,focus);
  const first=useRef<HTMLInputElement>(null);
  return <div className="btvn-self-check-content" data-version="v2">
    <p id={id+'-help'}>Em tự đánh dấu sau khi đọc lại bài. Phiếu dùng chung, không đọc nội dung hoặc đáp án em đã nhập, không tự xác minh, không chặn nộp và không thay đổi điểm hay trạng thái bài.</p>
    <label className="btvn-self-check-focus" htmlFor={id+'-focus'}><b>Em muốn ưu tiên rà lỗi nào?</b><select id={id+'-focus'} value={focus} onChange={event=>{const value=event.target.value;setFocus(HOMEWORK_CHECKS.some(item=>item.id===value)?value as HomeworkCheckFocus:'all');}}><option value="all">Rà toàn diện theo thứ tự gợi ý</option>{HOMEWORK_CHECKS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <p className="btvn-self-check-note">Chọn trọng tâm sẽ đưa mục đó lên đầu và gợi ý rà trước nếu chưa đánh dấu. Cả 5 mục vẫn cần tự đọc lại; đổi trọng tâm giữ nguyên dấu kiểm.</p>
    <fieldset aria-describedby={id+'-help'}><legend>5 điểm cần tự kiểm</legend>
      {homeworkChecksForFocus(focus).map((item,index)=><label key={item.id} className="btvn-self-check-item">
        <input ref={index===0?first:undefined} type="checkbox" checked={selected.includes(item.id)} onChange={()=>setSelected(previous=>previous.includes(item.id)?previous.filter(value=>value!==item.id):[...previous,item.id])}/>
        <span><b>{item.label}</b><span>{item.detail}</span></span>
      </label>)}
    </fieldset>
    <div className="btvn-self-check-progress">
      <p role="status" aria-live="polite">Đã tự kiểm {progress.done}/{progress.total} mục.{progress.next?' Còn '+progress.remaining.length+' mục để đọc lại.':' Em đã tự đánh dấu đủ 5 mục. Nếu sửa đáp án, hãy kiểm lại các mục liên quan.'}</p>
      <progress value={progress.done} max={progress.total} aria-label="Tiến độ tự kiểm"/>
    </div>
    {progress.next&&<aside className="btvn-self-check-hint" aria-labelledby={id+'-hint'}><h3 id={id+'-hint'}>Bước tiếp theo: {progress.next.label.toLocaleLowerCase('vi')}</h3><p>{progress.next.hint}</p></aside>}
    <button type="button" disabled={!progress.done} onClick={()=>{setSelected([]);first.current?.focus();}}>Bỏ đánh dấu để tự kiểm lại</button>
    <p className="btvn-self-check-note">Chỉ giữ dấu kiểm trong trang đang mở. Tải lại hoặc rời trang sẽ xóa phiếu. Dấu kiểm không phải biên nhận đã nộp bài.</p>
  </div>;
}
