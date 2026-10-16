import {Component,lazy,Suspense,useState,type ComponentProps,type ReactNode} from 'react';
const ResultRecall=lazy(()=>import('./ResultRecall'));
export class RecallBoundary extends Component<{children:ReactNode;onRetry?:()=>void},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true};}
  render(){return this.state.failed?<section className="ep-card" role="status"><h2>Thẻ tự ôn 5 phút</h2><p>Chưa mở được thẻ ôn. Em vẫn xem được kết quả và phần đối chiếu bài bên dưới.</p><p>Thử mở lại sẽ bắt đầu phiên tự ôn mới; kết quả bài thi được giữ nguyên.</p>{this.props.onRetry&&<button type="button" onClick={this.props.onRetry}>Thử mở lại thẻ ôn</button>}</section>:this.props.children;}
}
export default function ResultRecallTool(props:ComponentProps<typeof ResultRecall>){
  const [loader,setLoader]=useState(()=>({View:ResultRecall,revision:0}));
  const Recall=loader.View;
  const retry=()=>setLoader(value=>({View:lazy(()=>import('./ResultRecall')),revision:value.revision+1}));
  const identity=[props.exam.id,props.exam.versionHash,props.exam.answerKeyVersion,props.draft.attemptId,loader.revision].join(':');
  return <RecallBoundary key={identity} onRetry={retry}><Suspense fallback={<p role="status">Đang chuẩn bị thẻ tự ôn…</p>}><Recall {...props} focusOnMount={loader.revision>0}/></Suspense></RecallBoundary>;
}
