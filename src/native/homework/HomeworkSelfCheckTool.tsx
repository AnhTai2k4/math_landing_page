import {Component,lazy,Suspense,useEffect,useId,useRef,useState,type ReactNode} from 'react';
import type {HomeworkCheckSelection} from './HomeworkSelfCheck';
import './self-check.css';

const View=lazy(()=>import('./HomeworkSelfCheck'));
export class HomeworkSelfCheckBoundary extends Component<{children:ReactNode;onRetry:()=>void},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<div role="status"><p>Chưa mở được phiếu tự kiểm. Các phần BTVN khác vẫn dùng được. Dấu kiểm cũ có thể đã mất.</p><button type="button" onClick={this.props.onRetry}>Thử mở lại phiếu tự kiểm</button></div>:this.props.children;}
}
export default function HomeworkSelfCheckTool({selection}:{selection?:HomeworkCheckSelection}={}){
  const id=useId(),[loader,setLoader]=useState(()=>({View,revision:0})),[open,setOpen]=useState(false),[opened,setOpened]=useState(false);
  const panel=useRef<HTMLDivElement>(null),Content=loader.View;
  useEffect(()=>{if(open)panel.current?.focus();},[open]);
  return <section className="btvn-self-check" aria-labelledby={id+'-title'}>
    <h2 id={id+'-title'}>Phiếu tự kiểm trước khi nộp</h2>
    <p>Dành một lượt đọc lại để tự phát hiện lỗi nhỏ trong bài Toán của em.</p>
    <button type="button" aria-expanded={open} aria-controls={id+'-panel'} onClick={()=>{setOpened(true);setOpen(value=>!value);}}>{open?'Thu gọn phiếu tự kiểm':'Mở phiếu tự kiểm'}</button>
    <div id={id+'-panel'} hidden={!open} ref={panel} tabIndex={-1} role="region" aria-labelledby={id+'-title'}>
      {opened&&<HomeworkSelfCheckBoundary key={loader.revision} onRetry={()=>{setLoader(value=>({View:lazy(()=>import('./HomeworkSelfCheck')),revision:value.revision+1}));panel.current?.focus();}}><Suspense fallback={<p role="status">Đang mở phiếu tự kiểm…</p>}><Content selection={selection}/></Suspense></HomeworkSelfCheckBoundary>}
    </div>
  </section>;
}
