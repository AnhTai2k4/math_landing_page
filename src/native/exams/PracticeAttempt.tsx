import {examSections} from './flexible-profile';
import {lazy,Suspense,useCallback, useEffect, useRef, useState} from 'react';
import {Link} from '../../migration/navigation';
import type {Choice} from './assessment';
import {PERIOD_LABELS, type PracticeExam} from './data';
import {createDraft, matchingStorageEvent, retakeDraft, isAnswered, MAX_SHORT_LENGTH, readDraft, remainingMs, saveDraft, submitDraft, validateDraft, type Draft, type Response, type Store} from './store';
import {resultFor} from './result';
import {useUnsavedGuard} from './navigation-guard';
import ExamConfirm from './ExamConfirm';
import ExamReview from './ExamReview';
import {SOURCE_HOLDS} from './source-holds';
import {erratumFor} from './practice-errata';

export function localStore(): Store | null {
  try { return window.localStorage; } catch { return null; }
}
const letters: Choice[] = ['A', 'B', 'C', 'D'];
const statementLetters = ['a', 'b', 'c', 'd'];
const QuestionPdf=lazy(()=>import('./QuestionPdf'));
const formatPoints = (millipoints: number) => (millipoints / 1000).toLocaleString('vi-VN', {maximumFractionDigits: 3});
function displayAnswer(value: Response | undefined): string {
  if (Array.isArray(value)) return value.map((entry, i) => `${statementLetters[i]}) ${entry === null ? 'Chưa trả lời' : entry ? 'Đúng' : 'Sai'}`).join('; ');
  return typeof value === 'string' && value.trim() ? value : 'Chưa trả lời';
}
function exportDraft(draft: Draft): boolean {
  let url: string | undefined;
  try {
    url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], {type: 'application/json'}));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bai-lam-${draft.examId}-${draft.startedAt}.json`;
    anchor.click();
    const exportedUrl = url;
    window.setTimeout(() => URL.revokeObjectURL(exportedUrl), 1000);
    return true;
  } catch { if (url) URL.revokeObjectURL(url); return false; }
}

export default function PracticeAttempt({exam,previousExam,catalogUrl,storeOverride}: {exam: PracticeExam; previousExam?:PracticeExam; catalogUrl: string; storeOverride?:Store}) {
  const getStore=useCallback(()=>storeOverride??localStore(),[storeOverride]);
  const sourceIssue=SOURCE_HOLDS[exam.id];
  const erratum=erratumFor(exam.id);
  const [acceptedErratum,setAcceptedErratum]=useState(false);
  const [legacy]=useState(()=>previousExam?readDraft(getStore(),previousExam):null);
  const [initial] = useState(() => readDraft(getStore(), exam));
  const persisted = useRef<Draft | null>(initial.ok ? initial.value : null);
  const ram = useRef<Draft | null>(initial.ok && initial.value && initial.value.submittedAt !== null ? initial.value : null);
  const dirty = useRef(false), conflict = useRef(false);
  const [draft, setDraft] = useState<Draft | null>(ram.current);
  const [notice, setNotice] = useState(initial.ok ? '' : initial.message);
  const [unsaved, setUnsaved] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [exportNotice, setExportNotice] = useState('');
  const [pdfReady,setPdfReady]=useState(!exam.sourcePdf);
  const [confirmation,setConfirmation]=useState<'submit'|'retake'|null>(null);
  const [activeQuestion,setActiveQuestion]=useState(0),[questionFocus,setQuestionFocus]=useState(false),[mobilePane,setMobilePane]=useState<'pdf'|'answers'>(ram.current?.submittedAt!=null?'answers':'pdf');
  useEffect(()=>{if(questionFocus){const target=document.getElementById(`ep-question-${activeQuestion}`);target?.focus();setQuestionFocus(false);}},[activeQuestion,questionFocus]);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (draft?.submittedAt != null) resultHeading.current?.focus();
  }, [draft?.attemptId, draft?.submittedAt]);
  const leaveConfirmation=useUnsavedGuard(() => dirty.current);

  const persist = useCallback((next: Draft) => {
    // RAM is authoritative for this mounted attempt, even when storage refuses.
    ram.current = next;
    if (conflict.current) {
      dirty.current = true;
      setUnsaved(true);
      setNotice('Bản lưu đã thay đổi ở nơi khác. Câu trả lời trên trang này được giữ nguyên và chưa được lưu. Hãy xuất bài làm trước khi rời trang.');
    } else {
      const saved = saveDraft(getStore(), exam, next, persisted.current);
      dirty.current = !saved.ok;
      setUnsaved(!saved.ok);
      if (saved.ok) { persisted.current = saved.value; setNotice(''); }
      else {
        if (saved.code === 'conflict' || saved.code === 'version') conflict.current = true;
        setNotice(saved.message);
      }
    }
    setDraft(next);
  }, [exam,getStore]);

  useEffect(() => {
    const captured=getStore();
    const changed = (event: StorageEvent) => {
      if (!matchingStorageEvent(event,captured,exam.id)) return;
      conflict.current = true;
      if (ram.current) { dirty.current = true; setUnsaved(true); }
      setNotice('Bản lưu đã thay đổi hoặc bị xóa ở cửa sổ khác. Bài đang mở được giữ nguyên. Hãy xuất bài làm trước khi tải lại trang.');
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [exam.id,getStore]);

  const finish = useCallback((automatic: boolean, confirmed=false) => {
    const current = ram.current;
    if (!current || current.submittedAt !== null) return;
    const clock = Date.now();
    const unanswered = exam.questions.filter(q => !isAnswered(exam, q.id, current.answers)).length;
    if (!automatic && remainingMs(current, clock) > 0 && unanswered > 0 && !confirmed) {setConfirmation('submit');return;}
    const result = submitDraft(exam, current, Date.now());
    if (!result.ok) { setNotice(result.message); return; }
    setConfirmation(null);setMobilePane('answers');
    persist(result.value); // Sets the ref synchronously before another click/tick.
  }, [exam, persist]);

  useEffect(() => {
    if (!draft || draft.submittedAt !== null) return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 500);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(interval); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick); };
  }, [draft?.attemptId, draft?.submittedAt]);
  useEffect(() => {
    if (draft && draft.submittedAt === null && remainingMs(draft, now) === 0) finish(true);
  }, [draft, now, finish]);

  const begin = () => {
    if(sourceIssue||(erratum&&!acceptedErratum))return;
    if(!pdfReady){setNotice('Chưa mở làm bài khi bản câu hỏi chưa hiển thị.');return;}
    if (ram.current) return;
    const old = persisted.current;
    if (old) {
      if (old.submittedAt !== null) { persist(old); return; }
      const resumed = validateDraft({...old, updatedAt: Math.max(old.updatedAt, Date.now()), revision: old.revision + 1}, exam);
      if (resumed.ok) persist(resumed.value); else setNotice(resumed.message);
    } else {
      const attemptId = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const made = createDraft(exam, attemptId, Date.now());
      if (made.ok) persist(made.value); else setNotice(made.message);
    }
    setNow(Date.now());setMobilePane('answers');
  };
  const changeAnswer = (id: string, answer: Response) => {
    if(!pdfReady)return;
    const current = ram.current;
    if (!current || current.submittedAt !== null) return;
    const clock = Date.now();
    if (remainingMs(current, clock) === 0) { finish(true); return; }
    const next = validateDraft({...current, answers: {...current.answers, [id]: answer}, updatedAt: Math.max(clock, current.updatedAt), revision: current.revision + 1}, exam);
    if (!next.ok) { setNotice(next.message); return; }
    persist(next.value);
  };
  const submitted = !!draft && draft.submittedAt !== null;
  const result = draft && submitted ? resultFor(exam, draft) : null;
  const score = result?.score;
  const sections=examSections(exam);
  const answered = draft ? exam.questions.filter(q => isAnswered(exam, q.id, draft.answers)).length : 0;
  const seconds = draft ? Math.ceil(remainingMs(draft, now) / 1000) : 0;
  const retake=(confirmed=false)=>{
    if(sourceIssue)return;
    const old=ram.current;if(!old||old.submittedAt===null||dirty.current||conflict.current)return;
    if(!pdfReady)return;
    if(!confirmed){setConfirmation('retake');return;}
    setConfirmation(null);setActiveQuestion(0);setMobilePane('answers');
    const id=typeof crypto.randomUUID==='function'?crypto.randomUUID():`local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const next=retakeDraft(getStore(),exam,old,id,Date.now());
    if(!next.ok){setNotice(next.message);return;}
    persisted.current=next.value;ram.current=next.value;setDraft(next.value);setNow(Date.now());setNotice('');setExportNotice('');setUnsaved(false);
  };

  return <section className="ep-attempt">{leaveConfirmation}
    <Link className="ep-link" href={catalogUrl}>← Danh sách đề</Link>
    <header><p>Lớp {exam.grade} · {PERIOD_LABELS[exam.period]}</p><h1>{exam.title}</h1><p>{exam.questions.length} câu · {exam.durationMinutes} phút · Thang điểm 10</p></header>
    {notice&&<p className="ep-notice" role="alert">{notice}</p>}
    {erratum&&<div className="ep-notice"><strong>Bản luyện tập MTM đính chính v37 · điều kiện áp dụng khi chấm</strong><p>{erratum.condition}</p><p>Thành đã duyệt đính chính này. PDF nguồn giữ nguyên; lượt mới dùng mã phiên bản riêng. Lịch sử cũ giữ điểm theo khóa trước đính chính.</p>{<label className="ep-erratum-accept"><input type="checkbox" checked={acceptedErratum} onChange={event=>setAcceptedErratum(event.target.checked)}/> Tôi đã đọc điều kiện đính chính và làm bài theo điều kiện này.</label>}{legacy?.ok&&legacy.value&&<p>Đã giữ bản lưu trước đính chính. {legacy.value.submittedAt===null?<button type="button" onClick={()=>setExportNotice(exportDraft(legacy.value!)?'Đã yêu cầu tải bản bài cũ.':'Chưa xuất được; hãy giữ trang mở.')}>Xuất bài cũ đang làm</button>:<Link href={catalogUrl}>Xem lượt cũ trong lịch sử</Link>}</p>}</div>}
    {sourceIssue&&<div className="ep-notice" role="alert"><strong>Đề đang chờ đính chính · tạm ngừng lượt mới.</strong><p>{sourceIssue}</p><p>PDF gốc và lịch sử cũ được giữ. Điểm cũ dùng khóa trước khi phát hiện vấn đề này; cần đọc phần đối chiếu để hiểu giới hạn của kết quả.</p>{persisted.current&&persisted.current.submittedAt===null&&<button type="button" onClick={()=>setExportNotice(exportDraft(persisted.current!)?'Đã yêu cầu tải bản bài làm đang lưu.':'Chưa xuất được; hãy giữ trang mở.')}>Xuất bài đang làm để giữ bản cũ</button>}</div>}
    {unsaved&&<p className="ep-notice" role="status">Chưa xác nhận bài làm được lưu bền vững trên trình duyệt. Câu trả lời vẫn giữ trên trang. Hãy xuất JSON trước khi đóng hoặc tải lại trang.</p>}
    <div className="ep-mobile-panes" role="group" aria-label="Chọn vùng làm bài"><button type="button" aria-pressed={mobilePane==='pdf'} onClick={()=>setMobilePane('pdf')}>Đọc đề PDF</button><button type="button" aria-pressed={mobilePane==='answers'} onClick={()=>setMobilePane('answers')}>{submitted?'Kết quả và lời giải':'Phiếu trả lời'}</button>{draft&&!submitted&&<span className="ep-mobile-timer" role="timer" aria-label="Thời gian còn lại" aria-live="off">Còn {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</span>}</div>
    <div className={`ep-exam-layout ep-pane-${mobilePane}`}>
      <div className="ep-pdf-pane">
        {exam.sourcePdf&&<Suspense fallback={<p role="status">Đang mở bản câu hỏi…</p>}><QuestionPdf file={exam.sourcePdf} title={exam.title} onReady={setPdfReady}/></Suspense>}
        {exam.sourcePdf&&!pdfReady&&<p><a href={exam.sourceUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Xem nguồn để đối chiếu</a> · Nguồn gốc có thể chứa đáp án hoặc mã đề khác; chưa mở làm bài khi không xem được bản câu hỏi.</p>}
      </div>
      <div className="ep-answer-pane" aria-label={submitted?'Kết quả bài làm':'Phiếu trả lời'}>
        {!draft?<section className="ep-card">
          <h2>Phiếu trả lời</h2><p>{storeOverride?'Bản xem thử chỉ giữ trong bộ nhớ của trang quản trị, không ghi lịch sử học sinh.':'Bài làm và kết quả lưu trên trình duyệt này. Thời gian tiếp tục tính khi bạn rời trang.'}</p>
          <p>{sections.map(s=>`${s.name}: ${s.count} câu`).join(' · ')}</p>
          {persisted.current&&<p>Đã có bài đang làm. Hạn nộp: {new Date(persisted.current.deadline).toLocaleString('vi-VN')}.</p>}
          <button type="button" className="ep-primary ep-wide" disabled={!pdfReady||!!sourceIssue||!!erratum&&!acceptedErratum} onClick={begin}>{sourceIssue?'Chờ đính chính điều kiện':persisted.current?'Tiếp tục làm bài':'Bắt đầu làm bài'}</button>
        </section>:<>
          <div className="ep-toolbar ep-answer-toolbar">
            {submitted?<strong role="status">{unsaved?'Đã nộp trên trang · chưa xác nhận lưu':'Đã nộp và lưu kết quả'}</strong>:<><span role="timer" aria-label="Thời gian còn lại" aria-live="off">Còn {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</span><span>{answered}/{exam.questions.length} câu đã trả lời đầy đủ</span></>}
          </div>
          {submitted?<>
            <section className="ep-card" aria-label="Kết quả"><h2 ref={resultHeading} tabIndex={-1}>Kết quả luyện tập</h2>{score?.ok?<p className="ep-score">{formatPoints(score.earnedMillipoints)} / 10</p>:<p role="alert">Chưa tính được điểm. Bài làm vẫn giữ nguyên để đối chiếu.</p>}
              <p>Nộp lúc {new Date(draft.submittedAt!).toLocaleString('vi-VN')}.</p>{exam.answerVerificationNote&&<p>{exam.answerVerificationNote}</p>}
              <a className="ep-link" href={exam.sourceUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Nguồn đề và đáp án đối chiếu</a><p><Link className="ep-link" href={catalogUrl}>Trở về danh sách đề</Link></p>
              <button type="button" disabled={unsaved||conflict.current||!pdfReady||!!sourceIssue||!!erratum&&!acceptedErratum} onClick={()=>retake()}>Làm lại đề · giữ bài cũ trong lịch sử</button>
            </section>
            <ExamReview key={draft.attemptId} exam={exam} draft={draft}/>
          </>:<>
            <h2>Phiếu trả lời</h2>
            <nav aria-label="Chuyển đến câu hỏi">{sections.map(part=><section key={part.name}><h3>{part.name}</h3><div className="ep-question-nav">{exam.questions.slice(part.from,part.to).map((q,j)=>{const index=part.from+j;return <button type="button" key={q.id} className={isAnswered(exam,q.id,draft.answers)?'is-answered':''} aria-current={activeQuestion===index?'step':undefined} aria-label={`${part.name}, câu ${j+1}: ${isAnswered(exam,q.id,draft.answers)?'đã trả lời đầy đủ':'chưa trả lời đầy đủ'}`} onClick={()=>{setActiveQuestion(index);setQuestionFocus(true);}}>{j+1}</button>;})}</div></section>)}</nav>
            <p className="ep-source-ref">Ô tô màu: đã trả lời đầy đủ. Viền nổi: câu đang chọn.</p>
            {exam.questions.map((q,index)=>{
              if(index!==activeQuestion)return null;
              const answer=draft.answers[q.id],tfAnswers=Array.isArray(answer)?answer:[null,null,null,null];
              const section=sections.find(s=>index>=s.from&&index<s.to)!,part=section.name,number=index-section.from+1;
              return <section className="ep-question ep-card" key={q.id} id={`ep-question-${index}`} tabIndex={-1} aria-labelledby={`ep-heading-${index}`}>
                <h3 id={`ep-heading-${index}`}>{part} · Câu {number} <small>({formatPoints(q.maxMillipoints)} điểm)</small></h3>
                {(q.prompt||q.text)&&<p className="ep-source-text">{q.prompt??q.text}</p>}<p className="ep-source-ref">{q.sourceRef}</p>
                {q.kind==='mc'&&<fieldset disabled={!pdfReady} className="ep-mc-grid"><legend>Chọn đáp án câu {number}</legend>{q.choices.map((choice,i)=><label className={`ep-option ${answer===letters[i]?'is-selected':''}`} key={letters[i]}><input type="radio" name={`ep-mc-${index}`} value={letters[i]} checked={answer===letters[i]} onChange={()=>changeAnswer(q.id,letters[i])}/><span>{letters[i]}{choice!==letters[i]?`. ${choice}`:''}</span>{answer===letters[i]&&<span aria-hidden="true">✓</span>}</label>)}<button type="button" className="ep-clear-answer" onClick={()=>changeAnswer(q.id,null)}>Bỏ chọn</button></fieldset>}
                {q.kind==='tf'&&<div>{statementLetters.map((letter,i)=><fieldset key={letter} disabled={!pdfReady}><legend className="ep-source-text">Ý {letter}: {q.statements?.[i]??`${q.sourceRef}, ý ${letter}`}</legend>{[true,false,null].map(value=><label className={`ep-tf-option ${tfAnswers[i]===value?'is-selected':''}`} key={String(value)}><input type="radio" name={`ep-tf-${index}-${i}`} checked={tfAnswers[i]===value} onChange={()=>{const next=[...tfAnswers] as (boolean|null)[];next[i]=value;changeAnswer(q.id,next);}}/>{value===null?'Chưa chọn':value?'Đúng':'Sai'}</label>)}</fieldset>)}</div>}
                {q.kind==='short'&&<div><label htmlFor={`ep-short-${index}`}>Trả lời câu {number}</label><input id={`ep-short-${index}`} className="ep-short" type="text" disabled={!pdfReady} maxLength={MAX_SHORT_LENGTH} autoComplete="off" spellCheck={false} value={typeof answer==='string'?answer:''} aria-describedby={`ep-help-${index}`} onChange={event=>changeAnswer(q.id,event.target.value)}/><p id={`ep-help-${index}`}>{q.mode==='numeric'?'Nhập số thập phân bằng dấu phẩy hoặc dấu chấm; không nhập biểu thức hoặc phân số.':q.mode==='rational'?'Nhập số nguyên, số thập phân hoặc phân số, ví dụ -3/4; không nhập đơn vị hay biểu thức.':'Nhập câu trả lời chính xác theo yêu cầu đề (phân biệt chữ hoa/thường).'}</p></div>}
              </section>;
            })}
            <div className="ep-question-step"><button type="button" disabled={activeQuestion===0} onClick={()=>{setActiveQuestion(i=>i-1);setQuestionFocus(true);}}>Câu trước</button><button type="button" disabled={activeQuestion===exam.questions.length-1} onClick={()=>{setActiveQuestion(i=>i+1);setQuestionFocus(true);}}>Câu tiếp</button></div>
            <div className="ep-submit-row"><Link className="ep-link" href={catalogUrl}>Rời bài thi</Link><button type="button" className="ep-primary" onClick={()=>finish(false)}>Nộp bài</button></div>
          </>}
          <div className="ep-toolbar"><button type="button" onClick={()=>setExportNotice(exportDraft(draft)?'Đã yêu cầu tải tệp JSON bài làm.':'Chưa xuất được tệp. Hãy giữ trang mở và thử lại.')}>Xuất bài làm JSON</button>{unsaved&&!conflict.current&&<button type="button" onClick={()=>persist(draft)}>Thử lưu lại</button>}</div>
        </>}
      </div>
    </div>
    {exportNotice&&<p role="status">{exportNotice}</p>}
    {confirmation&&<ExamConfirm title={confirmation==='submit'?'Nộp bài chưa hoàn thành?':'Làm một lượt mới?'} message={confirmation==='submit'?`Còn ${exam.questions.length-answered} câu chưa trả lời đầy đủ. Nộp bài sẽ kết thúc lượt làm này.`:'Bài đã nộp giữ trong lịch sử trước khi bắt đầu lượt mới.'} confirmLabel={confirmation==='submit'?'Nộp bài':'Bắt đầu lượt mới'} onCancel={()=>setConfirmation(null)} onConfirm={()=>confirmation==='submit'?finish(false,true):retake(true)}/>}
  </section>;
}
