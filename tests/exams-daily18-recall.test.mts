import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {recallBatch,recallDecks} from '../src/native/chapters/quick-recall';
import tables from '../src/native/chapters/theory-tables.json';
import {suite} from './exams-harness.mts';

const {test,finish}=suite('D18-RECALL-');
test('Bộ thẻ giữ nguyên công thức, điều kiện và lưu ý nguồn đúng khối',()=>{
  for(const track of ['10','11','12'])for(const deck of recallDecks(track)){
    const source=tables.tables.find(table=>table.id===deck.id)!;
    assert.equal(String(deck.grade),track);assert.equal(deck.title,source.title);
    assert.deepEqual(deck.cards.map(({context,notes,...card})=>card),source.rows.map(row=>({id:source.id+':'+row.id,topic:row.topic,formulaLines:row.formulaLines,usageLines:row.usageLines})));
  }
  assert.deepEqual(recallDecks('hsa'),[]);
});
test('Thẻ tách lẻ mang theo định nghĩa ký hiệu và miền của dòng gốc',()=>{
  const triangle=recallDecks('10').find(deck=>deck.id==='g10-c3')!;
  for(const row of ['cosine','sine','area','heron','two-solutions','median']){
    const context=triangle.cards.find(card=>card.id==='g10-c3:'+row)!.context;
    assert.equal(context[0].topic,'Kí hiệu tam giác');assert.ok(context[0].formulaLines.some(line=>line.includes('p=')));assert.ok(context[0].usageLines.some(line=>line.includes('không suy biến')));
  }
  const rational=recallDecks('12')[0].cards.find(card=>card.id==='g12-c1:quadratic-extrema')!;
  assert.ok(rational.context[0].formulaLines.some(line=>line.includes('R=')));
  assert.ok(rational.context[0].formulaLines.some(line=>line.includes('d\\ne0')));
});
test('Mỗi lượt không quá 5 thẻ, duyệt hết không bỏ thẻ hoặc trộn chương',()=>{
  for(const track of ['10','11','12'])for(const deck of recallDecks(track)){
    const seen:string[]=[];
    for(let i=0;i<deck.cards.length;i+=5){const batch=recallBatch(deck,i);assert.ok(batch.length>0&&batch.length<=5);seen.push(...batch.map(card=>card.id));}
    assert.deepEqual(seen,deck.cards.map(card=>card.id));assert.equal(new Set(seen).size,seen.length);
  }
});

const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json'));
const React=require('react'),{buildSync}=require('esbuild'),{renderToStaticMarkup}=require('react-dom/server');
const file='src/native/chapters/QuickRecall.tsx';
const compiled=buildSync({stdin:{contents:readFileSync(join(root,file),'utf8')+'\nexport {RecallSession};',sourcefile:file,resolveDir:join(root,file,'..'),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
function load(hooks?:any){const mod={exports:{} as any};new Function('require','module','exports',compiled)((id:string)=>id==='react'&&hooks?{...React,...hooks}:id.endsWith('.css')?{}:require(id),mod,mod.exports);return mod.exports;}
const text=(tree:any):string=>tree==null||typeof tree==='boolean'?'':Array.isArray(tree)?tree.map(text).join(''):typeof tree==='object'?text(tree.props?.children):String(tree);
const all=(tree:any,p:(node:any)=>boolean):any[]=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(node=>all(node,p)):[...(p(tree)?[tree]:[]),...all(tree.props?.children,p)];
function mount(deck=recallDecks('10')[0]){
  let values:any[]=[],cursor=0,focused:any=null;
  const effects:(()=>void)[]=[];
  const hooks={useId:()=>':recall-test:',useEffect(effect:()=>void,deps:any[]){const i=cursor++,previous=values[i];if(!previous||deps.some((value,index)=>value!==previous[index])){values[i]=deps;effects.push(effect);}},useRef:(initial:any)=>{const i=cursor++;if(!(i in values))values[i]={current:initial};return values[i];},useState:(initial:any)=>{const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return[values[i],(next:any)=>values[i]=typeof next==='function'?next(values[i]):next];}};
  const Session=load(hooks).RecallSession;
  let tree:any;
  const draw=()=>{cursor=0;tree=Session({deck});for(const node of all(tree,()=>true)){const ref=Object.getOwnPropertyDescriptor(node.props,'ref')?.value??node.ref;if(ref&&typeof ref==='object')ref.current={focus:()=>{focused={id:node.props.id,type:node.type,label:node.props['aria-label']??text(node)};}};}while(effects.length)effects.shift()!();return tree;};
  const click=(label:string)=>{const btn=all(tree,node=>node.type==='button'&&text(node)===label)[0];assert.ok(btn,'Không tìm thấy nút '+label);btn.props.onClick();draw();};
  draw();return {draw,click,get tree(){return tree;},get focused(){return focused;},deck};
}
test('Chỉ tự đánh giá sau lật thẻ, thẻ sau đóng công thức và không ghi điểm',()=>{
  const m=mount();
  assert.ok(text(m.tree).includes('Thẻ 1/5'));
  assert.equal(all(m.tree,node=>node.type==='button'&&text(node)==='Em đã nhớ').length,0);
  assert.equal(all(m.tree,node=>node.props?.className==='cp-recall-answer')[0].props.hidden,true);
  m.click('Lật thẻ xem công thức');
  const reveal=all(m.tree,node=>node.type==='button'&&text(node)==='Ẩn công thức')[0];
  assert.equal(reveal.props['aria-expanded'],true);assert.equal(all(m.tree,node=>node.props?.id===reveal.props['aria-controls']).length,1);
  m.click('Em đã nhớ');assert.ok(text(m.tree).includes('Thẻ 2/5'));
  assert.equal(all(m.tree,node=>node.props?.className==='cp-recall-answer')[0].props.hidden,true);
});
test('Lật thẻ đưa focus tới công thức, sang thẻ đưa focus về tiêu đề mới',()=>{
  const m=mount();
  assert.equal(m.focused,null);
  m.click('Lật thẻ xem công thức');
  const reveal=all(m.tree,node=>node.type==='button'&&text(node)==='Ẩn công thức')[0];
  const answer=all(m.tree,node=>node.props?.id===reveal.props['aria-controls'])[0];
  assert.equal(answer.props.role,'region');assert.equal(answer.props.tabIndex,-1);
  assert.equal(answer.props['aria-label'],'Công thức: '+m.deck.cards[0].topic);
  assert.equal(m.focused.id,answer.props.id);assert.equal(m.focused.label,answer.props['aria-label']);
  m.click('Em đã nhớ');assert.equal(m.focused.type,'h3');assert.equal(m.focused.label,m.deck.cards[1].topic);
  m.click('Lật thẻ xem công thức');assert.equal(m.focused.label,'Công thức: '+m.deck.cards[1].topic);
});
test('Ôn lại đúng những thẻ đã chọn khó, rồi đi tiếp bộ nguồn thay vì lặp vô hạn',()=>{
  const m=mount();
  for(let i=0;i<5;i++){m.click('Lật thẻ xem công thức');m.click(i===1||i===3?'Cần ôn lại':'Em đã nhớ');}
  assert.ok(text(m.tree).includes('3 thẻ đã nhớ và 2 thẻ cần ôn lại'));
  m.click('Ôn lại 2 thẻ cần nhớ');assert.ok(text(m.tree).includes('Ôn lại · Thẻ 1/2'));assert.ok(text(m.tree).includes(m.deck.cards[1].topic));
  m.click('Lật thẻ xem công thức');m.click('Em đã nhớ');assert.ok(text(m.tree).includes(m.deck.cards[3].topic));
  m.click('Lật thẻ xem công thức');m.click('Em đã nhớ');
  assert.ok(text(m.tree).includes('2 thẻ đã nhớ và 0 thẻ cần ôn lại'));
  assert.equal(all(m.tree,node=>node.type==='button'&&text(node).startsWith('Ôn lại 0')).length,0);
  m.click('5 thẻ tiếp theo');assert.ok(text(m.tree).includes(m.deck.cards[5].topic));
});
test('Lượt cuối kết thúc, cho phép dừng hoặc ôn lại từ đầu',()=>{
  const m=mount();
  for(let batch=0;batch<3;batch++){
    for(let i=0;i<5;i++){m.click('Lật thẻ xem công thức');m.click('Em đã nhớ');}
    if(batch<2)m.click('5 thẻ tiếp theo');
  }
  assert.ok(text(m.tree).includes('Em có thể dừng ở đây'));
  m.click('Ôn lại từ đầu');assert.ok(text(m.tree).includes(m.deck.cards[0].topic));assert.ok(text(m.tree).includes('Thẻ 1/5'));
});
test('Lô cuối ít hơn 5 thẻ không đọc vượt câu và kết thúc đúng',()=>{
  const deck=recallDecks('10').find(item=>item.id==='g10-c3')!,m=mount(deck);
  for(const count of [5,5,4]){
    assert.ok(text(m.tree).includes('Thẻ 1/'+count));
    for(let i=0;i<count;i++){m.click('Lật thẻ xem công thức');m.click('Em đã nhớ');}
    assert.ok(text(m.tree).includes('Đã xem hết '+count+' thẻ'));
    if(count===5)m.click('5 thẻ tiếp theo');
  }
  m.click('Ôn lại từ đầu');assert.ok(text(m.tree).includes('Thẻ 1/5'));
});
test('SSR dùng đúng bộ chương, khai báo tự ôn và giới hạn lưu phiên',()=>{
  const Component=load().default;
  for(const [track,chapter,id] of [['10','3','g10-c3'],['11','1','g11-c1-foundation01'],['12','1','g12-c1']]){
    const html=renderToStaticMarkup(React.createElement(Component,{track,chapter}));
    assert.ok(html.includes('value="'+id+'" selected=""'));
    assert.ok(html.includes('không tính điểm hoặc xếp hạng'));assert.ok(html.includes('Tiến độ chỉ giữ khi em còn ở trang này.'));
    assert.ok(html.includes('MTM sưu tầm và biên soạn'));assert.match(html,/aria-expanded="false"/);assert.match(html,/hidden=""/);
  }
});
test('Chương 2 lớp 10 và lớp 12 chưa có thẻ không tự mở công thức chương khác',()=>{
  const Component=load().default;
  for(const track of ['10','12']){
    const html=renderToStaticMarkup(React.createElement(Component,{track,chapter:'2'}));
    assert.ok(html.includes('Chương này chưa có bộ thẻ.'));
    assert.ok(html.includes('value="" disabled="" selected=""'));
    assert.ok(!html.includes('cp-recall-session'));assert.ok(!html.includes('Lật thẻ xem công thức'));
    for(const deck of recallDecks(track))assert.ok(html.includes('value="'+deck.id+'"'));
  }
});
test('Đổi props nhóm hoặc chương bỏ lựa chọn cũ; chỉ mở bộ khác sau khi tự chọn',()=>{
  let values:any[]=[],cursor=0;
  const hooks={useId:()=>':recall-picker:',useState:(initial:any)=>{const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return[values[i],(next:any)=>values[i]=typeof next==='function'?next(values[i]):next];}};
  const Component=load(hooks).default;
  let props={track:'10',chapter:'3'},tree:any;
  const draw=()=>{cursor=0;tree=Component(props);};
  const select=()=>all(tree,node=>node.type==='select')[0];
  const sessions=()=>all(tree,node=>!!node.props?.deck);
  draw();assert.equal(select().props.value,'g10-c3');
  props={track:'10',chapter:'2'};draw();assert.equal(select().props.value,'');assert.equal(sessions().length,0);
  select().props.onChange({target:{value:'g10-c1'}});draw();assert.equal(select().props.value,'g10-c1');assert.equal(sessions()[0].props.deck.id,'g10-c1');
  props={track:'12',chapter:'2'};draw();assert.equal(select().props.value,'');assert.equal(sessions().length,0);
  props={track:'12',chapter:'1'};draw();assert.equal(select().props.value,'g12-c1');assert.equal(sessions()[0].props.deck.id,'g12-c1');
  props={track:'hsa',chapter:'1'};draw();assert.ok(text(tree).includes('Chưa có bộ thẻ cho nhóm này.'));assert.equal(sessions().length,0);
});
finish({note:'Hook/SSR local, không thay thế kiểm trình duyệt và ảnh thực tế.'});
