import {validateAssessment,scoreAssessment,type Assessment,type Validation} from './assessment';
import {validateMtmAssessment} from './mtm-profile';
export type ExamSection={label:string;kind:'mc'|'tf'|'short';count:number};
export const FLEX_RUBRIC='MTM-FLEX-10-v1';
export function validatePracticeProfile(input:unknown):Validation {
 const e=input as Assessment&{rubricVersion?:string;sections?:ExamSection[]};
 if(e?.rubricVersion!==FLEX_RUBRIC)return validateMtmAssessment(input);
 const gate=validateAssessment(input);if(!gate.valid)return gate;
 const errors:string[]=[];
 if(!e.id.startsWith('mtm-custom-')&&!e.id.startsWith('mtm-preview-')&&!e.id.startsWith('mtm-practice-'))errors.push('Flexible profile requires a custom edition');
 if(!Array.isArray(e.sections)||!e.sections.length||e.sections.length>12)return{valid:false,errors:[...errors,'Sections required']};
 let offset=0;for(const section of e.sections){if(!section||typeof section.label!=='string'||!section.label.trim()||section.label.length>100||!['mc','tf','short'].includes(section.kind)||!Number.isSafeInteger(section.count)||section.count<1||section.count>300){errors.push('Invalid section');continue;}
 if(e.questions.slice(offset,offset+section.count).length!==section.count||e.questions.slice(offset,offset+section.count).some(q=>q.kind!==section.kind))errors.push('Section/question mismatch');offset+=section.count;}
 if(offset!==e.questions.length||offset>300)errors.push('Complete section counts required');
 return{valid:!errors.length,errors};
}
export function scorePracticeAssessment(input:unknown,answers:unknown){const g=validatePracticeProfile(input);return g.valid?scoreAssessment(input,answers):{ok:false as const,errors:g.errors};}
export function examSections(e:{sections?:ExamSection[];questions:{kind:string}[]}) {
 const source=e.sections??[{label:'I · Trắc nghiệm',kind:'mc',count:12},{label:'II · Đúng/sai',kind:'tf',count:4},{label:'III · Trả lời ngắn',kind:'short',count:6}];
 let from=0;return source.map(s=>{const part={...s,name:s.label,from,to:from+s.count};from=part.to;return part;});
}
