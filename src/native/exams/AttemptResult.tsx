import {Link} from '../../migration/navigation';
import ResultSummary from './ResultSummary';
import ExamReview from './ExamReview';
import ResultRecallTool from './ResultRecallTool';
import type {PracticeAttemptProps} from './attempt-types';
import type {PracticeAttemptState} from './usePracticeAttempt';
export default function AttemptResult({props,state}:{props:PracticeAttemptProps;state:PracticeAttemptState}) {
  const {exam,catalogUrl,questionReader,renderText,renderSolutionExtra,kind='practice',newAttemptsClosed}=props;
  const {draft,resultHeading,score,unsaved,conflict,pdfReady,sourceIssue,erratum,acceptedErratum,retake}=state;
  if(!draft)return null;
  return <><section className="ep-card" aria-label="Kết quả"><h2 ref={resultHeading} tabIndex={-1}>{kind==='exam'?'Kết quả thi thử':'Kết quả luyện tập'}</h2><ResultSummary exam={exam} draft={draft}/>{!score?.ok&&<p role="alert">Chưa tính được điểm. Bài làm vẫn giữ nguyên để đối chiếu.</p>}
              <p>Nộp lúc {new Date(draft.submittedAt!).toLocaleString('vi-VN')}.</p>{exam.answerVerificationNote&&<p>{questionReader?'Câu hỏi, đáp án và lời giải đã được đối chiếu. Điểm được tính theo thang ghi tại từng câu.':exam.answerVerificationNote}</p>}
              <p><Link className="ep-link" href={catalogUrl}>Trở về danh sách đề</Link></p>
              {newAttemptsClosed?<p>Bài đang chờ phản biện nên chưa mở lượt làm lại; lượt này vẫn giữ trong lịch sử.</p>:<button type="button" disabled={unsaved||conflict.current||!pdfReady||!!sourceIssue||!!erratum&&!acceptedErratum} onClick={()=>retake()}>Làm lại đề · giữ bài cũ trong lịch sử</button>}
            </section>
            {kind==='exam'&&!props.isHomework&&draft.submittedAt!==null&&<ResultRecallTool key={draft.attemptId} exam={exam} draft={draft} renderText={renderText} renderSolutionExtra={renderSolutionExtra}/>}
            <ExamReview key={draft.attemptId} exam={exam} draft={draft} showSummary={false} renderText={renderText} renderSolutionExtra={renderSolutionExtra}/></>;
}
