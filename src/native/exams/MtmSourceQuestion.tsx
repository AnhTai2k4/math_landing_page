import React, {useContext, useId, useState} from 'react';
import RoomChoice from './RoomChoice';
import MathText from '../math/MathText';
import type {PracticeQuestion} from './data';
import MtmSourceContent from './MtmSourceContent';
import ZoomableImage from './ZoomableImage';
import {RoomQuestionContext} from './RoomQuestionContext';
import display from '../chapters/exact-source-display.json';

type SourceStatement={label:string;text:string};
type SourceDisplay={questionId:string;section:string;number:number;prompt:string;promptAfterFigure?:string;sourceDisplayCropSha256:string;choices?:{label:string;text:string}[];statements?:SourceStatement[];figureRef?:{path:string;width:number;height:number;alt?:string};questionTables?:{caption:string;headers:string[];rows:string[][]}[];interstitialContent?:{beforeStatement:string;text:string}[]};

function statementBlocks(entry:SourceDisplay) {
  const blocks:React.ReactElement[]=[];
  let run:SourceStatement[]=[], start=0;
  const flush=()=>{
    if(!run.length)return;
    blocks.push(<ol key={`statements-${start}`} className="mtm-native-statements" type="a" start={start+1}>{run.map(statement=><li key={statement.label}><MathText text={statement.text}/></li>)}</ol>);
    run=[];
  };
  entry.statements?.forEach((statement,index)=>{
    const context=entry.interstitialContent?.filter(block=>block.beforeStatement===statement.label)??[];
    if(context.length) {
      flush();
      context.forEach((block,i)=>blocks.push(<p key={`context-${statement.label}-${i}`}><MathText text={block.text}/></p>));
    }
    if(!run.length)start=index;
    run.push(statement);
  });
  flush();
  return blocks;
}

/** Same eligibility for source rendering and the sole room answer control. */
export function roomSourceDisplay(question:PracticeQuestion) {
  if(!question.sourceContent)return undefined;
  const entry=(display as SourceDisplay[]).find(item=>item.questionId===question.id);
  const matches=entry&&question.sourceContent.questions.some(segment=>segment.sha256===entry.sourceDisplayCropSha256);
  // Keep the original table layout; incomplete transcriptions use the complete source.
  const missingTableFigure=!!entry?.questionTables?.length&&!entry.figureRef;
  const missingContextAnchor=entry?.interstitialContent?.some(block=>!entry.statements?.some(statement=>statement.label===block.beforeStatement));
  return matches&&!missingTableFigure&&!missingContextAnchor?entry:undefined;
}

/** A checked transcription controls layout only. Grading and history retain their original identity. */
export default function MtmSourceQuestion({question}:{question:PracticeQuestion}) {
  const instance=useId();
  const inRoom=useContext(RoomQuestionContext)!==null;
  const [figureFailed,setFigureFailed]=useState(false);
  if(!question.sourceContent)return null;
  const entry=roomSourceDisplay(question);
  if(!entry)return <div data-question-id={question.id}><MtmSourceContent segments={question.sourceContent.questions} assetBase="/practice-media/source-crops" label={question.sourceRef} kind="question"/></div>;
  return <section data-question-id={question.id} className="mtm-source-content mtm-native-source" aria-label={`Đề ${question.sourceRef}`}>
    <div className="mtm-native-question-text">
      <p><MathText text={entry.prompt}/></p>
      {entry.figureRef&&<figure className="mtm-native-figure" style={{maxWidth:entry.figureRef.width>600?640:420}}>{figureFailed?<p className="mtm-source-error" role="alert"><span>Không tải được hình của {question.sourceRef}. Em có thể làm câu khác hoặc nộp phần đã làm.</span><button type="button" onClick={()=>setFigureFailed(false)}>Thử tải lại ảnh</button></p>:<ZoomableImage src={`/practice-media/source-crops/${entry.figureRef.path}`} width={entry.figureRef.width} height={entry.figureRef.height} loading={inRoom?'eager':'lazy'} watermark label={`Hình ${question.sourceRef}`} alt={entry.figureRef.alt??`Hình gốc ${question.sourceRef}`} onError={()=>setFigureFailed(true)}/>}</figure>}
      {entry.promptAfterFigure&&<p><MathText text={entry.promptAfterFigure}/></p>}
      {entry.choices&&<ol className="mtm-native-choices" type="A">{entry.choices.map(choice=><li key={choice.label}><RoomChoice questionId={question.id} choice={choice.label}><MathText text={choice.text}/></RoomChoice></li>)}</ol>}
      {entry.statements&&statementBlocks(entry)}
    </div>
    <svg className="mtm-source-watermark" aria-hidden="true" width="100%" height="100%"><defs><pattern id={`${instance}-native`} width="390" height="115" patternUnits="userSpaceOnUse"><text x="24" y="40" transform="rotate(-8 24 40)">MINH THÀNH MATH</text></pattern></defs><rect width="100%" height="100%" fill={`url(#${instance}-native)`}/></svg>
  </section>;
}
