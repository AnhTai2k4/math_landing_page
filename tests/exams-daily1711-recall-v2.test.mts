import assert from 'node:assert/strict';
import {validatePracticeExam,type PracticeExam} from '../src/native/exams/data';
import type {Draft} from '../src/native/exams/store';
import {resultRecallItems} from '../src/native/exams/result-recall';
import {all,mount,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D1711-RECALL-V2-'),file='src/native/exams/ResultRecall.tsx';
// Đề và lượt GIẢ chỉ dành cho test local, không dùng dữ liệu HS.
const exam:PracticeExam={id:'mtm-preview-synthetic-recall-v2',title:'Đề GIẢ',grade:10,period:'GK1',durationMinutes:5,rubricVersion:'MTM-FLEX-10-v1',versionHash:'a'.repeat(64),sourceHash:'b'.repeat(64),sourceRef:'Đề GIẢ local',sourceUrl:'https://example.invalid/gia',sourceMaterial:{title:'Đề GIẢ',publisher:'Test local',version:'fake-v1',locator:'5 câu giả'},publicationVerified:true,questionDisplayVerified:true,answerKeyVerified:true,rubricVerified:true,questionCount:5,sections:[{label:'I',kind:'mc',count:1},{label:'II',kind:'tf',count:2},{label:'III',kind:'short',count:2}],questions:[
  {id:'mc',kind:'mc',sourceRef:'GIẢ 1',prompt:'1 + 1 = ?',choices:['0','1','2','3'],answer:'C',solution:'1 + 1 = 2.',maxMillipoints:2000},
  {id:'tf-partial',kind:'tf',sourceRef:'GIẢ 2',prompt:'Xét số 2.',statements:['Dương','Chẵn','Lẻ','Âm'],answer:[true,true,false,false],pointsByCorrectCount:[0,200,500,1000,2000],solution:'2 dương và chẵn.',maxMillipoints:2000},
  {id:'tf-blank',kind:'tf',sourceRef:'GIẢ 3',prompt:'Xét số 4.',statements:['Dương','Chẵn','Lẻ','Âm'],answer:[true,true,false,false],pointsByCorrectCount:[0,200,500,1000,2000],solution:'4 dương và chẵn.',maxMillipoints:2000},
  {id:'short-blank',kind:'short',sourceRef:'GIẢ 4',prompt:'2x = 1.',mode:'rational',acceptedAnswers:['1/2'],solution:'x = 1/2.',maxMillipoints:2000},
  {id:'short-wrong',kind:'short',sourceRef:'GIẢ 5',prompt:'3x = 1.',mode:'rational',acceptedAnswers:['1/3'],solution:'x = 1/3.',maxMillipoints:2000},
]};
const draft:Draft={version:1,examId:exam.id,examVersionHash:exam.versionHash,rubricVersion:exam.rubricVersion,attemptId:'fake-only-v2',startedAt:1000,deadline:301000,updatedAt:2000,submittedAt:2000,revision:1,answers:{mc:'A','tf-partial':[true,null,null,null],'tf-blank':[null,null,null,null],'short-blank':'','short-wrong':'0'}};
const props=()=>({exam,draft,items:resultRecallItems(exam,draft),renderText:(value:string)=>value});
const select=(m:any,kind:string)=>{all(m.tree,n=>n.type==='select')[1].props.onChange({target:{value:kind}});m.draw();};
const blank=(m:any,checked:boolean)=>{all(m.tree,n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked}});m.draw();};

test('Lọc ba dạng câu kết hợp bỏ trống hoàn toàn; không coi TF mới trả lời một ý là bỏ trống',()=>{
  assert.equal(validatePracticeExam(exam).valid,true,JSON.stringify(validatePracticeExam(exam)));
  const before=JSON.stringify({exam,draft}),m=mount(file,props(),'RecallSession');try{
    assert.equal(m.tree.props['data-version'],'v2');assert.match(text(m.tree),/5 câu khớp lựa chọn/);
    select(m,'mc');assert.match(text(m.tree),/1 câu khớp lựa chọn/);blank(m,true);assert.match(text(m.tree),/0 câu khớp lựa chọn/);
    select(m,'tf');assert.match(text(m.tree),/1 câu khớp lựa chọn/);m.click('Bắt đầu ôn 1 thẻ');assert.match(text(m.tree),/Xét số 4/);assert.doesNotMatch(text(m.tree),/Xét số 2/);m.click('Dừng phiên ôn');
    select(m,'short');assert.match(text(m.tree),/1 câu khớp lựa chọn/);blank(m,false);assert.match(text(m.tree),/2 câu khớp lựa chọn/);
    select(m,'all');blank(m,true);assert.match(text(m.tree),/2 câu khớp lựa chọn/);assert.equal(JSON.stringify({exam,draft}),before);
  }finally{m.unmount();}
});

test('Kết quả rỗng có hướng dẫn và không mở phiên trống, callback Start cũ không bỏ qua bộ lọc mới',()=>{
  const m=mount(file,props(),'RecallSession');try{
    const oldStart=all(m.tree,n=>n.type==='button'&&text(n)==='Bắt đầu ôn 3 thẻ')[0].props.onClick;
    select(m,'mc');blank(m,true);const start=all(m.tree,n=>n.type==='button'&&text(n)==='Bắt đầu ôn 0 thẻ')[0];assert.equal(start.props.disabled,true);
    assert.match(text(m.tree),/Em chọn dạng khác hoặc bỏ lọc câu trống/);start.props.onClick();oldStart();m.draw();assert.doesNotMatch(text(m.tree),/Thẻ 1\//);
  }finally{m.unmount();}
});

test('Ôn lại đúng tập đã lọc, giữ lựa chọn khi dừng, không tăng điểm và không ghi dữ liệu',()=>{
  const before=JSON.stringify({exam,draft}),m=mount(file,props(),'RecallSession');try{
    select(m,'short');m.click('Bắt đầu ôn 2 thẻ');assert.match(text(m.tree),/2x = 1/);m.click('Em đã thử, xem đáp án và lời giải');m.click('Cần ôn lại, sang thẻ tiếp');
    assert.match(text(m.tree),/3x = 1/);m.click('Em đã thử, xem đáp án và lời giải');m.click('Đã hiểu, sang thẻ tiếp');m.click('Ôn lại 1 thẻ đã chọn');assert.match(text(m.tree),/2x = 1/);assert.doesNotMatch(text(m.tree),/3x = 1/);
    m.click('Dừng phiên ôn');assert.equal(all(m.tree,n=>n.type==='select')[1].props.value,'short');assert.match(text(m.tree),/2 câu khớp lựa chọn/);assert.equal(JSON.stringify({exam,draft}),before);
  }finally{m.unmount();}
});
test('Callback bắt đầu, lật, đánh dấu, dừng cũ không giành focus hoặc đổi thẻ của phiên đã lọc',()=>{
  const m=mount(file,props(),'RecallSession');try{
    select(m,'short');const oldStart=all(m.tree,n=>n.type==='button'&&text(n)==='Bắt đầu ôn 2 thẻ')[0].props.onClick;m.click('Bắt đầu ôn 2 thẻ');
    const oldReveal=all(m.tree,n=>n.type==='button'&&text(n)==='Em đã thử, xem đáp án và lời giải')[0].props.onClick,oldStop=all(m.tree,n=>n.type==='button'&&text(n)==='Dừng phiên ôn')[0].props.onClick;
    m.click('Em đã thử, xem đáp án và lời giải');const oldMark=all(m.tree,n=>n.type==='button'&&text(n)==='Đã hiểu, sang thẻ tiếp')[0].props.onClick;m.click('Đã hiểu, sang thẻ tiếp');
    const state=text(m.tree),focus=m.focused;oldStart();oldReveal();oldMark();oldStop();m.draw();assert.equal(text(m.tree),state);assert.equal(m.focused,focus);assert.match(state,/Thẻ 2\/2/);
  }finally{m.unmount();}
});
finish({note:'4 nhóm ca GIẢ; thẻ tự ôn v1 từ vòng 20261016-23 được nâng v2 với lọc dạng và bỏ trống.'});
