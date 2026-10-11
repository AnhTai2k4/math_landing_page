import {Link,useRoute} from '../../migration/navigation';
import {readHistory,readDraft} from '../exams/store';
import {localStore} from '../exams/PracticeAttempt';
import ChapterPractice,{type PracticeBankItem} from './ChapterPractice';
import curriculum from './curriculum.json';
import tests from './practice-tests.json';
import archives from './archived-tests.json';
import './chapters.css';

type Chapter={id:string;title:string;forms:string[];plannedPracticeTests?:number};
type Track={id:string;label:string;description:string;chapters:Chapter[];sourceUrl:string;sourceLabel:string};
type PracticeItem=PracticeBankItem&{track:string;chapter:string;order:number;coverage:string;isChapterEnd?:boolean;isFoundation?:boolean};
const tracks=curriculum as Track[];
const rawBank=tests as unknown as PracticeItem[];
const foundationLabel=(p:PracticeItem)=>p.track==='10'?'Hệ thống công thức và lý thuyết cả chương':p.track==='11'?p.order===1?'Góc và công thức lượng giác':'Hàm số và phương trình lượng giác':p.order===1?'Đạo hàm, biến thiên và cực trị':'Khảo sát đồ thị và bài toán ứng dụng';
const bank=rawBank.map(p=>{const coverage=p.isFoundation?foundationLabel(p):p.coverage;return {...p,coverage,presentationTitle:["HSA","TSA"].includes(p.track)?p.exam.title:`Toán ${p.track} · Chương ${p.chapter} · ${p.isChapterEnd?"Kiểm tra kết thúc chương":"Bài "+p.order+": "+coverage}`};});
const currentIds=new Set(bank.map(p=>p.exam.id));
const pilotBank=(archives as unknown as PracticeItem[]).filter(p=>!currentIds.has(p.exam.id));
export const practiceURL=(track:string,chapter:string,id?:string)=>'/luyen-tap?'+new URLSearchParams({nhom:track,chuong:chapter,...(id?{id}:{})}).toString();

export default function PracticeLibrary(){
  const route=useRoute(),params=new URLSearchParams(route.search);
  const selected=tracks.find(t=>t.id===params.get('nhom'))??tracks[0];
  const chapter=selected?.chapters.find(c=>c.id===params.get('chuong'))??selected?.chapters[0];
  const requested=params.get('id'),view=params.get('luot');
  const history=readHistory(localStore(),[...bank,...pilotBank].map(p=>p.exam));
  const savedId=view?history.items.find(p=>p.draft.attemptId===view)?.exam.id:undefined;
  const resolvedId=view?savedId:requested;
  const item=bank.find(p=>p.exam.id===resolvedId),pilot=pilotBank.find(p=>p.exam.id===resolvedId);
  const actualTrack=item?.track??(pilot?pilot.track:selected?.id??'10');
  const actualChapter=item?.chapter??(pilot?pilot.chapter:chapter?.id??'1');
  const returnURL=practiceURL(actualTrack,actualChapter);
  if(requested||view)return <ChapterPractice additionalBank={[...bank,...pilotBank]} catalogUrl={returnURL} contextLabel={['HSA','TSA'].includes(actualTrack)?'Luyện tập theo chủ đề':'Luyện tập theo chương'} audienceLabel={tracks.find(t=>t.id===actualTrack)?.label}/>;
  if(!selected||!chapter)return <section className="mig-container mig-panel"><h1>Chưa đọc được danh mục luyện tập</h1><Link href="/thi-thu">Về Thi thử</Link></section>;
  const chapterBank=bank.filter(p=>p.track===selected.id&&p.chapter===chapter.id).sort((a,b)=>a.order-b.order);
  const available=chapterBank.filter(p=>!p.isChapterEnd),final=chapterBank.find(p=>p.isChapterEnd);
  const targetCount=Math.max(chapter.plannedPracticeTests??10,available.length);
  const attempts=new Map(chapterBank.map(p=>{const r=readDraft(localStore(),p.exam);return [p.exam.id,r.ok?r.value:null] as const}));
  const actionLabel=(p:PracticeItem)=>attempts.get(p.exam.id)?.submittedAt===null?'Làm tiếp bài '+p.order:attempts.get(p.exam.id)?.submittedAt!=null?'Xem kết quả bài '+p.order:'Làm bài '+p.order;
  const samples=pilotBank.filter(p=>p.track===selected.id&&p.chapter===chapter.id);
  const visibleIds=new Set([...chapterBank,...samples].map(p=>p.exam.id));
  const entries=history.items.filter(p=>visibleIds.has(p.exam.id));
  return <section className="mig-container cp-library ep-root">
    <header className="cp-library-intro"><p className="mig-eyebrow">MINH THÀNH MATH · LUYỆN TỪNG DẠNG</p><h1>Luyện tập</h1>
      <p>Chọn chương đang học, luyện từng dạng rồi tự kiểm tra đáp án và lời giải sau khi nộp.</p>
      <p className="cp-local-note">Lượt làm lưu trên trình duyệt này; chưa đồng bộ giữa các thiết bị.</p>
    </header>
    <nav className="cp-track-nav" aria-label="Chọn nhóm luyện tập">{tracks.map(t=><Link key={t.id} href={practiceURL(t.id,t.chapters[0].id)} aria-current={selected.id===t.id?'page':undefined}>{t.label}</Link>)}</nav>
    <div className="cp-library-layout">
      <aside className="cp-chapter-panel"><h2>{selected.label}</h2><p>{selected.description}</p>
        <nav aria-label="Chọn chương hoặc chủ đề">{selected.chapters.map((c,index)=><Link key={c.id} href={practiceURL(selected.id,c.id)} aria-current={c.id===chapter.id?'page':undefined}><span className="cp-chapter-number">{index+1}</span><span>{c.title}</span></Link>)}</nav>
        <a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="cp-curriculum-source">{selected.sourceLabel} ↗</a>
      </aside>
      <div className="cp-chapter-content">
        <h2>{chapter.title}</h2><p>{chapter.forms.join(' · ')}</p>
        <p className="cp-ready-count" role="status">{available.length}/{targetCount} bài luyện đã mở.</p>
        {available.length>0?<ol className="cp-test-grid">{available.map(p=><li key={p.exam.id}><article>
          <span className="cp-test-index">Bài {p.order}/{targetCount}</span><h3>{p.coverage}</h3><p>{p.exam.questions.length} câu · {p.exam.durationMinutes} phút · thang 10</p>
          <p>{entries.filter(e=>e.exam.id===p.exam.id).length} lượt đã nộp</p>
          <Link className="mig-button cp-action-button" href={practiceURL(selected.id,chapter.id,p.exam.id)}>{actionLabel(p)}<span aria-hidden="true">→</span></Link>
        </article></li>)}</ol>:<div className="cp-empty"><h3>{['HSA','TSA'].includes(selected.id)?'Chủ đề':'Chương'} này chưa có bộ bài đã kiểm</h3><p>Bài sẽ được mở khi đề, khóa chấm và lời giải đã được đối chiếu. Có thể chọn Chương I lớp 10 để luyện ngay.</p><Link href={practiceURL('10','1')} className="mig-button outline">Luyện Mệnh đề và tập hợp</Link></div>}
        {final?<article className="cp-final"><p className="mig-eyebrow">TỰ KIỂM TRA SAU KHI LUYỆN</p><h3>Kiểm tra kết thúc chương</h3><p>{final.exam.questions.length} câu · {final.exam.durationMinutes} phút · thang 10 · bao phủ các dạng của chương.</p><p>{entries.filter(e=>e.exam.id===final.exam.id).length} lượt đã nộp</p><Link className="mig-button cp-action-button" href={practiceURL(selected.id,chapter.id,final.exam.id)}>{attempts.get(final.exam.id)?.submittedAt===null?'Làm tiếp bài kết thúc chương':attempts.get(final.exam.id)?.submittedAt!=null?'Xem kết quả bài kết thúc chương':'Làm bài kết thúc chương'}<span aria-hidden="true">→</span></Link></article>:<p className="cp-end-note">Bài kiểm tra kết thúc {['HSA','TSA'].includes(selected.id)?'chủ đề':'chương'}: chưa có bản đã kiểm.</p>}
        {samples.some(p=>entries.some(e=>e.exam.id===p.exam.id))&&<details className="cp-source-samples"><summary>Phiên bản ngắn trước đây · giữ để đọc lịch sử</summary>{samples.map(p=><article key={p.exam.id}><h3>{p.exam.title}</h3><p>{p.limits[0]}</p><Link className="mig-button outline" href={practiceURL(selected.id,chapter.id,p.exam.id)}>Mở phiên bản cũ lớp {p.exam.grade}</Link></article>)}</details>}
        <section className="cp-history"><h2>Lịch sử {['HSA','TSA'].includes(selected.id)?'chủ đề':'chương'} đang chọn</h2>{history.messages.length>0&&<p role="alert">{history.messages.join(' ')}</p>}{!entries.length?<p>Chưa có bài đã nộp ở đây.</p>:<ul>{entries.map(e=><li key={e.draft.attemptId}><Link href={returnURL+'&luot='+encodeURIComponent(e.draft.attemptId)}>{bank.find(p=>p.exam.id===e.exam.id&&p.exam.versionHash===e.exam.versionHash)?.presentationTitle??e.exam.title} · {new Date(e.draft.submittedAt!).toLocaleString('vi-VN')}</Link></li>)}</ul>}</section>
      </div>
    </div>
  </section>;
}
