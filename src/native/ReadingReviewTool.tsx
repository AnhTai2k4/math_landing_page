import {Component,lazy,Suspense,useState,type ReactNode} from 'react';
import './reading-review-tool.css';
const ReadingReviewPlan=lazy(()=>import('./ReadingReviewPlan'));
export class ReadingReviewBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<p role="alert">Chưa mở được mốc tự ôn. Em vẫn có thể tìm và đọc tài liệu bên dưới. Tải lại trang nếu muốn thử mở công cụ lần nữa.</p>:this.props.children;}
}
export default function ReadingReviewTool(){
 const [ready,setReady]=useState(false);
 return <details className="ne-reference-more reading-review-tool" onToggle={event=>{if(event.currentTarget.open)setReady(true);}}><summary>Mốc ôn sau đọc</summary>{ready&&<ReadingReviewBoundary><Suspense fallback={<p role="status">Đang mở mốc tự ôn…</p>}><ReadingReviewPlan/></Suspense></ReadingReviewBoundary>}</details>;
}
