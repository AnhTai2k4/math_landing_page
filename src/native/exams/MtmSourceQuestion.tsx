import React, {useId, useState} from 'react';
import MathText from '../math/MathText';
import type {PracticeQuestion} from './data';
import MtmSourceContent from './MtmSourceContent';
import display from '../chapters/exact-t04-question-display.json';

/** A checked transcription controls layout only. Grading and history retain their original identity. */
export default function MtmSourceQuestion({question}:{question:PracticeQuestion}) {
  const instance=useId();
  const [figureFailed,setFigureFailed]=useState(false);
  if(!question.sourceContent)return null;
  const prefix='mtm-drive-g10-c1-t04-mtm-errata-v1-';
  const id=question.id.startsWith(prefix)?question.id.slice(prefix.length):'';
  const entry=display.nativeQuestionDisplay.find(item=>`${item.section}${item.number}`===id);
  const matches=entry&&question.sourceContent.questions.some(segment=>segment.sha256===entry.sourceOriginalCropSha256);
  if(!matches)return <MtmSourceContent segments={question.sourceContent.questions} assetBase="/practice-media/source-crops" label={question.sourceRef} kind="question"/>;
  return <section className="mtm-source-content mtm-native-source" aria-label={`Đề ${question.sourceRef}`}>
    <div className="mtm-native-question-text">
      <p><MathText text={entry.prompt}/></p>
      {entry.figureRef&&<figure className="mtm-native-figure">{figureFailed?<p role="alert">Không tải được hình của {question.sourceRef}. Hãy tải lại trang để đọc đủ câu hỏi.</p>:<img src={`/practice-media/source-crops/${entry.figureRef.path}`} width={entry.figureRef.width} height={entry.figureRef.height} loading="lazy" decoding="async" alt={`Hình gốc ${question.sourceRef}`} onError={()=>setFigureFailed(true)}/>}</figure>}
      {entry.choices&&<ol className="mtm-native-choices" type="A">{entry.choices.map(choice=><li key={choice.label}><MathText text={choice.text}/></li>)}</ol>}
      {entry.statements&&<ol className="mtm-native-statements" type="a">{entry.statements.map(statement=><li key={statement.label}><MathText text={statement.text}/></li>)}</ol>}
    </div>
    <svg className="mtm-source-watermark" aria-hidden="true" width="100%" height="100%"><defs><pattern id={`${instance}-native`} width="390" height="115" patternUnits="userSpaceOnUse"><text x="24" y="40" transform="rotate(-8 24 40)">MINH THÀNH MATH</text></pattern></defs><rect width="100%" height="100%" fill={`url(#${instance}-native)`}/></svg>
  </section>;
}
