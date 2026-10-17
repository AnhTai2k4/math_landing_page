import {useEffect,useId,useRef,useState} from 'react';
import type {PracticeExam} from './data';
import type {Draft} from './store';
import {questionLabel} from './attempt-ui';
import {STATUS_LABELS} from './review';
import {createSpacedReviewPlan,FIRST_SPACED_DATE,LAST_SPACED_DATE,spacedDateLabel,spacedReviewItems,spacedReviewToday} from './result-spaced-review';
import './result-spaced-review.css';

type Plan=NonNullable<ReturnType<typeof createSpacedReviewPlan>>;
type Mark={tried:boolean;opened:boolean;assessment:string};
const emptyMark=():Mark=>({tried:false,opened:false,assessment:''});
const sameMark=(a:Mark,b:Mark)=>a.tried===b.tried&&a.opened===b.opened&&a.assessment===b.assessment;
export default function ResultSpacedReview({exam,draft,onReview,focusOnMount=false}:{exam:PracticeExam;draft:Draft;onReview:(id:string)=>void;focusOnMount?:boolean}){
  const items=spacedReviewItems(exam,draft),uid=useId();
  const [settings,setSettings]=useState(()=>({date:spacedReviewToday(),ids:[] as string[]}));
  const [plan,setPlan]=useState<Plan|null>(null),[marks,setMarks]=useState<Record<string,Mark>>({}),[error,setError]=useState(''),[focus,setFocus]=useState(0);
  const settingsRef=useRef(settings),planRef=useRef(plan),marksRef=useRef(marks),heading=useRef<HTMLHeadingElement>(null),dateInput=useRef<HTMLInputElement>(null),picker=useRef<HTMLFieldSetElement>(null),result=useRef<HTMLDivElement>(null);
  settingsRef.current=settings;planRef.current=plan;marksRef.current=marks;
  useEffect(()=>{if(focusOnMount)heading.current?.focus();},[focusOnMount]);
  useEffect(()=>{if(focus&&plan)result.current?.focus();},[focus,plan]);
  const configure=(next:typeof settings)=>{if(settingsRef.current!==settings||next.ids.length>5||new Set(next.ids).size!==next.ids.length)return;if(next.date===settings.date&&next.ids.join('\n')===settings.ids.join('\n'))return;setSettings(next);setPlan(null);setMarks({});setError('');};
  const currentMark=(key:string,expected:Mark)=>!!plan&&planRef.current===plan&&sameMark(marksRef.current[key]??emptyMark(),expected);
  const mark=(key:string,patch:Partial<Mark>,expected:Mark)=>{if(!currentMark(key,expected))return;setMarks(prior=>sameMark(prior[key]??emptyMark(),expected)?{...prior,[key]:{...(prior[key]??emptyMark()),...patch}}:prior);};
  if(!items.length)return <p>Chưa có câu đã chấm và chưa đủ điểm để lập lịch. Em vẫn có thể xem phần đối chiếu bài bên dưới.</p>;
  return <section className="ep-spaced" data-version="v1" aria-labelledby={uid+'-title'}>
    <h3 id={uid+'-title'} ref={heading} tabIndex={-1}>Phiếu ôn 1, 3, 7 ngày của lượt này</h3>
    <p>Đây là lịch em tự chọn để quay lại giải trên giấy. Mỗi mốc tính từ ngày bắt đầu, không cộng dồn. Em có thể chép các ngày vào sổ để dùng sau.</p>
    <p className="ep-spaced-note">Phiếu và dấu tự đánh giá chỉ giữ trong lần mở tiện ích này. Đóng phiếu, rời trang hoặc tải lại sẽ bỏ phiếu. Web không lưu lịch, gửi nhắc nhở hay đổi điểm bài thi.</p>
    <form onSubmit={event=>{event.preventDefault();if(settingsRef.current!==settings)return;if(!settings.ids.length){setError('Em chọn từ 1 đến 5 câu để tự ôn.');picker.current?.focus();return;}const next=createSpacedReviewPlan(exam,draft,settings.date,settings.ids);if(!next){setError('Ngày bắt đầu chưa hợp lệ. Em chọn ngày từ 01/01/2000 đến 24/12/2099.');dateInput.current?.focus();return;}if(!plan||plan.start!==next.start||plan.items.map(item=>item.q.id).join('\n')!==next.items.map(item=>item.q.id).join('\n')){setPlan(next);setMarks({});}setError('');setFocus(value=>value+1);}}>
      <fieldset ref={picker} tabIndex={-1} aria-describedby={uid+'-count'}><legend>Chọn tối đa 5 câu chưa đủ điểm</legend>
        {items.map(item=><label key={item.q.id} className="ep-spaced-choice"><input type="checkbox" checked={settings.ids.includes(item.q.id)} disabled={settings.ids.length>=5&&!settings.ids.includes(item.q.id)} onChange={event=>configure({...settings,ids:event.target.checked?[...settings.ids,item.q.id]:settings.ids.filter(id=>id!==item.q.id)})}/><span>{questionLabel(exam,item.index).full}<small>{STATUS_LABELS[item.status]}</small></span></label>)}
      </fieldset><p id={uid+'-count'} role="status">Đã chọn {settings.ids.length}/5 câu. Câu đúng một phần vẫn cần đối chiếu từng ý.</p>
      <label htmlFor={uid+'-date'}>Ngày bắt đầu</label><input id={uid+'-date'} ref={dateInput} type="date" min={FIRST_SPACED_DATE} max={LAST_SPACED_DATE} value={settings.date} onChange={event=>configure({...settings,date:event.target.value})}/>
      {error&&<p role="alert">{error}</p>}<button type="submit">Tạo lịch tự ôn từ câu đã chọn</button>
    </form>
    {plan&&<div className="ep-spaced-plan" ref={result} tabIndex={-1} aria-label="Lịch tự ôn câu sai"><h3>Lịch tự ôn {plan.items.length} câu</h3><p>Ngày gốc: {spacedDateLabel(plan.start)}. Mỗi mốc: tự giải không nhìn lời giải, mở đối chiếu, rồi tự đánh giá. Em có thể bỏ dấu nếu muốn thử lại.</p><p role="status">Đã tự đánh giá {Object.values(marks).filter(value=>value.assessment).length}/{plan.items.length*3} lượt câu. Dấu này không xác nhận em đã hiểu bài.</p>
      <div className="ep-spaced-milestones">{plan.dates.map(milestone=><section key={milestone.offset} className="ep-spaced-milestone" aria-labelledby={`${uid}-day-${milestone.offset}`}><h4 id={`${uid}-day-${milestone.offset}`}>Sau {milestone.offset} ngày <time dateTime={milestone.date}>{spacedDateLabel(milestone.date)}</time></h4>
        {plan.items.map(item=>{const key=milestone.offset+':'+item.q.id,value=marks[key]??emptyMark(),label=questionLabel(exam,item.index).full;return <div key={item.q.id} className="ep-spaced-question"><b>{label}</b><label className="ep-spaced-choice"><input type="checkbox" checked={value.tried} onChange={event=>mark(key,{tried:event.target.checked,opened:false,assessment:''},value)}/><span>Em đã tự giải lại ra giấy</span></label><button type="button" disabled={!value.tried} onClick={()=>{if(!value.tried||!currentMark(key,value))return;onReview(item.q.id);mark(key,{opened:true},value);}}>Đối chiếu {label.toLocaleLowerCase('vi-VN')} · mốc {milestone.offset} ngày</button><label htmlFor={`${uid}-assessment-${key}`}>Sau khi tự đối chiếu</label><select id={`${uid}-assessment-${key}`} value={value.assessment} disabled={!value.tried||!value.opened} onChange={event=>{if(!value.tried||!value.opened||!['','again','can-explain'].includes(event.target.value))return;mark(key,{assessment:event.target.value},value);}}><option value="">Chọn tự đánh giá</option><option value="again">Em còn vướng, cần ôn hoặc hỏi thầy</option><option value="can-explain">Em tự thấy giải thích lại được</option></select></div>;})}
      </section>)}</div>
    </div>}
  </section>;
}
