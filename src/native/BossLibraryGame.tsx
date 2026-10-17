import {useEffect,useId,useRef,useState,type KeyboardEvent} from 'react';
import {studyGameTopics,type StudyGrade} from './playground/study-game-bank';
import {bossDeck,bossDuration,canGuardBoss,finishBoss,freshBoss,guardBoss,moveBoss,nextBoss,pauseBoss,resolveBossGuard,resumeBoss,skipBossIntro,startBoss,tickBoss,type BossState} from './Boss-core';
import './boss.css';

function prefersReduced(){try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{return false;}}
function Shield(){return <svg viewBox="0 0 80 90" aria-hidden="true"><path d="M40 5 72 17v30Q68 72 40 84 12 72 8 47V17Z" fill="#FFCF24" stroke="#213269" strokeWidth="5"/><path d="m26 43 10 10 20-23" stroke="#213269" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="40" cy="20" r="5" fill="#fff"/></svg>;}
function BookBoss(){return <svg viewBox="0 0 160 110" aria-hidden="true"><path d="m22 28 57-15 58 15v68l-58-9-57 9Z" fill="#fff" stroke="#213269" strokeWidth="5"/><path d="M79 15v73" stroke="#FFCF24" strokeWidth="6"/><path d="m25 24-9-16 24 14m94 2 10-16-26 15" fill="#FFCF24" stroke="#213269" strokeWidth="4"/><path d="m40 42 20 5m38 0 20-5" stroke="#213269" strokeWidth="6"/><circle cx="50" cy="57" r="6" fill="#213269"/><circle cx="108" cy="57" r="6" fill="#213269"/><path d="M60 76q19-14 38 0" fill="none" stroke="#213269" strokeWidth="4"/></svg>;}

export default function BossLibraryGame(){
 const id=useId();
 const [grade,setGrade]=useState<StudyGrade|null>(null),[confirmed,setConfirmed]=useState(false),[game,setGame]=useState(()=>freshBoss()),[reduced,setReduced]=useState(prefersReduced),[sound,setSound]=useState(false),[review,setReview]=useState(false);
 const current=useRef(game),generation=useRef(0),alive=useRef(true),soundEnabled=useRef(false),audio=useRef<AudioContext|null>(null);
 const stage=useRef<HTMLDivElement>(null),feedbackHeading=useRef<HTMLHeadingElement>(null),resultHeading=useRef<HTMLHeadingElement>(null),settings=useRef<HTMLSelectElement>(null),pausedHeading=useRef<HTMLHeadingElement>(null);
 const renderedGeneration=generation.current,renderedCursor=game.cursor,renderedPhase=game.phase;
 const topic=grade?studyGameTopics(grade)[0]:undefined,question=game.questions[game.cursor],running=game.phase==='running'||game.phase==='intro';
 const valid=()=>alive.current&&generation.current===renderedGeneration;
 const sameTurn=()=>valid()&&current.current.cursor===renderedCursor;
 const samePhase=()=>sameTurn()&&current.current.phase===renderedPhase;
 function tone(good:boolean){
  const ctx=audio.current;if(!soundEnabled.current||!ctx||ctx.state!=='running')return;
  try{const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type='triangle';oscillator.frequency.setValueAtTime(good?620:180,ctx.currentTime);gain.gain.setValueAtTime(.035,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.13);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+.15);}catch{}
 }
 function update(next:BossState){if(!alive.current||next===current.current)return;if(next.results.length>current.current.results.length)tone(next.results.at(-1)!.correct);current.current=next;setGame(next);}
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++;soundEnabled.current=false;const ctx=audio.current;audio.current=null;void ctx?.close().catch(()=>{});};},[]);
 useEffect(()=>{const hidden=()=>{if(document.hidden)update(pauseBoss(current.current));};document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);},[]);
 useEffect(()=>{
  if(!running||reduced)return;
  let active=true,id=0,last:number|undefined;
  const frame=(time:number)=>{if(!active||!alive.current)return;if(last!==undefined)update(tickBoss(current.current,(time-last)/1000));last=time;if(['intro','running'].includes(current.current.phase))id=requestAnimationFrame(frame);};
  id=requestAnimationFrame(frame);return()=>{active=false;cancelAnimationFrame(id);};
 },[running,reduced]);
 useEffect(()=>{if(game.phase==='intro'||game.phase==='running')stage.current?.focus();else if(game.phase==='feedback')feedbackHeading.current?.focus();else if(game.phase==='finished')resultHeading.current?.focus();else if(game.phase==='paused')pausedHeading.current?.focus();else settings.current?.focus();},[game.phase,game.cursor]);
 function begin(){if(!samePhase()||current.current.phase!=='ready'||!grade||!topic||!confirmed)return;generation.current++;setReview(false);update(startBoss(freshBoss(bossDeck(grade,topic.id)),reduced));}
 function changeGrade(value:string){if(!samePhase()||current.current.phase!=='ready')return;const next=Number(value);if(next!==10&&next!==11&&next!==12)return;generation.current++;setGrade(next);setConfirmed(false);}
 function steer(direction:-1|1){if(samePhase())update(moveBoss(current.current,direction,reduced));}
 function defend(){if(!samePhase())return;const next=guardBoss(current.current);update(reduced?resolveBossGuard(next):next);}
 function pause(){if(samePhase())update(pauseBoss(current.current));}
 function resume(){if(samePhase()&&current.current.phase==='paused'&&!document.hidden)update(resumeBoss(current.current,reduced));}
 function restart(onlyWrong:boolean){
  if(!samePhase()||current.current.phase!=='finished'||!grade||!topic)return;
  const wrongIds=new Set(current.current.results.filter(hit=>!hit.correct).map(hit=>hit.questionId)),deck=bossDeck(grade,topic.id).filter(q=>!onlyWrong||wrongIds.has(q.id));if(!deck.length)return;
  generation.current++;setReview(onlyWrong);update(startBoss(freshBoss(deck),reduced));
 }
 function changeScope(){if(!samePhase()||current.current.phase!=='finished')return;generation.current++;setConfirmed(false);setReview(false);update(freshBoss());}
 function toggleReduced(){
  if(!valid())return;const next=!reduced;setReduced(next);
  if(next&&current.current.phase==='intro')update(skipBossIntro(current.current));
  if(next&&current.current.phase==='running')update(resolveBossGuard({...current.current,x:current.current.lane}));
 }
 async function toggleSound(){
  if(!valid())return;const next=!soundEnabled.current;soundEnabled.current=next;setSound(next);if(!next)return;
  try{const ctx=audio.current??new AudioContext();audio.current=ctx;if(ctx.state==='suspended')await ctx.resume();if(!alive.current||audio.current!==ctx||!soundEnabled.current)return;tone(true);}catch{if(alive.current){soundEnabled.current=false;setSound(false);}}
 }
 function keyDown(event:KeyboardEvent<HTMLElement>){
  if(event.altKey||event.ctrlKey||event.metaKey||event.nativeEvent?.isComposing)return;
  const target=event.target as HTMLElement|undefined,tag=target?.tagName;if(target?.isContentEditable||target?.closest?.('button,input,select,textarea,a,summary,[contenteditable="true"]')||tag&&['BUTTON','INPUT','SELECT','TEXTAREA','A','SUMMARY'].includes(tag))return;
  const key=event.key.toLowerCase();if(!['arrowleft','arrowright','a','d',' ','p'].includes(key))return;event.preventDefault();if(event.repeat)return;
  if(key==='arrowleft'||key==='a')steer(-1);else if(key==='arrowright'||key==='d')steer(1);else if(key===' ')defend();else if(current.current.phase==='paused')resume();else pause();
 }
 const last=game.results.at(-1),wrong=game.results.filter(hit=>!hit.correct),done=game.hearts===0||game.health===0||game.cursor+1===game.questions.length;
 return <section className={'boss-library'+(reduced?' boss-reduced':'')} aria-label="Bảo vệ thư viện v1" onKeyDown={keyDown}>
  <header className="boss-heading"><div><span className="boss-tag">BOSS CUỐI CHƯƠNG · v1</span><h3>Bảo vệ thư viện Toán</h3><p>Đỡ đúng, đánh trả mạnh. Combo 3 đòn tạo một cú phản công gấp đôi!</p></div><div className="boss-settings"><button type="button" aria-pressed={sound} onClick={()=>void toggleSound()}>Âm thanh: {sound?'bật':'tắt'}</button><button type="button" aria-pressed={reduced} onClick={toggleReduced}>Giảm chuyển động: {reduced?'bật':'tắt'}</button></div></header>
  {game.phase==='ready'?<div className="boss-preflight"><div className="boss-cover" aria-hidden="true"><BookBoss/><div className="boss-demo-bolt">x ∈ ℝ</div><Shield/></div><div><h4>Chọn phạm vi em đã học</h4><label>Khối của em <select ref={settings} value={grade??''} onChange={event=>changeGrade(event.target.value)}><option value="" disabled>Chọn khối</option><option value="10">Lớp 10 · 2K11</option><option value="11">Lớp 11 · 2K10</option><option value="12">Lớp 12 · 2K9</option></select></label>{topic&&<><p><strong>Chương:</strong> {topic.chapter}</p><p><strong>Bài ôn:</strong> {topic.lesson}</p><label className="boss-confirm"><input type="checkbox" checked={confirmed} onChange={event=>{if(samePhase()&&current.current.phase==='ready')setConfirmed(event.target.checked);}}/>Em đã học đủ các nội dung trên và muốn ôn lại.</label></>}<p>Chỉ chọn chương đã học. Trò chơi chưa tự đối chiếu tiến độ BTVN của lớp.</p><ol><li>Dùng ← → hoặc A/D để lái khiên tới làn đáp án.</li><li>Nhấn phím cách hoặc Dựng khiên để đỡ đòn, khóa làn đã chọn.</li><li>Đỡ đúng làm Boss mất máu; sai hoặc chưa kịp đỡ mất 1 tim.</li></ol><p>{reduced?'Chế độ giảm chuyển động giữ đạn đứng yên, không giới hạn giờ và đỡ ngay khi bấm.':'Mở đầu 3 giây; mỗi đòn có ít nhất 27 giây đọc đề, dựng khiên sớm để phản công nhanh.'}</p><button type="button" className="boss-primary" disabled={!grade||!topic||!confirmed} onClick={begin}>Vào bảo vệ thư viện</button></div></div>:game.phase==='finished'?<div className="boss-summary"><h4 ref={resultHeading} tabIndex={-1}>{game.health===0?'Thư viện an toàn, Boss đã được hóa giải!':'Dừng một nhịp, gỡ lại từng đòn'}</h4><p className="boss-score">{game.score} <span>điểm luyện cá nhân</span></p><p>Đúng {game.results.filter(hit=>hit.correct).length}/{game.results.length} câu đã gặp · Combo tốt nhất ×{game.bestCombo} · Còn {game.hearts} tim.</p><p>{review?'Đây là lượt ôn riêng các đòn chưa đúng. ':''}Các câu chưa gặp không được tính là sai. Điểm không cộng vào BTVN hay bảng xếp hạng.</p><div className="boss-actions"><button type="button" className="boss-primary" onClick={()=>restart(false)}>Chơi lại 8 đòn</button>{wrong.length>0&&<button type="button" onClick={()=>restart(true)}>Ôn lại {wrong.length} đòn chưa đúng</button>}<button type="button" onClick={changeScope}>Đổi khối hoặc chương</button></div>{game.results.length>0&&<div className="boss-solutions"><h4>Lời giải các đòn đã gặp</h4>{game.results.map((hit,index)=>{const q=game.questions.find(item=>item.id===hit.questionId)!;return <details key={q.id} open={!hit.correct}><summary>Câu {index+1}: {hit.correct?'Đã đúng':'Cần ôn lại'} · {q.prompt}</summary><p>{hit.chosen===null?'Chưa dựng khiên kịp.':`Em đỡ đáp án ${q.answers[hit.chosen]}.`} Đáp án đúng: <strong>{q.answers[q.correct]}</strong>.</p><p>{q.explanation}</p><p><b>Mẹo:</b> {q.tip}</p></details>;})}</div>}</div>:<>
   <div className="boss-hud" aria-label="Thông số bảo vệ thư viện"><span>BOSS<strong>{game.health}/{game.maxHealth}</strong></span><span>TIM<strong aria-label={`${game.hearts} tim`}>{'♥'.repeat(game.hearts)}{'♡'.repeat(3-game.hearts)}</strong></span><span>COMBO<strong>×{game.combo}</strong></span><span>CÂU<strong>{game.cursor+1}/{game.questions.length}</strong></span></div>
   <div className="boss-question"><span>KHỐI {grade} · MỨC {question?.level} · {reduced?'KHÔNG GIỚI HẠN GIỜ':`CÒN ${Math.max(0,Math.ceil((1-game.progress)*bossDuration(game)))} GIÂY`}</span><p>{question?.prompt}</p></div>
   <ol className="boss-answer-guide" id={id+'-answers'} aria-label="Đáp án theo làn từ trái sang phải">{question?.answers.map((answer,index)=><li key={index} aria-current={game.lane===index?'true':undefined}><span>Làn {index+1}</span><strong>{answer}</strong>{game.lane===index&&<small>Khiên đang ở đây</small>}</li>)}</ol>
   <div ref={stage} tabIndex={0} className={`boss-stage${game.phase==='feedback'?(last?.correct?' boss-hit-good':' boss-hit-bad'):''}`} role="group" aria-label="Sân bảo vệ thư viện. Mũi tên trái phải để lái khiên, phím cách dựng khiên, P tạm dừng." aria-describedby={id+'-answers'}>
    <div className="boss-shelves" aria-hidden="true"><span>▥ ▤ ▥</span><span>▤ ▥ ▤</span></div><div className="boss-monster" aria-hidden="true"><BookBoss/></div><div className="boss-lanes" aria-hidden="true"><span/><span/></div>
    {question?.answers.map((answer,index)=><div className="boss-bolt" aria-hidden="true" key={`${question.id}-${index}`} style={{left:`${18+index*32}%`,top:`${reduced?42:30+game.progress*45}%`}}><span>✦</span><strong>{answer}</strong></div>)}
    <div className={'boss-player'+(game.guarding?' boss-guarding':'')} style={{left:`${18+game.x*32}%`}}><Shield/></div>
    {game.phase==='intro'&&<div className="boss-overlay"><div role="status"><h4>Boss đang mở sách!</h4><strong className="boss-countdown">{Math.max(1,3-Math.floor(game.intro))}</strong><p>Lái khiên, đọc kỹ điều kiện rồi đánh trả.</p><button type="button" onClick={()=>{if(samePhase())update(skipBossIntro(current.current));}}>Bỏ qua mở đầu</button></div></div>}
    {game.phase==='paused'&&<div className="boss-overlay"><div><h4 ref={pausedHeading} tabIndex={-1}>Khiên đã neo, thư viện đang nghỉ</h4><p>Đạn và đồng hồ đều dừng. Đổi tab cũng tự tạm dừng.</p><button type="button" className="boss-primary" onClick={resume}>Tiếp tục bảo vệ</button><button type="button" onClick={()=>{if(samePhase())update(finishBoss(current.current));}}>Kết thúc và xem lời giải</button></div></div>}
    {game.phase==='feedback'&&<div className="boss-overlay"><div className="boss-feedback"><h4 ref={feedbackHeading} tabIndex={-1}>{last?.correct?last.damage===2?'Combo căng đét, phản công gấp đôi!':'Đỡ chuẩn, Boss mất 1 máu!':'Mất 1 tim, mình gỡ lại nhé'}</h4><p>{question?.explanation}</p><p><b>Mẹo:</b> {question?.tip}</p><button type="button" className="boss-primary" onClick={()=>{if(samePhase())update(nextBoss(current.current));}}>{done?'Xem tổng kết bảo vệ':'Đòn tiếp theo'}</button></div></div>}
   </div>
   <div className="boss-controls"><button type="button" disabled={game.phase!=='running'||game.lane===0||game.guarding} onClick={()=>steer(-1)}>← Trái</button><button type="button" className="boss-primary" disabled={!canGuardBoss(game)} onClick={defend}>Dựng khiên</button><button type="button" disabled={game.phase!=='running'||game.lane===2||game.guarding} onClick={()=>steer(1)}>Phải →</button></div>
   <div className="boss-bottom"><p role="status" aria-live="polite">Khiên ở làn {game.lane+1}/3. {game.guarding?'Đã khóa làn, đòn đang va vào khiên!':game.phase==='running'?'Đọc kỹ đề, lái tới đáp án rồi dựng khiên.':''}</p><button type="button" disabled={!running} onClick={pause}>Tạm dừng Boss</button></div>
  </>}
  <footer>MTM sưu tầm và biên soạn · Nội dung tự ôn độc lập với tài liệu PDF. Lượt chơi chỉ giữ khi màn này mở, không lưu hay gửi dữ liệu học sinh.</footer>
 </section>;
}
