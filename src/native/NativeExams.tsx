import {useEffect, useMemo, useState} from 'react';
import {Link, navigate} from '../migration/navigation';
import {filterSearch, GRADES, PERIODS, PERIOD_LABELS, PRACTICE_EXAMS, readFilters, readyExams, titleTerm, type Filters, type PracticeExam} from './exams/data';
import PracticeAttempt, {localStore} from './exams/PracticeAttempt';
import {readHistory, STORAGE_PREFIX} from './exams/store';
import {resultFor} from './exams/result';
import {SEO} from '../components/SEO';
import {examRouteMetadata} from './exams/route-metadata';
import './exams/exams.css';

function LocalHistory({catalog, search}: {catalog: readonly PracticeExam[]; search: string}) {
  const [history, setHistory] = useState(() => readHistory(localStore(), catalog));
  useEffect(() => {
    const captured=localStore();
    const refresh = () => setHistory(readHistory(localStore(), catalog));
    const changed = (event: StorageEvent) => {
      if (!captured||event.storageArea!==captured) return;
      if (event.key === null || event.key.startsWith(STORAGE_PREFIX)) refresh();
    };
    refresh();
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [catalog]);
  return <section className="ep-card" aria-labelledby="ep-history-heading">
    <h2 id="ep-history-heading">Lịch sử trên trình duyệt này</h2>
    {history.messages.map((message, i) => <p className="ep-notice" role="status" key={i}>{message}</p>)}
    {!history.items.length && <p>Chưa có bài nộp đã lưu để hiển thị.</p>}
    <ul className="ep-history">{history.items.map(({exam, draft}) => {
      const result = resultFor(exam, draft);
      return <li key={draft.attemptId + ':' + exam.id}><strong>{exam.title}</strong><span>{new Date(draft.submittedAt!).toLocaleString('vi-VN')} · {result?.score.ok ? `${(result.score.earnedMillipoints / 1000).toLocaleString('vi-VN', {maximumFractionDigits: 3})} / 10` : 'Chưa tính được điểm'}</span><details><summary>Xem lại lượt đã nộp</summary><p>Nguồn: {exam.sourceMaterial.title} · {exam.sourceMaterial.version}</p>{exam.questions.map((q,i)=><p key={q.id}>Câu {i+1}: bài làm {JSON.stringify(draft.answers[q.id]??null)} · đáp án {q.kind==='mc'?q.answer:q.kind==='tf'?q.answer.map(v=>v?'Đúng':'Sai').join(', '):q.acceptedAnswers.join(' hoặc ')}</p>)}</details></li>;
    })}</ul>
  </section>;
}

/** Explicit catalog prop is for an external owner QA entry module. Production
 * App passes no catalog, and this entry imports no synthetic test material. */
export default function NativeExams({pathname, search, catalog = PRACTICE_EXAMS}: {pathname: string; search: string; catalog?: readonly unknown[]}) {
  const ready = useMemo(() => readyExams(catalog), [catalog]);
  const filters = readFilters(search), normalizedSearch = filterSearch(filters);
  const catalogUrl = '/thi-thu' + normalizedSearch;
  useEffect(() => {
    if (search !== normalizedSearch) navigate(pathname + normalizedSearch + location.hash, {replace: true});
  }, [pathname, search, normalizedSearch]);
  let id: string | null = null;
  if (pathname !== '/thi-thu') {
    try { id = decodeURIComponent(pathname.slice('/thi-thu/'.length)); } catch { id = ''; }
  }
  const exam = id !== null ? ready.find(item => item.id === id) : undefined;
  const changeFilters = (patch: Partial<Filters>) => navigate('/thi-thu' + filterSearch({...filters, ...patch}), {replace: true});
  const matches = ready.filter(item => (filters.lop === 'all' || item.grade === Number(filters.lop)) && (filters.ky === 'all' || item.period === filters.ky) && titleTerm(item.title).includes(titleTerm(filters.q)));

  return <div className="ep-root">
    <SEO {...examRouteMetadata(exam,id!==null)}/>
    {id !== null ? exam ? <PracticeAttempt key={exam.id + ':' + exam.versionHash + ':' + exam.rubricVersion} exam={exam} catalogUrl={catalogUrl}/> : <section className="ep-card"><h1>Chưa mở được đề này</h1><p>Đề trong đường dẫn chưa có trong danh sách đã kiểm tra hoặc đường dẫn không đúng.</p><p>Đề đang được kiểm tra nguồn và đáp án trước khi mở làm bài.</p><Link className="ep-link" href={catalogUrl}>Về danh sách đề</Link></section> : <>
      <header className="ep-intro"><p>Minh Thành Math · Tự luyện</p><h1>Thi thử Toán</h1><p>Đọc đề, làm bài có thời gian và xem đáp án, lời giải sau khi nộp.</p><p className="ep-total"><strong>{ready.length}</strong> đề mở làm bài</p></header>
      <div className="ep-filters" role="search" aria-label="Lọc đề thi">
        <label>Lớp<select value={filters.lop} onChange={event => changeFilters({lop: event.target.value as Filters['lop']})}><option value="all">Tất cả lớp</option>{GRADES.map(grade => <option key={grade} value={grade}>Lớp {grade}</option>)}</select></label>
        <label>Kỳ kiểm tra<select value={filters.ky} onChange={event => changeFilters({ky: event.target.value as Filters['ky']})}><option value="all">Tất cả kỳ</option>{PERIODS.map(period => <option key={period} value={period}>{PERIOD_LABELS[period]}</option>)}</select></label>
        <label>Tìm theo tên đề<input type="search" maxLength={120} value={filters.q} placeholder="Nhập tên đề…" onChange={event => changeFilters({q: event.target.value})}/></label>
        <button type="button" onClick={() => changeFilters({lop: 'all', ky: 'all', q: ''})}>Xóa bộ lọc</button>
      </div>
      <section aria-label="Đề theo lớp và kỳ" className="ep-buckets">{GRADES.flatMap(grade => PERIODS.map(period => <button type="button" className="ep-bucket" key={`${grade}-${period}`} aria-pressed={filters.lop === String(grade) && filters.ky === period} onClick={() => changeFilters({lop: String(grade) as Filters['lop'], ky: period})}><span>Lớp {grade} · {PERIOD_LABELS[period]}</span><strong>{ready.filter(item => item.grade === grade && item.period === period).length} đề</strong></button>))}</section>
      <p role="status" aria-live="polite">{matches.length} đề phù hợp bộ lọc</p>
      <div className="ep-catalog">{matches.map(item => <article className="ep-card" key={item.id}><p>Lớp {item.grade} · {PERIOD_LABELS[item.period]}</p><h2>{item.title}</h2><p>22 câu · {item.durationMinutes} phút</p><Link className="ep-link" href={`/thi-thu/${encodeURIComponent(item.id)}${normalizedSearch}`}>Mở đề luyện tập →</Link></article>)}</div>
      {!matches.length && <p className="ep-card">{ready.length ? 'Chưa có đề phù hợp. Hãy thử đổi bộ lọc.' : 'Chưa có đề mở làm bài.'}</p>}
      <LocalHistory catalog={ready} search={normalizedSearch}/>
    </>}
  </div>;
}
