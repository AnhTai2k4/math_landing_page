import {useId,useRef,useState} from 'react';
import {HOMEWORK_CHECKS,summarizeHomeworkChecks} from './self-check';

export default function HomeworkSelfCheck(){
  const id=useId(),[selected,setSelected]=useState<string[]>([]),progress=summarizeHomeworkChecks(selected);
  const first=useRef<HTMLInputElement>(null);
  return <div className="btvn-self-check-content">
    <p id={id+'-help'}>Em tự đánh dấu sau khi đọc lại bài. Phiếu dùng chung, không đọc nội dung hoặc đáp án em đã nhập, không tự xác minh, không chặn nộp và không thay đổi điểm hay trạng thái bài.</p>
    <fieldset aria-describedby={id+'-help'}><legend>5 điểm cần tự kiểm</legend>
      {HOMEWORK_CHECKS.map((item,index)=><label key={item.id} className="btvn-self-check-item">
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
