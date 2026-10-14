import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';

// TH-05 (Đợt 4): bảng biến thiên (6-10 cột) rộng 400-530 px trong khung 277 px ở màn 375, phải cuộn ngang trong bảng.
// Khi bảng ngang không vừa khung, hiện cùng dữ liệu dạng dọc: mỗi cột cũ thành một hàng, giữ nguyên thứ tự, dấu,
// mũi tên và điểm không xác định; tiêu đề hàng/cột giữ đúng vai trò. Khung đủ rộng lại thì trở về dạng ngang.
// Học sinh vẫn có thể bấm "Xem dạng ngang" (cuộn ngang như cũ). Chỉ đổi cách bày, không đổi dữ liệu bảng.
export type TableData={caption?:string;headers:string[];rows:string[][]};

export default function FitTable({table,renderCell,rowHeaders=true}:{table:TableData;renderCell:(text:string)=>ReactNode;rowHeaders?:boolean}){
  const wrap=useRef<HTMLDivElement>(null),wide=useRef<HTMLTableElement>(null),naturalWidth=useRef(0);
  const [vertical,setVertical]=useState(false),[keepWide,setKeepWide]=useState(false);
  const canTranspose=table.headers.length>2&&table.rows.length>0&&table.rows.every(row=>row.length===table.headers.length);
  useLayoutEffect(()=>{
    const box=wrap.current;if(!box||!canTranspose||keepWide)return;
    const check=()=>{
      const available=box.clientWidth;
      if(wide.current){const needed=wide.current.scrollWidth;if(needed>available+1){naturalWidth.current=needed;setVertical(true);}}
      else if(naturalWidth.current&&available>=naturalWidth.current)setVertical(false);
    };
    check();
    if(typeof ResizeObserver!=='function')return;
    const observer=new ResizeObserver(check);observer.observe(box);if(wide.current)observer.observe(wide.current);
    return()=>observer.disconnect();
  },[vertical,keepWide,canTranspose,table]);
  const showVertical=vertical&&!keepWide&&canTranspose;
  const caption=table.caption?<caption>{renderCell(table.caption)}</caption>:null;
  return <div className={`ep-table-wrap${showVertical?' ep-table-vertical':''}`} ref={wrap}>
    {showVertical?<table className="ep-solution-table">{caption}
      <thead><tr>{[table.headers[0],...table.rows.map(row=>row[0])].map((cell,i)=><th scope="col" key={i}>{renderCell(cell)}</th>)}</tr></thead>
      <tbody>{table.headers.slice(1).map((header,j)=><tr key={j}><th scope="row">{renderCell(header)}</th>{table.rows.map((row,i)=><td key={i}>{renderCell(row[j+1])}</td>)}</tr>)}</tbody>
    </table>:<table className="ep-solution-table" ref={wide}>{caption}
      <thead><tr>{table.headers.map((cell,i)=><th scope="col" key={i}>{renderCell(cell)}</th>)}</tr></thead>
      <tbody>{table.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=>j===0&&rowHeaders?<th scope="row" key={j}>{renderCell(cell)}</th>:<td key={j}>{renderCell(cell)}</td>)}</tr>)}</tbody>
    </table>}
    {canTranspose&&(showVertical||keepWide)&&<button type="button" className="ep-table-toggle" aria-pressed={keepWide} onClick={()=>{setKeepWide(k=>!k);if(keepWide)setVertical(false);}}>{keepWide?'Xem dạng dọc vừa màn hình':'Xem dạng ngang (cuộn ngang)'}</button>}
  </div>;
}
