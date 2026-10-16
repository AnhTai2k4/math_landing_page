import {useState} from 'react';
import type {Store} from './notebook-store';
import {notebookRhythm} from './notebook-rhythm';
import './notebook-rhythm.css';

type Props={days:Store['days'];today:string;selectedDate:string;onSelectDay:(key:string)=>boolean;unavailable?:boolean;unavailableMessage?:string};
const dateLabel=(key:string)=>key.split('-').reverse().join('/');

export default function NotebookRhythm({days,today,selectedDate,onSelectDay,unavailable=false,unavailableMessage}:Props){
 const [target,setTarget]=useState<3|5|7>(3);
 if(unavailable)return <section className="mig-notebook-rhythm" aria-labelledby="notebook-rhythm-title"><h2 id="notebook-rhythm-title">Nhịp học 7 ngày</h2><p>{unavailableMessage??'Chưa tính được nhịp học vì bản lưu sổ tay đang lỗi. Hãy xuất bản lưu gốc trước khi xử lý; không xem dữ liệu lỗi là chưa học.'}</p></section>;
 const rhythm=notebookRhythm(days,today);
 return <section className="mig-notebook-rhythm" aria-labelledby="notebook-rhythm-title">
  <header><p className="mig-eyebrow">ĐỀU ĐẶN THEO CÁCH CỦA EM</p><h2 id="notebook-rhythm-title">Nhịp học 7 ngày</h2><p>Mỗi ngày có ít nhất một việc em tự đánh dấu hoàn thành được tính một lần. Không tính ngày tương lai.</p></header>
  <dl className="mig-rhythm-summary" aria-live="polite"><div><dt>Chuỗi hiện tại</dt><dd>{rhythm.current} <span>ngày</span></dd></div><div><dt>Chuỗi dài nhất</dt><dd>{rhythm.best} <span>ngày</span></dd></div><div><dt>Trong 7 ngày gần nhất</dt><dd>{rhythm.weekCount}<span>/7 ngày</span></dd></div></dl>
  <p className="mig-rhythm-note">Chuỗi hiện tại nối đến hôm nay hoặc hôm qua. Nghỉ một hôm cũng không sao, em có thể bắt đầu lại theo nhịp của mình.</p>
  <div className="mig-rhythm-controls"><fieldset><legend>Mục tiêu cho 7 ngày gần nhất</legend><div>{([3,5,7] as const).map(value=><button key={value} type="button" aria-pressed={target===value} onClick={()=>setTarget(value)}>{value} ngày</button>)}</div></fieldset><p>Chỉ giữ mục tiêu trong lần mở trang này, không lưu vào trình duyệt.</p></div>
  <p className="mig-rhythm-progress" role="status">Đã đánh dấu {rhythm.weekCount}/{target} ngày theo mục tiêu em chọn. {rhythm.weekCount>=target?'Em đã chạm mục tiêu. Hãy chọn nhịp tiếp theo vừa sức.':'Em có thể đổi mục tiêu bất cứ lúc nào.'}</p>
  <div className="mig-rhythm-week" role="group" aria-label="Mở kế hoạch trong 7 ngày gần nhất">{rhythm.week.map(day=><button key={day.key} type="button" aria-pressed={selectedDate===day.key} aria-label={'Mở kế hoạch ngày '+dateLabel(day.key)+(day.key===today?', hôm nay':'')+(day.marked?', có việc đã đánh dấu hoàn thành':', chưa có việc đã đánh dấu hoàn thành')} className={day.marked?'is-marked':''} onClick={()=>onSelectDay(day.key)}><span>{day.key===today?'Hôm nay':dateLabel(day.key).slice(0,5)}</span><b aria-hidden="true">{day.marked?'✓':'·'}</b><small>{day.marked?'Đã đánh dấu':'Chưa đánh dấu'}</small></button>)}</div>
  <ul className="mig-rhythm-badges" aria-label="Mốc chuỗi dài nhất">{[3,7,30].map(milestone=><li key={milestone} className={rhythm.best>=milestone?'is-reached':''}>Mốc {milestone} ngày: {rhythm.best>=milestone?'đã chạm':'để khám phá'}</li>)}</ul>
  <p className="mig-rhythm-note">Bấm một ngày để mở kế hoạch bên dưới. Đây là số liệu tự đánh dấu trong sổ tay, chưa xác minh việc học hay thời gian học thực tế.</p>
 </section>;
}
