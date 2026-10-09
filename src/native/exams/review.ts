import type {PracticeExam} from './data';
import type {Draft, Response} from './store';
import {resultFor} from './result';

export type ReviewStatus = 'correct' | 'partial' | 'wrong' | 'unanswered' | 'unscored';
export const STATUS_LABELS: Record<ReviewStatus,string> = {correct:'Đúng toàn bộ',partial:'Đúng một phần',wrong:'Chưa đúng',unanswered:'Chưa trả lời',unscored:'Chưa tính được điểm'};
export const statementLetters = ['a','b','c','d'];
export const formatPoints = (points:number) => (points/1000).toLocaleString('vi-VN',{maximumFractionDigits:3});
export function displayAnswer(answer:Response|undefined):string {
  if(Array.isArray(answer))return answer.map((v,i)=>`${statementLetters[i]}) ${v===null?'Chưa chọn':v?'Đúng':'Sai'}`).join('; ');
  return typeof answer==='string'&&answer.trim()?answer:'Chưa trả lời';
}
export function reviewRows(exam:PracticeExam,draft:Draft) {
  const result=resultFor(exam,draft);
  return exam.questions.map((q,index)=>{
    const answer=draft.answers[q.id];
    const hasResponse=Array.isArray(answer)?answer.some(v=>v!==null):typeof answer==='string'&&!!answer.trim();
    const scored=result?.score.ok?result.score.rows.find(r=>r.id===q.id):undefined;
    const earned=scored?.earnedMillipoints??0;
    const status:ReviewStatus=!scored?'unscored':!hasResponse?'unanswered':earned===q.maxMillipoints?'correct':earned>0?'partial':'wrong';
    return {q,index,answer,earned,status,invalidNumeric:result?.invalidNumeric.includes(q.id)??false};
  });
}

/** Only render unambiguous integer exponents. Raw notation is retained for
 * accessible text and copying; no expression evaluation or HTML parsing. */
export function mathTokens(text:string):{raw:string;exponent?:string}[] {
  const result:{raw:string;exponent?:string}[]=[];
  const regex=/(?<=[\p{L}\p{N})])\^([+-]?\d+)(?![\d.,/\p{L}])/gu;
  let last=0;
  for(const match of text.matchAll(regex)){
    result.push({raw:text.slice(last,match.index)});result.push({raw:match[0],exponent:match[1]});last=match.index+match[0].length;
  }
  result.push({raw:text.slice(last)});return result;
}
