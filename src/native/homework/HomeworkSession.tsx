import {Link} from '../../migration/navigation';
import {createAssetRenewal,mergeHomeworkSave} from './asset-renewal';
import {scheduleOpeningRefresh} from './opening-refresh';
import {useContext,useEffect,useMemo,useRef,useState} from 'react';
import {displayClassName} from './presentation';
import EntryNotice,{entryFailure} from './EntryNotice';
import LessonCards from './LessonCards';
import HomeworkOverview from './HomeworkOverview';
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
function ManagedAttempt({state,gateway,onState}:{state:HomeworkState & {exam:PracticeExam};gateway:HomeworkGateway;onState:(state:HomeworkState)=>void}){
  const [notice,setNotice]=useState(''),[saving,setSaving]=useState(false),[failed,setFailed]=useState(false);
  const alive=useRef(true),last=useRef<Draft|null>(state.draft),queue=useRef(Promise.resolve()),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(timer.current&&last.current){clearTimeout(timer.current);send(last.current);}};},[]);
  const send=(draft:Draft)=>{
    if(alive.current){setSaving(true);setFailed(false);setNotice(draft.submittedAt===null?'Đang lưu bài trên máy chủ MTM…':'Đang gửi bài đến máy chủ MTM…');}
    queue.current=queue.current.catch(()=>{}).then(async()=>{
      try{
        const next=await gateway.call(draft.submittedAt===null?'save':'submit',{lessonCode:state.lessonCode,attemptId:draft.attemptId,answers:draft.answers});
        if(alive.current){setFailed(false);setNotice((next.draft!=null&&next.draft.submittedAt!==null)?'Máy chủ MTM đã nhận bài.':'Đã lưu bài trên máy chủ MTM.');
          // Re-mount sau submit để UI lấy thời điểm/đáp án máy chủ (timeout loại đáp án đến muộn).
          onState(next);
        }
      }catch(error){if(alive.current){setFailed(true);setNotice(error instanceof Error?error.message:'Chưa gửi được. Giữ trang mở và thử lại.');}}
      finally{if(alive.current)setSaving(false);}
    });
  };
  useEffect(()=>{
    if(state.kind!=='kiem-tra-thang'||!state.closesAt)return;
    const timer=setInterval(()=>{if(Date.now()>=state.closesAt!&&last.current?.submittedAt===null){clearInterval(timer);send({...last.current,submittedAt:Date.now()});}},1000);
    return()=>clearInterval(timer);
  },[state.kind,state.closesAt]);
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
    <PracticeAttempt isHomework exam={state.exam} catalogUrl={location.pathname} contextLabel="BTVN" audienceLabel={displayClassName(state)} storeOverride={store}
      storageNotice="Bài làm gửi đến máy chủ MTM theo tài khoản em. Chỉ thông báo nhận bài từ máy chủ mới xác nhận đã nộp BTVN."
      onRetake={()=>{setNotice('Dùng nút Làm lượt tiếp ở phần kết quả BTVN.');document.getElementById('btvn-summary')?.scrollIntoView({behavior:'smooth'});}}
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
  const renewAssets=useRef<(failed?:boolean)=>void>(()=>{});
  const selectedLesson=useRef<string|undefined>(parts?.[2]);
  useEffect(()=>{if(state)selectedLesson.current=state.lessonCode||undefined;},[state?.lessonCode]);
  const gateway=useMemo<HomeworkGateway>(()=>({async call(action,body={}){
    const response=await fetch('/api/btvn',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action,classKey:parts?.[1],lessonCode:action==='login'?parts?.[2]:selectedLesson.current,...body})}).catch(()=>{throw new Error('Chưa kết nối được máy chủ. Em thử lại sau.');});
    const data=await response.json().catch(()=>{throw new Error('Máy chủ chưa trả lời hợp lệ. Em thử lại sau.');});if(!response.ok)throw new Error(action==='login'?entryFailure(response.status,data.message):data.message??'Chưa kết nối được máy chủ.');return data as HomeworkState;
  }}),[pathname]);
  useEffect(()=>{mounted.current=true;void gateway.call('state').then(next=>{if(mounted.current){setState(next);setRoom(!!next.draft&&next.draft.submittedAt===null);}}).catch(()=>{}).finally(()=>{if(mounted.current)setChecking(false);});return()=>{mounted.current=false;};},[gateway]);
  useEffect(()=>{
    if(!state?.lessons)return;
    let alive=true;const lessonCode=state.lessonCode;
    const cancel=scheduleOpeningRefresh(state.lessons,async()=>{const next=await gateway.call('state',{lessonCode});if(alive)setState(previous=>previous?.lessonCode===lessonCode?{...previous,lessons:next.lessons}:previous);});
    return ()=>{alive=false;cancel();};
  },[gateway,state?.lessonCode,state?.lessons]);
  // Link ảnh/PDF sống 150 phút; chỉ gia hạn khi còn tối đa 30 phút hoặc ảnh lỗi.
  useEffect(()=>{
    if(!state||state.demo||(!state.exam&&!state.opensAt))return;
    let alive=true;const lesson=state.lessonCode;
    const renew=createAssetRenewal(async()=>{try{
      const next=await gateway.call('state',{lessonCode:lesson});
      if(alive)setState(previous=>previous?.lessonCode===lesson?{...previous,exam:next.exam,lessons:next.lessons,assetsExpiresAt:next.assetsExpiresAt,canStart:next.canStart,solutionsAvailable:next.solutionsAvailable}:previous);
    }catch{ /* Giữ bài hiện tại khi mất mạng; lần kiểm sau thử lại. */ }});
    const check=(failed=false)=>void renew(state.assetsExpiresAt,failed);
    renewAssets.current=check;
    const timer=setInterval(()=>check((!state.exam&&!!state.opensAt&&Date.now()>=state.opensAt)||(state.kind==='kiem-tra-thang'&&!state.solutionsAvailable&&!!state.closesAt&&Date.now()>=state.closesAt)),60000);
    const visible=()=>{if(document.visibilityState==='visible')check();};document.addEventListener('visibilitychange',visible);
    return()=>{alive=false;renewAssets.current=()=>{};clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  },[gateway,state?.lessonCode,state?.demo,state?.assetsExpiresAt,state?.opensAt,state?.closesAt,state?.solutionsAvailable,!!state?.exam]);
  const run=async(action:'login'|'start',input?:GateInput)=>{setBusy(true);setNotice('');try{setState(await gateway.call(action,action==='login'?{gate:input}:{}));if(action==='start')setRoom(true);setGate({fullName:'',phone:'',className:''});setStudentCode('');}catch(error){setNotice(error instanceof Error?error.message:'Chưa kết nối được máy chủ. Em thử lại sau.');}finally{setBusy(false);}};
  if(!parts&&pathname!=='/btvn')return <section className="mig-container mig-panel"><Link href="/" className="btvn-home-link">← Trang chủ</Link><h1>Đường dẫn BTVN không hợp lệ</h1></section>;
  return <section className="ep-root btvn-session" onErrorCapture={event=>{if(event.target instanceof HTMLImageElement&&event.target.closest('.mtm-source-content'))renewAssets.current(true);}}>
    {state?.demo&&<p className="btvn-demo" role="note">Bản thử với học sinh giả và buổi mẫu. Chưa giao BTVN cho lớp thật.</p>}{notice&&<p role="alert">{notice}</p>}
    {!state&&<header className="btvn-entry-heading"><Link href="/" className="btvn-home-logo" aria-label="Minh Thành Math, về trang chủ"><img src="/mtm-original-logo-420w.webp" alt="Minh Thành Math"/></Link><Link href="/" className="btvn-home-link">← Trang chủ</Link><h1>Bài tập về nhà</h1><p>Vào lớp để xem bài giảng và hoàn thành BTVN của em.</p></header>}
    {checking?<p role="status">Đang kiểm tra phiên…</p>:!state?<HomeworkGate studentCode={studentCode} identity={gate} busy={busy} classNames={classNames} classesLoading={classesLoading} classesError={classesError} onReloadClasses={()=>void loadClasses()} onCode={setStudentCode} onIdentity={setGate} onLogin={input=>void run('login',input)}/>:<>
      <header className="btvn-top"><Link href="/" className="btvn-home-logo" aria-label="Minh Thành Math, về trang chủ"><img src="/mtm-original-logo-420w.webp" alt="Minh Thành Math"/></Link><div><b>Bài tập về nhà</b><p>Video buổi học và BTVN của lớp em</p></div><div className="btvn-me"><Link href="/" className="btvn-home-link">← Trang chủ</Link><b>{state.fullName}</b><span>{displayClassName(state)}</span><button disabled={busy} onClick={async()=>{setBusy(true);try{await gateway.call('logout');setState(null);setRoom(false);}catch{setNotice('Chưa thoát phiên được.');}finally{setBusy(false);}}}>Thoát</button></div></header>
      {state.classMismatch&&<EntryNotice className={state.className}/>}
      {!room&&<LessonCards demo={state.demo} lessons={state.lessons??[]} busy={busy} onHomework={async code=>{setBusy(true);setNotice('');try{setState(await gateway.call('select',{lessonCode:code}));setRoom(true);requestAnimationFrame(()=>document.getElementById('btvn-summary')?.scrollIntoView({behavior:'smooth'}));}catch(error){setNotice(error instanceof Error?error.message:'Chưa mở được bài.');}finally{setBusy(false);}}}/>}
      {room&&(state.exam||state.opensAt!==undefined||state.kind==='kiem-tra-thang')&&<><button className="btvn-btn btvn-back" disabled={busy} onClick={()=>setRoom(false)}>← Các buổi học</button>
        {state.exam&&state.draft&&state.draft.submittedAt===null?<ManagedAttempt key={state.draft.attemptId} state={{...state,exam:state.exam}} gateway={gateway} onState={next=>setState(previous=>previous?mergeHomeworkSave(previous,next):next)}/>:<HomeworkOverview key={state.lessonCode+':'+(state.draft?.attemptId??'new')} state={state} busy={busy} onStart={()=>void run('start')}/>}
      </>}

    </>}
  </section>;
}
