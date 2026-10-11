import {useMemo} from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {schoolLatex} from '../exams/notation';
function Formula({value}:{value:string}){const html=useMemo(()=>{try{return katex.renderToString(schoolLatex(value).replace(/\\subseteq(?![A-Za-z])/g,'\\subset'),{throwOnError:true,trust:false,output:'htmlAndMathml',maxExpand:1000,maxSize:20});}catch{return null;}},[value]);return html?<span dangerouslySetInnerHTML={{__html:html}}/>:<code>{value}</code>;}
export default function MathText({text}:{text:string}){const display=text.replace('Nguồn dùng $\\subset$ với nghĩa bao hàm, cho phép bằng nhau. Để tránh nhập nhằng, MTM dùng $\\subseteq$ cho bao hàm và $\\subsetneq$ cho tập con thực sự; dùng $\\in,\\notin$ cho phần tử.','Theo quy ước sách phổ thông, $\\subset$ biểu thị tập con, cho phép bằng nhau. Khi cần phân biệt, $\\subsetneq$ chỉ tập con thực sự (không bằng nhau). Dùng $\\in,\\notin$ cho quan hệ phần tử.');return <>{display.split(/(\$[^$\n]+\$)/g).map((part,i)=>part.startsWith('$')&&part.endsWith('$')?<Formula key={i} value={part.slice(1,-1)}/>:part)}</>;}
