import {Component,lazy,Suspense,useState,type ReactNode} from 'react';
import type {PracticeExam} from './data';
import type {Draft} from './store';
const View=lazy(()=>import('./ResultSpacedReview'));
export class SpacedReviewBoundary extends Component<{children:ReactNode;onRetry:()=>void},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true};}
  render(){return this.state.failed?<div role="status"><p>Chưa mở được phiếu ôn cách ngày. Phần đối chiếu bài bên dưới vẫn dùng được.</p><button type="button" onClick={this.props.onRetry}>Thử mở lại phiếu ôn cách ngày</button></div>:this.props.children;}
}
export default function ResultSpacedReviewTool(props:{exam:PracticeExam;draft:Draft;onReview:(id:string)=>void}){
  const [open,setOpen]=useState(false),[loader,setLoader]=useState(()=>({View,revision:0}));
  const Content=loader.View;
  return <section className="ep-card ep-spaced-tool"><h2>Ôn câu sai cách ngày</h2><p>Chọn vài câu từ lượt thi này, hẹn tự ôn sau 1, 3, 7 ngày và đối chiếu từng câu khi thử lại.</p><button type="button" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{open?'Đóng phiếu ôn cách ngày':'Lập phiếu ôn cách ngày'}</button>{open&&<SpacedReviewBoundary key={loader.revision} onRetry={()=>setLoader(value=>({View:lazy(()=>import('./ResultSpacedReview')),revision:value.revision+1}))}><Suspense fallback={<p role="status">Đang mở phiếu ôn cách ngày…</p>}><Content key={[props.draft.attemptId,props.exam.versionHash,props.exam.answerKeyVersion].join(':')} {...props} focusOnMount={loader.revision>0}/></Suspense></SpacedReviewBoundary>}</section>;
}
