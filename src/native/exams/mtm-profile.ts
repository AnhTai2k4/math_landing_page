import {validateAssessment,scoreAssessment,type Assessment,type ScoreResult,type Validation} from './assessment';

/** Thành's MTM profile: 12 MC, 4 four-statement true/false, 6 short answers.
 * General assessment validation stays unchanged. No fabricated questions,
 * reordered source data, automatic essay conversion or point rescaling. */
export const MTM_PROFILE = Object.freeze({id:'MTM-12MC-4TF-6SHORT-v1',questionCount:22,mc:12,tf:4,short:6});
export function validateMtmAssessment(input:unknown):Validation {
  const general=validateAssessment(input);
  if(!general.valid)return general;
  const exam=input as Assessment,errors:string[]=[];
  if(exam.questionCount!==22)errors.push('MTM profile: exactly22 source questions required (12MC + 4TF + 6short)');
  if(exam.questions.some(q=>q.kind==='essay'))errors.push('MTM profile: essays are excluded; do not convert them automatically');
  if(exam.questions.length===22)exam.questions.forEach((q,i)=>{
    const expected=i<12?'mc':i<16?'tf':'short';
    if(q.kind!==expected)errors.push('MTM profile: question '+(i+1)+' must be '+expected+' in source section order');
  });
  return {valid:!errors.length,errors};
}
export function scoreMtmAssessment(input:unknown,submitted:unknown):ScoreResult {
  const gate=validateMtmAssessment(input);
  return gate.valid?scoreAssessment(input,submitted):{ok:false,errors:gate.errors};
}
