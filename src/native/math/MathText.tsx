import {useMemo} from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {schoolLatex} from '../exams/notation';
import authored from './mathtype-authored.json';
import './math-text.css';
const authoredMath=new Map(authored.map(item=>[item.latex,item.mathml]));
export const authoredFormula=(latex:string)=>authoredMath.get(latex);
/** Static MathML is imported/rendered/exported by MathType Web and whitelist checked at authoring.
 * Legacy formulas retain their existing renderer until independently migrated. */
function Formula({value}:{value:string}){const mathml=authoredMath.get(value);const html=useMemo(()=>{if(mathml)return mathml;try{return katex.renderToString(schoolLatex(value).replace(/\\subseteq(?![A-Za-z])/g,'\\subset'),{throwOnError:true,trust:false,output:'htmlAndMathml',maxExpand:1000,maxSize:20});}catch{return null;}},[value,mathml]);return html?<span className={mathml?'mtm-formula mtm-math-authored':'mtm-formula'} data-math-author={mathml?'MathType Web':undefined} dangerouslySetInnerHTML={{__html:html}}/>:<code>{value}</code>;}
export default function MathText({text}:{text:string}){const display=text.replace('Nguồn dùng $\\subset$ với nghĩa bao hàm, cho phép bằng nhau. Để tránh nhập nhằng, MTM dùng $\\subseteq$ cho bao hàm và $\\subsetneq$ cho tập con thực sự; dùng $\\in,\\notin$ cho phần tử.','Theo quy ước sách phổ thông, $\\subset$ biểu thị tập con, cho phép bằng nhau. Khi cần phân biệt, $\\subsetneq$ chỉ tập con thực sự (không bằng nhau). Dùng $\\in,\\notin$ cho quan hệ phần tử.');return <>{display.split(/(\$[^$\n]+\$)/g).map((part,i)=>part.startsWith('$')&&part.endsWith('$')?<Formula key={i} value={part.slice(1,-1)}/>:part)}</>;}
