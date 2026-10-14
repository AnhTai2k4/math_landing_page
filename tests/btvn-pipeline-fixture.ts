import {createHash} from 'node:crypto';
import type {PracticeExam} from '../src/native/exams/data';
import {expectedSlots} from '../server/btvn/publish-handler';
export const digest=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');
export function pipelineFixture(){
 const pdf=Buffer.from('%PDF-1.4\n% fixture fake; not a teaching document\n%%EOF\n'),sha=digest(pdf);
 const exam:PracticeExam={id:'mtm-custom-btvn-fake',title:'Đề giả kiểm hệ thống',grade:12,period:'GK1',durationMinutes:120,versionHash:'a'.repeat(64),sourceHash:'b'.repeat(64),sourceRef:'Dữ liệu giả',sourceUrl:'https://source.invalid/fake',questionCount:3,rubricVersion:'MTM-FLEX-10-v1',publicationVerified:true,questionDisplayVerified:true,answerKeyVerified:true,rubricVerified:true,sourceMaterial:{title:'Giả',publisher:'MTM sưu tầm và biên soạn',version:'fake',locator:'3 câu giả'},sections:[{label:'TN',kind:'mc',count:1},{label:'ĐS',kind:'tf',count:1},{label:'TLN',kind:'short',count:1}],questions:[
 {id:'mc-1',kind:'mc',sourceRef:'Câu giả 1',prompt:'2 + 2 = ?',choices:['1','2','3','4'],answer:'D',maxMillipoints:3000},
 {id:'tf-1',kind:'tf',sourceRef:'Câu giả 2',prompt:'Các mệnh đề giả',statements:['1=1','1=2','2=2','2=3'],answer:[true,false,true,false],pointsByCorrectCount:[0,500,1000,2000,4000],maxMillipoints:4000},
 {id:'sa-1',kind:'short',sourceRef:'Câu giả 3',prompt:'5 : 2 = ?',mode:'numeric',acceptedAnswers:['2.5'],maxMillipoints:3000}],sourcePdf:{url:`/exam-assets/${sha}.pdf`,sha256:sha,bytes:pdf.length,totalPages:1,questionPages:[1],verified:true}};
 const material={lessonCode:'fake-2026-10-15',classNames:['Lớp giả pipeline'],date:'2026-10-15',title:'Buổi giả',videoId:null,materialUrl:null,handoutUrl:null,homeworkUrl:null};
 return {action:'publish',lesson_key:material.lessonCode,source_version:'c'.repeat(64),material,exam,assets:[{path:`exam-assets/${sha}.pdf`,sha256:sha,content_type:'application/pdf',data_base64:pdf.toString('base64')}],verification:{validator:true,independent:true,receipt_hash:'d'.repeat(64),provider:'fake-independent',model:'fake-model',extractor_provider:'fake-extractor',slots:expectedSlots(exam).map(s=>({...s,actual:s.question_id==='sa-1'?'2,5':s.expected}))}};
}
