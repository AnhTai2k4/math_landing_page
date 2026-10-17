import {Component,lazy,Suspense,useState,type ReactNode} from 'react';
import type {PracticeExam} from './data';
import type {Draft} from './store';
const View=lazy(()=>import('./ResultReflection'));
export class ReflectionBoundary extends Component<{children:ReactNode;onRetry:()=>void},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true};}
  render(){return this.state.failed?<div role="status"><p>Chưa mở được phiếu tự sửa. Kết quả và phần đối chiếu bên dưới vẫn dùng được.</p><button type="button" onClick={this.props.onRetry}>Thử mở lại phiếu</button></div>:this.props.children;}
}
export default function ResultReflectionTool(props:{exam:PracticeExam;draft:Draft;onReview?:(questionId:string)=>void}){
  const [loader,setLoader]=useState(()=>({View,revision:0})),[open,setOpen]=useState(false);
  const Content=loader.View;
  return <section className="ep-card ep-reflection-tool"><h2>Gỡ nút thắt sau bài thi</h2><p>Chọn một câu chưa đủ điểm, tự tìm nguyên nhân và nhận ba bước để thử lại.</p><button type="button" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{open?'Đóng phiếu tự sửa':'Mở phiếu tự sửa'}</button>{open&&<ReflectionBoundary key={props.draft.attemptId+':'+loader.revision} onRetry={()=>setLoader(value=>({View:lazy(()=>import('./ResultReflection')),revision:value.revision+1}))}><Suspense fallback={<p role="status">Đang mở phiếu tự sửa…</p>}><Content key={props.draft.attemptId+':'+props.exam.versionHash+':'+props.exam.answerKeyVersion} {...props} focusOnMount={loader.revision>0}/></Suspense></ReflectionBoundary>}</section>;
}
