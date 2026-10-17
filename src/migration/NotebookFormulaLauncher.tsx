import {Component,Suspense,lazy,useState,type ReactNode} from 'react';
import './notebook-tools.css';

const FormulaGame=lazy(()=>import('./NotebookFormulaGame'));
export class NotebookFormulaBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return{failed:true};}
 render(){return this.state.failed?<p role="alert">Chưa mở được trò chơi. Em vẫn có thể dùng sổ tay bên dưới. Hãy đóng trò chơi và tải lại trang khi thuận tiện.</p>:this.props.children;}
}
export default function NotebookFormulaLauncher(){
 const [open,setOpen]=useState(false);
 return <section className="mig-notebook-formula" aria-labelledby="notebook-formula-title">
  <div className="mig-formula-heading"><div><p className="mig-eyebrow">HỌC TOÁN THÚ VỊ</p><h2 id="notebook-formula-title">Ghép cặp công thức</h2><p>Ôn 3 cặp mỗi lượt. Thử chế độ tự nhớ trước khi lật công thức và điều kiện.</p></div><button type="button" aria-expanded={open} aria-controls="notebook-formula-content" onClick={()=>setOpen(value=>!value)}>{open?'Đóng trò chơi':'Mở trò chơi'}</button></div>
  {open&&<div id="notebook-formula-content"><NotebookFormulaBoundary><Suspense fallback={<p role="status">Đang mở trò chơi...</p>}><FormulaGame/></Suspense></NotebookFormulaBoundary></div>}
 </section>;
}
