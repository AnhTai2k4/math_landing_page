import assert from 'node:assert/strict';
import {homeworkServerNow} from '../src/native/homework/asset-renewal';
import {mergeOpeningState,scheduleOpeningRefresh} from '../src/native/homework/opening-refresh';
import {createHomeworkDeadlineICS} from '../src/native/homework/deadline-calendar';
import type {HomeworkState} from '../src/native/homework/btvn-contract';
import {all,load,mount,React,require,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D20-CLOCK-'),T0=Date.parse('2026-10-16T00:00:00+07:00'),original=Date.now;
const lesson={lessonCode:'fake-day20',classNames:['LỚP GIẢ'],date:'2026-10-16',title:'Buổi giả',videoId:null,videoUrl:null,materialUrl:null,handoutUrl:null,homeworkUrl:null,dueAt:T0+1000,opensAt:T0-1000,locked:false,bestScore:null,submittedAt:null,late:null,available:true};
const Cards=load('src/native/homework/LessonCards.tsx').default,render=(props:any)=>require('react-dom/server').renderToStaticMarkup(React.createElement(Cards,{lessons:[lesson],busy:false,onHomework(){},...props}));
test('Máy nhanh/chậm 24h vẫn khóa, quá hạn, video sắp học và lịch theo cùng giờ server',()=>{
  try{for(const skew of [-86400000,86400000]){
    Date.now=()=>T0+skew;
    const anchor={serverNow:T0,clientReceivedAt:T0+skew},html=render(anchor);
    assert.match(html,/Làm BTVN/);assert.match(html,/Video sẽ có sau buổi học/);assert.match(html,/Nhắc lịch hạn nộp/);assert.doesNotMatch(html,/Quá hạn/);
    assert.match(render({...anchor,lessons:[{...lesson,opensAt:T0+1}]}),/Chưa mở/);
    const due=render({...anchor,serverNow:T0+1000});assert.match(due,/Quá hạn/);assert.doesNotMatch(due,/Nhắc lịch hạn nộp/);
    assert.match(createHomeworkDeadlineICS(lesson,homeworkServerNow(anchor)),/DTSTAMP:20261015T170000Z/);
  }}finally{Date.now=original;}
});
test('Thiếu mốc fallback thiết bị, timestamp mở hỏng giữ locked, không báo Invalid Date trong lịch',()=>{
  try{Date.now=()=>T0;assert.match(render({}),/Nhắc lịch hạn nộp/);assert.match(render({lessons:[{...lesson,opensAt:NaN,locked:true}]}),/Chưa mở/);}finally{Date.now=original;}
});
test('Merge lịch giữ nguyên bản làm và biên nhận; bỏ snapshot lùi và giữ anchor khi legacy thiếu mốc',()=>{
  const prior={lessonCode:'fake',serverNow:T0,clientReceivedAt:10,lessons:[lesson],draft:{answers:{a:'B'}},receipts:[{score:7}],revision:10} as unknown as HomeworkState;
  const next={...prior,serverNow:T0+500,clientReceivedAt:510,lessons:[{...lesson,locked:false}],draft:null,receipts:[],revision:11};
  const merged=mergeOpeningState(prior,next);assert.equal(merged.draft,prior.draft);assert.equal(merged.receipts,prior.receipts);assert.equal(merged.revision,10);assert.equal(merged.serverNow,T0+500);assert.equal(merged.clientReceivedAt,510);
  assert.equal(mergeOpeningState(prior,{...next,serverNow:T0-1}),prior);assert.equal(mergeOpeningState(prior,{...next,lessonCode:'other'}),prior);
  const legacy=mergeOpeningState(prior,{...next,serverNow:undefined});assert.equal(legacy.serverNow,T0);assert.equal(legacy.clientReceivedAt,10);
});
const timerResult=await (async()=>{
  let task=()=>{},delay=0,clock=10,anchor={serverNow:T0,clientReceivedAt:10},called=0,release!:()=>void;
  const timer={set(fn:()=>void,ms:number){task=fn;delay=ms;return 1;},clear(){}};
  const stop=scheduleOpeningRefresh([{...lesson,locked:true,opensAt:T0+1000}],()=>{called++;return new Promise<void>(r=>{release=r;});},()=>homeworkServerNow(anchor,clock),timer);
  assert.equal(delay,1050);clock+=500;anchor={serverNow:T0+500,clientReceivedAt:clock};task();assert.equal(called,0);assert.equal(delay,550);
  clock+=550;task();assert.equal(called,1);stop();const old=task;release();await Promise.resolve();old();assert.equal(called,1);return true;
})();
test('Timer tính khoảng chờ bằng giờ server, nhận anchor mới và cancel trong request đang chờ',()=>assert.equal(timerResult,true));
test('Server còn giữ bài sau mốc mở không tạo vòng đọc lại tức thời',()=>{
  for(const at of [T0,T0+5000]){
    let delay=0;
    const stop=scheduleOpeningRefresh([{...lesson,locked:true,opensAt:T0}],async()=>{},()=>at,{set(_fn,ms){delay=ms;return 1;},clear(){}});
    assert.equal(delay,30000);stop();
  }
});
finish({note:'Clock, hook/SSR và timer giả; chưa kiểm lịch trên thiết bị thật.'});
