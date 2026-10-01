import { useMemo, useRef, useState } from 'react';
import references from './mtm-reference-data.json';
import './MtmReferenceLibrary.css';

export type ReferenceItem = { title: string; category: string; pages: number | null; source: string };
export const normalizeReferenceSearch = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
export function referenceClass(category: string, title = '') {
  const name = normalizeReferenceSearch(title);
  if (/vao lop 10|tuyen sinh.*lop 10/.test(name)) return 'Ôn vào lớp 10';
  const explicit = [...name.matchAll(/(?:toan|lop)\s+(6|7|8|9|10|11|12)(?!\d)/g)].map(x=>x[1]);
  const distinct = [...new Set(explicit)];
  if (distinct.length === 1) return 'Lớp '+distinct[0];
  if (distinct.length > 1) return 'Nhiều lớp';
  if (/vao-lop-10|tuyen-sinh-lop-10/.test(category)) return 'Ôn vào lớp 10';
  const match = category.match(/(?:toan-)(6|7|8|9|10|11|12)$/);
  if (match) return `Lớp ${match[1]}`;
  if (/thpt/.test(category)) return 'Ôn THPT';
  if (/dgnl|danh-gia-nang-luc/.test(category)) return 'Đánh giá năng lực';
  return 'Chưa phân lớp';
}
export function referenceType(category: string, title = '') {
  const name = normalizeReferenceSearch(title);
  if (/giua\s+(?:hoc\s*)?(?:ky|ki)|giua\s*hk/.test(name)) return 'Giữa học kỳ';
  if (/cuoi\s+(?:hoc\s*)?(?:ky|ki)|cuoi\s*hk/.test(name)) return 'Cuối học kỳ';
  if (/hoc sinh gioi|\bhsg\b/.test(name)) return 'Học sinh giỏi';
  if (/khao sat/.test(name)) return 'Khảo sát';
  if (/de cuong/.test(name)) return 'Đề cương ôn tập';
  if (/giao an/.test(name)) return 'Giáo án';
  if (/dinh ky|dinh ki/.test(name)) return 'Ôn kiểm tra định kỳ';
  if (/chuyen de|bai tap|ly thuyet/.test(name)) return 'Tài liệu ôn tập';
  if (/de (?:thi|kiem tra)\s+(?:hoc ky|hoc ki|hk)/.test(name)) return 'Cuối học kỳ';
  if (/giua-hk/.test(category)) return 'Giữa học kỳ';
  if (/de-thi-hk/.test(category)) return 'Cuối học kỳ';
  if (/hsg/.test(category)) return 'Học sinh giỏi';
  if (/khao-sat/.test(category)) return 'Khảo sát';
  if (/de-cuong/.test(category)) return 'Đề cương ôn tập';
  if (/giao-an/.test(category)) return 'Giáo án';
  if (/de-thi|de-danh-gia/.test(category)) return 'Đề tham khảo';
  return 'Tài liệu ôn tập';
}
export function filterReferences(items: ReferenceItem[], query: string, grade: string, type: string) {
  const terms = normalizeReferenceSearch(query).split(/\s+/).filter(Boolean);
  return items.filter(item => (!grade || referenceClass(item.category, item.title) === grade) && (!type || referenceType(item.category, item.title) === type) && terms.every(term => normalizeReferenceSearch(`${item.title} ${referenceClass(item.category, item.title)} ${referenceType(item.category, item.title)}`).includes(term)));
}
export default function MtmReferenceLibrary() {
  const [query, setQuery] = useState(''); const [grade, setGrade] = useState(''); const [type, setType] = useState(''); const [page, setPage] = useState(1);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const items = references as ReferenceItem[];
  const grades = useMemo(() => [...new Set(items.map(item => referenceClass(item.category, item.title)))].sort((a,b) => a.localeCompare(b, 'vi', {numeric:true})), []);
  const types = useMemo(() => [...new Set(items.map(item => referenceType(item.category, item.title)))].sort((a,b) => a.localeCompare(b, 'vi')), []);
  const filtered = useMemo(() => filterReferences(items, query, grade, type), [query, grade, type]);
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const changePage = (next: number) => { setPage(next); resultsHeading.current?.focus(); };
  return <section className="mtm-reference" id="tai-lieu-tham-khao" aria-labelledby="mtm-reference-title">
    <header><p className="mtm-reference-eyebrow">GÓC HỌC LIỆU</p><h2 id="mtm-reference-title">Tìm thêm một bài Toán hay</h2><p>Tài liệu tham khảo tại nguồn TOANMATH. Em có thể lọc theo lớp và dạng tài liệu để tìm nội dung cần ôn.</p><p className="mtm-reference-note">Các liên kết mở bài gốc ở trang bên ngoài. Đây chưa phải đề được nhập vào hệ thống làm bài hoặc chấm điểm MTM; hãy đối chiếu nội dung và đáp án với giáo viên.</p></header>
    <div className="mtm-reference-filters">
      <label>Tìm tài liệu<input type="search" value={query} onChange={e => {setQuery(e.target.value);setPage(1);}} placeholder="Ví dụ: cực trị, giữa kỳ…" /></label>
      <label>Lớp / hướng ôn<select value={grade} onChange={e => {setGrade(e.target.value);setPage(1);}}><option value="">Tất cả</option>{grades.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Loại tài liệu<select value={type} onChange={e => {setType(e.target.value);setPage(1);}}><option value="">Tất cả</option>{types.map(value => <option key={value}>{value}</option>)}</select></label>
      <button type="button" onClick={() => {setQuery('');setGrade('');setType('');setPage(1);}}>Xóa bộ lọc</button>
    </div>
    <h3 tabIndex={-1} ref={resultsHeading} className="mtm-reference-count" aria-live="polite">{filtered.length} tài liệu · Trang {page}/{pages}</h3>
    {filtered.length === 0 ? <p className="mtm-reference-empty">Chưa tìm thấy tài liệu phù hợp. Em thử từ khóa ngắn hơn hoặc xóa bộ lọc nhé.</p> : <ul className="mtm-reference-grid">{filtered.slice((page-1)*20,page*20).map(item => <li key={item.source}><article><p className="mtm-reference-meta">{referenceClass(item.category, item.title)} · {referenceType(item.category, item.title)}{item.pages !== null ? ` · ${item.pages} trang` : ''}</p><h4><a href={item.source} target="_blank" rel="noopener noreferrer">{item.title}<span className="mtm-reference-sr"> (mở bài nguồn trong thẻ mới)</span></a></h4><p className="mtm-reference-source">Tài liệu tham khảo tại nguồn · TOANMATH</p></article></li>)}</ul>}
    {pages > 1 && <nav className="mtm-reference-pagination" aria-label="Phân trang tài liệu"><button type="button" disabled={page === 1} onClick={() => changePage(page-1)}>← Trang trước</button><span>Trang {page}/{pages}</span><button type="button" disabled={page === pages} onClick={() => changePage(page+1)}>Trang sau →</button></nav>}
  </section>;
}
