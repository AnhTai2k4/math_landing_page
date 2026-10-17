import {Component,Suspense,lazy,useId,useState,type ReactNode} from 'react';

const GuideGraphGame=lazy(()=>import('./GuideGraphGame'));
export class GuideGraphBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return{failed:true};}
 render(){return this.state.failed?<p role="alert">Chưa mở được phòng khám phá. Em có thể đóng và tải lại trang khi thuận tiện. Các hướng dẫn bên dưới vẫn dùng được.</p>:this.props.children;}
}
export default function GuideGraphLauncher(){
 const id=useId(),[open,setOpen]=useState(false);
 return <section className="mg-card mg-web" aria-labelledby={id+'-title'}>
  <h2 id={id+'-title'}>Khám phá đồ thị: tự đổi a, b</h2>
  <p>Đổi hệ số, xem bảng giá trị và ghim hai đồ thị để tự tìm ra điều gì làm đường thẳng đổi độ dốc hoặc dịch lên, xuống.</p>
  <button className="mg-button" type="button" aria-expanded={open} aria-controls={id+'-content'} onClick={()=>setOpen(value=>!value)}>{open?'Đóng phòng khám phá':'Mở phòng khám phá'}</button>
  <div id={id+'-content'} hidden={!open}>{open&&<GuideGraphBoundary><Suspense fallback={<p role="status">Đang mở phòng khám phá...</p>}><GuideGraphGame/></Suspense></GuideGraphBoundary>}</div>
  <p className="mg-sub">Không hẹn giờ hoặc tính điểm thi. Hệ số và đồ thị ghim chỉ giữ trong lần mở này.</p>
 </section>;
}
