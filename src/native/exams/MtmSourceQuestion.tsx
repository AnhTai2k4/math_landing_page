import React, {useId, useState} from 'react';
import MathText from '../math/MathText';
import type {PracticeQuestion} from './data';
import MtmSourceContent from './MtmSourceContent';
import display from '../chapters/exact-source-display.json';

type SourceDisplay={questionId:string;section:string;number:number;prompt:string;promptAfterFigure?:string;sourceDisplayCropSha256:string;choices?:{label:string;text:string}[];statements?:{label:string;text:string}[];figureRef?:{path:string;width:number;height:number;alt?:string};questionTables?:{caption:string;headers:string[];rows:string[][]}[]};

/** A checked transcription controls layout only. Grading and history retain their original identity. */
export default function MtmSourceQuestion({question}:{question:PracticeQuestion}) {
  const instance=useId();
  const [figureFailed,setFigureFailed]=useState(false);
  if(!question.sourceContent)return null;
  const entry=(display as SourceDisplay[]).find(item=>item.questionId===question.id);
  const matches=entry&&question.sourceContent.questions.some(segment=>segment.sha256===entry.sourceDisplayCropSha256);
  if(!matches)return <MtmSourceContent segments={question.sourceContent.questions} assetBase="/practice-media/source-crops" label={question.sourceRef} kind="question"/>;
  return <section className="mtm-source-content mtm-native-source" aria-label={`Đề ${question.sourceRef}`}>
    <div className="mtm-native-question-text">
      <p><MathText text={entry.prompt}/></p>
      {entry.figureRef&&<figure className="mtm-native-figure" style={{maxWidth:entry.figureRef.width>600?640:420}}>{figureFailed?<p role="alert">Không tải được hình của {question.sourceRef}. Hãy tải lại trang để đọc đủ câu hỏi.</p>:<img src={`/practice-media/source-crops/${entry.figureRef.path}`} width={entry.figureRef.width} height={entry.figureRef.height} loading="lazy" decoding="async" alt={entry.figureRef.alt??`Hình gốc ${question.sourceRef}`} onError={()=>setFigureFailed(true)}/>}</figure>}
      {entry.promptAfterFigure&&<p><MathText text={entry.promptAfterFigure}/></p>}
      {entry.choices&&<ol className="mtm-native-choices" type="A">{entry.choices.map(choice=><li key={choice.label}><MathText text={choice.text}/></li>)}</ol>}
      {entry.statements&&<ol className="mtm-native-statements" type="a">{entry.statements.map(statement=><li key={statement.label}><MathText text={statement.text}/></li>)}</ol>}
    </div>
    <svg className="mtm-source-watermark" aria-hidden="true" width="100%" height="100%"><defs><pattern id={`${instance}-native`} width="390" height="115" patternUnits="userSpaceOnUse"><text x="24" y="40" transform="rotate(-8 24 40)">MINH THÀNH MATH</text></pattern></defs><rect width="100%" height="100%" fill={`url(#${instance}-native)`}/></svg>
  </section>;
}
