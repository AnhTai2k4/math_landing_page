import assert from 'node:assert/strict';
import {nextHomework,homeworkPriorityDeadline,homeworkPriorityReason} from '../src/native/homework/homework-priority';
import type {HomeworkLesson} from '../src/native/homework/btvn-contract';
import {all,load,mount,React,require,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D21-PRIORITY-'),T0=Date.parse('2026-10-16T12:00:00+07:00');
const base:HomeworkLesson={lessonCode:'fake21',classNames:['LỚP GIẢ'],date:'2026-10-15',title:'Buổi giả',videoId:null,materialUrl:null,handoutUrl:null,homeworkUrl:null,dueAt:T0+1000,opensAt:T0-1000,locked:false,bestScore:null,submittedAt:null,late:null,available:true};
const lesson=(code:string,patch:Partial<HomeworkLesson>={}):HomeworkLesson=>({...base,lessonCode:code,...patch});

test('Ưu tiên hạn thật còn hiệu lực, rồi quá hạn, rồi chưa xác minh; ổn định, không sửa đầu vào',()=>{
  const list=[lesson('unknown',{dueAt:null,expectedDueAt:T0+1}),lesson('late',{dueAt:T0-500}),lesson('later',{dueAt:T0+2000}),lesson('soon')],before=[...list];
  assert.equal(nextHomework(list,T0)?.lessonCode,'soon');assert.deepEqual(list,before);
  assert.equal(nextHomework(list.slice(0,2),T0)?.lessonCode,'late');assert.equal(nextHomework([list[0]],T0)?.lessonCode,'unknown');
  assert.equal(nextHomework([lesson('B'),lesson('A')],T0)?.lessonCode,'A');
  assert.equal(nextHomework([lesson('old',{dueAt:T0-1}),lesson('edge',{dueAt:T0})],T0)?.lessonCode,'old');
  assert.match(homeworkPriorityReason(lesson('edge',{dueAt:T0}),T0),/quá hạn/);
  assert.equal(homeworkPriorityDeadline(lesson('bad',{dueAt:NaN})),null);assert.equal(nextHomework(list,NaN),undefined);
});

test('Không gợi ý bài chưa mở, thiếu đề, đã nộp chờ điểm, đã có điểm kể cả 0',()=>{
  for(const patch of [{available:false},{opensAt:T0+1},{opensAt:NaN,locked:true},{submittedAt:T0-1},{submittedAt:0},{bestScore:0},{bestScore:9}])assert.equal(nextHomework([lesson('exclude',patch)],T0),undefined,JSON.stringify(patch));
  assert.equal(nextHomework([lesson('opened',{opensAt:T0,locked:true})],T0)?.lessonCode,'opened');
});

test('Kiểm tra tháng dùng closesAt, không gợi ý bài đã đóng hoặc thiếu mốc; BTVN vẫn có thể muộn',()=>{
  const monthly=lesson('monthly',{kind:'kiem-tra-thang',closesAt:T0+500,dueAt:T0-999});
  assert.equal(nextHomework([monthly,base],T0)?.lessonCode,'monthly');assert.equal(homeworkPriorityDeadline(monthly),T0+500);
  assert.doesNotMatch(homeworkPriorityReason(monthly,T0),/muộn/);
  for(const closesAt of [T0-1,T0,undefined,NaN])assert.equal(nextHomework([{...monthly,closesAt}],T0),undefined);
  assert.equal(nextHomework([lesson('late',{dueAt:T0-500})],T0)?.lessonCode,'late');
});

test('SSR dùng cùng clock server khi máy lệch 24h, không thay danh sách buổi gốc',()=>{
  const original=Date.now,Component=load('src/native/homework/LessonCards.tsx').default;
  try{for(const skew of [-86400000,86400000]){
    Date.now=()=>T0+skew;
    const html=require('react-dom/server').renderToStaticMarkup(React.createElement(Component,{lessons:[base,lesson('locked',{opensAt:T0+1})],busy:false,onHomework(){},serverNow:T0,clientReceivedAt:T0+skew}));
    assert.match(html,/Việc nên làm tiếp/);assert.match(html,/Bài đang mở có hạn nộp gần nhất/);assert.match(html,/Mở bài được gợi ý/);
    assert.doesNotMatch(html,/BTVN chưa nộp đã quá hạn/);assert.match(html,/Chưa mở/);
  }}finally{Date.now=original;}
});

test('Nút chỉ chọn bài hiển thị; khóa busy và kiểm lại giờ đóng ở lúc bấm, không tự start',()=>{
  const original=Date.now,calls:string[]=[],file='src/native/homework/LessonCards.tsx';let now=T0;Date.now=()=>now;
  const monthly=lesson('monthly',{kind:'kiem-tra-thang',closesAt:T0+500});
  const props={lessons:[base,monthly],busy:false,onHomework:(code:string)=>calls.push(code),serverNow:T0,clientReceivedAt:T0};
  const m=mount(file,props);try{
    const old=all(m.tree,n=>n.type==='button'&&text(n)==='Mở bài được gợi ý')[0].props.onClick;
    m.click('Mở bài được gợi ý');assert.deepEqual(calls,['monthly']);
    now=T0+500;old();assert.deepEqual(calls,['monthly']);
    m.draw({...props,lessons:[base],busy:true});m.click('Mở bài được gợi ý');assert.deepEqual(calls,['monthly']);
    assert.equal(all(m.tree,n=>n.type==='button'&&text(n)==='Mở bài được gợi ý')[0].props.disabled,true);
    m.draw({...props,lessons:[base]});m.click('Mở bài được gợi ý');assert.deepEqual(calls,['monthly','fake21']);
    m.draw({...props,lessons:[lesson('submitted',{submittedAt:T0})]});assert.doesNotMatch(text(m.tree),/Việc nên làm tiếp/);assert.match(text(m.tree),/Xem bài đã nộp/);
  }finally{m.unmount();Date.now=original;}
});
test('Qua hạn ngay lúc bấm thì cập nhật gợi ý và báo lý do, không mở nhầm bài khác',()=>{
  const original=Date.now,calls:string[]=[],file='src/native/homework/LessonCards.tsx';let now=T0;Date.now=()=>now;
  const props={lessons:[lesson('A',{dueAt:T0+1000}),lesson('B',{dueAt:T0+2000})],busy:false,onHomework:(code:string)=>calls.push(code),serverNow:T0,clientReceivedAt:T0};
  const m=mount(file,props);try{
    assert.equal(all(m.tree,n=>n.type==='button'&&text(n)==='Mở bài được gợi ý')[0].props['aria-describedby'],'next-homework-A-reason');
    now=T0+1100;m.click('Mở bài được gợi ý');assert.deepEqual(calls,[]);
    assert.equal(all(m.tree,n=>n.type==='button'&&text(n)==='Mở bài được gợi ý')[0].props['aria-describedby'],'next-homework-B-reason');
    assert.ok(all(m.tree,n=>n.props['aria-live']==='polite').some(n=>/Gợi ý vừa thay đổi/.test(text(n))));
    m.click('Mở bài được gợi ý');assert.deepEqual(calls,['B']);assert.doesNotMatch(text(m.tree),/Gợi ý vừa thay đổi/);
    m.draw({...props,lessons:[lesson('monthly',{kind:'kiem-tra-thang',closesAt:T0+1500})]});
    now=T0+1500;m.click('Mở bài được gợi ý');assert.deepEqual(calls,['B']);
    assert.doesNotMatch(text(m.tree),/Việc nên làm tiếp/);
    assert.ok(all(m.tree,n=>n.props['aria-live']==='polite').some(n=>/không còn bài phù hợp/.test(text(n))));
  }finally{m.unmount();Date.now=original;}
});
finish({note:'Lựa chọn local, clock, hook/SSR; không gọi gateway/start hoặc dùng dữ liệu thật.'});
