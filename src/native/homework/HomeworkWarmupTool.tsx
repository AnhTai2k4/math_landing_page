import {Component,lazy,Suspense,useEffect,useId,useRef,useState,type ReactNode} from 'react';
import './self-check.css';
const View=lazy(()=>import('./HomeworkWarmup'));
export class HomeworkWarmupBoundary extends Component<{children:ReactNode;onRetry:()=>void},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<div role="status"><p>Chưa mở được bộ thẻ. Em vẫn dùng được các phần BTVN khác. Thử lại sẽ mở phiên thẻ mới.</p><button type="button" onClick={this.props.onRetry}>Thử mở lại bộ thẻ</button></div>:this.props.children;}
}
export default function HomeworkWarmupTool(){
  const id=useId(),[loader,setLoader]=useState(()=>({View,revision:0})),[open,setOpen]=useState(false),[opened,setOpened]=useState(false),panel=useRef<HTMLDivElement>(null),Content=loader.View;
  useEffect(()=>{if(open)panel.current?.focus();},[open]);
  return <section className="btvn-self-check" data-version="v1" aria-labelledby={id+'-title'}>
    <h2 id={id+'-title'}>Khởi động BTVN: chặn lỗi đại số</h2>
    <p>Tự nhớ rồi đối chiếu 3 thẻ trong khoảng 3 đến 5 phút. Em thử nhập kết quả trước khi xem từng bước giải.</p>
    <button type="button" aria-expanded={open} aria-controls={id+'-panel'} onClick={()=>{setOpened(true);setOpen(value=>!value);}}>{open?'Thu gọn bộ thẻ khởi động':'Mở bộ thẻ khởi động'}</button>
    <div id={id+'-panel'} hidden={!open} ref={panel} tabIndex={-1} role="region" aria-labelledby={id+'-title'}>
      {opened&&<HomeworkWarmupBoundary key={loader.revision} onRetry={()=>setLoader(value=>({View:lazy(()=>import('./HomeworkWarmup')),revision:value.revision+1}))}><Suspense fallback={<p role="status">Đang mở bộ thẻ khởi động…</p>}><Content/></Suspense></HomeworkWarmupBoundary>}
    </div>
  </section>;
}
