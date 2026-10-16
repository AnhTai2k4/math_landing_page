import {Component,Suspense,useRef,useState,type ReactNode} from 'react';

export class ToolErrorBoundary extends Component<{children:ReactNode;onClose:()=>void},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(this.state.failed)return <div role="status"><p>Chưa mở được tiện ích này. Em vẫn có thể chọn bài luyện hoặc dùng tiện ích khác trên trang.</p><p>Lượt tự luyện trong tiện ích bị lỗi có thể đã mất; không ảnh hưởng bài luyện đã lưu.</p><button type="button" className="mig-button outline" onClick={this.props.onClose}>Đóng tiện ích</button></div>;
    return this.props.children;
  }
}

/** Mỗi tiện ích có ranh lỗi riêng, chỉ nạp sau khi mở. Đổi chương remount bằng key ở nơi gọi. */
export default function PracticeTool({label,loading,children}:{label:string;loading:string;children:ReactNode}){
  const [ready,setReady]=useState(false),panel=useRef<HTMLDetailsElement>(null);
  return <details className="cp-theory" ref={panel} onToggle={event=>{if(event.currentTarget.open)setReady(true);}}>
    <summary>{label}</summary>
    {ready&&<ToolErrorBoundary onClose={()=>{if(panel.current){panel.current.open=false;panel.current.querySelector('summary')?.focus();}}}><Suspense fallback={<p role="status">{loading}</p>}>{children}</Suspense></ToolErrorBoundary>}
  </details>;
}
