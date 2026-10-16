import {useEffect,useId,useRef,useState} from 'react';
import type {HomeworkState} from './btvn-contract';
import {createHomeworkResultSummary,createHomeworkSubmissionSummary} from './result-summary';

type Scope={key:string;alive:boolean;request:number;timer?:ReturnType<typeof setTimeout>};
type Feedback={scope:Scope;message:string;pending:boolean;manual:boolean;expanded:boolean};
const clearTimer=(scope:Scope)=>{if(scope.timer!==undefined){clearTimeout(scope.timer);scope.timer=undefined;}};

export default function HomeworkResultSummary({state}:{state:HomeworkState}){
  const resultText=createHomeworkResultSummary(state),submissionText=resultText?null:createHomeworkSubmissionSummary(state);
  const submissionOnly=!!submissionText,text=resultText??submissionText,id=useId();
  const label=submissionOnly?'Phiếu xác nhận đã nộp':'Phiếu kết quả';
  const key=JSON.stringify([state.lessonCode,state.draft?.attemptId,state.draft?.examVersionHash,text]);
  const scopeRef=useRef<Scope>({key,alive:true,request:0}),field=useRef<HTMLTextAreaElement>(null);
  if(scopeRef.current.key!==key){scopeRef.current.alive=false;clearTimer(scopeRef.current);scopeRef.current={key,alive:true,request:0};}
  const scope=scopeRef.current;
  const [feedback,setFeedback]=useState<Feedback|null>(null);
  const current=feedback?.scope===scope?feedback:null;
  useEffect(()=>{scope.alive=true;return()=>{scope.alive=false;scope.request++;clearTimer(scope);};},[scope]);
  useEffect(()=>{if(current?.manual&&current.expanded){field.current?.focus();field.current?.select();}},[scope,current?.manual,current?.expanded]);
  if(!text)return null;
  const copy=async()=>{
    const request=++scope.request;
    const active=()=>scope.alive&&scopeRef.current===scope&&scope.request===request;
    clearTimer(scope);
    setFeedback(previous=>({scope,message:'Đang sao chép '+label.toLowerCase()+'…',pending:true,manual:previous?.scope===scope&&previous.manual,expanded:previous?.scope===scope&&previous.expanded}));
    scope.timer=setTimeout(()=>{
      if(!active())return;
      scope.request++;
      scope.timer=undefined;
      setFeedback({scope,message:'Sao chép tự động đang mất nhiều thời gian. Em có thể tự sao chép trong ô bên dưới hoặc thử lại.',pending:false,manual:true,expanded:true});
    },4000);
    try{
      if(typeof navigator==='undefined'||typeof navigator.clipboard?.writeText!=='function')throw Error('Clipboard chưa sẵn sàng');
      await navigator.clipboard.writeText(text);
      if(active()){
        clearTimer(scope);
        setFeedback({scope,message:'Đã sao chép '+label.toLowerCase()+'. Em mở ứng dụng nhắn tin và tự gửi cho phụ huynh.',pending:false,manual:false,expanded:false});
      }
    }catch{
      if(active()){
        clearTimer(scope);
        setFeedback({scope,message:'Chưa sao chép tự động được. Em chọn và sao chép nội dung trong ô bên dưới.',pending:false,manual:true,expanded:true});
      }
    }
  };
  return <section aria-labelledby={id+'-title'}>
    <h3 id={id+'-title'}>{label} để tự gửi</h3>
    <p className="btvn-footnote">{submissionOnly?'Em có thể tự gửi xác nhận đã nộp cho phụ huynh trong khi điểm đang đối soát. Phiếu chưa có điểm hoặc thông tin hạn nộp.':'Em có thể xem phiếu rồi tự gửi cho phụ huynh. Phiếu gồm lượt làm, điểm và thời gian nộp.'}</p>
    <button type="button" className="btvn-btn" disabled={current?.pending??false} aria-describedby={id+'-status'} aria-busy={current?.pending??false} onClick={()=>void copy()}>Sao chép {label.toLowerCase()}</button>
    <p id={id+'-status'} className="btvn-footnote" role="status" aria-live="polite" aria-atomic="true">{current?.message}</p>
    <details open={current?.expanded??false} onToggle={event=>{
      const expanded=event.currentTarget.open;
      setFeedback(previous=>previous?.scope===scope?{...previous,expanded}:{scope,message:'',pending:false,manual:false,expanded});
    }}>
      <summary>Xem nội dung {label.toLowerCase()}</summary>
      <textarea ref={field} readOnly rows={10} value={text} aria-label={'Nội dung '+label.toLowerCase()+' để tự sao chép'} style={{width:'100%',boxSizing:'border-box',font:'inherit'}} onFocus={event=>event.currentTarget.select()}/>
    </details>
  </section>;
}
