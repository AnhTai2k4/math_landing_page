import {Component,lazy,Suspense,useState,type ReactNode} from 'react';
const Counterexample=lazy(()=>import('./ResultCounterexample'));
export class CounterexampleBoundary extends Component<{children:ReactNode;onRetry:()=>void},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true};}
  render(){return this.state.failed?<section className="ep-card" role="status"><h2>Phòng thử phản ví dụ</h2><p>Chưa mở được mini game. Kết quả và phần đối chiếu bài thi vẫn dùng được.</p><button type="button" onClick={this.props.onRetry}>Thử mở lại mini game</button></section>:this.props.children;}
}
export default function ResultCounterexampleTool(){
  const [loader,setLoader]=useState(()=>({View:Counterexample,revision:0})),View=loader.View;
  return <CounterexampleBoundary key={loader.revision} onRetry={()=>setLoader(value=>({View:lazy(()=>import('./ResultCounterexample')),revision:value.revision+1}))}><Suspense fallback={<p role="status">Đang chuẩn bị phòng thử phản ví dụ…</p>}><View/></Suspense></CounterexampleBoundary>;
}
