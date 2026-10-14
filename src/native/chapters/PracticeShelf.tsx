// KT-06 (Đợt 3): phần Luyện tập cần ngân hàng đề. Nạp trễ (React.lazy) từ PracticeLibrary.tsx để chữ giới thiệu,
// nhóm và danh sách chương hiện trước khi gói đề về. Hiển thị và hành vi giữ nguyên như bản nhập tĩnh.
import {lazy} from 'react';
import {Link,useRoute} from '../../migration/navigation';
import {readHistory,readDraft} from '../exams/store';
import {localStore} from '../exams/local-store';
import {bank,pilotBank} from './practice-bank';
import {lessonName,practiceURL,testLabel,tracks,type Chapter,type PracticeItem,type Track} from './practice-shared';
import {awaitingReview,AWAITING_REVIEW_NOTICE,historyOnlyAttempt,isWarmup,shelfVisible,WARMUP_LABEL} from './library-rules';

const ChapterPractice=lazy(()=>import('./ChapterPractice'));
const allItems=()=>[...bank,...pilotBank];

/** Trang một bài (?id=) hoặc một lượt đã lưu (?luot=). */
export function PracticeDetail(){
  const route=useRoute(),params=new URLSearchParams(route.search);
  const selected=tracks.find(t=>t.id===params.get('nhom'))??tracks[0];
  const chapter=selected?.chapters.find(c=>c.id===params.get('chuong'))??selected?.chapters[0];
  const requested=params.get('id'),view=params.get('luot');
  const history=readHistory(localStore(),allItems().map(p=>p.exam));
  const savedId=view?history.items.find(p=>p.draft.attemptId===view)?.exam.id:undefined;
  const resolvedId=view?savedId:requested;
  const item=bank.find(p=>p.exam.id===resolvedId),pilot=pilotBank.find(p=>p.exam.id===resolvedId);
  const actualTrack=item?.track??(pilot?pilot.track:selected?.id??'10');
  const actualChapter=item?.chapter??(pilot?pilot.chapter:chapter?.id??'1');
  const returnURL=practiceURL(actualTrack,actualChapter);
  // DL-01: chỉ ngân hàng hiện hành (practice-tests + exact-tests) dùng cổng chờ phản biện; bản lưu trữ giữ như cũ.
  const closedNotice=(id:string)=>{const p=bank.find(b=>b.exam.id===id);return p&&awaitingReview(p)?AWAITING_REVIEW_NOTICE:undefined;};
  return <ChapterPractice closedNotice={closedNotice} additionalBank={allItems()} catalogUrl={returnURL} contextLabel={['HSA','TSA'].includes(actualTrack)?'Luyện tập theo chủ đề':'Luyện tập theo chương'} audienceLabel={tracks.find(t=>t.id===actualTrack)?.label}/>;
}

/** Phần thân một chương (sau tiêu đề chương): đề theo tài liệu, bài luyện, bài kết thúc chương, lịch sử. */
export function ChapterShelf({selected,chapter}:{selected:Track;chapter:Chapter}){
  const history=readHistory(localStore(),allItems().map(p=>p.exam));
  const returnURL=practiceURL(selected.id,chapter.id);
  const chapterBank=bank.filter(p=>p.track===selected.id&&p.chapter===chapter.id).sort((a,b)=>a.order-b.order);
  const attempts=new Map(chapterBank.map(p=>{const r=readDraft(localStore(),p.exam);return [p.exam.id,r.ok?r.value:null] as const}));
  const actionLabel=(p:PracticeItem)=>reviewOnly(p)?'Xem kết quả bài '+p.order:attempts.get(p.exam.id)?.submittedAt===null?'Làm tiếp bài '+p.order:attempts.get(p.exam.id)?.submittedAt!=null?'Xem kết quả bài '+p.order:'Làm bài '+p.order;
  const samples=pilotBank.filter(p=>p.track===selected.id&&p.chapter===chapter.id);
  const visibleIds=new Set([...chapterBank,...samples].map(p=>p.exam.id));
  const entries=history.items.filter(p=>visibleIds.has(p.exam.id));
  const hasAttempt=(p:PracticeItem)=>!!attempts.get(p.exam.id)||entries.some(e=>e.exam.id===p.exam.id);
  // DL-01 (review Codex vòng 2): bài chờ phản biện chỉ còn lượt trong lịch sử thì thẻ dẫn thẳng tới lượt đã nộp gần nhất.
  const reviewOnly=(p:PracticeItem)=>historyOnlyAttempt(p,!!attempts.get(p.exam.id),entries.filter(e=>e.exam.id===p.exam.id).map(e=>e.draft));
  const cardHref=(p:PracticeItem)=>{const luot=reviewOnly(p);return luot?practiceURL(selected.id,chapter.id)+'&luot='+encodeURIComponent(luot):practiceURL(selected.id,chapter.id,p.exam.id);};
  const available=chapterBank.filter(p=>!p.isChapterEnd&&!p.sourceEdition&&shelfVisible(p,hasAttempt(p))),final=chapterBank.find(p=>p.isChapterEnd&&!p.sourceEdition&&shelfVisible(p,hasAttempt(p))),exact=chapterBank.filter(p=>p.sourceEdition);
  const openCount=available.filter(p=>!awaitingReview(p)).length;
  const targetCount=Math.max(chapter.plannedPracticeTests??10,available.length);
  const thpt=['10','11','12'].includes(selected.id);
  const sourceGroups=Array.from(new Set(exact.map(p=>`${p.sourceSequence?.fileId??p.exam.sourceHash}:${p.sourceSequence?.lesson??p.order}`))).map(key=>exact.filter(p=>`${p.sourceSequence?.fileId??p.exam.sourceHash}:${p.sourceSequence?.lesson??p.order}`===key).sort((a,b)=>(a.sourceSequence?.sequence??a.order)-(b.sourceSequence?.sequence??b.order)));
  // LT-14 (Đợt 4): thẻ cũ ghi "Bài 4 · Đề test số 02" (4 là thứ tự đề trong chương, dễ nhầm với "Bài 2" ở tiêu đề nhóm).
  // Nay tiêu đề thẻ là số đề trong bài, dòng nhỏ là thứ tự trong chương; mô tả nội dung chỉ hiện khi khác tên bài.
  const sourceName=(p:PracticeItem)=>p.sourceSequence?.test?testLabel(p.sourceSequence.test):lessonName(p.coverage);
  const sourceAction=(p:PracticeItem)=>`${attempts.get(p.exam.id)?.submittedAt===null?'Làm tiếp':attempts.get(p.exam.id)?.submittedAt!=null?'Xem kết quả':'Làm'} ${sourceName(p).replace(/^Đề/,'đề')}`;
  const sameAsLesson=(p:PracticeItem)=>lessonName(p.coverage)===lessonName(p.sourceSequence?.lessonTitle??'');
  return <>
        {thpt&&<section className="cp-exact-list" aria-label="Đề theo bộ tài liệu MTM"><h3>Luyện theo thứ tự tài liệu</h3><p>Mỗi đề giữ trọn câu hỏi, hình và bảng; đi theo từng bài của file nguồn rồi đến ôn tập cuối chương.</p>{sourceGroups.length?sourceGroups.map(group=><section key={`${group[0].sourceSequence?.fileId}:${group[0].sourceSequence?.lesson}`}><h4>{lessonName(group[0].sourceSequence?.lessonTitle??group[0].coverage)}</h4><ol className="cp-test-grid">{group.map(p=><li key={p.exam.id}><article><span className="cp-test-index">Đề thứ {p.sourceSequence?.sequence??p.order} trong chương</span><h3>{sourceName(p)}</h3>{!sameAsLesson(p)&&<p>{p.coverage}</p>}<p>{p.exam.questions.length} câu · 3 phần · {p.exam.durationMinutes} phút · thang 10</p><p>{entries.filter(e=>e.exam.id===p.exam.id).length} lượt đã nộp</p><Link className="mig-button cp-action-button" href={practiceURL(selected.id,chapter.id,p.exam.id)} aria-label={`${sourceAction(p)}, ${lessonName(p.sourceSequence?.lessonTitle??p.coverage)}`}>{sourceAction(p)}<span aria-hidden="true">→</span></Link></article></li>)}</ol></section>):<p>Đề theo tài liệu của chương này đang được đối chiếu đủ câu, hình và lời giải trước khi mở.</p>}</section>}
        <details className="cp-previous-bank" open={thpt?undefined:true}><summary>{thpt?'Các bài luyện đã có · giữ riêng với lịch sử cũ':'Các bài luyện đang có'}</summary>
        <p className="cp-ready-count" role="status">{openCount}/{targetCount} bài luyện đã mở.</p>
        {available.length>0?<ol className="cp-test-grid">{available.map(p=><li key={p.exam.id}><article>
          <span className="cp-test-index">Bài {p.order}/{targetCount}</span>{isWarmup(p)&&<span className="cp-warmup-badge">{WARMUP_LABEL}</span>}{awaitingReview(p)&&<span className="cp-review-badge">Chờ phản biện · chỉ làm tiếp hoặc xem lại</span>}<h3>{p.coverage}</h3><p>{p.exam.questions.length} câu · {p.exam.durationMinutes} phút · thang 10</p>
          <p>{entries.filter(e=>e.exam.id===p.exam.id).length} lượt đã nộp</p>
          <Link className="mig-button cp-action-button" href={cardHref(p)}>{actionLabel(p)}<span aria-hidden="true">→</span></Link>
        </article></li>)}</ol>:<div className="cp-empty"><h3>{['HSA','TSA'].includes(selected.id)?'Chủ đề':'Chương'} này chưa có bộ bài đã kiểm</h3><p>Bài sẽ được mở khi đề, đáp án và lời giải đã được đối chiếu. Có thể chọn Chương I lớp 10 để luyện ngay.</p><Link href={practiceURL('10','1')} className="mig-button outline">Luyện Mệnh đề và tập hợp</Link></div>}
        {final?<article className="cp-final"><p className="mig-eyebrow">TỰ KIỂM TRA SAU KHI LUYỆN</p>{awaitingReview(final)&&<span className="cp-review-badge">Chờ phản biện · chỉ làm tiếp hoặc xem lại</span>}<h3>Kiểm tra kết thúc chương</h3><p>{final.exam.questions.length} câu · {final.exam.durationMinutes} phút · thang 10 · bao phủ các dạng của chương.</p><p>{entries.filter(e=>e.exam.id===final.exam.id).length} lượt đã nộp</p><Link className="mig-button cp-action-button" href={cardHref(final)}>{reviewOnly(final)?'Xem kết quả bài kết thúc chương':attempts.get(final.exam.id)?.submittedAt===null?'Làm tiếp bài kết thúc chương':attempts.get(final.exam.id)?.submittedAt!=null?'Xem kết quả bài kết thúc chương':'Làm bài kết thúc chương'}<span aria-hidden="true">→</span></Link></article>:<p className="cp-end-note">Bài kiểm tra kết thúc {['HSA','TSA'].includes(selected.id)?'chủ đề':'chương'}: chưa có bản đã kiểm.</p>}
        </details>
        {samples.some(p=>entries.some(e=>e.exam.id===p.exam.id))&&<details className="cp-source-samples"><summary>Phiên bản ngắn trước đây · giữ để đọc lịch sử</summary>{samples.map(p=><article key={p.exam.id}><h3>{p.exam.title}</h3><p>{p.limits[0]}</p><Link className="mig-button outline" href={practiceURL(selected.id,chapter.id,p.exam.id)}>Mở phiên bản cũ lớp {p.exam.grade}</Link></article>)}</details>}
        <section className="cp-history"><h2>Lịch sử {['HSA','TSA'].includes(selected.id)?'chủ đề':'chương'} đang chọn</h2>{history.messages.length>0&&<p role="alert">{history.messages.join(' ')}</p>}{!entries.length?<p>Chưa có bài đã nộp ở đây.</p>:<ul>{entries.map(e=><li key={e.draft.attemptId}><Link href={returnURL+'&luot='+encodeURIComponent(e.draft.attemptId)}>{bank.find(p=>p.exam.id===e.exam.id&&p.exam.versionHash===e.exam.versionHash)?.presentationTitle??e.exam.title} · {new Date(e.draft.submittedAt!).toLocaleString('vi-VN')}</Link></li>)}</ul>}</section>
  </>;
}
