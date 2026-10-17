import {Component,lazy,Suspense,useId,useState,type ReactNode} from 'react';
export class BossLibraryBoundary extends Component<{children:ReactNode;onRetry:()=>void},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<div role="alert"><p>Chưa mở được Boss thư viện. Em vẫn tìm và đọc tài liệu bên dưới.</p><button type="button" onClick={this.props.onRetry}>Thử mở Boss lại</button></div>:this.props.children;}
}
export default function BossLibraryTool(){
 const id=useId(),[open,setOpen]=useState(false),[version,setVersion]=useState(0),[Game,setGame]=useState(()=>lazy(()=>import('./BossLibraryGame')));
 const retry=()=>{setGame(()=>lazy(()=>import('./BossLibraryGame')));setVersion(value=>value+1);};
 return <section className="ne-white ne-padding" aria-label="Boss cuối chương: Bảo vệ thư viện">
  <h2>Boss cuối chương: Bảo vệ thư viện</h2><p>Lái khiên qua ba làn đáp án, đỡ đúng để đánh trả Boss. Tối đa 8 câu theo đúng khối và chương em chọn. Đóng màn sẽ bỏ lượt chơi đang mở.</p>
  <button type="button" className="ne-primary" aria-expanded={open} aria-controls={id+'-boss-panel'} onClick={()=>setOpen(value=>!value)}>{open?'Đóng Boss thư viện':'Mở Boss thư viện'}</button>
  <div id={id+'-boss-panel'} hidden={!open} role="region" aria-label="Màn Boss bảo vệ thư viện">{open&&<BossLibraryBoundary key={version} onRetry={retry}><Suspense fallback={<p role="status">Đang mở màn bảo vệ thư viện…</p>}><Game/></Suspense></BossLibraryBoundary>}</div>
 </section>;
}
