import {Component,Suspense,lazy,useState,type ReactNode} from 'react';
import './notebook-tools.css';

const FlightGame=lazy(()=>import('./NotebookFlightGame'));
export class NotebookFlightBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return{failed:true};}
 render(){return this.state.failed?<p role="alert">Chưa mở được Phi thuyền Toán. Em vẫn có thể dùng sổ tay bên dưới. Đóng trò chơi rồi mở lại khi thuận tiện.</p>:this.props.children;}
}
export default function NotebookFlightLauncher(){
 const [open,setOpen]=useState(false);
 return <section className="mig-notebook-formula" aria-labelledby="notebook-flight-title">
  <div className="mig-formula-heading"><div><p className="mig-eyebrow">HỌC TOÁN THÚ VỊ · MỚI</p><h2 id="notebook-flight-title">Phi thuyền Toán</h2><p>Lái tàu, bắn thiên thạch mang đáp án đúng, giữ 3 tim. Chọn khối và chương đã học trước khi cất cánh.</p></div><button type="button" aria-expanded={open} aria-controls="notebook-flight-content" onClick={()=>setOpen(value=>!value)}>{open?'Đóng Phi thuyền Toán':'Mở Phi thuyền Toán'}</button></div>
  {open&&<div id="notebook-flight-content"><NotebookFlightBoundary key="flight"><Suspense fallback={<p role="status">Đang mở Phi thuyền Toán...</p>}><FlightGame/></Suspense></NotebookFlightBoundary></div>}
 </section>;
}
