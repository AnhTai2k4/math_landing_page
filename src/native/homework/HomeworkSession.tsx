import {useContext,useEffect,useMemo,useRef,useState} from 'react';
import {homeworkTitle,displayClassName} from './presentation';
import LessonCards from './LessonCards';
import HomeworkGate from './HomeworkGate';
import PracticeAttempt from '../exams/PracticeAttempt';
import type {Draft,Store} from '../exams/store';
import {draftKey} from '../exams/store';
import type {PracticeExam} from '../exams/data';
import type {GateInput,HomeworkGateway,HomeworkState} from './btvn-contract';
import MtmSourceContent from '../exams/MtmSourceContent';
import {RoomQuestionContext} from '../exams/RoomQuestionContext';
import {questionLabel} from '../exams/attempt-ui';
import '../exams/exams.css';
import './btvn-session.css';

function HomeworkReader({exam}:{exam:PracticeExam}){
  const active=useContext(RoomQuestionContext);
  return <section aria-label="Đề BTVN">{exam.questions.map((q,index)=>active!==null&&active!==index?null:<article key={q.id} className="btvn-question"><h2>{questionLabel(exam,index).full}</h2>{q.sourceContent&&<MtmSourceContent segments={q.sourceContent.questions} assetBase="/practice-media/source-crops" label={questionLabel(exam,index).full} kind="question"/>}<small>MTM sưu tầm và biên soạn</small></article>)}</section>;
}
function ManagedAttempt({state,gateway,onState}:{state:HomeworkState;gateway:HomeworkGateway;onState:(state:HomeworkState)=>void}){
  const [notice,setNotice]=useState(''),[saving,setSaving]=useState(false),[failed,setFailed]=useState(false);
  const alive=useRef(true),last=useRef<Draft|null>(state.draft),queue=useRef(Promise.resolve()),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(timer.current&&last.current){clearTimeout(timer.current);send(last.current);}};},[]);
  const send=(draft:Draft)=>{
    if(alive.current){setSaving(true);setFailed(false);setNotice(draft.submittedAt===null?'Đang lưu bài trên máy chủ thử…':'Đang gửi bài đến máy chủ thử…');}
    queue.current=queue.current.catch(()=>{}).then(async()=>{
      try{
        const next=await gateway.call(draft.submittedAt===null?'save':'submit',{lessonCode:state.lessonCode,attemptId:draft.attemptId,answers:draft.answers});
        if(alive.current){setFailed(false);setNotice(next.draft?.submittedAt!==null?'Máy chủ thử đã nhận bài; điểm tính nằm ở bảng BTVN bên dưới.':'Đã lưu bài trên máy chủ thử.');
          // Re-mount sau submit để UI lấy thời điểm/đáp án máy chủ (timeout loại đáp án đến muộn).
          if(next.draft?.submittedAt!==null)onState(next);
        }
      }catch(error){if(alive.current){setFailed(true);setNotice(error instanceof Error?error.message:'Chưa gửi được. Giữ trang mở và thử lại.');}}
      finally{if(alive.current)setSaving(false);}
    });
  };
  const store=useMemo<Store>(()=>{
    const values=new Map<string,string>();if(state.draft)values.set(draftKey(state.exam.id),JSON.stringify(state.draft));
    return {getItem:key=>values.get(key)??null,setItem:(key,value)=>{
      if(key===draftKey(state.exam.id)){
        const draft=JSON.parse(value) as Draft;
        if(draft.attemptId!==state.draft?.attemptId)throw new Error('Chỉ máy chủ mở lượt mới.');
        values.set(key,value);last.current=draft;clearTimeout(timer.current);timer.current=undefined;
        if(draft.submittedAt!==null)send(draft);else timer.current=setTimeout(()=>{timer.current=undefined;send(draft);},500);
      }else values.set(key,value);
    }};
  },[state.draft?.attemptId]);
  return <><p role="status">{notice}</p>{failed&&<button disabled={saving} onClick={()=>last.current&&send(last.current)}>Gửi lại bài đang giữ</button>}
    <PracticeAttempt exam={state.exam} catalogUrl={location.pathname} contextLabel="BTVN" audienceLabel={displayClassName(state)} storeOverride={store}
      storageNotice="Bài thử giữ trong bộ nhớ trang và gửi đến máy chủ thử. Chỉ thông báo nhận bài từ máy chủ mới xác nhận đã nộp BTVN."
      onRetake={()=>{setNotice('Dùng nút Mở lượt tiếp theo ở bảng BTVN bên dưới.');document.getElementById('btvn-summary')?.scrollIntoView({behavior:'smooth'});}}
      questionReader={<HomeworkReader exam={state.exam}/>}/>
  </>;
}
export default function HomeworkSession({pathname}:{pathname:string}){
  const parts=/^\/btvn\/([a-z0-9-]+)\/([a-z0-9-]+)$/.exec(pathname);
  const [state,setState]=useState<HomeworkState|null>(null),[gate,setGate]=useState({fullName:'',phone:'',className:''});
  const [studentCode,setStudentCode]=useState('');
  const [classNames,setClassNames]=useState<string[]>([]),[classesLoading,setClassesLoading]=useState(true),[classesError,setClassesError]=useState(false);
  const classesGeneration=useRef(0);
  const loadClasses=async()=>{
    const generation=++classesGeneration.current;setClassesLoading(true);setClassesError(false);
    try{
      const response=await fetch('/api/btvn',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'classes'})});
      const data=await response.json();
      if(!response.ok||!Array.isArray(data.classNames)||data.classNames.length>200||data.classNames.some((name:unknown)=>typeof name!=='string'||!name.trim()||name.length>100))throw Error('Danh sách lớp chưa sẵn sàng');
      if(generation===classesGeneration.current){setClassNames([...new Set<string>(data.classNames)]);setGate(previous=>({...previous,className:data.classNames.includes(previous.className)?previous.className:''}));}
    }catch{if(generation===classesGeneration.current){setClassNames([]);setClassesError(true);}}
    finally{if(generation===classesGeneration.current)setClassesLoading(false);}
  };
  useEffect(()=>{void loadClasses();return()=>{classesGeneration.current++;};},[pathname]);
  const [room,setRoom]=useState(false);
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[checking,setChecking]=useState(true);
  const mounted=useRef(true);
  const selectedLesson=useRef<string|undefined>(parts?.[2]);
  useEffect(()=>{if(state)selectedLesson.current=state.lessonCode;},[state?.lessonCode]);
  const gateway=useMemo<HomeworkGateway>(()=>({async call(action,body={}){
    const response=await fetch('/api/btvn',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action,classKey:parts?.[1],lessonCode:action==='login'?parts?.[2]:selectedLesson.current,...body})});
    const data=await response.json();if(!response.ok)throw new Error(data.message??'Chưa kết nối được máy chủ.');return data as HomeworkState;
  }}),[pathname]);
  useEffect(()=>{mounted.current=true;void gateway.call('state').then(next=>{if(mounted.current){setState(next);setRoom(!!next.draft&&next.draft.submittedAt===null);}}).catch(()=>{}).finally(()=>{if(mounted.current)setChecking(false);});return()=>{mounted.current=false;};},[gateway]);
  // Chữ ký tài sản sống 5 phút; làm mới ảnh/PDF, giữ đáp án đang gõ và lượt hiện tại.
  useEffect(()=>{
    if(!state||state.demo)return;
    let alive=true;const lesson=state.lessonCode;
    const renew=async()=>{try{const next=await gateway.call('state',{lessonCode:lesson});if(alive)setState(previous=>previous?.lessonCode===lesson?{...previous,exam:next.exam}:previous);}catch{ /* Lỗi mạng giữ bài hiện tại; lần tải sau thử lại. */ }};
    const timer=setInterval(()=>void renew(),240000);
    const visible=()=>{if(document.visibilityState==='visible')void renew();};document.addEventListener('visibilitychange',visible);
    return()=>{alive=false;clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  },[gateway,state?.lessonCode,state?.demo]);
  const run=async(action:'login'|'start',input?:GateInput)=>{setBusy(true);setNotice('');try{setState(await gateway.call(action,action==='login'?{gate:input}:{}));if(action==='start')setRoom(true);setGate({fullName:'',phone:'',className:''});setStudentCode('');}catch(error){setNotice(action==='login'?'Chưa vào được bài. Em kiểm tra thông tin và thử lại sau.':error instanceof Error?error.message:'Chưa kết nối được.');}finally{setBusy(false);}};
  if(!parts&&pathname!=='/btvn')return <section className="mig-container mig-panel"><h1>Đường dẫn BTVN không hợp lệ</h1></section>;
  return <section className="mig-container ep-root btvn-session"><h1>Bài tập về nhà</h1><p>MTM sưu tầm và biên soạn</p>
    {(!state||state.demo)&&<p className="btvn-demo" role="note">Bản thử với học sinh giả và buổi mẫu. Chưa giao BTVN cho lớp thật.</p>}{notice&&<p role="alert">{notice}</p>}
    {checking?<p role="status">Đang kiểm tra phiên…</p>:!state?<HomeworkGate studentCode={studentCode} identity={gate} busy={busy} classNames={classNames} classesLoading={classesLoading} classesError={classesError} onReloadClasses={()=>void loadClasses()} onCode={setStudentCode} onIdentity={setGate} onLogin={input=>void run('login',input)}/>:<>
      <header className="btvn-top"><img src="/mtm-original-logo-420w.webp" alt="Minh Thành Math"/><div><b>Bài tập về nhà</b><p>Video buổi học và BTVN của lớp em</p></div><div className="btvn-me"><b>{state.fullName}</b><span>{displayClassName(state)}</span><button disabled={busy} onClick={async()=>{setBusy(true);try{await gateway.call('logout');setState(null);setRoom(false);}catch{setNotice('Chưa thoát phiên được.');}finally{setBusy(false);}}}>Thoát</button></div></header>
      {!room&&<LessonCards demo={state.demo} lessons={state.lessons??[]} busy={busy} onHomework={async code=>{setBusy(true);setNotice('');try{setState(await gateway.call('select',{lessonCode:code}));setRoom(true);requestAnimationFrame(()=>document.getElementById('btvn-summary')?.scrollIntoView({behavior:'smooth'}));}catch(error){setNotice(error instanceof Error?error.message:'Chưa mở được bài.');}finally{setBusy(false);}}}/>}
      {room&&<><button className="btvn-btn" onClick={()=>setRoom(false)}>Quay lại các buổi học</button><section id="btvn-summary" className="mig-panel"><h2>{homeworkTitle(state)}</h2>
        <p>{state.attemptsUsed}/{state.maxAttempts} lượt · 120 phút/lượt · Điểm cao nhất: {state.bestScore===null?'Chưa có':state.bestScore+'/10'} · Hạn: {state.dueAt===null?'chờ xác minh buổi học kế tiếp':new Date(state.dueAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} (giờ Việt Nam).</p>
        <p>Mở lượt tính ngay là một lần làm. Điểm cao nhất tính cả lần nộp muộn. Hạn nộp là giờ vào buổi học kế tiếp mà em thực học.</p>
        {(!state.draft||state.draft.submittedAt!==null)&&state.attemptsUsed<state.maxAttempts&&<button className="ep-primary" disabled={busy} onClick={()=>void run('start')}>{state.draft?'Mở lượt tiếp theo':'Bắt đầu làm bài'}</button>}
        {state.receipts.length>0&&<ul>{state.receipts.map(r=><li key={r.attemptId}>Lượt {r.attemptNumber}: {r.score}/10 · {new Date(r.submittedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} · {r.elapsedSeconds} giây{r.late===null?' · Chờ xác minh hạn':r.late?' · Nộp muộn':' · Đúng hạn'}{r.timedOut?' · Hết giờ':''}</li>)}</ul>}
        <button disabled={busy} onClick={async()=>{setBusy(true);try{await gateway.call('logout');setState(null);}catch{setNotice('Chưa thoát phiên được.');}finally{setBusy(false);}}}>Thoát phiên</button>
      </section>
      {state.draft&&<ManagedAttempt key={state.draft.attemptId+':'+(state.draft.submittedAt??'open')} state={state} gateway={gateway} onState={setState}/>}
      </>}
    </>}
  </section>;
}
