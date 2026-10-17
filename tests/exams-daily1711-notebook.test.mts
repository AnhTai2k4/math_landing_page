import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {SOLUTION_PUZZLES,stepChoices} from '../src/migration/notebook-step-order';
import {FORMULA_DECKS} from '../src/migration/notebook-formula-game';
import {all,load,mount,React,require,root,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D1711-NOTEBOOK-'),file='src/migration/NotebookStepOrder.tsx',formula='src/migration/NotebookFormulaGame.tsx';
const button=(m:any,label:string)=>{const node=all(m.tree,n=>n.type==='button'&&n.props['aria-label']===label)[0];assert.ok(node,'Có nút '+label);assert.ok(!node.props.disabled);return node;};
const choose=(m:any,index:number,puzzle=SOLUTION_PUZZLES[0])=>{button(m,'Đặt bước: '+puzzle.steps[index].text).props.onClick();m.draw();};
const selectExpression=(m:any,id:string,deck=FORMULA_DECKS[0])=>{button(m,'Chọn biểu thức '+deck.pairs.find(pair=>pair.id===id)!.expression).props.onClick();m.draw();};
const selectAnswer=(m:any,id:string,deck=FORMULA_DECKS[0])=>{button(m,'Ghép với '+deck.pairs.find(pair=>pair.id===id)!.answer).props.onClick();m.draw();};

test('Oracle số độc lập: nghiệm bậc nhất, phân thức và căn thức; giữ đủ điều kiện và phép thử',()=>{
 const xs=Array.from({length:161},(_,i)=>i/4-20);
 assert.deepEqual(xs.filter(x=>3*(x-2)+4===10),[4]);
 assert.deepEqual(xs.filter(x=>x!==2&&(x*x-4)/(x-2)===5),[3]);
 assert.deepEqual(xs.filter(x=>2*x+3>=0&&Math.sqrt(2*x+3)===3),[3]);
 for(const x of xs){
  assert.equal(3*(x-2)+4,3*x-2);
  if(x!==2)assert.ok((x*x-4)/(x-2)===x+2);
  if(x>=-1.5)assert.equal(Math.sqrt(2*x+3)===3,2*x+3===9);
 }
 assert.ok(Number.isNaN((2*2-4)/(2-2)));assert.ok(Number.isNaN(Math.sqrt(2*(-2)+3)));
 const [linear,rational,radical]=SOLUTION_PUZZLES;
 assert.match(linear.steps.at(-1)!.text,/3\(4 − 2\) \+ 4 = 10.*S = \{4\}/);
 assert.match(rational.steps[0].text,/x ≠ 2/);assert.match(rational.steps[2].text,/Với x ≠ 2/);assert.match(rational.steps.at(-1)!.text,/thỏa điều kiện.*S = \{3\}/);
 assert.match(radical.steps[0].text,/x ≥ −3\/2/);assert.match(radical.steps[1].text,/Hai vế không âm/);assert.match(radical.steps.at(-1)!.text,/√\(2 · 3 \+ 3\) = √9 = 3.*S = \{3\}/);
});

test('Ba bài hữu hạn, 5 thẻ duy nhất, xáo thứ tự và lời giải tự biên soạn đủ lý do',()=>{
 assert.equal(SOLUTION_PUZZLES.length,3);assert.equal(new Set(SOLUTION_PUZZLES.map(p=>p.id)).size,3);
 for(const p of SOLUTION_PUZZLES){assert.equal(p.steps.length,5);assert.equal(new Set(p.steps.map(s=>s.id)).size,5);assert.deepEqual(stepChoices(p).map(s=>s.id).sort(),p.steps.map(s=>s.id).sort());assert.notDeepEqual(stepChoices(p),p.steps);for(const s of p.steps)assert.ok(s.text.length>10&&s.reason.length>20&&s.hint.length>20);}
});

test('Chọn sai không đặt thẻ; mỗi bước đúng hiện lý do, tiến độ và cuối cùng đủ lời giải',()=>{
 const m=mount(file);try{
  assert.match(text(m.tree),/Đã xếp 0\/5/);assert.match(text(m.tree),/những cách giải tương đương khác vẫn có thể đúng/);
  choose(m,3);assert.match(text(m.tree),/Chưa đúng vị trí/);assert.match(text(m.tree),/Đã xếp 0\/5/);
  for(let i=0;i<5;i++){choose(m,i);assert.match(text(m.tree),new RegExp('Đã xếp '+(i+1)+'/5'));assert.ok(text(m.tree).includes(SOLUTION_PUZZLES[0].steps[i].reason));assert.equal(m.focused.id,i===4?'step-order-summary':'step-order-question');}
  assert.match(text(m.tree),/Em đã xếp đúng cả lời giải/);assert.equal(all(m.tree,n=>n.type==='ol')[0].props.children.length,5);assert.equal(all(m.tree,n=>n.props['aria-label']?.startsWith('Đặt bước:')).length,0);
 }finally{m.unmount();}
});

test('Lùi, xếp lại và đổi bài khôi phục đúng thẻ, không giữ phản hồi bài cũ',()=>{
 const m=mount(file);try{
  assert.equal(all(m.tree,n=>n.type==='button'&&text(n)==='Lùi một bước')[0].props.disabled,true);
  choose(m,0);choose(m,1);m.click('Lùi một bước');assert.match(text(m.tree),/Đã xếp 1\/5/);assert.ok(button(m,'Đặt bước: '+SOLUTION_PUZZLES[0].steps[1].text));assert.equal(m.focused.id,'step-order-question');
  m.click('Xếp lại bài');assert.match(text(m.tree),/Đã xếp 0\/5/);assert.doesNotMatch(text(m.tree),/Lời giải em đã xếp/);
  for(const p of SOLUTION_PUZZLES.slice(1)){m.click(p.title);assert.match(text(m.tree),/Đã xếp 0\/5/);assert.doesNotMatch(text(m.tree),/Đã trả bước cuối/);for(let i=0;i<5;i++)choose(m,i,p);assert.match(text(m.tree),/Em đã xếp đúng cả lời giải/);}
 }finally{m.unmount();}
});

test('Bấm đúp, callback đúng cũ, lùi cũ và đổi bài cũ không làm tiến sai lượt mới',()=>{
 const m=mount(file);try{
  const start=button(m,'Đặt bước: '+SOLUTION_PUZZLES[0].steps[0].text).props.onClick;
  const staleLater=button(m,'Đặt bước: '+SOLUTION_PUZZLES[0].steps[1].text).props.onClick;
  start();start();m.draw();assert.match(text(m.tree),/Đã xếp 1\/5/);
  staleLater();m.draw();assert.match(text(m.tree),/Đã xếp 1\/5/);
  const undo=all(m.tree,n=>n.type==='button'&&text(n)==='Lùi một bước')[0].props.onClick;
  choose(m,1);undo();m.draw();assert.match(text(m.tree),/Đã xếp 2\/5/);
  m.click('Phân thức có điều kiện');const before=text(m.tree);start();staleLater();undo();m.draw();assert.equal(text(m.tree),before);
  choose(m,0,SOLUTION_PUZZLES[1]);assert.match(text(m.tree),/Đã xếp 1\/5/);
 }finally{m.unmount();}
});

test('Launcher tải lười, có trạng thái mở đóng và lỗi riêng không phá sổ tay',()=>{
 const launch='src/migration/NotebookStepOrderLauncher.tsx',m=mount(launch);try{
  assert.equal(all(m.tree,n=>n.props.id==='notebook-step-content').length,0);m.click('Mở Xếp bước giải');assert.equal(all(m.tree,n=>n.props.id==='notebook-step-content').length,1);assert.equal(all(m.tree,n=>n.props['aria-expanded']===true).length,1);m.click('Đóng Xếp bước giải');assert.equal(all(m.tree,n=>n.props.id==='notebook-step-content').length,0);
 }finally{m.unmount();}
 const {NotebookStepOrderBoundary}=load(launch),boundary=new NotebookStepOrderBoundary({children:React.createElement('p',null,'Game')});assert.equal(text(boundary.render()),'Game');boundary.state=NotebookStepOrderBoundary.getDerivedStateFromError();assert.equal(boundary.render().props.role,'alert');assert.match(text(boundary.render()),/vẫn có thể dùng sổ tay/);
});

test('Ghép công thức v2 che trước khi tự nhớ, lật chủ động, chuyển focus rồi che lại cho cặp tiếp',()=>{
 const m=mount(formula);try{
  m.click('Tự nhớ trước khi ghép');assert.equal(all(m.tree,n=>n.props['aria-label']?.startsWith('Ghép với ')).length,0);
  selectExpression(m,'sum-square');assert.equal(m.focused.id,'formula-recall-flip');assert.equal(all(m.tree,n=>n.props['aria-label']?.startsWith('Ghép với ')).length,0);
  m.click('Lật công thức để đối chiếu');assert.equal(all(m.tree,n=>n.props['aria-label']?.startsWith('Ghép với ')).length,3);assert.equal(m.focused.id,'formula-answer-difference-square');
  selectAnswer(m,'sum-square');assert.match(text(m.tree),/Đã ghép 1\/3/);assert.equal(m.focused.id,'formula-expression-difference-square');assert.equal(all(m.tree,n=>n.props['aria-label']?.startsWith('Ghép với ')).length,0);
  selectExpression(m,'difference-square');assert.equal(m.focused.id,'formula-recall-flip');m.click('Lật công thức để đối chiếu');selectAnswer(m,'difference-square');selectExpression(m,'difference-of-squares');m.click('Lật công thức để đối chiếu');assert.equal(m.focused.id,'formula-answer-difference-of-squares');assert.equal(all(m.tree,n=>n.props.id===m.focused.id)[0].props.disabled,false);assert.match(text(m.tree),/không được chấm tự động/);
 }finally{m.unmount();}
});

test('Lật cũ và đáp án cũ không vượt màn che hoặc tác động bộ, chế độ mới',()=>{
 const m=mount(formula);try{
  selectExpression(m,'sum-square');const oldAnswer=button(m,'Ghép với '+FORMULA_DECKS[0].pairs[0].answer).props.onClick;
  m.click('Tự nhớ trước khi ghép');selectExpression(m,'sum-square');oldAnswer();m.draw();assert.match(text(m.tree),/Đã ghép 0\/3/);
  const oldFlip=all(m.tree,n=>n.type==='button'&&text(n)==='Lật công thức để đối chiếu')[0].props.onClick;
  selectExpression(m,'difference-square');oldFlip();m.draw();assert.equal(all(m.tree,n=>n.props['aria-label']?.startsWith('Ghép với ')).length,0);
  m.click('Căn thức và điều kiện');selectExpression(m,'root-square',FORMULA_DECKS[1]);oldFlip();oldAnswer();m.draw();assert.equal(all(m.tree,n=>n.props['aria-label']?.startsWith('Ghép với ')).length,0);assert.match(text(m.tree),/Đã ghép 0\/3/);
  m.click('Tự nhớ trước khi ghép');assert.equal(all(m.tree,n=>n.props['aria-label']?.startsWith('Ghép với ')).length,3);
 }finally{m.unmount();}
});

test('Tự nhớ giữ ôn sai, điều kiện và lời giải, đổi bộ giữ chế độ nhưng xóa lượt',()=>{
 const m=mount(formula);try{
  m.click('Tự nhớ trước khi ghép');
  for(const [i,p] of FORMULA_DECKS[0].pairs.entries()){selectExpression(m,p.id);m.click('Lật công thức để đối chiếu');if(i===0){selectAnswer(m,'difference-square');assert.match(text(m.tree),/Cặp này chưa khớp/);}selectAnswer(m,p.id);}
  assert.match(text(m.tree),/Em đã ghép xong 3 cặp/);m.click('Ôn cặp từng nhầm');assert.match(text(m.tree),/Đã ghép 0\/1/);assert.equal(all(m.tree,n=>n.props['aria-label']?.startsWith('Ghép với ')).length,0);
  selectExpression(m,'sum-square');m.click('Lật công thức để đối chiếu');selectAnswer(m,'sum-square');assert.match(text(m.tree),/Em đã ghép xong 1 cặp/);
  m.click('Căn thức và điều kiện');assert.match(text(m.tree),/Đã ghép 0\/3/);assert.match(text(m.tree),/Đang bật tự nhớ/);selectExpression(m,'root-square',FORMULA_DECKS[1]);m.click('Lật công thức để đối chiếu');selectAnswer(m,'root-square',FORMULA_DECKS[1]);assert.match(text(m.tree),/Căn bậc hai số học luôn không âm/);
 }finally{m.unmount();}
});

test('Callback đáp án cũ không chấm lựa chọn mới trong cùng bộ, kể cả sau khi lật lại',()=>{
 for(const recall of [false,true]){
  const m=mount(formula);try{
   if(recall)m.click('Tự nhớ trước khi ghép');selectExpression(m,'sum-square');if(recall)m.click('Lật công thức để đối chiếu');
   const staleCorrect=button(m,'Ghép với '+FORMULA_DECKS[0].pairs[1].answer).props.onClick;
   selectExpression(m,'difference-square');staleCorrect();m.draw();assert.match(text(m.tree),/Đã ghép 0\/3/);
   if(recall)m.click('Lật công thức để đối chiếu');const before=text(m.tree);staleCorrect();m.draw();assert.equal(text(m.tree),before);assert.match(text(m.tree),/Đã ghép 0\/3/);
   selectAnswer(m,'difference-square');assert.match(text(m.tree),/Đã ghép 1\/3/);
  }finally{m.unmount();}
 }
});

test('SSR đủ nhãn, nội dung Toán, nút native và gói nhỏ không mạng, lưu trữ, timer hay dependency mới',()=>{
 const files=['NotebookStepOrder.tsx','NotebookStepOrderLauncher.tsx','notebook-step-order.ts','NotebookFormulaGame.tsx'];const code=files.map(name=>readFileSync(join(root,'src/migration',name),'utf8')).join('\n');
 assert.doesNotMatch(code,/localStorage|sessionStorage|fetch\(|setItem|setInterval|setTimeout|\u2014|onDrag/);assert.match(code,/lazy\(\(\)=>import\('\.\/NotebookStepOrder'\)\)/);
 const html=require('react-dom/server').renderToStaticMarkup(React.createElement(load(file).default));assert.match(html,/3\(x − 2\) \+ 4 = 10/);assert.match(html,/type="button"/);assert.match(html,/aria-live="polite"/);assert.match(html,/MTM sưu tầm và biên soạn/);assert.match(html,/không thuộc đề gốc/);assert.doesNotMatch(html,/role="timer"/);
 const css=readFileSync(join(root,'src/migration/notebook-tools.css'),'utf8');assert.match(css,/min-height:44px/);assert.match(css,/:focus-visible/);assert.match(css,/#213269/);assert.match(css,/#FFCF24/);assert.match(css,/mig-step-cards\{display:grid/);
 assert.match(readFileSync(join(root,'src/migration/Notebook.tsx'),'utf8'),/<NotebookStepOrderLauncher\/>/);
});

finish({newFeature:'Xếp bước giải v1',upgrade:'Ghép cặp công thức v1 → v2'});
