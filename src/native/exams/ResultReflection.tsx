import {useEffect,useId,useRef,useState} from 'react';
import type {PracticeExam} from './data';
import type {Draft} from './store';
import {questionLabel} from './attempt-ui';
import {STATUS_LABELS} from './review';
import {REFLECTION_CAUSES,reflectionCause,reflectionItems} from './result-reflection';
import './result-reflection.css';

type Sheet={cause:string;note:string;ready:boolean};
const empty=():Sheet=>({cause:'',note:'',ready:false});
export default function ResultReflection({exam,draft,onReview,focusOnMount=false}:{exam:PracticeExam;draft:Draft;onReview?:(questionId:string)=>void;focusOnMount?:boolean}){
  const items=reflectionItems(exam,draft);
  const [selected,setSelected]=useState(''),[sheets,setSheets]=useState<Record<string,Sheet>>({}),[error,setError]=useState(''),[focus,setFocus]=useState(0);
  const uid=useId(),heading=useRef<HTMLHeadingElement>(null),question=useRef<HTMLSelectElement>(null),causeSelect=useRef<HTMLSelectElement>(null),result=useRef<HTMLDivElement>(null);
  const item=items.find(row=>row.q.id===selected),sheet=item?sheets[item.q.id]??empty():empty(),cause=reflectionCause(sheet.cause);
  useEffect(()=>{if(focus&&sheet.ready)result.current?.focus();},[focus,sheet.ready]);
  useEffect(()=>{if(focusOnMount)heading.current?.focus();},[focusOnMount]);
  const change=(patch:Partial<Sheet>)=>{if(!item)return;setSheets(prior=>({...prior,[item.q.id]:{...(prior[item.q.id]??empty()),...patch,ready:false}}));setError('');};
  if(!items.length)return <p className="ep-reflection-empty">Chưa có câu đã chấm và chưa đủ điểm để lập phiếu. Em vẫn có thể đối chiếu bài bên dưới.</p>;
  return <section className="ep-reflection" aria-labelledby={uid+'-title'}>
    <h2 id={uid+'-title'} ref={heading} tabIndex={-1}>Tự tìm nguyên nhân, gỡ một câu sai</h2>
    <p>Đọc lại bài đã nộp và phần đối chiếu bên dưới, rồi tự chọn điều khiến em vướng. Web không tự kết luận nguyên nhân hoặc chấm lại bài.</p>
    <p className="ep-reflection-note">Phiếu chỉ ở trang đang mở. Đóng tiện ích, rời trang hoặc tải lại sẽ bỏ phiếu; không gửi giáo viên, không đổi điểm. Không ghi thông tin cá nhân.</p>
    <form onSubmit={event=>{event.preventDefault();if(!item){setError('Em chọn một câu trước.');question.current?.focus();return;}if(!cause){setError('Em chọn nguyên nhân phù hợp, hoặc mục chưa xác định.');causeSelect.current?.focus();return;}setSheets(prior=>({...prior,[item.q.id]:{...(prior[item.q.id]??empty()),ready:true}}));setError('');setFocus(value=>value+1);}}>
      <label htmlFor={uid+'-question'}>Câu em muốn gỡ</label><select id={uid+'-question'} ref={question} value={item?selected:''} aria-invalid={!!error&&!item} aria-describedby={error&&!item?uid+'-error':undefined} onChange={event=>{setSelected(event.target.value);setError('');}}><option value="">Chọn một câu chưa đủ điểm</option>{items.map(row=><option key={row.q.id} value={row.q.id}>{questionLabel(exam,row.index).full} · {STATUS_LABELS[row.status]}</option>)}</select>
      {item&&<>{onReview&&<button type="button" onClick={()=>onReview(item.q.id)}>Xem đối chiếu câu đã chọn</button>}{item.q.kind==='tf'&&<p>Câu Đúng/Sai: đối chiếu riêng từng ý; đúng một phần không có nghĩa cả câu đều sai.</p>}<label htmlFor={uid+'-cause'}>Em tự thấy mình vướng ở đâu?</label><select id={uid+'-cause'} ref={causeSelect} value={sheet.cause} aria-invalid={!!error&&!cause} aria-describedby={error&&!cause?uid+'-error':undefined} onChange={event=>change({cause:event.target.value})}><option value="">Chọn nguyên nhân</option>{REFLECTION_CAUSES.map(value=><option key={value.id} value={value.id}>{value.label}</option>)}</select>
      <label htmlFor={uid+'-note'}>Ghi lại bước bị vướng (không bắt buộc)</label><textarea id={uid+'-note'} maxLength={600} rows={3} value={sheet.note} onChange={event=>change({note:event.target.value.slice(0,600)})} aria-describedby={uid+'-note-help'}/><small id={uid+'-note-help'}>Tối đa 600 ký tự. Mỗi câu giữ một phiếu trong lần mở này.</small></>}
      {error&&<p role="alert" id={uid+'-error'}>{error}</p>}<button type="submit">Gợi ý cách gỡ câu này</button>
    </form>
    {item&&sheet.ready&&cause&&<div className="ep-reflection-plan" ref={result} tabIndex={-1} aria-label="Kế hoạch tự sửa câu đã chọn"><h3>{questionLabel(exam,item.index).full}: cách em thử lại</h3><p><b>Nguyên nhân em tự chọn:</b> {cause.label}.</p>{sheet.note.trim()&&<p className="ep-reflection-own-note"><b>Bước em ghi:</b> {sheet.note}</p>}<ol>{cause.steps.map(step=><li key={step}>{step}</li>)}</ol><p>Đây là gợi ý theo lựa chọn của em. Thử lại ở nháp, đối chiếu lời giải gốc hoặc hỏi thầy nếu còn vướng. Phiếu không xác nhận em đã hiểu bài.</p></div>}
  </section>;
}
