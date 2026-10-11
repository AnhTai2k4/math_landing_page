import type {ReactNode} from 'react';
import {Link,useRoute} from '../../migration/navigation';
import PracticeAttempt,{localStore} from '../exams/PracticeAttempt';
import ExamReview from '../exams/ExamReview';
import {readHistory} from '../exams/store';
import {resultFor} from '../exams/result';
import {validatePracticeExam,type PracticeExam,type PracticeQuestion} from '../exams/data';
import MathText from '../math/MathText';

import '../exams/exams.css';
import './chapters.css';

type VariationTable={caption:string;headers:string[];rows:string[][]};
type DisplayQuestion=PracticeQuestion&{image?:string;imageAlt?:string;solutionTables?:VariationTable[];questionTables?:VariationTable[];statementSolutions?:string[]};
export type PracticeBankItem={exam:PracticeExam;note:string;limits:string[];scope:string;published:boolean;presentationTitle?:string};
const originalBank:PracticeBankItem[]=[];
const rich=(text:string):ReactNode=><MathText text={text}/>;
const points=(value:number)=>(value/1000).toLocaleString('vi-VN',{maximumFractionDigits:3});

type TheoryRecall={title:string;scope?:string;notationConvention?:string;sections:{id?:string;title:string;body:string;tables?:VariationTable[]}[]};
function TheorySummary({exam}:{exam:PracticeExam}){const theory=(exam as PracticeExam&{theoryRecall?:TheoryRecall}).theoryRecall;if(!theory)return null;return <details className="cp-theory"><summary>Ôn công thức và lý thuyết của chương</summary><h3>{theory.title}</h3>{theory.scope&&<p>{theory.scope}</p>}{theory.sections.map((section,index)=><section key={section.id??index}><h4>{section.title}</h4><p><MathText text={section.body}/></p><Tables tables={section.tables}/></section>)}{theory.notationConvention&&<p className="cp-notation"><MathText text={theory.notationConvention}/></p>}</details>;}

function QuestionReader({exam}:{exam:PracticeExam}) {
  return <section className="cp-reader" aria-label="Đề bài luyện chương">
    <TheorySummary exam={exam}/><h2>Đề bài</h2><p>Cuộn vùng này để đọc các câu. Điền bài làm ở phiếu trả lời.</p>
    {(exam.questions as DisplayQuestion[]).map((q,index)=><article key={q.id} className="cp-source-question">
      <h3>Câu {index+1} · {points(q.maxMillipoints)} điểm</h3>
      <p><MathText text={q.prompt??q.text??''}/></p><Tables tables={q.questionTables}/>
      {q.kind==='mc'&&<ol className="cp-choices" type="A">{q.choices.map((choice,i)=><li key={i}><MathText text={choice}/></li>)}</ol>}
      {q.kind==='tf'&&<ol className="cp-statements" type="a">{q.statements?.map((statement,i)=><li key={i}><MathText text={statement}/></li>)}</ol>}
      {q.image&&(q.imageAlt?<figure><img loading="lazy" src={q.image} alt={q.imageAlt}/><figcaption>{q.imageAlt}</figcaption></figure>:<details><summary>Xem ảnh câu trong nguồn</summary><img loading="lazy" src={q.image} alt={`Câu ${index+1} trong PDF gốc; nội dung đã chép ở trên`}/></details>)}
      <details className="cp-question-source"><summary>Nguồn đối chiếu kiến thức</summary><small>{q.sourceRef}</small></details>
    </article>)}
  </section>;
}

function Tables({tables}:{tables?:VariationTable[]}){return <>{tables?.map((table,index)=><div className="ep-table-wrap" key={index}><table className="ep-solution-table"><caption><MathText text={table.caption}/></caption><thead><tr>{table.headers.map((cell,i)=><th scope="col" key={i}><MathText text={cell}/></th>)}</tr></thead><tbody>{table.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=>j===0?<th scope="row" key={j}><MathText text={cell}/></th>:<td key={j}><MathText text={cell}/></td>)}</tr>)}</tbody></table></div>)}</>;}
function ExtraSolution({question}:{question:PracticeQuestion}) {const q=question as DisplayQuestion;return <>{q.statementSolutions&&<ol className="cp-statements">{q.statementSolutions.map((text,index)=><li key={index}><MathText text={text}/></li>)}</ol>}<Tables tables={q.solutionTables}/></>;}

export default function ChapterPractice({additionalBank=[],catalogUrl='/luyen-tap',contextLabel='Luyện Chương I',audienceLabel}:{additionalBank?:PracticeBankItem[];catalogUrl?:string;contextLabel?:string;audienceLabel?:string}) {
  const bank=[...originalBank,...additionalBank];
  const route=useRoute(),id=new URLSearchParams(route.search).get('id');
  const history=readHistory(localStore(),bank.map(p=>p.exam));
  const entries=history.items.filter(item=>bank.some(p=>p.exam.id===item.exam.id));
  const view=new URLSearchParams(route.search).get('luot'),saved=entries.find(item=>item.draft.attemptId===view);
  const savedResult=saved?resultFor(saved.exam,saved.draft):null;
  if(view&&!saved)return <section className="mig-container mig-panel"><h1>Không tìm thấy lượt đã lưu</h1><p>Lượt này không còn trong lịch sử trên trình duyệt này.</p><Link href={catalogUrl}>Về danh sách bài luyện</Link></section>;
  if(view&&saved)return <section className="mig-container cp-attempt ep-root">
    <h1>Lượt làm đã lưu · {audienceLabel??'Lớp '+saved.exam.grade}</h1><p>{bank.find(p=>p.exam.id===saved.exam.id&&p.exam.versionHash===saved.exam.versionHash)?.presentationTitle??saved.exam.title}</p>
    <p>Nộp lúc {new Date(saved.draft.submittedAt!).toLocaleString('vi-VN')} · Điểm {savedResult?.score.ok?points(savedResult.score.earnedMillipoints):'Chưa tính được'}/10</p>
    <ExamReview exam={saved.exam} draft={saved.draft} renderText={rich} renderSolutionExtra={q=><ExtraSolution question={q}/>}/>
    <Link href={catalogUrl} className="mig-button outline">Về danh sách bài luyện</Link>
  </section>;
  const pilot=bank.find(p=>p.exam.id===id);
  if(!id)return <section className="mig-container cp-catalog ep-root">
    <h1>Luyện theo chương</h1>
    <p>Ba bài mẫu đã kiểm nội dung và khóa chấm. Lịch sử được lưu trên trình duyệt này; chưa đồng bộ tài khoản học sinh.</p>
    <div className="cp-grid">{bank.map(p=><article key={p.exam.id} className="mig-panel">
      <h2>Lớp {p.exam.grade} · Chương I</h2><p>{p.exam.title}</p>
      <p>{p.exam.questions.length} nhóm câu · {p.exam.durationMinutes} phút · Thang 10</p>
      <p>Đã nộp {entries.filter(item=>item.exam.id===p.exam.id).length} lượt trên trình duyệt này.</p>
      <Link className="mig-button" href={'/luyen-chuong?id='+p.exam.id}>Làm bài lớp {p.exam.grade}</Link>
      <p>{p.limits[0]}</p>
    </article>)}</div>
    <p>Các bài lớp 10, 11 có câu cơ bản; chưa nghiệm thu toàn bộ mức 2 trở lên. Ngân hàng 10 bài mỗi chương và bài kết thúc chương còn đang tuyển chọn, kiểm và biên soạn.</p>
    <h2>Lịch sử bài luyện chương</h2>
    {view&&!saved&&<p role="alert">Không tìm thấy lượt này trong lịch sử trên trình duyệt.</p>}
    {history.messages.length>0&&<p role="alert">{history.messages.join(' ')}</p>}
    {!entries.length?<p>Chưa có bài luyện chương đã nộp trên trình duyệt này.</p>:<ul>{entries.map(item=><li key={item.draft.attemptId}><Link href={'/luyen-chuong?luot='+encodeURIComponent(item.draft.attemptId)}>{item.exam.title} · {new Date(item.draft.submittedAt!).toLocaleString('vi-VN')}</Link></li>)}</ul>}
    <Link href="/" className="mig-button outline">Về trang chủ</Link>
  </section>;
  if(!pilot)return <section className="mig-container mig-panel"><h1>Không tìm thấy bài thử</h1><Link href={catalogUrl}>Chọn bài luyện</Link></section>;
  const gate=validatePracticeExam(pilot.exam);
  if(!gate.valid)return <section className="mig-container mig-panel" role="alert"><h1>Bài chưa đủ điều kiện mở</h1><p>Giữ bản lưu cũ; cần kiểm lại cấu trúc đề và điểm.</p><Link href={catalogUrl}>Chọn bài khác</Link></section>;
  const tf=pilot.exam.questions.find(q=>q.kind==='tf');
  return <div className="mig-container cp-attempt ep-root">
    <section className="cp-intake mig-panel"><p><strong>Đề luyện tập Minh Thành Math</strong></p><p>{pilot.note}</p>
      <p>Đúng–sai: {tf?.kind==='tf'&&tf.pointsByCorrectCount.map((value,count)=>`${count} ý đúng: ${points(value)} điểm`).join(' · ')}. Điểm trắc nghiệm và trả lời ngắn ghi tại từng câu.</p>
      <p>{pilot.exam.sourceMaterial.publisher} · {pilot.exam.sourceMaterial.version}</p>
    </section>
    <PracticeAttempt key={pilot.exam.id} exam={pilot.exam} displayTitle={pilot.presentationTitle} catalogUrl={catalogUrl} contextLabel={contextLabel} audienceLabel={audienceLabel} sourceLinkLabel={additionalBank.some(p=>p.exam.id===pilot.exam.id)?contextLabel==='Luyện tập theo chủ đề'?'Nguồn cấu trúc kỳ thi đối chiếu':pilot.exam.sourceUrl.includes('drive.google.com')?'Nguồn kiến thức đối chiếu':'Website Minh Thành Math':undefined} renderText={rich} renderSolutionExtra={q=><ExtraSolution question={q}/>} questionReader={<QuestionReader exam={pilot.exam}/>}/>
  </div>;
}
