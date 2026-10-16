import {lazy,Suspense,useEffect,useState} from 'react';
import {Link,useRoute} from '../../migration/navigation';
import {practiceURL,tracks} from './practice-shared';
import PracticeTool from './PracticeTool';
// Nhập tĩnh ChapterPractice (chỉ phần mã giao diện, KHÔNG có ngân hàng đề) như trước KT-06 để giữ nguyên thứ tự CSS:
// katex, math-text, result-summary, mtm-source-content, theory-tables, chapters, exams. Đã thử nhập riêng từng CSS nhưng
// Vite đặt CSS riêng của chunk lên trước CSS dùng chung nên đổi giao diện nút/summary (review Codex đợt 3; so computed style).
import './ChapterPractice';
import './chapters.css';

// KT-06 (Đợt 3) bước 1: ngân hàng đề (khoảng 3 MB) không còn nhập tĩnh vào trang này. Khung trang (giới thiệu,
// nhóm, danh sách chương) vẽ ngay; phần cần ngân hàng đề nạp bằng import() rồi hiện vào chỗ giữ sẵn.
// Bài đơn (?id=, ?luot=) nạp song song ngân hàng đề và phòng làm bài để không phải chờ nối tiếp.
let shelfReady=false;
const loadShelf=()=>import('./PracticeShelf').then(m=>{shelfReady=true;return m;});
const QuickRecall=lazy(()=>import('./QuickRecall'));
const MentalMath=lazy(()=>import('./MentalMath'));
const FormulaMatch=lazy(()=>import('./FormulaMatch'));
const LineGraphGame=lazy(()=>import('./LineGraphGame'));
const ErrorHunt=lazy(()=>import('./ErrorHunt'));
const ChapterShelf=lazy(()=>loadShelf().then(m=>({default:m.ChapterShelf})));
const PracticeDetail=lazy(()=>Promise.all([loadShelf(),import('./ChapterPractice')]).then(([m])=>({default:m.PracticeDetail})));
export {practiceURL};

/** true sau khi khung trang đã vẽ ít nhất một khung hình (hoặc ngân hàng đề đã có sẵn), để việc tải gói đề
 * không giành băng thông với lần vẽ đầu của chữ giới thiệu. */
function useAfterFirstPaint(){
  const [ready,setReady]=useState(shelfReady);
  // Dự phòng 400 ms: khi trình duyệt không vẽ khung hình (cửa sổ bị che, webview nhúng) requestAnimationFrame có thể
  // không chạy, trước đây danh sách bài kẹt ở "Đang tải danh sách bài…" (bắt gặp khi kiểm trình duyệt đợt 3).
  useEffect(()=>{if(ready)return;let timer=0;const go=()=>{window.clearTimeout(fallback);cancelAnimationFrame(frame);timer=window.setTimeout(()=>setReady(true),0);};const frame=requestAnimationFrame(go);const fallback=window.setTimeout(go,400);return()=>{cancelAnimationFrame(frame);window.clearTimeout(fallback);window.clearTimeout(timer);};},[ready]);
  return ready;
}

export default function PracticeLibrary(){
  const route=useRoute(),params=new URLSearchParams(route.search);
  const selected=tracks.find(t=>t.id===params.get('nhom'))??tracks[0];
  const chapter=selected?.chapters.find(c=>c.id===params.get('chuong'))??selected?.chapters[0];
  const requested=params.get('id'),view=params.get('luot');
  const painted=useAfterFirstPaint();
  if(requested||view)return <Suspense fallback={<div className="mig-container mig-route-loading" role="status" aria-live="polite">Đang tải bài luyện…</div>}><PracticeDetail/></Suspense>;
  if(!selected||!chapter)return <section className="mig-container mig-panel"><h1>Chưa đọc được danh mục luyện tập</h1><Link href="/thi-thu">Về Thi thử</Link></section>;
  return <section className="mig-container cp-library ep-root">
    <header className="cp-library-intro"><p className="mig-eyebrow">MINH THÀNH MATH · LUYỆN TỪNG DẠNG</p><h1>Luyện tập</h1>
      <p>Chọn chương đang học, luyện từng dạng rồi tự kiểm tra đáp án và lời giải sau khi nộp.</p>
      <p className="cp-local-note">Lượt làm lưu trên trình duyệt này; chưa đồng bộ giữa các thiết bị.</p>
    </header>
    <nav className="cp-track-nav" aria-label="Chọn nhóm luyện tập">{tracks.map(t=><Link key={t.id} href={practiceURL(t.id,t.chapters[0].id)} aria-current={selected.id===t.id?'page':undefined}>{t.label}</Link>)}</nav>
    <div className="cp-library-layout">
      <aside className="cp-chapter-panel"><h2>{selected.label}</h2><p>{selected.description}</p>
        <nav aria-label="Chọn chương hoặc chủ đề">{selected.chapters.map((c,index)=><Link key={c.id} href={practiceURL(selected.id,c.id)} aria-current={c.id===chapter.id?'page':undefined}><span className="cp-chapter-number">{index+1}</span><span>{c.title}</span></Link>)}</nav>

      </aside>
      <div className="cp-chapter-content">
        <h2>{chapter.title}</h2><p>{chapter.forms.join(' · ')}</p>
        {['10','11','12'].includes(selected.id)&&<>
          <PracticeTool key={'recall:'+selected.id+':'+chapter.id} label="Ôn nhanh công thức" loading="Đang tải bộ thẻ…"><QuickRecall track={selected.id} chapter={chapter.id}/></PracticeTool>
          <PracticeTool key={'mental:'+selected.id+':'+chapter.id} label="Trò tự luyện · Tính nhẩm 5 câu" loading="Đang tải trò tính nhẩm…"><MentalMath/></PracticeTool>
          <PracticeTool key={'formula:'+selected.id+':'+chapter.id} label="Trò tự ôn · Nhận diện công thức" loading="Đang tải trò ghép thẻ…"><FormulaMatch track={selected.id} chapter={chapter.id}/></PracticeTool>
          <PracticeTool key={'graph:'+selected.id+':'+chapter.id} label="Trò tự luyện · Đọc đồ thị đường thẳng" loading="Đang tải trò đồ thị…"><LineGraphGame/></PracticeTool>
          <PracticeTool key={'error:'+selected.id+':'+chapter.id} label="Trò tự luyện · Săn lỗi biến đổi" loading="Đang tải trò săn lỗi…"><ErrorHunt/></PracticeTool>
        </>}
        {painted?<Suspense fallback={<div className="cp-shelf-loading" role="status" aria-live="polite">Đang tải danh sách bài…</div>}><ChapterShelf selected={selected} chapter={chapter}/></Suspense>:<div className="cp-shelf-loading" role="status" aria-live="polite">Đang tải danh sách bài…</div>}
      </div>
    </div>
  </section>;
}
