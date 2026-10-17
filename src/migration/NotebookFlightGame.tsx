import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {readStudyGameGrade,saveStudyGameGrade,studyGameQuestions,studyGameTopics,type StudyGrade} from '../native/playground/study-game-bank';
import {canFireFlight,finishFlight,fireFlight,flightDuration,flightTargetY,freshFlight,moveFlight,nextFlight,pauseFlight,readFlightRecord,resolveFlightShot,resumeFlight,saveFlightRecord,skipFlightIntro,startFlight,tickFlight,type FlightState} from './flight-game-core';
import './notebook-flight.css';

function localStore():Storage|undefined {try{return window.localStorage;}catch{return undefined;}}
function prefersReduced(){try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{return false;}}
function Ship(){return <svg viewBox="0 0 80 90" aria-hidden="true"><path d="M40 4C19 25 20 49 20 64h40C60 49 61 25 40 4Z" fill="#FFCF24" stroke="#213269" strokeWidth="4"/><path d="m20 42-14 28 17-6m37-22 14 28-17-6" fill="#fff" stroke="#213269" strokeWidth="4"/><circle cx="40" cy="35" r="11" fill="#bce9f5" stroke="#213269" strokeWidth="4"/><path d="m29 68 11 17 11-17" fill="#ff9970" stroke="#213269" strokeWidth="3"/></svg>;}
function Meteor(){return <svg viewBox="0 0 100 80" aria-hidden="true"><path d="M18 6 69 3 96 29 86 65 45 77 9 55 3 28Z" fill="#fff6c5" stroke="#FFCF24" strokeWidth="4"/><path d="m23 22 8 9m42 13 8 8M32 58l8-8" stroke="#e9bb35" strokeWidth="5" strokeLinecap="round"/></svg>;}

export default function NotebookFlightGame(){
 const [grade,setGrade]=useState<StudyGrade|null>(()=>readStudyGameGrade(localStore()));
 const [confirmed,setConfirmed]=useState(false),[game,setGame]=useState(()=>freshFlight()),[reduced,setReduced]=useState(prefersReduced);
 const [sound,setSound]=useState(false),[record,setRecord]=useState(()=>grade?readFlightRecord(localStore(),grade):0),[storageNote,setStorageNote]=useState('');
 const current=useRef(game),session=useRef(0),alive=useRef(true),soundEnabled=useRef(false),audio=useRef<AudioContext|null>(null);
 const stage=useRef<HTMLDivElement>(null),feedbackHeading=useRef<HTMLHeadingElement>(null),resultHeading=useRef<HTMLHeadingElement>(null);
 const renderSession=session.current,renderCursor=game.cursor;
 const topic=grade?studyGameTopics(grade)[0]:undefined,question=game.questions[game.cursor];
 const flying=game.phase==='intro'||game.phase==='running';
 const valid=()=>alive.current&&session.current===renderSession;
 const sameTurn=()=>valid()&&current.current.cursor===renderCursor;
 function tone(good:boolean){
  const ctx=audio.current;if(!soundEnabled.current||!ctx||ctx.state!=='running')return;
  try{const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(good?660:180,ctx.currentTime);oscillator.frequency.exponentialRampToValueAtTime(good?990:110,ctx.currentTime+.12);gain.gain.setValueAtTime(.045,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.16);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+.17);}catch{}
 }
 function update(next:FlightState){if(!alive.current||next===current.current)return;if(next.results.length>current.current.results.length)tone(next.results.at(-1)!.correct);current.current=next;setGame(next);}
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;session.current++;soundEnabled.current=false;const ctx=audio.current;audio.current=null;void ctx?.close().catch(()=>{});};},[]);
 useEffect(()=>{
  const hidden=()=>{if(document.hidden)update(pauseFlight(current.current));};document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);
 },[]);
 useEffect(()=>{
  if(!flying||reduced)return;
  let active=true,last:number|undefined,id=0;
  const frame=(time:number)=>{if(!active||!alive.current)return;if(last!==undefined)update(tickFlight(current.current,(time-last)/1000));last=time;if(current.current.phase==='running'||current.current.phase==='intro')id=requestAnimationFrame(frame);};
  id=requestAnimationFrame(frame);return()=>{active=false;cancelAnimationFrame(id);};
 },[flying,reduced]);
 useEffect(()=>{if(game.phase==='running'||game.phase==='intro')stage.current?.focus();else if(game.phase==='feedback')feedbackHeading.current?.focus();else if(game.phase==='finished')resultHeading.current?.focus();},[game.phase,game.cursor]);
 useEffect(()=>{
  if(game.phase!=='finished'||!grade)return;
  const saved=saveFlightRecord(localStore(),grade,game);setRecord(readFlightRecord(localStore(),grade));setStorageNote(saved?'Kỷ lục chỉ lưu trên thiết bị này.':'Trình duyệt chưa cho lưu kỷ lục. Em vẫn chơi và xem lời giải được.');
 },[game.phase,grade]);
 function begin(){
  if(!valid()||current.current.phase!=='ready'||!grade||!topic||!confirmed)return;
  const deck=studyGameQuestions(grade,topic.id);if(deck.length===0)return;
  session.current++;update(startFlight(freshFlight(deck),reduced));
 }
 function restart(){if(!valid()||current.current.phase!=='finished'||!grade||!topic)return;session.current++;update(startFlight(freshFlight(studyGameQuestions(grade,topic.id)),reduced));}
 function changeGrade(value:string){if(!valid()||current.current.phase!=='ready')return;const next=Number(value);if(next!==10&&next!==11&&next!==12)return;session.current++;setGrade(next);setConfirmed(false);setRecord(readFlightRecord(localStore(),next));if(!saveStudyGameGrade(localStore(),next))setStorageNote('Chưa nhớ được lựa chọn khối; em vẫn có thể chơi.');else setStorageNote('');}
 function steer(direction:-1|1){if(sameTurn())update(moveFlight(current.current,direction,reduced));}
 function shoot(){if(!sameTurn())return;const next=fireFlight(current.current);update(reduced?resolveFlightShot(next):next);}
 function pause(){if(sameTurn())update(pauseFlight(current.current));}
 function resume(){if(!sameTurn()||current.current.phase!=='paused'||document.hidden)return;update(resumeFlight(current.current,reduced));}
 function toggleReduced(){
  if(!valid())return;const next=!reduced;setReduced(next);
  if(next&&current.current.phase==='intro')update(skipFlightIntro(current.current));
  if(next&&current.current.phase==='running')update(resolveFlightShot({...current.current,x:current.current.lane}));
 }
 async function toggleSound(){
  if(!valid())return;const next=!soundEnabled.current;soundEnabled.current=next;setSound(next);if(!next)return;
  try{const ctx=audio.current??new AudioContext();audio.current=ctx;if(ctx.state==='suspended')await ctx.resume();if(!alive.current||audio.current!==ctx||!soundEnabled.current)return;tone(true);}catch{if(alive.current){soundEnabled.current=false;setSound(false);}}
 }
 function keyDown(event:KeyboardEvent<HTMLElement>){
  if(event.altKey||event.ctrlKey||event.metaKey||event.nativeEvent?.isComposing)return;
  const tag=(event.target as HTMLElement|undefined)?.tagName;if(tag&&['BUTTON','INPUT','SELECT','TEXTAREA','A'].includes(tag))return;
  const key=event.key.toLowerCase();if(!['arrowleft','arrowright','a','d',' ','p'].includes(key))return;event.preventDefault();if(event.repeat)return;
  if(key==='arrowleft'||key==='a')steer(-1);else if(key==='arrowright'||key==='d')steer(1);else if(key===' ')shoot();else if(current.current.phase==='paused')resume();else pause();
 }
 const lastResult=game.results.at(-1),wrong=game.results.filter(result=>!result.correct);
 return <section className={`flight-game${reduced?' flight-reduced':''}`} aria-label="Phi thuyền Toán v1" onKeyDown={keyDown}>
  <header className="flight-heading"><div><span className="flight-tag">PHI THUYỀN TOÁN · v1</span><h3>Lái vững, ngắm chuẩn, hiểu Toán</h3><p>8 thiên thạch · 3 tim · Kỷ lục khối {grade??'chưa chọn'}: <strong>{record}</strong></p></div><div className="flight-settings"><button type="button" aria-pressed={sound} onClick={()=>void toggleSound()}>Âm thanh: {sound?'bật':'tắt'}</button><button type="button" aria-pressed={reduced} onClick={toggleReduced}>Giảm chuyển động: {reduced?'bật':'tắt'}</button></div></header>
  {game.phase==='ready'?<div className="flight-preflight"><div className="flight-cover" aria-hidden="true"><span>✦</span><Meteor/><Ship/><span>✧</span></div><div><h4>Chọn đúng khối trước khi cất cánh</h4><label>Khối của em <select value={grade??''} onChange={event=>changeGrade(event.target.value)}><option value="" disabled>Chọn khối</option><option value="10">Lớp 10 · 2K11</option><option value="11">Lớp 11 · 2K10</option><option value="12">Lớp 12 · 2K9</option></select></label>{topic&&<><p className="flight-topic"><strong>Phạm vi:</strong> {topic.label}</p><label className="flight-confirm"><input type="checkbox" checked={confirmed} onChange={event=>{if(valid()&&current.current.phase==='ready')setConfirmed(event.target.checked);}}/>Em đã học đủ nội dung chương này và muốn ôn lại.</label></>}<p>Chỉ chơi chương em đã học. Lựa chọn này chưa tự đối chiếu tiến độ BTVN của lớp.</p><p>← → hoặc A/D để lái, phím cách để bắn, P để dừng. Điện thoại dùng ba nút dưới vùng trời. Bắn đúng được điểm và combo; bắn sai hoặc để thiên thạch chạm tàu mất 1 tim.</p><button type="button" className="flight-primary" disabled={!grade||!confirmed||!topic} onClick={begin}>Cất cánh</button><small>{reduced?'Giảm chuyển động: thiên thạch đứng yên, bắn chốt ngay, không giới hạn giờ.':'Mở đầu 3 giây, mỗi thiên thạch có 25 đến 36 giây để ngắm và bắn.'}</small></div></div>:game.phase==='finished'?<div className="flight-summary"><h4 ref={resultHeading} tabIndex={-1}>Hạ cánh, cùng xem lại đường bay</h4><p className="flight-final-score">{game.score} <span>điểm</span></p><p>Đúng {game.results.filter(result=>result.correct).length}/{game.results.length} câu đã gặp · Combo tốt nhất ×{game.bestCombo} · Còn {game.hearts} tim.</p><p>Các câu chưa gặp không tính là sai. {wrong.length?`Có ${wrong.length} câu cần ôn lại bên dưới.`:'Giữ thói quen đọc điều kiện trước khi chọn đáp án nhé.'}</p><div className="flight-result-actions"><button type="button" className="flight-primary" onClick={restart}>Bay lại 8 thiên thạch</button><button type="button" onClick={()=>{if(valid()&&current.current.phase==='finished'){session.current++;setConfirmed(false);update(freshFlight());}}}>Đổi khối hoặc chương</button></div>{game.results.length>0&&<div className="flight-solutions"><h4>Lời giải các câu đã gặp</h4>{game.results.map((result,index)=>{const q=game.questions.find(item=>item.id===result.questionId)!;return <details key={q.id} open={!result.correct}><summary>Câu {index+1}: {result.correct?'Đã đúng':'Cần ôn lại'} · {q.prompt}</summary><p>{result.chosen===null?'Em chưa bắn kịp.':`Em bắn mục tiêu ${q.answers[result.chosen]}.`} Đáp án đúng: <strong>{q.answers[q.correct]}</strong>.</p><p>{q.explanation}</p><p><strong>Mẹo:</strong> {q.tip}</p></details>;})}</div>}</div>:<>
   <div className="flight-hud" aria-label="Thông số lượt bay"><span>ĐIỂM<strong>{game.score}</strong></span><span>TIM<strong aria-label={`${game.hearts} tim`}>{'♥'.repeat(game.hearts)}<i aria-hidden="true">{'♡'.repeat(3-game.hearts)}</i></strong></span><span>COMBO<strong>×{game.combo}</strong></span><span>CÂU<strong>{game.cursor+1}/{game.questions.length}</strong></span></div>
   <div className="flight-question"><span>KHỐI {grade} · MỨC {question?.level} · {reduced?'KHÔNG GIỚI HẠN GIỜ':`CÒN ${Math.max(0,Math.ceil((1-game.progress)*flightDuration(game)))} GIÂY`}</span><p>{question?.prompt}</p></div>
   <div ref={stage} tabIndex={0} className={`flight-stage${game.phase==='feedback'?(lastResult?.correct?' flight-hit-good':' flight-hit-bad'):''}`} role="group" aria-label="Vùng lái phi thuyền. Mũi tên trái phải để lái, phím cách để bắn, P để tạm dừng.">
    <div className="flight-stars" aria-hidden="true">✦ <span>✧</span> · <b>✦</b> · <span>✧</span> ✦</div><div className="flight-lanes" aria-hidden="true"><span/><span/></div>
    {question&&question.answers.map((answer,index)=><div className="flight-meteor" key={`${question.id}-${index}`} style={{left:`${18+index*32}%`,top:`${(reduced?.22:flightTargetY(game))*100}%`}}><Meteor/><strong>{answer}</strong></div>)}
    <div className="flight-ship" style={{left:`${18+game.x*32}%`}}><Ship/></div>
    {game.bullet&&<div className="flight-laser" style={{left:`${18+game.bullet.x*32}%`,top:`${game.bullet.y*100}%`}} aria-hidden="true"/>}
    {game.phase==='intro'&&<div className="flight-overlay"><div className="flight-intro" role="status"><strong>{Math.max(1,3-Math.floor(game.intro))}</strong><p>Phi hành đoàn MTM đã sẵn sàng!</p><button type="button" onClick={()=>{if(sameTurn()&&current.current.phase==='intro')update(skipFlightIntro(current.current));}}>Bỏ qua mở đầu</button></div></div>}
    {game.phase==='paused'&&<div className="flight-overlay"><div><h4>Phi thuyền đang neo an toàn</h4><p>Thiên thạch, tia bắn và đồng hồ đều dừng. Đổi tab cũng tự tạm dừng.</p><button type="button" className="flight-primary" onClick={resume}>Tiếp tục bay</button><button type="button" onClick={()=>{if(sameTurn())update(finishFlight(current.current));}}>Kết thúc và xem lời giải</button></div></div>}
    {game.phase==='feedback'&&<div className="flight-overlay"><div className="flight-feedback"><span aria-hidden="true">{lastResult?.correct?'✦ + ĐIỂM ✦':'−1 ♥'}</span><h4 ref={feedbackHeading} tabIndex={-1}>{lastResult?.correct?'Trúng mục tiêu!':'Cùng gỡ thiên thạch này'}</h4><p>{game.feedback}</p><p>{question?.tip}</p><button type="button" className="flight-primary" onClick={()=>{if(sameTurn())update(nextFlight(current.current));}}>{game.hearts===0||game.cursor+1===game.questions.length?'Xem tổng kết đường bay':'Thiên thạch tiếp theo'}</button></div></div>}
   </div>
   <div className="flight-controls"><button type="button" disabled={game.phase!=='running'||game.lane===0||!!game.bullet} onClick={()=>steer(-1)}>← Trái</button><button type="button" className="flight-fire" disabled={!canFireFlight(game)} onClick={shoot}>Bắn mục tiêu</button><button type="button" disabled={game.phase!=='running'||game.lane===2||!!game.bullet} onClick={()=>steer(1)}>Phải →</button></div>
   <div className="flight-bottom"><p role="status" aria-live="polite">Tàu ở làn {game.lane+1}/3. {game.bullet?'Tia bắn đang bay!':game.phase==='running'?'Lái tới đáp án em chọn rồi bắn.':''}</p><button type="button" disabled={!flying} onClick={pause}>Tạm dừng phi thuyền</button></div>
  </>}
  {storageNote&&<p className="flight-storage" role="status">{storageNote}</p>}<footer className="flight-credit">MTM sưu tầm và biên soạn · Luyện cá nhân, không phải thi đua trực tuyến. Chỉ lưu khối và kỷ lục trên thiết bị, không lưu thông tin học sinh.</footer>
 </section>;
}
