import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {FORMULA_DECKS} from '../src/migration/notebook-formula-game';
import {NOTEBOOK_KEY,type Task} from '../src/migration/notebook-store';
import {all,mount,text,load,root,React} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';

const {test,finish}=suite('D1707-NOTEBOOK-'),game='src/migration/NotebookFormulaGame.tsx';
const keyFor=(date:Date)=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
const today=keyFor(new Date()),task=(id:string,done=false):Task=>({id,text:'Việc GIẢ '+id,minutes:30,done});
function press(m:any,label:string){const button=all(m.tree,node=>node.type==='button'&&node.props['aria-label']===label)[0];assert.ok(button,'Có nút '+label);assert.ok(!button.props.disabled,'Nút đang khả dụng');button.props.onClick();m.draw();}
function pair(m:any,id:string,deck=FORMULA_DECKS[0]){const item=deck.pairs.find(p=>p.id===id)!;press(m,'Chọn biểu thức '+item.expression);press(m,'Ghép với '+item.answer);}
const list=(m:any)=>all(m.tree,node=>node.props.className==='mig-task-list')[0];
const rows=(m:any)=>all(list(m),node=>node.type==='article');

test('Kiểm Toán độc lập 6 cặp trên số nguyên âm, 0, dương và điều kiện biên',()=>{
 for(let a=-6;a<=6;a++)for(let b=-6;b<=6;b++){
  assert.ok((a+b)**2===a*a+2*a*b+b*b);
  assert.ok((a-b)**2===a*a-2*a*b+b*b);
  assert.ok(a*a-b*b===(a-b)*(a+b));
  assert.equal(Math.sqrt(a*a),Math.abs(a));
  if(a>=0&&b>=0)assert.ok(Math.abs(Math.sqrt(a*b)-Math.sqrt(a)*Math.sqrt(b))<1e-10);
  if(a!==0)assert.equal(a**3/a**2,a);
 }
 assert.ok(Number.isNaN(Math.sqrt(-1)));assert.equal(Math.sqrt((-1)*(-1)),1);assert.ok(Number.isNaN(0**3/0**2));
 assert.equal(FORMULA_DECKS.length,2);assert.ok(FORMULA_DECKS.every(deck=>deck.pairs.length===3));
 assert.equal(new Set(FORMULA_DECKS.flatMap(deck=>deck.pairs.map(p=>p.id))).size,6);
 for(const deck of FORMULA_DECKS){assert.equal(new Set(deck.pairs.map(p=>p.answer)).size,3);for(const p of deck.pairs)assert.ok(p.condition.length>5&&p.explanation.length>40);}
 assert.match(FORMULA_DECKS[1].pairs[0].answer,/\|a\|/);assert.match(FORMULA_DECKS[1].pairs[1].condition,/a ≥ 0 và b ≥ 0/);assert.match(FORMULA_DECKS[1].pairs[2].condition,/a ≠ 0/);
});

test('Trò chơi chọn biểu thức trước, báo sai có điều kiện và giải thích rồi hoàn thành',()=>{
 const m=mount(game);try{
  assert.match(text(m.tree),/Đã ghép 0\/3 cặp/);
  assert.equal(all(m.tree,n=>n.type==='button'&&n.props['aria-label']?.startsWith('Ghép với ')&&n.props.disabled).length,3);
  press(m,'Chọn biểu thức (a + b)²');press(m,'Ghép với a² − 2ab + b²');
  assert.match(text(m.tree),/Cặp này chưa khớp/);assert.match(text(m.tree),/Với mọi số thực a, b/);assert.match(text(m.tree),/Đã ghép 0\/3/);
  press(m,'Ghép với a² + 2ab + b²');assert.match(text(m.tree),/Đã ghép 1\/3/);assert.match(text(m.tree),/Lời giải các cặp đã ghép/);
  assert.equal(all(m.tree,n=>n.type==='button'&&n.props['aria-label']==='Chọn biểu thức (a + b)²')[0].props.disabled,true);
  pair(m,'difference-square');pair(m,'difference-of-squares');
  assert.match(text(m.tree),/Em đã ghép xong 3 cặp/);assert.match(text(m.tree),/Có 1 cặp từng nhầm/);
  m.click('Ôn cặp từng nhầm');assert.match(text(m.tree),/Đang ôn các cặp từng nhầm/);assert.match(text(m.tree),/Đã ghép 0\/1/);
  assert.equal(all(m.tree,n=>n.type==='button'&&n.props['aria-label']?.startsWith('Chọn biểu thức')).length,1);
  pair(m,'sum-square');assert.match(text(m.tree),/Em đã ghép xong 1 cặp/);
  m.click('Chơi lại cả bộ');assert.match(text(m.tree),/Đã ghép 0\/3/);assert.doesNotMatch(text(m.tree),/Đang ôn các cặp/);
 }finally{m.unmount();}
});

test('Đổi bộ xóa lượt cũ, hoàn thành căn thức có lời giải và không ép chơi tiếp',()=>{
 const m=mount(game);try{
  pair(m,'sum-square');m.click('Căn thức và điều kiện');assert.match(text(m.tree),/Đã ghép 0\/3/);
  for(const p of FORMULA_DECKS[1].pairs)pair(m,p.id,FORMULA_DECKS[1]);
  assert.match(text(m.tree),/không được rút gọn tại a = 0/);assert.match(text(m.tree),/Các cặp trong lượt này đều được ghép đúng ngay/);
  assert.equal(all(m.tree,n=>n.type==='button'&&text(n)==='Ôn cặp từng nhầm').length,0);
  assert.match(text(m.tree),/không tính điểm thi/);
 }finally{m.unmount();}
});

test('Ghép đúng chuyển focus tới biểu thức tiếp theo, tổng kết, đổi bộ và ôn sai',()=>{
 const m=mount(game);try{
  press(m,'Chọn biểu thức (a + b)²');press(m,'Ghép với a² − 2ab + b²');press(m,'Ghép với a² + 2ab + b²');
  assert.equal(m.focused?.id,'formula-expression-difference-square');
  pair(m,'difference-square');assert.equal(m.focused?.id,'formula-expression-difference-of-squares');
  pair(m,'difference-of-squares');assert.equal(m.focused?.id,'formula-summary-title');assert.equal(m.focused?.type,'h3');
  m.click('Ôn cặp từng nhầm');assert.equal(m.focused?.id,'formula-expression-sum-square');
  pair(m,'sum-square');assert.equal(m.focused?.id,'formula-summary-title');
  m.click('Chơi lại cả bộ');assert.equal(m.focused?.id,'formula-expression-sum-square');
  m.click('Căn thức và điều kiện');assert.equal(m.focused?.id,'formula-expression-root-square');
 }finally{m.unmount();}
});

test('Bấm trùng và callback cũ không cộng trùng hoặc làm bẩn bộ mới',()=>{
 const m=mount(game);try{
  const find=(label:string)=>all(m.tree,node=>node.type==='button'&&node.props['aria-label']===label)[0];
  const oldSelect=find('Chọn biểu thức (a + b)²').props.onClick;
  oldSelect();m.draw();const oldAnswer=find('Ghép với a² + 2ab + b²').props.onClick;
  oldAnswer();oldAnswer();m.draw();assert.match(text(m.tree),/Đã ghép 1\/3/);
  oldSelect();oldAnswer();m.draw();assert.match(text(m.tree),/Đã ghép 1\/3/);
  const oldDeckButton=all(m.tree,n=>n.type==='button'&&text(n)==='Hằng đẳng thức')[0].props.onClick;
  m.click('Căn thức và điều kiện');const before=text(m.tree);
  oldSelect();oldAnswer();oldDeckButton();m.draw();assert.equal(text(m.tree),before);assert.match(text(m.tree),/Đã ghép 0\/3/);
  pair(m,'root-square',FORMULA_DECKS[1]);assert.match(text(m.tree),/Đã ghép 1\/3/);
 }finally{m.unmount();}
});

test('Launcher chỉ gắn game khi mở, đóng gỡ game; lỗi riêng không thay sổ tay',()=>{
 const file='src/migration/NotebookFormulaLauncher.tsx',m=mount(file);try{
  assert.equal(all(m.tree,n=>n.props.id==='notebook-formula-content').length,0);
  m.click('Mở trò chơi');assert.equal(all(m.tree,n=>n.props.id==='notebook-formula-content').length,1);
  assert.equal(all(m.tree,n=>n.type==='button'&&n.props['aria-expanded']===true).length,1);
  m.click('Đóng trò chơi');assert.equal(all(m.tree,n=>n.props.id==='notebook-formula-content').length,0);
 }finally{m.unmount();}
 const {NotebookFormulaBoundary}=load(file),boundary=new NotebookFormulaBoundary({children:React.createElement('span',null,'Nội dung game')});
 assert.equal(text(boundary.render()),'Nội dung game');boundary.state=NotebookFormulaBoundary.getDerivedStateFromError();assert.match(text(boundary.render()),/vẫn có thể dùng sổ tay/);assert.equal(boundary.render().props.role,'alert');
});

test('Lọc việc v2 đếm đúng, chỉ đổi RAM, không ghi bản lưu khi đổi bộ lọc',()=>withNotebook([task('a'),task('b',true),task('c')],({m,primary,before}:any)=>{
 assert.equal(rows(m).length,3);m.click('Chưa xong (2)');assert.equal(rows(m).length,2);assert.match(text(m.tree),/Đang hiện 2\/3 việc/);assert.doesNotMatch(text(list(m)),/Việc GIẢ b/);
 m.click('Đã xong (1)');assert.equal(rows(m).length,1);assert.match(text(list(m)),/Việc GIẢ b/);assert.equal(primary.raw,before);assert.equal(primary.writes,0);
 m.click('Tất cả (3)');assert.equal(rows(m).length,3);
}));

test('Đánh dấu trong bộ lọc cập nhật số đếm và danh sách ngay, giữ đúng schema v1',()=>withNotebook([task('a'),task('b',true)],({m,primary}:any)=>{
 m.click('Chưa xong (1)');all(list(m),n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:true}});m.draw();
 assert.equal(rows(m).length,0);assert.match(text(m.tree),/Không còn việc chưa xong/);assert.match(text(m.tree),/Đã xong \(2\)/);assert.match(text(m.tree),/Đang hiện 0\/2/);
 assert.deepEqual(Object.keys(JSON.parse(primary.raw)).sort(),['days','goals','version']);assert.equal(primary.writes,1);
 m.click('Đã xong (2)');assert.equal(rows(m).length,2);
}));

test('Đánh dấu hoặc bỏ đánh dấu dưới bộ lọc đưa focus tới việc kế tiếp, hết việc về bộ lọc',()=>{
 for(const done of [false,true])withNotebook([task('a',done),task('b',done),task('c',done)],({m,primary}:any)=>{
  const filter=done?'done':'pending';m.click(done?'Đã xong (3)':'Chưa xong (3)');
  for(const [index,next] of ['b','c',null].entries()){
   all(list(m),n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:!done}});m.draw();
   assert.equal(rows(m).length,2-index);assert.equal(m.focused?.id,next?'notebook-task-'+next:'notebook-task-filter-'+filter);
   assert.equal(primary.writes,index+1);
  }
  assert.equal(JSON.parse(primary.raw).days[today].filter((t:Task)=>t.done===!done).length,3);
 });
});

test('Xóa việc giữ điểm tiếp nối bàn phím ở việc còn lại hoặc bộ lọc khi hết việc',()=>withNotebook([task('a'),task('b')],({m,primary}:any)=>{
 press(m,'Xóa việc Việc GIẢ a');assert.equal(rows(m).length,1);assert.equal(m.focused?.id,'notebook-task-b');
 assert.deepEqual(JSON.parse(primary.raw).days[today].map((t:Task)=>t.id),['b']);
 press(m,'Xóa việc Việc GIẢ b');assert.equal(rows(m).length,0);assert.equal(m.focused?.id,'notebook-task-filter-all');assert.equal(primary.writes,2);
}));

test('Lưu hoặc hủy editor trả focus về checkbox chính việc đó, việc còn lại hoặc bộ lọc',()=>{
 for(const action of ['Lưu thay đổi','Hủy sửa'])for(const remaining of [false,true])withNotebook([task('a'),...(remaining?[task('b',true)]:[])],({m,primary}:any)=>{
  press(m,'Sửa việc Việc GIẢ a');all(list(m),n=>n.type==='input'&&n.props.maxLength===400)[0].props.onChange({target:{value:'Việc GIẢ đã sửa'}});m.draw();
  m.click('Đã xong ('+(remaining?1:0)+')');assert.match(text(m.tree),/Việc đang sửa được giữ/);
  m.click(action);assert.equal(rows(m).length,remaining?1:0);assert.equal(m.focused?.id,remaining?'notebook-task-b':'notebook-task-filter-done');
  const saved=JSON.parse(primary.raw).days[today];assert.equal(saved[0].text,action==='Lưu thay đổi'?'Việc GIẢ đã sửa':'Việc GIẢ a');assert.equal(primary.writes,action==='Lưu thay đổi'?1:0);
 });
 for(const action of ['Lưu thay đổi','Hủy sửa'])withNotebook([task('a')],({m,primary}:any)=>{
  press(m,'Sửa việc Việc GIẢ a');all(list(m),n=>n.type==='input'&&n.props.maxLength===400)[0].props.onChange({target:{value:'Việc GIẢ chỉnh trong Tất cả'}});m.draw();
  m.click(action);assert.equal(rows(m).length,1);assert.equal(m.focused?.id,'notebook-task-a');assert.equal(all(list(m),n=>n.type==='input'&&n.props.maxLength===400).length,0);
  assert.equal(primary.writes,action==='Lưu thay đổi'?1:0);
 });
 withNotebook([task('a'),task('b',true)],({m,primary,before}:any)=>{
  press(m,'Sửa việc Việc GIẢ a');all(list(m),n=>n.type==='input'&&n.props.maxLength===400)[0].props.onChange({target:{value:'Bản sửa GIẢ cần giữ'}});m.draw();
  m.click('Đã xong (1)');const beforeFocus=m.focused;primary.setItem=()=>{throw new Error('Bộ nhớ GIẢ chưa lưu được editor');};
  m.click('Lưu thay đổi');assert.equal(rows(m).length,2);assert.equal(m.focused,beforeFocus);assert.equal(primary.raw,before);assert.equal(primary.writes,0);
  assert.equal(all(list(m),n=>n.type==='input'&&n.props.maxLength===400)[0].props.value,'Bản sửa GIẢ cần giữ');assert.match(text(m.tree),/Bộ nhớ GIẢ chưa lưu được editor/);
 });
});

test('Không tự chuyển focus khi dòng còn trong Tất cả hoặc lưu bị lỗi, xung đột',()=>{
 withNotebook([task('a'),task('b')],({m,primary}:any)=>{
  const beforeFocus=m.focused;all(list(m),n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:true}});m.draw();
  assert.equal(rows(m).length,2);assert.equal(m.focused,beforeFocus);assert.equal(primary.writes,1);
 });
 for(const failure of ['write','conflict'])withNotebook([task('a'),task('b')],({m,primary,before}:any)=>{
  m.click('Chưa xong (2)');const beforeFocus=m.focused;
  if(failure==='write')primary.setItem=()=>{throw new Error('Bộ nhớ GIẢ bị chặn ghi');};
  else primary.raw=JSON.stringify({version:1,days:{[today]:[task('external',true)]},goals:{}});
  const expectedRaw=primary.raw;all(list(m),n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:true}});m.draw();
  assert.equal(rows(m).length,2);assert.equal(m.focused,beforeFocus);assert.equal(primary.raw,expectedRaw);assert.equal(primary.writes,0);
  assert.match(text(m.tree),failure==='write'?/Bộ nhớ GIẢ bị chặn ghi/:/thẻ khác/);
  if(failure==='write')assert.equal(primary.raw,before);
 });
});

test('Trạng thái rỗng phân biệt chưa có kế hoạch và chưa có việc hoàn thành',()=>{
 withNotebook([],({m}:any)=>{m.click('Đã xong (0)');assert.match(text(list(m)),/Một ngày mới, một kế hoạch mới/);assert.doesNotMatch(text(list(m)),/Chưa có việc đã xong/);});
 withNotebook([task('a')],({m}:any)=>{m.click('Đã xong (0)');assert.match(text(list(m)),/Chưa có việc đã xong/);assert.equal(rows(m).length,0);m.click('Tất cả (1)');assert.equal(rows(m).length,1);});
});

test('Đang sửa được giữ khi đổi lọc, vẫn lưu đúng việc và số phút',()=>withNotebook([task('a'),task('b',true)],({m,primary}:any)=>{
 press(m,'Sửa việc Việc GIẢ a');const input=all(list(m),n=>n.type==='input'&&n.props.maxLength===400)[0];input.props.onChange({target:{value:'Việc GIẢ đã sửa'}});m.draw();
 m.click('Đã xong (1)');assert.equal(rows(m).length,2);assert.match(text(m.tree),/Việc đang sửa được giữ/);assert.match(text(m.tree),/Đang hiện 2\/2/);
 assert.equal(all(list(m),n=>n.type==='input'&&n.props.maxLength===400)[0].props.value,'Việc GIẢ đã sửa');m.click('Lưu thay đổi');
 assert.equal(rows(m).length,1);assert.equal(JSON.parse(primary.raw).days[today][0].text,'Việc GIẢ đã sửa');assert.equal(JSON.parse(primary.raw).days[today][0].minutes,30);assert.equal(primary.writes,1);
 m.click('Tất cả (2)');assert.match(text(list(m)),/Việc GIẢ đã sửa/);
}));

test('Giới hạn 30 việc vẫn kiểm toàn bộ ngày kể cả khi bộ lọc hiện rỗng',()=>withNotebook(Array.from({length:30},(_,i)=>task(String(i),true)),({m,primary,before}:any)=>{
 m.click('Chưa xong (0)');all(m.tree,n=>n.type==='input'&&n.props.required)[0].props.onChange({target:{value:'Việc GIẢ thứ 31'}});m.draw();
 all(m.tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});m.draw();assert.match(text(m.tree),/Mỗi ngày tối đa 30 việc/);assert.equal(primary.raw,before);assert.equal(primary.writes,0);
}));

test('Lọc không xóa nháp hoặc vượt khóa xung đột, trò chơi vẫn có launcher',()=>withNotebook([task('a')],({m,primary,emitStorage,before}:any)=>{
 all(m.tree,n=>n.type==='input'&&n.props.required)[0].props.onChange({target:{value:'Nháp GIẢ cần giữ'}});m.draw();
 const changed=JSON.stringify({version:1,days:{[today]:[task('external',true)]},goals:{}});emitStorage(changed);m.draw();
 m.click('Chưa xong (1)');assert.equal(all(m.tree,n=>n.type==='input'&&n.props.required)[0].props.value,'Nháp GIẢ cần giữ');assert.match(text(m.tree),/thẻ khác/);
 all(list(m),n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:true}});m.draw();assert.equal(primary.raw,changed);assert.equal(primary.writes,0);
 assert.equal(all(m.tree,n=>n.type?.name==='NotebookFormulaLauncher').length,1);assert.notEqual(primary.raw,before);
}));

test('Bộ lọc tính lại theo ngày đang chọn và không làm đổi dữ liệu',()=>withNotebook([task('a')],({m,primary,before}:any)=>{
 m.click('Chưa xong (1)');const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
 all(m.tree,n=>n.type?.name==='NotebookRhythm')[0].props.onSelectDay(keyFor(yesterday));m.draw();assert.match(text(m.tree),/Tất cả \(0\)/);assert.match(text(m.tree),/Đang hiện 0\/0/);assert.equal(primary.raw,before);assert.equal(primary.writes,0);
}));

test('Phạm vi riêng, tải lười, không storage/mạng/timer/dependency mới và giữ màu MTM',()=>{
 const files=['NotebookFormulaLauncher.tsx','NotebookFormulaGame.tsx','notebook-formula-game.ts'];const code=files.map(file=>readFileSync(join(root,'src/migration',file),'utf8')).join('\n'),css=readFileSync(join(root,'src/migration/notebook-tools.css'),'utf8');
 assert.match(code,/lazy\(\(\)=>import\('\.\/NotebookFormulaGame'\)\)/);assert.match(code,/Suspense/);assert.doesNotMatch(code,/localStorage|sessionStorage|setItem|fetch\(|setInterval|setTimeout|\u2014/);
 assert.match(css,/min-height:44px/);assert.match(css,/:focus-visible/);assert.match(css,/#213269/);assert.match(css,/#FFCF24/);assert.match(css,/@media\(max-width:680px\)/);
 const notebook=readFileSync(join(root,'src/migration/Notebook.tsx'),'utf8');assert.doesNotMatch(notebook,/\u2014|L\?c vi\?c|T\?t c\?/);
});

function withNotebook(tasks:Task[],run:(context:any)=>void){
 const before=JSON.stringify({version:1,days:{[today]:tasks},goals:{}}),primary={raw:before,writes:0,getItem(key:string){return key===NOTEBOOK_KEY?this.raw:null;},setItem(key:string,value:string){assert.equal(key,NOTEBOOK_KEY);this.raw=value;this.writes++;}},session=new Map<string,string>();
 const listeners=new Map<string,Set<(e:any)=>void>>(),globals=globalThis as any,names=['window','localStorage','sessionStorage','confirm'],previous=names.map(name=>[name,Object.getOwnPropertyDescriptor(globals,name)] as const);
 Object.defineProperties(globals,{localStorage:{configurable:true,value:primary},sessionStorage:{configurable:true,value:{getItem:(key:string)=>session.get(key)??null,setItem:(key:string,value:string)=>session.set(key,value),removeItem:(key:string)=>session.delete(key)}},confirm:{configurable:true,value:()=>true},window:{configurable:true,value:{addEventListener(name:string,listener:(e:any)=>void){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name)!.add(listener);},removeEventListener(name:string,listener:(e:any)=>void){listeners.get(name)?.delete(listener);}}}});
 const m=mount('src/migration/Notebook.tsx');
 try{run({m,primary,before,emitStorage(raw:string){primary.raw=raw;for(const listener of listeners.get('storage')??[])listener({key:NOTEBOOK_KEY,newValue:raw,storageArea:primary});}});}
 finally{m.unmount();for(const [name,descriptor] of previous){if(descriptor)Object.defineProperty(globals,name,descriptor);else delete globals[name];}}
}

finish({note:'Dữ liệu GIẢ, kiểm bằng harness hook và số học độc lập. Cần kiểm trình duyệt thật ở lượt tích hợp.'});
