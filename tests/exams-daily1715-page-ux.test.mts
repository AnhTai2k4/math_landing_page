import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {join} from 'node:path';
import {suite} from './exams-harness.mts';import {all,mount,text,root} from './daily19-ui-harness.mts';
const {test,finish}=suite('D1715-UX-');
test('Trang chủ: phím phải mở, trái thu gọn FAQ, giữ native Enter/Space và link',()=>{
 const m=mount('src/components/FAQSection.tsx',{},'FAQSection');try{
  const group=all(m.tree,n=>n.props.className==='mtm-faq-list')[0],detail={open:false};let prevented=0;
  const summary={closest:(selector:string)=>selector==='details'?detail:null};
  const key=(key:string,extra:any={})=>group.props.onKeyDown({key,target:{closest:()=>summary},preventDefault(){prevented++;},...extra});
  key('ArrowRight');assert.equal(detail.open,true);key('ArrowLeft');assert.equal(detail.open,false);assert.equal(prevented,2);
  key('ArrowRight',{ctrlKey:true});key('Enter');key(' ');key('ArrowRight',{target:{closest:()=>null}});assert.equal(prevented,2);
  assert.equal(all(m.tree,n=>n.type==='details').length,5);assert.equal(all(m.tree,n=>n.props.id===group.props['aria-describedby']).length,1);assert.match(text(m.tree),/Esc để thu gọn/);
 }finally{m.unmount();}
});
test('Thi thử: Enter đi tới kết quả, Escape/xóa giữ các bộ lọc khác, không cản IME',()=>{
 const changes:string[]=[],searched:string[]=[];const props={query:'từ khóa',onChange:(q:string)=>changes.push(q),onSearch:()=>searched.push('result')};
 const m=mount('src/native/exams/ExamSearchField.tsx',props);try{
  const input=()=>all(m.tree,n=>n.type==='input')[0];let prevented=0;
  const key=(key:string,extra:any={})=>input().props.onKeyDown({key,preventDefault(){prevented++;},...extra});
  key('Enter');assert.equal(searched.length,1);assert.equal(prevented,1);
  key('Escape',{nativeEvent:{isComposing:true}});key('Escape',{altKey:true});assert.equal(changes.length,0);
  key('Escape');assert.deepEqual(changes,['']);assert.equal(m.focused.type,'input');assert.equal(prevented,2);
  m.click('Xóa tên đề');assert.deepEqual(changes,['','']);m.click('Xem đề tìm được');assert.equal(searched.length,2);
  m.draw({...props,query:''});key('Escape');assert.equal(prevented,2);assert.equal(all(m.tree,n=>n.type==='button').length,1);
  const source=readFileSync(join(root,'src/native/NativeExams.tsx'),'utf8');assert.match(source,/onChange=\{q=>changeFilters\(\{q\}\)\}/);assert.match(source,/onSearch=\{\(\)=>searchResult.current\?\.focus\(\)\}/);assert.match(source,/ref=\{searchResult\} tabIndex=\{-1\}/);
  assert.match(readFileSync(join(root,'src/native/exams/exam-search-ux.css'),'utf8'),/@media\(max-width:760px\)\{\.ep-filters \.ep-exam-search\{grid-column:1\/-1\}\}/);
 }finally{m.unmount();}
});
finish();
