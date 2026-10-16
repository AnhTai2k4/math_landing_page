import React from 'react';
import {roundMtmTotal,type Fraction,type MtmScore,type MtmType} from './mtm-scoring';
import './mtm-score-breakdown.css';

const labels:Record<MtmType,string>={TN:'Trắc nghiệm',DS:'Đúng/Sai',TLN:'Trả lời ngắn',UNKNOWN:'Chưa xác định loại câu'};
export const formatMtmDisplay=(value:string)=>value.replace('.',',');
const fractionText=(value:Fraction)=>value.denominator==='1'?value.numerator:`${value.numerator}/${value.denominator}`;

/** Chỉ hiển thị kết quả của engine, không cộng lại các điểm đã làm tròn. */
export default function MtmScoreBreakdown({score}:{score:MtmScore}){
 const pending=score.officialTotal===null||score.officialDisplayTotal===null||score.pending.length>0;
 const globalPending=score.pending.some(issue=>!issue.questionId);
 return <section className="mtm-score-breakdown" aria-label="Bảng điểm từng phần">
  <h3>Điểm từng phần</h3>
  <div className="mtm-score-table" role="region" aria-label="Bảng điểm từng phần, có thể cuộn ngang" tabIndex={0}>
   <table>
    <caption>Thang MTM: mỗi câu lớn có điểm tối đa bằng 10/N.</caption>
    <thead><tr><th scope="col">Phần</th><th scope="col">Điểm gốc</th><th scope="col">Điểm hiển thị</th><th scope="col">Tối đa</th></tr></thead>
    <tbody>{score.sections.map(section=>{
     const rows=score.rows.filter(row=>row.type===section.type),sectionPending=globalPending||rows.some(row=>row.status==='ungradable');
     return <tr key={section.type}><th scope="row">{labels[section.type]}<small>{rows.length} câu</small></th><td>{sectionPending?'Chờ chấm':fractionText(section.rawTotal)}</td><td>{sectionPending?'Chờ chấm':formatMtmDisplay(roundMtmTotal(section.rawTotal))}</td><td>{fractionText(section.maxScore)}</td></tr>;
    })}</tbody>
    <tfoot><tr><th scope="row">Tổng điểm</th>{pending?<td colSpan={3}>Chưa công bố tổng điểm</td>:<><td>{fractionText(score.officialTotal!)}</td><td><strong>{formatMtmDisplay(score.officialDisplayTotal!)}</strong></td><td>10</td></>}</tr></tfoot>
   </table>
  </div>
  <p className="mtm-score-note">Tổng tính từ điểm gốc bằng phân số chính xác, sau đó làm tròn ROUND_HALF_UP đến 2 chữ số thập phân. Không cộng các điểm từng phần đã làm tròn để tính tổng.</p>
  {pending&&<p className="mtm-score-pending" role="status">Có phần chưa chấm được. Tổng điểm chỉ được công bố sau khi tất cả các phần đã được chấm và xác minh.</p>}
 </section>;
}
