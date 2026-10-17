import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {all,load,root,text} from './daily19-ui-harness.mts';

// Hook có trạng thái và Image giả: không tải ảnh hoặc gọi mạng thật.
const tests:{name:string;run:()=>void|Promise<void>}[]=[];
const test=(name:string,run:()=>void|Promise<void>)=>tests.push({name,run});
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function environment(){
  const keys=['Image','ResizeObserver','matchMedia','requestAnimationFrame','cancelAnimationFrame'] as const;
  const previous=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const images:FakeImage[]=[];
  class FakeImage{
    src='';decoding='';onload:(()=>void)|null=null;onerror:(()=>void)|null=null;
    resolveDecode!:()=>void;rejectDecode!:(error:Error)=>void;
    decoded=new Promise<void>((resolve,reject)=>{this.resolveDecode=resolve;this.rejectDecode=reject;});
    constructor(){images.push(this);}
    decode(){return this.decoded;}
  }
  const values:Record<string,unknown>={Image:FakeImage,ResizeObserver:class{observe(){}disconnect(){}},matchMedia:()=>({matches:true,addEventListener(){},removeEventListener(){}}),requestAnimationFrame:()=>1,cancelAnimationFrame(){}};
  for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,value:values[key]});
  return {images,finish(image:FakeImage,callback=image.onload){callback?.();image.resolveDecode();},restore(){for(const key of keys){if(previous[key])Object.defineProperty(globalThis,key,previous[key]!);else delete (globalThis as any)[key];}}};
}
function mountHero(){
  const values:any[]=[],effects:(()=>void)[]=[];let cursor=0,dirty=false,tree:any,updates=0,focused:any=null;
  const effect=(fn:()=>void|(()=>void),deps:any[])=>{const at=cursor++,before=values[at];if(!before||deps.some((v,i)=>!Object.is(v,before.deps[i]))){const slot={deps,cleanup:null as any};values[at]=slot;effects.push(()=>{before?.cleanup?.();slot.cleanup=fn();});}};
  const Hero=load('src/migration/R106Hero.tsx',{
    useId:()=>':hero-ux:',
    useRef:(initial:any)=>{const at=cursor++;if(!(at in values))values[at]={current:initial};return values[at];},
    useState:(initial:any)=>{const at=cursor++;if(!(at in values))values[at]=typeof initial==='function'?initial():initial;return [values[at],(next:any)=>{const value=typeof next==='function'?next(values[at]):next;if(!Object.is(values[at],value)){values[at]=value;dirty=true;updates++;}}];},
    useEffect:effect,useLayoutEffect:effect,
  }).default;
  const draw=()=>{let loops=0;do{assert.ok(++loops<20,'Render phải ổn định');dirty=false;cursor=0;tree=Hero();
    for(const node of all(tree,()=>true)){
      const ref=Object.getOwnPropertyDescriptor(node.props,'ref')?.value??node.ref;
      if(ref&&typeof ref==='object')ref.current={style:{setProperty(){}},children:Array.from({length:3},(_,i)=>({offsetLeft:i*80,offsetTop:0,offsetWidth:80,offsetHeight:60})),addEventListener(){},removeEventListener(){},focus(){focused={type:node.type,label:node.props['aria-label']};}};
    }
    while(effects.length)effects.shift()!();
  }while(dirty);return tree;};
  const button=(label:string)=>{const found=all(tree,n=>n.type==='button'&&(n.props['aria-label']===label||text(n)===label))[0];assert.ok(found,'Thiếu nút '+label);return found;};
  const click=(label:string)=>{button(label).props.onClick();draw();};
  draw();
  return {draw,click,button,get tree(){return tree;},get updates(){return updates;},get focused(){return focused;},front:()=>all(tree,n=>n.props?.className==='r106-photo-front')[0].props.src,busy:()=>button('Mở ảnh MTM đầy đủ').props['aria-busy'],unmount(){values.forEach(value=>value?.cleanup?.());}};
}

test('Ảnh tải chậm giữ ảnh hiện tại và chỉ báo bận trong lúc tải, đợi cả decode',async()=>{
  const env=environment(),m=mountHero();try{
    const first=m.front();assert.equal(m.busy(),false);assert.equal(env.images.length,0);
    m.click('Ảnh MTM sau');const image=env.images[0];assert.equal(m.busy(),true);assert.equal(m.front(),first);assert.match(text(m.tree),/Đang tải ảnh Thầy Thành/);
    image.onload?.();await tick();m.draw();assert.equal(m.busy(),true);assert.equal(m.front(),first,'Load xong vẫn chờ decode, chưa thay ảnh');
    image.resolveDecode();await tick();m.draw();assert.equal(m.busy(),false);assert.match(m.front(),/teacher-original\.jpg$/);assert.equal(all(m.tree,n=>n.props?.className==='r106-image-error').length,0);
  }finally{m.unmount();env.restore();}
});

test('Ảnh lỗi ngừng báo bận, giữ ảnh cũ và thử lại đúng ảnh, trả focus về ảnh đang nhìn',async()=>{
  const env=environment(),m=mountHero();try{
    const first=m.front();m.click('Ảnh MTM sau');env.images[0].onerror?.();await tick();m.draw();
    assert.equal(m.busy(),false);assert.equal(m.front(),first);assert.match(text(m.tree),/Chưa tải được ảnh này\. Ảnh hiện tại vẫn được giữ\./);
    assert.equal(m.button('Thử tải lại ảnh').props.type,'button');m.click('Thử tải lại ảnh');
    assert.deepEqual(m.focused,{type:'button',label:'Mở ảnh MTM đầy đủ'},'Nút thử lại bị gỡ nhưng focus vẫn ở nút mở ảnh còn trên trang');
    assert.equal(env.images.length,2);assert.equal(env.images[1].src,env.images[0].src);assert.equal(m.busy(),true);assert.equal(m.front(),first);assert.equal(all(m.tree,n=>n.props?.className==='r106-image-error').length,0);
    env.finish(env.images[1]);await tick();m.draw();assert.equal(m.busy(),false);assert.equal(m.front(),env.images[1].src);
  }finally{m.unmount();env.restore();}
});

test('Đổi ảnh nhanh bỏ callback cũ; quay về ảnh đang nhìn không để trạng thái bận bị kẹt',async()=>{
  const env=environment(),m=mountHero();try{
    const first=m.front();m.click('Ảnh MTM sau');const old=env.images[0],oldLoad=old.onload;
    m.click('Ảnh MTM sau');const current=env.images[1];assert.equal(old.onload,null);assert.equal(old.onerror,null);
    env.finish(old,oldLoad);await tick();m.draw();assert.equal(m.front(),first);assert.equal(m.busy(),true,'Tải cũ không xóa trạng thái chờ ảnh mới');
    env.finish(current);await tick();m.draw();assert.equal(m.front(),current.src);assert.equal(m.busy(),false);
    m.click('Ảnh MTM sau');const abandoned=env.images[2],oldError=abandoned.onerror;
    m.click('Ảnh MTM trước');assert.equal(m.busy(),false);assert.equal(m.front(),current.src);oldError?.();await tick();m.draw();
    assert.equal(m.busy(),false);assert.equal(all(m.tree,n=>n.props?.className==='r106-image-error').length,0);
  }finally{m.unmount();env.restore();}
});

test('Decode lỗi có thể thử lại; callback tải sau khi rời trang không cập nhật component',async()=>{
  const env=environment(),m=mountHero();let unmounted=false;try{
    m.click('Ảnh MTM sau');env.images[0].onload?.();env.images[0].rejectDecode(new Error('decode failed'));await tick();m.draw();assert.equal(m.busy(),false);assert.ok(m.button('Thử tải lại ảnh'));
    m.click('Thử tải lại ảnh');const image=env.images[1],callback=image.onload;m.unmount();unmounted=true;const updates=m.updates;
    env.finish(image,callback);await tick();assert.equal(m.updates,updates);assert.equal(image.onload,null);assert.equal(image.onerror,null);
  }finally{if(!unmounted)m.unmount();env.restore();}
});

test('Chỉnh nhỏ đúng vùng ảnh, nút thử lại có vùng chạm và focus, giữ đủ cấu trúc trang',()=>{
  const env=environment(),m=mountHero();try{
    assert.equal(all(m.tree,n=>n.type==='section'&&n.props?.className==='r106-hero').length,1);assert.equal(all(m.tree,n=>n.props?.className==='r106-programmes').length,1);assert.equal(all(m.tree,n=>n.props?.className==='r106-album').length,1);assert.equal(all(m.tree,n=>n.props?.className==='r106-course').length,1);
    const css=readFileSync(join(root,'src/migration/r106-shell.css'),'utf8');assert.match(css,/\.r106-hero \.r106-image-retry\{[^}]*min-height:44px/);assert.match(css,/\.r106-hero \.r106-image-retry:focus-visible/);
  }finally{m.unmount();env.restore();}
});

let failed=0;for(const [index,row] of tests.entries()){try{await row.run();console.log('  ok D1712-HOME-UX-'+(index+1)+' '+row.name);}catch(error){failed++;console.error('  LỖI D1712-HOME-UX-'+(index+1)+' '+row.name);console.error(error);}}
console.log(JSON.stringify({suite:'D1712-HOME-UX-',total:tests.length,passed:tests.length-failed,failed,note:'Image và hook giả kiểm tải/giải mã/lỗi/thử lại/race. Chưa thay QA trình duyệt hoặc xem ảnh ở 1920/1366/390.'}));
process.exitCode=failed?1:0;
