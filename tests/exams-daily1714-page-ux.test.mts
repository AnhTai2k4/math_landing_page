import assert from 'node:assert/strict';
import {suite} from './exams-harness.mts';
import {all,mount,text} from './daily19-ui-harness.mts';
const {test,finish}=suite('D1714-UX-');

test('Trang chủ: Escape đóng đúng câu FAQ đang đọc và trả focus về câu hỏi',()=>{
 const m=mount('src/components/FAQSection.tsx',{},'FAQSection');
 try{
  const group=all(m.tree,n=>n.props.className==='mtm-faq-list')[0];
  let focus=0,prevented=0;const detail={open:true,querySelector:(selector:string)=>{assert.equal(selector,'summary');return{focus(){focus++;}};}};
  const event=(extra:any={})=>({key:'Escape',target:{closest:(selector:string)=>{assert.equal(selector,'details');return detail;}},preventDefault(){prevented++;},...extra});
  group.props.onKeyDown(event());assert.equal(detail.open,false);assert.equal(focus,1);assert.equal(prevented,1);
  group.props.onKeyDown(event());assert.equal(focus,1);assert.equal(prevented,1);
  detail.open=true;group.props.onKeyDown(event({ctrlKey:true}));assert.equal(detail.open,true);
  group.props.onKeyDown(event({target:{closest:()=>null}}));assert.equal(prevented,1);
 }finally{m.unmount();}
});

function withBrowser(run:(changes:string[],focused:string[])=>void){
 const keys=['location','window','history','document'],before=Object.fromEntries(keys.map(key=>[key,(globalThis as any)[key]]));
 const changes:string[]=[],focused:string[]=[];
 (globalThis as any).location=new URL('https://example.test/huong-dan?cho=hoc-sinh');
 (globalThis as any).window={addEventListener(){},removeEventListener(){},dispatchEvent(){return true;}};
 (globalThis as any).history={replaceState(_a:any,_b:any,url:string){changes.push(url);},pushState(_a:any,_b:any,url:string){changes.push(url);}};
 (globalThis as any).document={getElementById:(id:string)=>({focus(){focused.push(id);}})};
 try{run(changes,focused);}finally{for(const key of keys){if(before[key]===undefined)delete(globalThis as any)[key];else(globalThis as any)[key]=before[key];}}
}

test('Tài liệu: Enter tới số kết quả, Escape xóa riêng từ tìm và giữ lớp',()=>withBrowser(changes=>{
 const m=mount('src/native/NativeResources.tsx',{kind:'documents',pathname:'/tai-lieu',search:'?muc=grade-10&q=khongtimthay'});
 try{
  const search=()=>all(m.tree,n=>n.type==='input'&&n.props.type==='search')[0];
  const form=all(m.tree,n=>n.type==='form'&&n.props.role==='search')[0];let submitted=0;
  form.props.onSubmit({preventDefault(){submitted++;}});assert.equal(submitted,1);assert.match(m.focused?.text??'',/\(0\)/);
  assert.equal(search().props.enterKeyHint,'search');assert.equal(search().props['aria-describedby'],'ne-resource-search-help');
  let prevented=0;search().props.onKeyDown({key:'Escape',nativeEvent:{isComposing:true},preventDefault(){prevented++;}});
  assert.equal(prevented,0);assert.equal(changes.length,0);
  search().props.onKeyDown({key:'Escape',preventDefault(){prevented++;}});
  assert.equal(changes.at(-1),'/tai-lieu?muc=grade-10');assert.equal(prevented,1);assert.equal(m.focused?.type,'input');
  m.draw({kind:'documents',pathname:'/tai-lieu',search:'?muc=grade-10'});
  search().props.onKeyDown({key:'Escape',preventDefault(){prevented++;}});assert.equal(prevented,1);
  search().props.onKeyDown({key:'ArrowDown',preventDefault(){prevented++;}});assert.equal(prevented,1);
 }finally{m.unmount();}
}));

test('Hướng dẫn: lối đi nhanh đặt focus đúng phần trợ giúp cho cả hai nhóm người đọc',()=>withBrowser((_changes,focused)=>{
 const m=mount('src/migration/Guide.tsx');
 try{
  const nav=all(m.tree,n=>n.type==='nav'&&n.props['aria-label']==='Đi nhanh trong hướng dẫn')[0];
  const links=all(nav,n=>n.type==='a');assert.equal(links.length,2);
  for(const link of links){assert.ok(link.props.href.startsWith('#mg-'));link.props.onClick();assert.equal(focused.at(-1),link.props.href.slice(1));}
  assert.match(text(links[0]),/BTVN/);assert.match(text(links[1]),/cách xử lý/);
  const tab=all(m.tree,n=>n.type==='button'&&text(n)==='Phụ huynh')[0];tab.props.onClick();m.draw();
  assert.equal(all(m.tree,n=>n.props['aria-label']==='Đi nhanh trong hướng dẫn').length,1);
 }finally{m.unmount();}
}));
finish();
