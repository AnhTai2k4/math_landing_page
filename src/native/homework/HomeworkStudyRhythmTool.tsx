import {Component,lazy,Suspense,useEffect,useId,useRef,useState,type ReactNode} from 'react';
import './self-check.css';
const View=lazy(()=>import('./HomeworkStudyRhythm'));
export class HomeworkStudyRhythmBoundary extends Component<{children:ReactNode;onRetry:()=>void},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<div role="status"><p>Chưa mở được lịch tự học. Các phần BTVN khác vẫn dùng được.</p><button type="button" onClick={this.props.onRetry}>Thử mở lại lịch tự học</button></div>:this.props.children;}
}
export default function HomeworkStudyRhythmTool(){
  const id=useId(),[loader,setLoader]=useState(()=>({View,revision:0})),[open,setOpen]=useState(false),[opened,setOpened]=useState(false),panel=useRef<HTMLDivElement>(null),Content=loader.View;
  useEffect(()=>{if(open)panel.current?.focus();},[open]);
  return <section className="btvn-self-check" data-version="v1" aria-labelledby={id+'-title'}>
    <h2 id={id+'-title'}>Nhịp tự học của em</h2><p>Tự ghi ngày học trên thiết bị, nhìn lại nhịp học và nhận huy hiệu 3, 7, 30 ngày. Không có điểm thưởng hoặc hình phạt.</p>
    <button type="button" aria-expanded={open} aria-controls={id+'-panel'} onClick={()=>{setOpened(true);setOpen(value=>!value);}}>{open?'Thu gọn lịch tự học':'Mở lịch tự học'}</button>
    <div id={id+'-panel'} hidden={!open} ref={panel} tabIndex={-1} role="region" aria-labelledby={id+'-title'}>{opened&&<HomeworkStudyRhythmBoundary key={loader.revision} onRetry={()=>setLoader(value=>({View:lazy(()=>import('./HomeworkStudyRhythm')),revision:value.revision+1}))}><Suspense fallback={<p role="status">Đang mở lịch tự học…</p>}><Content/></Suspense></HomeworkStudyRhythmBoundary>}</div>
  </section>;
}
