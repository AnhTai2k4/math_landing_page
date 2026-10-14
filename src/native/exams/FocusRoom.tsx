/// <reference path="./react-dom-portal.d.ts" />
import {lazy,Suspense,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Choice} from './assessment';
import type {PracticeAttemptProps} from './attempt-types';
import type {PracticeAttemptState} from './usePracticeAttempt';
import MtmSourceQuestion,{roomSourceDisplay} from './MtmSourceQuestion';
import {questionLabel,shortAnswerStatus,shortFormatMessage} from './attempt-ui';
import {MAX_SHORT_LENGTH} from './store';
import {localStore} from './local-store';
import {readAux,writeAux,roomShortcut,warningBand} from './room-aux';
import {RoomAnswerContext} from './RoomAnswerContext';
import {RoomQuestionContext} from './RoomQuestionContext';
import './focus-room.css';
const QuestionPdf=lazy(()=>import('./QuestionPdf'));

export default function FocusRoom({props,state,onExit}:{props:PracticeAttemptProps;state:PracticeAttemptState;onExit:()=>void}) {
  const {exam,displayTitle,questionReader,storeOverride}=props;
  const {draft,activeQuestion,setActiveQuestion,setQuestionFocus,seconds,answered,states,unsaved,notice,changeAnswer,pdfReady,setPdfReady,finish,confirmation}=state;
  const [aux,setAux]=useState(()=>readAux(storeOverride??localStore(),draft!.attemptId,exam.questions.length));
  const [menu,setMenu]=useState(false),[titleOpen,setTitleOpen]=useState(false);
  const [auxSaved,setAuxSaved]=useState(true),[sheet,setSheet]=useState(false),[help,setHelp]=useState(false),[tools,setTools]=useState(false),[full,setFull]=useState(false),[fullNotice,setFullNotice]=useState('');
  const host=useRef<HTMLDivElement>(null),sheetButton=useRef<HTMLButtonElement>(null),sheetPanel=useRef<HTMLElement>(null),previousActive=useRef<Element|null>(null),initial=useRef(true),restoring=useRef(true),touch=useRef<{x:number;y:number}|null>(null);
  useLayoutEffect(()=>{setActiveQuestion(aux.active);},[]);
  useEffect(()=>{
    if(initial.current){initial.current=false;return;}
    setAuxSaved(writeAux(storeOverride??localStore(),draft!.attemptId,aux));
  },[aux,draft!.attemptId,storeOverride]);
  useEffect(()=>{if(restoring.current){restoring.current=false;return;}setAux(a=>a.active===activeQuestion?a:{...a,active:activeQuestion});},[activeQuestion]);
  useEffect(()=>{
    const root=document.getElementById('root'),wasInert=root?.inert,overflow=document.documentElement.style.overflow;
    previousActive.current=document.activeElement;if(root)root.inert=true;document.documentElement.style.overflow='hidden';host.current?.focus();
    return()=>{if(root)root.inert=wasInert??false;document.documentElement.style.overflow=overflow;if(previousActive.current instanceof HTMLElement&&previousActive.current.isConnected)previousActive.current.focus({preventScroll:true});};
  },[]);
  useEffect(()=>{const sync=()=>setFull(!!host.current&&document.fullscreenElement===host.current);document.addEventListener('fullscreenchange',sync);return()=>{document.removeEventListener('fullscreenchange',sync);if(host.current&&document.fullscreenElement===host.current)void document.exitFullscreen().catch(()=>{});};},[]);
  // Thoát fullscreen để hộp xác nhận ở cổng body luôn nhìn thấy được.
  useEffect(()=>{if(confirmation&&host.current&&document.fullscreenElement===host.current)void document.exitFullscreen().catch(()=>{});},[confirmation]);
  const go=(index:number)=>{setActiveQuestion(Math.min(exam.questions.length-1,Math.max(0,index)));setQuestionFocus(true);setSheet(false);};
  const mark=()=>setAux(a=>({...a,marked:a.marked.includes(activeQuestion)?a.marked.filter(i=>i!==activeQuestion):[...a.marked,activeQuestion]}));
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(event.defaultPrevented||confirmation)return;
      if(event.key==='Escape'&&(sheet||help||tools||menu||titleOpen)){event.preventDefault();setSheet(false);setHelp(false);setTools(false);setMenu(false);setTitleOpen(false);sheetButton.current?.focus();return;}
      const editing=event.target instanceof Element&&!!event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
      const shortcut=roomShortcut(event,editing);if(!shortcut||sheet||help||tools||menu)return;
      const q=exam.questions[activeQuestion];
      if(shortcut==='arrowleft'){event.preventDefault();go(activeQuestion-1);}
      else if(shortcut==='arrowright'){event.preventDefault();go(activeQuestion+1);}
      else if(shortcut==='m'){event.preventDefault();mark();}
      else if(shortcut==='?'){event.preventDefault();setHelp(true);}
      else if(q.kind==='mc'&&pdfReady){event.preventDefault();changeAnswer(q.id,shortcut.toUpperCase() as Choice);}
    };
    document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);
  });
  useEffect(()=>{if(!sheet)return;sheetPanel.current?.querySelector<HTMLButtonElement>('button')?.focus();const key=(event:KeyboardEvent)=>{if(event.key!=='Tab')return;const buttons=Array.from(sheetPanel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[href],input,textarea')??[]),first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[sheet]);
  const band=warningBand(seconds),[warning,setWarning]=useState(''),lastBand=useRef(0);
  useEffect(()=>{if(band!==lastBand.current){lastBand.current=band;if(band)setWarning(`Còn ${band} phút. Hãy kiểm tra các câu chưa xong và câu đánh dấu.`);}},[band]);
  const toggleFull=async()=>{try{if(host.current&&document.fullscreenElement===host.current)await document.exitFullscreen();else if(host.current?.requestFullscreen)await host.current.requestFullscreen();else setFullNotice('Trình duyệt chưa hỗ trợ toàn màn hình. Phòng tập trung vẫn dùng bình thường.');}catch{setFullNotice('Chưa mở được toàn màn hình. Bài làm vẫn được giữ.');}};
  const nextMatching=(predicate:(i:number)=>boolean)=>{for(let n=1;n<=exam.questions.length;n++){const i=(activeQuestion+n)%exam.questions.length;if(predicate(i)){go(i);return;}}};
  const q=exam.questions[activeQuestion];
  const label=questionLabel(exam,activeQuestion);
  const answer=draft!.answers[q.id],tfAnswers=Array.isArray(answer)?answer:[null,null,null,null];
  const sourcePage=q.sourceContent?.questions[0]?.sourcePage??Number(q.sourceRef.match(/trang\s+(\d+)/i)?.[1]);
  const questionPage=exam.sourcePdf?.questionPages.includes(sourcePage)?sourcePage:undefined;
  const fullTitle=displayTitle??exam.title;
  const titleParts=fullTitle.split(/\s*[·–]\s*/);
  const titleSubtitle=titleParts.flatMap(part=>part.match(/^(Chương[^:]*|Bài\s+\d+)/i)?.[0]??[]).join(' · ');
  const shortTitle=titleParts.filter(part=>!/^Chương/i.test(part)).map(part=>part.replace(/^Bài\s+\d+\s*:\s*/i,'')).join(' · ')||fullTitle;
  const inlineChoices=q.kind==='mc'&&(!!roomSourceDisplay(q)?.choices?.length||!!questionReader&&!q.sourceContent);
  const answerStatus=q.kind==='mc'?(answer?`Đã chọn ${answer}`:'Chưa trả lời'):q.kind==='tf'?`${tfAnswers.filter(v=>typeof v==='boolean').length}/4 ý đã chọn`:shortAnswerStatus(q.mode,answer)==='invalid'?'Sai định dạng':typeof answer==='string'&&answer.trim()?`Đã nhập ${answer}`:'Chưa trả lời';
  const closeSheet=()=>{setSheet(false);sheetButton.current?.focus();};
  return createPortal(<div ref={host} tabIndex={-1} className={`ep-root fr-room${aux.dark?' fr-dark':''}`} aria-label="Phòng làm bài tập trung" style={{'--fr-font':aux.font} as React.CSSProperties}>
    <header className="fr-top"><div className="fr-brand"><span className="fr-brand-symbol"><img src="/mtm-original-logo-420w.webp" alt="Minh Thành Math" width="160" height="30"/></span><b aria-hidden="true">MTM</b></div><div className="fr-title"><button className="fr-title-button" aria-label={`Xem tên đầy đủ: ${fullTitle}`} aria-expanded={titleOpen} onClick={()=>setTitleOpen(v=>!v)}><strong title={fullTitle}><span className="fr-title-long">{fullTitle}</span><span className="fr-title-short">{shortTitle}</span></strong></button><small>{titleSubtitle||'Minh Thành Math'}</small></div><time className={`fr-clock fr-band-${band}`} role="timer" aria-label="Thời gian còn lại" aria-live="off"><small>THỜI GIAN CÒN LẠI</small><strong>{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</strong></time><div className="fr-progress"><span>{answered}/{exam.questions.length} câu đã làm</span><progress max={exam.questions.length} value={answered}/></div><button className={`fr-submit${answered===exam.questions.length||seconds<=300?' is-ready':''}`} disabled={!pdfReady} onClick={()=>finish(false)}>Nộp bài</button><button className="fr-menu-toggle" aria-label="Tiện ích phòng làm bài" aria-expanded={menu} aria-controls="fr-actions" onClick={()=>setMenu(v=>!v)}><span aria-hidden="true">⋯</span><span className="fr-menu-label">Tiện ích</span></button><div id="fr-actions" className={`fr-actions${menu?' is-open':''}`}><button className="fr-menu-title" onClick={()=>{setTitleOpen(true);setMenu(false);}}>Tên đề: {fullTitle}</button><button onClick={()=>{void toggleFull();setMenu(false);}}>{full?'Thoát toàn màn hình':'Toàn màn hình'}</button><button onClick={onExit}>Thoát tập trung</button><button disabled={!pdfReady} onClick={()=>{setMenu(false);finish(false);}}>Nộp bài</button><button aria-expanded={tools} onClick={()=>{setTools(v=>!v);setMenu(false);}}>Tiện ích</button><button aria-expanded={help} onClick={()=>{setHelp(v=>!v);setMenu(false);}}>Phím tắt ?</button></div></header>
    {titleOpen&&<section className="fr-tool-panel" aria-label="Tên đầy đủ của đề"><strong>{fullTitle}</strong><button onClick={()=>setTitleOpen(false)}>Đóng tên đề</button></section>}
    {(notice||unsaved)&&<p className="fr-notice" role="alert">{notice||'Chưa xác nhận lưu bài. Hãy giữ trang mở và tải bản lưu.'}{unsaved&&<button onClick={()=>{onExit();}}>Mở bản lưu bài làm</button>}</p>}
    <p className="fr-warning" role="status">{[warning,fullNotice,!auxSaved?'Chưa lưu được ghi chú và dấu xem lại; bài làm được lưu riêng.':''].filter(Boolean).join(' ')}</p>
    {help&&<section className="fr-tool-panel" aria-label="Phím tắt"><strong>Thao tác nhanh</strong><p>A / B / C / D: chọn đáp án · ← / →: đổi câu · M: đánh dấu · ?: trợ giúp. Phím tắt tạm ngừng khi nhập văn bản. Esc đóng bảng phụ hoặc thoát toàn màn hình, không mất bài.</p><button onClick={()=>setHelp(false)}>Đóng hướng dẫn</button></section>}
    {tools&&<section className="fr-tool-panel" aria-label="Tiện ích phòng làm bài"><label>Cỡ chữ <select value={aux.font} onChange={e=>setAux(a=>({...a,font:Number(e.target.value)}))}><option value="1">100%</option><option value="1.15">115%</option><option value="1.3">130%</option></select></label><button aria-pressed={aux.dark} onClick={()=>setAux(a=>({...a,dark:!a.dark}))}>Nền tối {aux.dark?'bật':'tắt'}</button><label className="fr-notes">Nháp chữ riêng · {questionLabel(exam,activeQuestion).full}<textarea maxLength={2000} value={aux.notes[activeQuestion]??''} onChange={e=>{const text=e.target.value;setAux(a=>({...a,notes:{...a.notes,[activeQuestion]:text}}));}} placeholder="Chỉ lưu trên trình duyệt này. Không ghi thông tin cá nhân."/></label><small>Nháp chữ không được chấm, không gửi lên máy chủ.</small><button onClick={()=>setTools(false)}>Đóng tiện ích</button></section>}
    <aside ref={sheetPanel} className={`fr-sheet${sheet?' is-open':''}`} role={sheet?'dialog':undefined} aria-modal={sheet||undefined} aria-label="Phiếu trả lời"><div className="fr-sheet-title"><h2>Bảng câu <small> {answered}/{exam.questions.length} đã làm</small></h2><button className="fr-sheet-close" onClick={closeSheet}>Đóng</button></div>
      <p className="fr-legend">○ Chưa làm · ● Đã làm · ◐ Làm dở · ★ Xem lại</p>
      {state.sections.map((part,partIndex)=><section key={part.name}><h3 title={part.name} aria-label={part.name}>{part.name.match(/^I{1,3}(?=\s|$|[\u00b7.])/u)?.[0]??String(partIndex+1)}</h3><nav className="fr-grid" aria-label={part.name}>{exam.questions.slice(part.from,part.to).map((question,j)=>{const index=part.from+j,marked=aux.marked.includes(index),status=states[index],label=status==='answered'?'đã làm':status==='partial'?'làm dở':status==='invalid'?'sai định dạng':'chưa làm';return <button key={question.id} aria-current={activeQuestion===index?'step':undefined} className={`fr-${status}${marked?' fr-marked':''}`} aria-label={`${questionLabel(exam,index).full}: ${label}${marked?', đánh dấu xem lại':''}`} onClick={()=>go(index)}>{j+1}{marked?' ★':status==='partial'?' ◐':status==='invalid'?' !':''}</button>;})}</nav></section>)}
      <button className="fr-sheet-submit" disabled={!pdfReady} onClick={()=>{closeSheet();finish(false);}}>Nộp bài</button><button className="fr-wide" disabled={states.every(s=>s==='answered')} onClick={()=>nextMatching(i=>states[i]!=='answered')}>Đến câu chưa xong</button><button className="fr-wide" disabled={!aux.marked.length} onClick={()=>nextMatching(i=>aux.marked.includes(i))}>Xem câu đánh dấu ({aux.marked.length})</button><p className="fr-local">Tự luyện trên thiết bị này.<br/>Điểm không phải kết quả xác thực.</p>
    </aside>
    <main className={`fr-workspace${exam.sourcePdf?' fr-pdf-workspace':''}`}><section className="fr-paper" aria-label="Đề và trả lời" onErrorCapture={event=>{if(event.target instanceof HTMLImageElement&&event.target.closest('.mtm-source-content')){setPdfReady(false);state.setNotice('Có phần câu hỏi chưa tải được. Bài đang nhập vẫn được giữ; hãy tải lại để đọc đủ đề.');}}} onTouchStart={event=>{if(event.touches.length!==1||event.target instanceof Element&&event.target.closest('input,textarea,select,button,a,canvas,.ep-pdf-sheet,.ep-zoomable,.ep-zoom-row')){touch.current=null;return;}touch.current={x:event.touches[0].clientX,y:event.touches[0].clientY};}} onTouchEnd={event=>{const start=touch.current;touch.current=null;if(!start||event.changedTouches.length!==1)return;const dx=event.changedTouches[0].clientX-start.x,dy=event.changedTouches[0].clientY-start.y;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.7)go(activeQuestion+(dx<0?1:-1));}}>
      <div className="fr-question-heading" id={`ep-question-${activeQuestion}`} tabIndex={-1}><span>Câu {label.number} · {(q.maxMillipoints/1000).toLocaleString('vi-VN')} điểm</span><small title={label.part}>{q.kind==='mc'?'Trắc nghiệm':q.kind==='tf'?'Đúng / Sai':'Trả lời ngắn'} · {label.part.split(' · ')[0].replace(/^(I{1,3})$/, 'Phần $1')}</small><button aria-label={aux.marked.includes(activeQuestion)?'Bỏ đánh dấu xem lại':'Đánh dấu để xem lại'} title="Đánh dấu để xem lại" aria-pressed={aux.marked.includes(activeQuestion)} onClick={mark}><span aria-hidden="true">{aux.marked.includes(activeQuestion)?'★':'☆'}</span><span className="fr-mark-label">{aux.marked.includes(activeQuestion)?' Đã đánh dấu':' Đánh dấu để xem lại'}</span></button></div>
      <RoomAnswerContext.Provider value={{questionId:q.id,answer,disabled:!pdfReady,choose:choice=>changeAnswer(q.id,answer===choice?null:choice)}}><RoomQuestionContext.Provider value={activeQuestion}>{questionReader||<>{(q.prompt||q.text)&&<p className="ep-source-text">{props.renderText?props.renderText(q.prompt??q.text!):q.prompt??q.text}</p>}<MtmSourceQuestion question={q}/></>}</RoomQuestionContext.Provider>
      {exam.sourcePdf&&<div className="fr-pdf-document"><Suspense fallback={<p role="status">Đang mở bản câu hỏi…</p>}><QuestionPdf file={exam.sourcePdf} title={exam.title} onReady={setPdfReady} targetPage={questionPage} allowFullscreen={false} compact/>{!questionPage&&<p>Chưa có vị trí trang cho câu này; chọn trang bằng nút trên bản đề.</p>}</Suspense></div>}
      {!inlineChoices&&<section className="fr-quick" aria-label={`Trả lời ${label.full}`}>
      <fieldset disabled={!pdfReady}><legend className="fr-sr-only">Câu {label.number} · Trả lời nhanh</legend>
        {q.kind==='mc'&&!inlineChoices&&<div className={`fr-quick-mc${!q.sourceContent&&!exam.sourcePdf?' fr-text-choices':''}`}>{(['A','B','C','D'] as Choice[]).map((choice,i)=><button key={choice} aria-label={`Chọn ${choice}`} aria-pressed={answer===choice} onClick={()=>changeAnswer(q.id,answer===choice?null:choice)}><span className="fr-choice-letter" aria-hidden="true">{choice}</span>{!q.sourceContent&&!exam.sourcePdf&&q.kind==='mc'&&q.choices[i]!==choice&&<span>{props.renderText?props.renderText(q.choices[i]):q.choices[i]}</span>}<span className="fr-choice-tick" aria-hidden="true">✓</span></button>)}</div>}
        {q.kind==='tf'&&<div className="fr-quick-tf">{['a','b','c','d'].map((letter,i)=><div key={letter} role="group" aria-label={`Ý ${letter}`}><span>{letter})</span>{q.kind==='tf'&&q.statements?.[i]&&<p>{props.renderText?props.renderText(q.statements[i]):q.statements[i]}</p>}{[true,false].map(value=><button key={String(value)} aria-label={`Ý ${letter}: ${value?'Đúng':'Sai'}`} aria-pressed={tfAnswers[i]===value} onClick={()=>{const next=[...tfAnswers] as (boolean|null)[];next[i]=next[i]===value?null:value;changeAnswer(q.id,next);}}>{value?'Đúng':'Sai'}</button>)}</div>)}</div>}
        {q.kind==='short'&&<><label htmlFor="fr-quick-short">Đáp án</label><input id="fr-quick-short" className="ep-short" type="text" inputMode={q.kind==='short'&&q.mode==='numeric'?'decimal':'text'} maxLength={MAX_SHORT_LENGTH} autoComplete="off" spellCheck={false} value={typeof answer==='string'?answer:''} aria-invalid={shortAnswerStatus(q.mode,answer)==='invalid'||undefined} aria-describedby="fr-quick-format" onChange={event=>changeAnswer(q.id,event.target.value)}/><small id="fr-quick-format" aria-live="polite">{shortAnswerStatus(q.mode,answer)==='invalid'?shortFormatMessage(q.mode):q.mode==='numeric'?'Nhập số, dùng dấu phẩy hoặc dấu chấm.':q.mode==='rational'?'Nhập số hoặc phân số, ví dụ -3/4.':'Nhập chính xác, phân biệt chữ hoa/thường.'}</small></>}
      </fieldset>
    </section>}
<p className="fr-source-credit">MTM sưu tầm và biên soạn</p></RoomAnswerContext.Provider><nav className="fr-navigation" aria-label="Điều hướng câu"><button aria-label="Câu trước" disabled={activeQuestion===0} onClick={()=>go(activeQuestion-1)}>← Câu trước</button><button aria-label="Câu sau" disabled={activeQuestion===exam.questions.length-1} onClick={()=>go(activeQuestion+1)}>Câu tiếp →</button><span>{answerStatus} · {unsaved?'Chưa lưu bài':'Đã lưu'}</span></nav>
    </section></main>
    {sheet&&<button className="fr-scrim" aria-label="Đóng phiếu trả lời" onClick={closeSheet} tabIndex={-1}/>}
    <div className="fr-answer-dock"><nav className="fr-mobile-nav" aria-label="Điều hướng câu trên điện thoại"><button disabled={activeQuestion===0} onClick={()=>go(activeQuestion-1)}>← Trước</button><button className="fr-sheet-toggle" ref={sheetButton} aria-label="Mở phiếu trả lời" aria-expanded={sheet} aria-haspopup="dialog" onClick={()=>setSheet(v=>!v)}>{activeQuestion+1}/{exam.questions.length} {aux.marked.includes(activeQuestion)?'★ ':''}▦</button><button disabled={activeQuestion===exam.questions.length-1} onClick={()=>go(activeQuestion+1)}>Sau →</button></nav><small>{answerStatus} · {unsaved?'Chưa lưu bài':'Đã lưu'}</small></div>
  </div>,document.body);
}
