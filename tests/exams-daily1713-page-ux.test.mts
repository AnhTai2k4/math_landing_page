import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {suite} from './exams-harness.mts';
import {all,mount,text,root} from './daily19-ui-harness.mts';
const {test,finish}=suite('D1713-UX-');
test('FAQ giữ native details, phím lên/xuống/Home/End chỉ đổi focus trên câu hỏi',()=>{
 const m=mount('src/components/FAQSection.tsx',{},'FAQSection');
 try{
  assert.equal(all(m.tree,n=>n.type==='details').length,5);const group=all(m.tree,n=>n.props.className==='mtm-faq-list')[0];
  let selected=-1,prevented=0;const summaries=Array.from({length:5},(_,i)=>({focus(){selected=i;}}));
  function key(index:number,key:string,extra:any={}){group.props.onKeyDown({key,target:{closest:()=>summaries[index]},currentTarget:{querySelectorAll:()=>summaries},preventDefault(){prevented++;},...extra});}
  key(0,'ArrowUp');assert.equal(selected,4);key(4,'ArrowDown');assert.equal(selected,0);key(1,'End');assert.equal(selected,4);key(3,'Home');assert.equal(selected,0);assert.equal(prevented,4);
  key(2,'Enter');key(2,' ');key(2,'ArrowDown',{ctrlKey:true});key(2,'End',{target:{closest:()=>null}});assert.equal(prevented,4);
  assert.match(text(m.tree),/Hỏi một chút/);assert.match(text(m.tree),/Vào BTVN bằng cách nào/);
 }finally{m.unmount();}
});
test('Khóa học đếm kết quả, focus ô lọc, xóa từ khóa và giữ đúng lớp trong URL',()=>{
 const previous={location:(globalThis as any).location,window:(globalThis as any).window,history:(globalThis as any).history};
 const changes:string[]=[];(globalThis as any).location=new URL('https://example.test/khoa-hoc?lop=10&q=none');(globalThis as any).window={dispatchEvent:()=>true};(globalThis as any).history={replaceState(_a:any,_b:any,url:string){changes.push(url);},pushState(_a:any,_b:any,url:string){changes.push(url);}};
 const m=mount('src/native/NativeCourses.tsx',{search:'?lop=10&q=none'},'NativeCatalogue');
 try{
  const toggle=()=>all(m.tree,n=>n.type==='button'&&text(n).includes('Tìm và lọc khóa học'))[0];
  assert.equal(toggle().props['aria-expanded'],true);assert.equal(toggle().props['aria-controls'],'ne-catalog-search');assert.match(text(m.tree),/0 khóa học lớp 10 khớp từ tìm kiếm/);
  m.click('Xóa từ tìm kiếm');assert.equal(changes.at(-1),'/khoa-hoc?lop=10');assert.equal(m.focused?.type,'input');
  m.draw({search:'?lop=10'});assert.equal(all(m.tree,n=>n.props.id==='ne-catalog-search').length,1);assert.equal(toggle().props['aria-expanded'],true);assert.ok(all(m.tree,n=>n.props.role==='status'&&text(n).includes('khóa học lớp 10')).length);
  toggle().props.onClick();m.draw();assert.equal(toggle().props['aria-expanded'],false);assert.equal(all(m.tree,n=>n.props.id==='ne-catalog-search').length,0);
  toggle().props.onClick();m.draw();assert.equal(m.focused?.type,'input');
 }finally{m.unmount();for(const [key,value]of Object.entries(previous)){if(value===undefined)delete(globalThis as any)[key];else(globalThis as any)[key]=value;}}
});
finish();
