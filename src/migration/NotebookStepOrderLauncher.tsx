import {Component,Suspense,lazy,useState,type ReactNode} from 'react';
import './notebook-tools.css';

const StepOrder=lazy(()=>import('./NotebookStepOrder'));
export class NotebookStepOrderBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return{failed:true};}
 render(){return this.state.failed?<p role="alert">Chưa mở được Xếp bước giải. Em vẫn có thể dùng sổ tay bên dưới. Đóng trò chơi và tải lại trang khi thuận tiện.</p>:this.props.children;}
}
export default function NotebookStepOrderLauncher(){
 const [open,setOpen]=useState(false);
 return <section className="mig-notebook-formula mig-notebook-step-order" aria-labelledby="notebook-step-title">
  <div className="mig-formula-heading"><div><p className="mig-eyebrow">HỌC TOÁN THÚ VỊ</p><h2 id="notebook-step-title">Xếp bước giải</h2><p>Ghép lại một lời giải, hiểu vì sao từng bước được phép thực hiện.</p></div><button type="button" aria-expanded={open} aria-controls="notebook-step-content" onClick={()=>setOpen(value=>!value)}>{open?'Đóng Xếp bước giải':'Mở Xếp bước giải'}</button></div>
  {open&&<div id="notebook-step-content"><NotebookStepOrderBoundary><Suspense fallback={<p role="status">Đang mở Xếp bước giải...</p>}><StepOrder/></Suspense></NotebookStepOrderBoundary></div>}
 </section>;
}
