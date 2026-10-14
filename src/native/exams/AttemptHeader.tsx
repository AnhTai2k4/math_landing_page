import {Link} from '../../migration/navigation';
import {PERIOD_LABELS} from './data';
import type {PracticeAttemptProps} from './attempt-types';
export default function AttemptHeader({exam,catalogUrl,audienceLabel,contextLabel,displayTitle}:PracticeAttemptProps) {
  return <><Link className="ep-link" href={catalogUrl}>← Danh sách đề</Link>
    <header><p>{audienceLabel??'Lớp '+exam.grade} · {contextLabel??PERIOD_LABELS[exam.period]}</p><h1>{displayTitle??exam.title}</h1><p>{exam.questions.length} câu · {exam.durationMinutes} phút · Thang điểm 10</p></header></>;
}
