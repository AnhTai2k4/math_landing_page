import type {PracticeExam} from '../exams/data';
import MathText from '../math/MathText';
import theoryTables from './theory-tables.json';
import './theory-tables.css';

type SourceTable={caption:string;headers:string[];rows:string[][]};
type Recall={title:string;scope?:string;notationConvention?:string;sections:{title:string;body:string;tables?:SourceTable[]}[]};
export default function TheorySummary({exam}:{exam:PracticeExam}){
  const recall=(exam as PracticeExam&{theoryRecall?:Recall}).theoryRecall;
  const sourceTableByExam:Record<string,string>={'mtm-drive-g10-c1-t04-mtm-errata-v1':'g10-c1','mtm-drive-g11-c1-t01-mtm-errata-v1':'g11-c1-foundation01','mtm-drive-g12-c1-t01-mtm-errata-v1':'g12-c1'};
  const summary=theoryTables.tables.find(table=>table.examIds.includes(exam.id)||table.id===sourceTableByExam[exam.id]);
  if(!recall&&!summary)return null;
  return <details className="cp-theory"><summary>Ôn công thức và lý thuyết của chương</summary>
    <h3>{summary?.title??recall?.title}</h3>
    {summary?<>
      <p className="mtm-theory-intro">Đọc công thức cùng điều kiện; xem cột cuối để biết cách dùng và tránh nhầm.</p>
      <table className="mtm-theory-table"><caption>Kiến thức cần nhớ trước khi làm bài</caption>
        <thead><tr>{summary.headers.map(header=><th key={header} scope="col">{header}</th>)}</tr></thead>
        <tbody>{summary.rows.map(row=><tr key={row.id}>
          <th scope="row">{row.topic}</th>
          <td data-label={summary.headers[1]}>{row.formulaLines.map((line,index)=><div className="mtm-theory-line" key={index}><MathText text={line}/></div>)}</td>
          <td data-label={summary.headers[2]}>{row.usageLines.map((line,index)=><div className="mtm-theory-line" key={index}><MathText text={line}/></div>)}</td>
        </tr>)}</tbody>
      </table>
    </>:recall?.sections.map((section,index)=><section key={index}><h4>{section.title}</h4><p><MathText text={section.body}/></p></section>)}
    {(summary?.referenceTables??recall?.sections.flatMap(section=>section.tables??[])??[]).map((table,index)=><div className="mtm-theory-reference" key={index}><table>
      <caption><MathText text={table.caption}/></caption>
      <thead><tr>{table.headers.map((header,i)=><th scope="col" key={i}><MathText text={header}/></th>)}</tr></thead>
      <tbody>{table.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=>j===0?<th scope="row" key={j}><MathText text={cell}/></th>:<td key={j}><MathText text={cell}/></td>)}</tr>)}</tbody>
    </table></div>)}
    {recall?.notationConvention&&<p className="cp-notation"><MathText text={recall.notationConvention}/></p>}
  </details>;
}
