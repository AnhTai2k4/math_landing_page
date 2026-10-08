import {lazy,Suspense,useCallback, useEffect, useRef, useState} from 'react';
import {Link} from '../../migration/navigation';
import type {Choice} from './assessment';
import {PERIOD_LABELS, type PracticeExam} from './data';
import {createDraft, matchingStorageEvent, retakeDraft, isAnswered, MAX_SHORT_LENGTH, readDraft, remainingMs, saveDraft, submitDraft, validateDraft, type Draft, type Response, type Store} from './store';
import {resultFor} from './result';
import {useUnsavedGuard} from './navigation-guard';
import ExamConfirm from './ExamConfirm';

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

export default function PracticeAttempt({exam, catalogUrl}: {exam: PracticeExam; catalogUrl: string}) {
  const [initial] = useState(() => readDraft(localStore(), exam));
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
  useUnsavedGuard(() => dirty.current);

  const persist = useCallback((next: Draft) => {
    // RAM is authoritative for this mounted attempt, even when storage refuses.
    ram.current = next;
    if (conflict.current) {
      dirty.current = true;
      setUnsaved(true);
      setNotice('Bản lưu đã thay đổi ở nơi khác. Câu trả lời trên trang này được giữ nguyên và chưa được lưu. Hãy xuất bài làm trước khi rời trang.');
    } else {
      const saved = saveDraft(localStore(), exam, next, persisted.current);
      dirty.current = !saved.ok;
      setUnsaved(!saved.ok);
      if (saved.ok) { persisted.current = saved.value; setNotice(''); }
      else {
        if (saved.code === 'conflict' || saved.code === 'version') conflict.current = true;
        setNotice(saved.message);
      }
    }
    setDraft(next);
  }, [exam]);

  useEffect(() => {
    const captured=localStore();
    const changed = (event: StorageEvent) => {
      if (!matchingStorageEvent(event,captured,exam.id)) return;
      conflict.current = true;
      if (ram.current) { dirty.current = true; setUnsaved(true); }
      setNotice('Bản lưu đã thay đổi hoặc bị xóa ở cửa sổ khác. Bài đang mở được giữ nguyên. Hãy xuất bài làm trước khi tải lại trang.');
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [exam.id]);

  const finish = useCallback((automatic: boolean, confirmed=false) => {
    const current = ram.current;
    if (!current || current.submittedAt !== null) return;
    const clock = Date.now();
    const unanswered = exam.questions.filter(q => !isAnswered(exam, q.id, current.answers)).length;
    if (!automatic && remainingMs(current, clock) > 0 && unanswered > 0 && !confirmed) {setConfirmation('submit');return;}
    const result = submitDraft(exam, current, Date.now());
    if (!result.ok) { setNotice(result.message); return; }
    setConfirmation(null);
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
    setNow(Date.now());
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
  const answered = draft ? exam.questions.filter(q => isAnswered(exam, q.id, draft.answers)).length : 0;
  const seconds = draft ? Math.ceil(remainingMs(draft, now) / 1000) : 0;
  const retake=(confirmed=false)=>{
    const old=ram.current;if(!old||old.submittedAt===null||dirty.current||conflict.current)return;
    if(!pdfReady)return;
    if(!confirmed){setConfirmation('retake');return;}
    setConfirmation(null);
    const id=typeof crypto.randomUUID==='function'?crypto.randomUUID():`local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const next=retakeDraft(localStore(),exam,old,id,Date.now());
    if(!next.ok){setNotice(next.message);return;}
    persisted.current=next.value;ram.current=next.value;setDraft(next.value);setNow(Date.now());setNotice('');setExportNotice('');setUnsaved(false);
  };

  return <section className="ep-attempt">
    <Link className="ep-link" href={catalogUrl}>← Danh sách đề</Link>
    <header><p>Lớp {exam.grade} · {PERIOD_LABELS[exam.period]}</p><h1>{exam.title}</h1><p>22 câu · {exam.durationMinutes} phút · Thang điểm 10</p></header>
    {notice && <p className="ep-notice" role="alert">{notice}</p>}
    {unsaved && <p className="ep-notice" role="status">Chưa xác nhận bài làm được lưu bền vững trên trình duyệt. Câu trả lời vẫn được giữ trên trang này. Hãy xuất JSON trước khi đóng hoặc tải lại trang.</p>}
    {exam.sourcePdf&&<Suspense fallback={<p role="status">Đang mở bản câu hỏi…</p>}><QuestionPdf file={exam.sourcePdf} title={exam.title} onReady={setPdfReady}/></Suspense>}
    {exam.sourcePdf&&!pdfReady&&<p><a href={exam.sourceUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Xem nguồn để đối chiếu</a> · Nguồn gốc có thể chứa đáp án hoặc mã đề khác; chưa mở làm bài khi không xem được bản câu hỏi.</p>}
    {!draft ? <div className="ep-card">
      <p>Bài làm và kết quả được lưu trên trình duyệt này. Thời gian tiếp tục tính khi bạn rời trang.</p>
      <p>Phần I: 12 câu chọn đáp án. Phần II: 4 câu đúng/sai. Phần III: 6 câu trả lời ngắn.</p>
      {persisted.current && <p>Đã có bài đang làm. Hạn nộp: {new Date(persisted.current.deadline).toLocaleString('vi-VN')}.</p>}
      <button type="button" className="ep-primary" disabled={!pdfReady} onClick={begin}>{persisted.current ? 'Tiếp tục làm bài' : 'Bắt đầu làm bài'}</button>
    </div> : <>
      <div className="ep-toolbar">
        {submitted ? <strong role="status">{unsaved ? 'Đã nộp trên trang này · chưa xác nhận lưu kết quả' : 'Đã nộp và lưu kết quả'}</strong> : <>
          <span role="timer" aria-label="Thời gian còn lại" aria-live="off">Còn {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>
          <span>{answered}/22 câu đã trả lời đầy đủ</span>
          <button type="button" className="ep-primary" onClick={() => finish(false)}>Nộp bài</button>
        </>}
        <button type="button" onClick={() => setExportNotice(exportDraft(draft) ? 'Đã yêu cầu tải tệp JSON bài làm.' : 'Chưa xuất được tệp. Hãy giữ trang này mở và thử lại.')}>Xuất bài làm JSON</button>
        {unsaved && !conflict.current && <button type="button" onClick={() => persist(draft)}>Thử lưu lại</button>}
      </div>
      {exportNotice && <p role="status">{exportNotice}</p>}
      {submitted && <section className="ep-card" aria-label="Kết quả">
        <h2>Kết quả luyện tập</h2>
        {score?.ok ? <p className="ep-score">{formatPoints(score.earnedMillipoints)} / 10</p> : <p role="alert">Chưa tính được điểm. Bài làm vẫn được giữ nguyên để đối chiếu.</p>}
        <p>Nộp lúc {new Date(draft.submittedAt!).toLocaleString('vi-VN')}.</p>
        <p>Nguồn: {exam.sourceMaterial.title} · {exam.sourceMaterial.publisher} · {exam.sourceMaterial.version} · {exam.sourceMaterial.locator}</p>
        <a className="ep-link" href={exam.sourceUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Mở nguồn đề (tab mới)</a>
        <p><Link className="ep-link" href={catalogUrl}>Trở về danh sách đề</Link></p>
        <button type="button" disabled={unsaved||conflict.current||!pdfReady} onClick={()=>retake()}>Làm lại đề · giữ bài cũ trong lịch sử</button>
      </section>}
      <nav className="ep-question-nav" aria-label="Chuyển đến câu hỏi">{exam.questions.map((q, i) => <button type="button" key={q.id} className={isAnswered(exam, q.id, draft.answers) ? 'is-answered' : ''} aria-label={`Câu ${i + 1}: ${isAnswered(exam, q.id, draft.answers) ? 'đã trả lời đầy đủ' : 'chưa trả lời đầy đủ'}`} onClick={() => {
        const target = document.getElementById(`ep-question-${i}`); target?.focus(); target?.scrollIntoView({block: 'start'});
      }}>{i + 1}</button>)}</nav>
      <p>Ô tô màu: câu đã trả lời đầy đủ.</p>
      {exam.questions.map((q, index) => {
        const answer = draft.answers[q.id];
        const row = score?.ok ? score.rows.find(item => item.id === q.id) : undefined;
        const tfAnswers = Array.isArray(answer) ? answer : [null, null, null, null];
        return <section className="ep-question ep-card" key={q.id} id={`ep-question-${index}`} tabIndex={-1} aria-labelledby={`ep-heading-${index}`}>
          {(index === 0 || index === 12 || index === 16) && <h2>{index === 0 ? 'Phần I · Chọn một đáp án' : index === 12 ? 'Phần II · Đúng hoặc sai' : 'Phần III · Trả lời ngắn'}</h2>}
          <h3 id={`ep-heading-${index}`}>Câu {index + 1} <small>({formatPoints(q.maxMillipoints)} điểm)</small></h3>
          <p className="ep-source-text">{q.prompt ?? q.text ?? q.sourceRef}</p>
          <p className="ep-source-ref">{q.sourceRef}</p>
          {q.kind === 'mc' && (submitted ? <ul className="ep-options-readonly">{q.choices.map((choice, i) => <li key={letters[i]}>{letters[i]}. {choice}</li>)}</ul> : <fieldset disabled={!pdfReady}><legend>Chọn đáp án câu {index + 1}</legend>{q.choices.map((choice, i) => <label className="ep-option" key={letters[i]}><input type="radio" name={`ep-mc-${index}`} value={letters[i]} checked={answer === letters[i]} onChange={() => changeAnswer(q.id, letters[i])}/><span>{letters[i]}. {choice}</span></label>)}<button type="button" onClick={() => changeAnswer(q.id, null)}>Bỏ chọn câu {index + 1}</button></fieldset>)}
          {q.kind === 'tf' && <div>{statementLetters.map((letter, i) => submitted ? <p className="ep-source-text" key={letter}>{letter}) {q.statements?.[i] ?? `${q.sourceRef}, ý ${letter}`}</p> : <fieldset key={letter} disabled={!pdfReady}><legend className="ep-source-text">{letter}) {q.statements?.[i] ?? `${q.sourceRef}, ý ${letter}`}</legend>{[true, false, null].map(value => <label className="ep-tf-option" key={String(value)}><input type="radio" name={`ep-tf-${index}-${i}`} checked={tfAnswers[i] === value} onChange={() => {
            const next = [...tfAnswers] as (boolean | null)[]; next[i] = value; changeAnswer(q.id, next);
          }}/>{value === null ? 'Chưa chọn' : value ? 'Đúng' : 'Sai'}</label>)}</fieldset>)}</div>}
          {q.kind === 'short' && !submitted && <div><label htmlFor={`ep-short-${index}`}>Trả lời câu {index + 1}</label><input id={`ep-short-${index}`} className="ep-short" type="text" disabled={!pdfReady} maxLength={MAX_SHORT_LENGTH} autoComplete="off" spellCheck={false} value={typeof answer === 'string' ? answer : ''} aria-describedby={`ep-help-${index}`} onChange={event => changeAnswer(q.id, event.target.value)}/><p id={`ep-help-${index}`}>{q.mode === 'numeric' ? 'Nhập số thập phân, dùng dấu phẩy hoặc dấu chấm; không nhập biểu thức hoặc phân số. Câu trả lời khác định dạng số được tính 0 điểm.' : 'Nhập câu trả lời chính xác theo yêu cầu đề.'}</p></div>}
          {submitted && <div className="ep-review"><p><strong>Bài làm:</strong> {displayAnswer(answer)}</p><p><strong>Đáp án:</strong> {q.kind === 'mc' ? q.answer : q.kind === 'tf' ? q.answer.map((v, i) => `${statementLetters[i]}) ${v ? 'Đúng' : 'Sai'}`).join('; ') : q.acceptedAnswers.join(' hoặc ')}</p>{result?.invalidNumeric.includes(q.id) && <p>Câu trả lời không đúng định dạng số: 0 điểm.</p>}<p><strong>Điểm câu này:</strong> {row ? formatPoints(row.earnedMillipoints ?? 0) : 'Chưa tính được'} / {formatPoints(q.maxMillipoints)}</p></div>}
        </section>;
      })}
      {!submitted && <button type="button" className="ep-primary" onClick={() => finish(false)}>Nộp bài</button>}
    </>}
    {confirmation&&<ExamConfirm title={confirmation==='submit'?'Nộp bài chưa hoàn thành?':'Làm một lượt mới?'} message={confirmation==='submit'?`Còn ${22-answered} câu chưa trả lời đầy đủ. Nộp bài sẽ kết thúc lượt làm này.`:'Bài đã nộp được giữ trong lịch sử trước khi bắt đầu lượt mới.'} confirmLabel={confirmation==='submit'?'Nộp bài':'Bắt đầu lượt mới'} onCancel={()=>setConfirmation(null)} onConfirm={()=>confirmation==='submit'?finish(false,true):retake(true)}/>}
  </section>;
}
