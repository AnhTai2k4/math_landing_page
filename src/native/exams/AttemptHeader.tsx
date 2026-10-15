import {Link} from '../../migration/navigation';
import {PERIOD_LABELS} from './data';
import type {PracticeAttemptProps} from './attempt-types';
import {displayTitle as titleText} from '../../components/display-text';
export default function AttemptHeader({exam,catalogUrl,audienceLabel,contextLabel,displayTitle,isHomework=false}:PracticeAttemptProps) {
  return <>{!isHomework&&<Link className="ep-link" href={catalogUrl}>← Danh sách đề</Link>}
    <header><p>{audienceLabel??'Lớp '+exam.grade} · {contextLabel??PERIOD_LABELS[exam.period]}</p><h1>{titleText(displayTitle??exam.title)}</h1><p>{exam.questions.length} câu · {exam.durationMinutes} phút · Thang điểm 10</p></header></>;
}
