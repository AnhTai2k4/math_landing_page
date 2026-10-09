import type {PracticeExam} from './data';
/** Thành approved these two practice conditions. Original PDFs/catalog/attempts
 * remain unchanged; revised attempts use separate ids, hashes and storage keys. */
export const PRACTICE_ERRATA=[
  {
    "baseId": "mtm-tm-modern-supplement-11-GK1-47-code157",
    "questionId": "II-2",
    "condition": "Phần II, câu 2: bổ sung điều kiện công bội q≠0.",
    "id": "mtm-tm-modern-supplement-11-GK1-47-code157-mtm-v37",
    "baseVersionHash": "e331d33164e392b1ffbd0c89d21fb096a2accb16702029a8f0cdb6cbfda4a7a0",
    "versionHash": "145b3adb43ee6c5668d73ea4c252af2522d7a82c1dfcc6e41e32c2c6b7b8e2ba"
  },
  {
    "baseId": "mtm-tm-modern-supplement-11-GK1-7-code101",
    "questionId": "II-3",
    "condition": "Phần II, câu 3: M nằm bên trong cạnh AB và N nằm bên trong cạnh AC; M, N không trùng các đầu mút.",
    "id": "mtm-tm-modern-supplement-11-GK1-7-code101-mtm-v37",
    "baseVersionHash": "6483206a04365feceed83bca6c2e08f0b9a82dbf6d413e615f67fb1c6c2695d2",
    "versionHash": "08a3092a04f4712d6a3a92aa1bf293b6593d49fb42b72894e0d754c5cd87cada"
  }
];
export function erratumFor(examId:string){return PRACTICE_ERRATA.find(e=>e.id===examId||e.baseId===examId);}
export function originalExamId(examId:string){return erratumFor(examId)?.baseId??examId;}
export function practiceVersion(exam:PracticeExam):PracticeExam {
 const erratum=PRACTICE_ERRATA.find(e=>e.baseId===exam.id&&e.baseVersionHash===exam.versionHash);
 if(!erratum)return exam;
 return {...exam,id:erratum.id,versionHash:erratum.versionHash,sourceMaterial:{...exam.sourceMaterial,version:exam.sourceMaterial.version+' · MTM đính chính v37'},answerVerificationNote:(exam.answerVerificationNote??'')+' Bản luyện tập MTM đính chính, đã được Thành duyệt: '+erratum.condition+' PDF gốc giữ nguyên. Lượt cũ dùng điều kiện trước đính chính.'};
}
export function historyVersions(catalog:readonly PracticeExam[]){return catalog.flatMap(e=>{const revised=practiceVersion(e);return revised===e?[e]:[e,revised];});}
