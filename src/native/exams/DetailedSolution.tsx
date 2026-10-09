import React,{useMemo} from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import bank from './detailed-solutions.json';
type Block={type:'text';text:string}|{type:'math';latex:string}|{type:'table';headers:string[];rows:string[][]};
type DetailedExam={examId:string;versionHash:string;questions:{id:string;sourceRef:string;blocks:Block[];answer:string}[]};
function Formula({latex,inline=false}:{latex:string;inline?:boolean}) {
  const html=useMemo(()=>{try{return katex.renderToString(latex,{displayMode:!inline,output:'htmlAndMathml',throwOnError:true,trust:false,maxSize:20,maxExpand:1000,strict:'warn',macros:{}});}catch{return null;}},[latex,inline]);
  return html?<span className={inline?'ep-inline-math':'ep-formula'} dangerouslySetInnerHTML={{__html:html}}/>:<code className="ep-formula-source">{latex}</code>;
}
function RichText({text}:{text:string}) {
  return <>{text.split(/(\$[^$\n]+\$)/g).map((part,i)=>part.startsWith('$')&&part.endsWith('$')?<Formula key={i} latex={part.slice(1,-1)} inline/>:part)}</>;
}
export default function DetailedSolution({examId,versionHash,questionId,fallback}:{examId:string;versionHash:string;questionId:string;fallback:string}) {
  const question=(bank as unknown as DetailedExam[]).find(exam=>exam.examId===examId&&exam.versionHash===versionHash)?.questions.find(q=>q.id===questionId);
  if(!question)return <p className="ep-math-text">{fallback}</p>;
  return <div className="ep-detailed-solution">{question.blocks.map((block,i)=>block.type==='text'?<p key={i}><RichText text={block.text}/></p>:block.type==='math'?<div className="ep-formula-line" key={i}><Formula latex={block.latex}/></div>:<div className="ep-table-wrap" key={i}><table className="ep-solution-table"><thead><tr>{block.headers.map((header,j)=><th key={j} scope="col"><RichText text={header}/></th>)}</tr></thead><tbody>{block.rows.map((row,j)=><tr key={j}>{row.map((cell,k)=><td key={k}><RichText text={cell}/></td>)}</tr>)}</tbody></table></div>)}</div>;
}
