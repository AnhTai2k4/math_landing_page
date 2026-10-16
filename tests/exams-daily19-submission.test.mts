import assert from 'node:assert/strict';
import type {HomeworkState} from '../src/native/homework/btvn-contract';
import {MTM_SCORING_VERSION} from '../src/native/exams/mtm-scoring';
import {createHomeworkSubmissionSummary,createHomeworkResultSummary,acknowledgedHomeworkSubmission} from '../src/native/homework/result-summary';
import {all,load,mount,React,require,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D19-SUBMISSION-'),T0=Date.UTC(2026,9,16,3);
const fixture=():HomeworkState=>({exam:null,fullName:'TEN-GIA-KHONG-XUAT',className:'LOP-GIA-KHONG-XUAT',lessonCode:'BUOI-GIA',dueAt:null,maxAttempts:5,attemptsUsed:1,bestScore:null,demo:true,
 draft:{version:1,examId:'DE-GIA',examVersionHash:'a'.repeat(64),rubricVersion:MTM_SCORING_VERSION,answerKeyVersion:'KHOA-GIA',attemptId:'LUOT-GIA',startedAt:T0,deadline:T0+60000,updatedAt:T0+1000,submittedAt:T0+1000,revision:1,answers:{'CAU-GIA':'DAP-AN-GIA'}},
 receipts:[{attemptId:'LUOT-GIA',attemptNumber:1,submittedAt:T0+1000,elapsedSeconds:1,score:9.99,rubricVersion:MTM_SCORING_VERSION,late:false,timedOut:false}]});
const expected=['MINH THÀNH MATH','Phiếu xác nhận đã nộp BTVN','Máy chủ đã xác nhận nhận bản nộp đang xem.','Điểm đang đối soát.','Phiếu này không xác nhận điểm, thời gian hoặc hạn nộp.','Phiếu này không được gửi tự động.'].join('\n');
test('ACK có nhưng thiếu snapshot chỉ cho phiếu literal, không thay cổng điểm hoặc dữ liệu',()=>{
 const state=fixture(),before=JSON.stringify(state);assert.equal(acknowledgedHomeworkSubmission(state),state.receipts[0]);assert.equal(createHomeworkResultSummary(state),null);assert.equal(createHomeworkSubmissionSummary(state),expected);assert.equal(JSON.stringify(state),before);
 const extra:any={...state,privateUrl:'URL-GIA-RIENG',note:'GHI-CHU-GIA',receipts:[{...state.receipts[0],attemptNumber:92374,submittedAt:T0+999,elapsedSeconds:87654,phone:'SDT-GIA',mtm:{versions:{rubricVersion:MTM_SCORING_VERSION},officialDisplayTotal:'9.99'}}]};
 assert.equal(createHomeworkSubmissionSummary(extra),expected);for(const secret of ['TEN-GIA','LOP-GIA','BUOI-GIA','LUOT-GIA','URL-GIA','SDT-GIA','9.99','92374','87654','DAP-AN-GIA','GHI-CHU-GIA'])assert.ok(!expected.includes(secret));
});
test('Không có ACK duy nhất hoặc chưa nộp thì không tạo phiếu, tháng trước/sau công bố vẫn giữ chặn',()=>{
 const base=fixture();for(const state of [{...base,draft:null},{...base,draft:{...base.draft!,submittedAt:null}},{...base,receipts:[]},{...base,receipts:[{...base.receipts[0],attemptId:'SAI-LUOT'}]},{...base,receipts:[base.receipts[0],base.receipts[0]]},...[false,true].map(solutionsAvailable=>({...base,kind:'kiem-tra-thang' as const,solutionsAvailable}))])assert.equal(createHomeworkSubmissionSummary(state),null);
});
test('Lỗi metadata phiếu khi điểm legacy đã được xác nhận không bị gán là đối soát',()=>{
 const state=fixture();state.draft!.rubricVersion='LEGACY-GIA';state.receipts=[{...state.receipts[0],rubricVersion:undefined,score:8,elapsedSeconds:-1}];
 assert.equal(createHomeworkResultSummary(state),null);assert.equal(createHomeworkSubmissionSummary(state),null);
 state.receipts[0].elapsedSeconds=1;assert.match(createHomeworkResultSummary(state)!,/Điểm: 8\/10/);assert.equal(createHomeworkSubmissionSummary(state),null);
});
const file='src/native/homework/HomeworkResultSummary.tsx';
test('UI/SSR nói đúng xác nhận nộp và không hứa điểm/thời gian; thành phần cũ vẫn giữ nhãn',()=>{
 const Component=load(file).default,render=(state:HomeworkState)=>require('react-dom/server').renderToStaticMarkup(React.createElement(Component,{state}));
 const html=render(fixture());assert.match(html,/Phiếu xác nhận đã nộp để tự gửi/);assert.match(html,/Sao chép phiếu xác nhận đã nộp/);assert.match(html,/đang đối soát/);assert.doesNotMatch(html,/9\.99|TEN-GIA|LOP-GIA|LUOT-GIA|BUOI-GIA/);
 assert.equal(render({...fixture(),kind:'kiem-tra-thang',solutionsAvailable:false}),'');
});
// Đổi lượt khi clipboard đang chờ không được hiển thị thành công của phiếu cũ.
const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
let resolve!:()=>void;const writes:string[]=[];
try{
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText(value:string){writes.push(value);return new Promise<void>(done=>resolve=done);}}}});
 const m=mount(file,{state:fixture()});all(m.tree,n=>n.type==='button')[0].props.onClick();m.draw();assert.equal(all(m.tree,n=>n.type==='button')[0].props.disabled,true);assert.deepEqual(writes,[expected]);
 const other=fixture();other.draft!.attemptId='LUOT-KHAC-GIA';other.receipts[0].attemptId='LUOT-KHAC-GIA';m.draw({state:other});
 resolve();await Promise.resolve();await Promise.resolve();m.draw();assert.ok(!text(m.tree).includes('Đã sao chép'));assert.equal(all(m.tree,n=>n.type==='button')[0].props.disabled,false);m.unmount();
 console.log('ĐẠT D19-SUBMISSION-ASYNC clipboard cũ không báo thành công sau đổi lượt.');
}finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete (globalThis as any).navigator;}
finish({note:'Fixture tổng hợp, clipboard giả, không có gửi mạng hoặc dữ liệu học sinh thật.'});
