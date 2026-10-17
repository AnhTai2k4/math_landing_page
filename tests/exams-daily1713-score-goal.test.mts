import assert from 'node:assert/strict';
import {createScoreGoal,goalTracks,goalDays,goalMinutes,type GoalInput} from '../src/native/score-goal';
import {suite} from './exams-harness.mts';
import {all,mount,text,root} from './daily19-ui-harness.mts';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const {test,finish}=suite('D1713-GOAL-');
const initial:GoalInput={grade:'10',chapter:goalTracks[0].chapters[0].id,current:'6,5',target:'8',days:3,minutes:20};
const field=(m:any,type:string,index=0)=>all(m.tree,n=>n.type===type)[index];
function set(m:any,type:string,index:number,value:string){field(m,type,index).props.onChange({target:{value}});m.draw();}
function submit(m:any){field(m,'form').props.onSubmit({preventDefault(){}});m.draw();}

test('Từ chối điểm rỗng, vô hạn, ngoài miền, target thấp và giá trị không thuộc lựa chọn',()=>{
 for(const value of ['', ' ', '-1','10.01','11','1e1','NaN','Infinity','6/10','1,2,3']){
  assert.equal(createScoreGoal({...initial,current:value}),null,value);
  assert.equal(createScoreGoal({...initial,target:value}),null,value);
 }
 for(const patch of [{target:'6'},{days:0},{days:6},{days:2.5},{minutes:10},{minutes:Infinity},{grade:'9'},{chapter:'unknown'}])assert.equal(createScoreGoal({...initial,...patch}),null);
 assert.equal(createScoreGoal({...initial,current:'0',target:'0'})?.current,0);
 assert.equal(createScoreGoal({...initial,current:'10',target:'10'})?.target,10);
 assert.equal(createScoreGoal({...initial,current:'6.5'})?.current,6.5);
});
test('Mọi lớp/chương và quỹ thời gian có link đúng, số phút cộng độc lập và chặng hữu hạn',()=>{
 let count=0;
 for(const track of goalTracks)for(const chapter of track.chapters)for(const days of goalDays)for(const minutes of goalMinutes)for(const current of ['0','4,5','6','8,5','10']){
  const plan=createScoreGoal({...initial,grade:track.id,chapter:chapter.id,days,minutes,current,target:'10'})!;
  assert.ok(plan);assert.equal(plan.sessions.length,days);assert.equal(plan.total,days*minutes);assert.equal(plan.chapter,chapter.title);
  for(const session of plan.sessions){
   assert.equal(session.foundation+session.practice+session.review,minutes);
   assert.ok(session.foundation>=3&&session.practice>=3&&session.review>=3);
   const url=new URL(session.href,'https://example.test');assert.equal(url.pathname,'/luyen-tap');assert.equal(url.searchParams.get('nhom'),track.id);assert.equal(url.searchParams.get('chuong'),chapter.id);assert.equal(url.searchParams.has('id'),false);
  }
  count++;
 }
 assert.ok(count>=1000);
 const low=createScoreGoal({...initial,current:'4'})!,high=createScoreGoal({...initial,current:'8'})!;
 assert.ok(low.sessions[0].foundation>high.sessions[0].foundation);
});
test('UI nhập rồi tạo kế hoạch, focus, đánh dấu, giữ tab khi học và loại callback kế hoạch cũ',()=>{
 const m=mount('src/native/ScoreGoal.tsx',{grade:'10'});
 try{
  submit(m);assert.match(text(m.tree),/Nhập hai mức điểm/);assert.equal(m.focused?.type,'input');
  set(m,'input',0,'6,5');set(m,'input',1,'8');submit(m);
  assert.match(text(m.tree),/6,5 → 8 điểm/);assert.match(text(m.tree),/60 phút cả tuần/);assert.equal(m.focused?.type,'div');
  const checks=()=>all(m.tree,n=>n.type==='input'&&n.props.type==='checkbox');
  checks()[0].props.onChange({target:{checked:true}});m.draw();assert.match(text(m.tree),/1\/3 buổi/);
  const oldCheck=checks()[1].props.onChange,oldSubmit=field(m,'form').props.onSubmit,oldChange=field(m,'input',0).props.onChange;
  const links=all(m.tree,n=>n.props.href?.startsWith('/luyen-tap?'));assert.equal(links.length,3);assert.ok(links.every(n=>n.props.target==='_blank'&&n.props.rel.includes('noopener')));
  set(m,'select',1,'2');assert.doesNotMatch(text(m.tree),/Em tự đánh dấu:/);
  oldCheck({target:{checked:true}});oldSubmit({preventDefault(){}});oldChange({target:{value:'0'}});m.draw();
  assert.equal(field(m,'input',0).props.value,'6,5');assert.doesNotMatch(text(m.tree),/Em tự đánh dấu:/);
  submit(m);assert.match(text(m.tree),/0\/2 buổi/);assert.match(text(m.tree),/40 phút cả tuần/);
 }finally{m.unmount();}
});
test('Xem lại lộ trình khi chưa đổi lựa chọn giữ dấu tự học và focus kết quả',()=>{
 const m=mount('src/native/ScoreGoal.tsx',{grade:'10'});
 try{
  set(m,'input',0,'6,5');set(m,'input',1,'8');submit(m);
  const checks=()=>all(m.tree,n=>n.type==='input'&&n.props.type==='checkbox');
  checks()[0].props.onChange({target:{checked:true}});m.draw();
  assert.equal(field(m,'button').props.children,'Xem lộ trình đã tạo');
  for(let repeat=0;repeat<2;repeat++){
   submit(m);assert.equal(m.focused?.type,'div');assert.match(text(m.tree),/1\/3 buổi/);
   assert.deepEqual(checks().map(node=>node.props.checked),[true,false,false]);
  }
  checks()[1].props.onChange({target:{checked:true}});m.draw();assert.match(text(m.tree),/2\/3 buổi/);
  set(m,'input',1,'9');assert.equal(checks().length,0);assert.equal(field(m,'button').props.children,'Tạo lộ trình của em');
  submit(m);assert.match(text(m.tree),/0\/3 buổi/);assert.ok(checks().every(node=>!node.props.checked));
 }finally{m.unmount();}
});
test('Mở có tải lười, giới hạn riêng tab và không gửi/lưu điểm tự nhập',()=>{
 const launcher=readFileSync(join(root,'src/native/ScoreGoalTool.tsx'),'utf8');assert.match(launcher,/lazy\(\(\)=>import\('\.\/ScoreGoal'\)\)/);
 const source=readFileSync(join(root,'src/native/ScoreGoal.tsx'),'utf8');assert.match(source,/không cam kết đạt điểm/);assert.match(source,/MTM sưu tầm và biên soạn/);assert.doesNotMatch(source,/fetch\(|localStorage|sessionStorage|supabase|sendBeacon|\u2014/);
 const native=readFileSync(join(root,'src/native/NativeCourses.tsx'),'utf8');assert.match(native,/<ScoreGoalTool key=\{state.grade\} grade=\{state.grade\}/);
});
finish();
