import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {solverProblems} from '../src/native/chapters/step-solver';
import {all,load,mount,React,require,root,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D22-SOLVER-'),file='src/native/chapters/StepSolver.tsx';
const choiceLabel=(step:any,id:string)=>{const index=step.choices.findIndex((c:any)=>c.id===id);return String.fromCharCode(65+index)+'. '+step.choices[index].text;};

test('Ba bài, 13 bước độc lập có điều kiện và một đáp án, đối chiếu nghiệm gốc',()=>{
  assert.equal(solverProblems.length,3);assert.equal(solverProblems.reduce((n,p)=>n+p.steps.length,0),13);
  assert.equal(new Set(solverProblems.map(p=>p.id)).size,3);
  for(const problem of solverProblems)for(const step of problem.steps){
    assert.equal(step.choices.length,3);assert.equal(new Set(step.choices.map(c=>c.id)).size,3);
    assert.equal(step.choices.filter(c=>c.id===step.correctId).length,1);assert.ok(step.hint.length>10);
    step.choices.forEach(c=>assert.ok(c.explanation.length>20));
  }
  // Giải và thế nghiệm độc lập bằng số hữu tỉ nguyên. Không dùng đáp án module để tính.
  const rational=[],product=[],radical=[];
  for(let x=-100;x<=100;x++){
    if(x!==2&&x+1===2*(x-2))rational.push(x);
    if(x*x-5*x+6===0)product.push(x);
    if(x>=-1&&Math.sqrt(x+1)===x-1)radical.push(x);
  }
  assert.deepEqual(rational,[5]);assert.deepEqual(product,[2,3]);assert.deepEqual(radical,[3]);
  assert.notEqual(Math.sqrt(0+1),0-1);assert.ok(0<1);
  assert.match(solverProblems[0].conclusion,/S = \{5\}/);assert.match(solverProblems[1].conclusion,/S = \{2; 3\}/);assert.match(solverProblems[2].conclusion,/S = \{3\}/);
  assert.match(solverProblems[2].steps[1].from,/x ≥ 1/);assert.match(solverProblems[2].steps[4].choices.find(c=>c.id==='accept')!.explanation,/x = 0 không thỏa/);
});

test('Sai thì thử lại, không nhảy bước; gợi ý và callback cũ không trả lời bước mới',()=>{
  const m=mount(file),p=solverProblems[0];try{
    m.click('Bắt đầu giải từng bước');assert.equal(m.focused.type,'h4');
    const old=all(m.tree,n=>n.type==='button'&&n.props['aria-pressed']!==undefined)[0].props.onClick;
    m.click('Xem gợi ý bước này');assert.equal(m.focused.type,'p');
    assert.equal(all(m.tree,n=>n.type==='button'&&n.props['aria-expanded']===true).length,1);
    m.click(choiceLabel(p.steps[0],'positive'));assert.equal(m.focused.type,'div');assert.match(text(m.tree),/Em xem lại/);
    const feedback=all(m.tree,n=>n.type==='div'&&n.props['aria-label']==='Giải thích bước đã chọn')[0];
    for(const id of feedback.props['aria-describedby'].split(' '))assert.equal(all(feedback,n=>n.props.id===id).length,1);
    assert.equal(all(m.tree,n=>n.type==='button'&&text(n)==='Sang bước tiếp theo').length,0);
    assert.ok(all(m.tree,n=>n.type==='button'&&n.props['aria-pressed']!==undefined).every(n=>n.props.disabled));
    m.click('Thử lại bước này');old();m.draw();assert.equal(all(m.tree,n=>n.type==='div'&&n.props['aria-label']==='Giải thích bước đã chọn').length,0);
    m.click(choiceLabel(p.steps[0],p.steps[0].correctId));
    const oldNext=all(m.tree,n=>n.type==='button'&&text(n)==='Sang bước tiếp theo')[0].props.onClick;
    m.click('Sang bước tiếp theo');oldNext();old();m.draw();assert.match(text(m.tree),/Bước 2\/4/);
    assert.equal(all(m.tree,n=>n.type==='div'&&n.props['aria-label']==='Giải thích bước đã chọn').length,0);
    assert.equal(all(m.tree,n=>n.type==='p'&&n.props.id?.endsWith('-hint'))[0].props.hidden,true);
    for(let i=1;i<p.steps.length;i++){m.click(choiceLabel(p.steps[i],p.steps[i].correctId));m.click(i===p.steps.length-1?'Xem lời giải đầy đủ':'Sang bước tiếp theo');}
    assert.match(text(m.tree),/1 bước dùng gợi ý và 1 bước đã thử lại/);
    assert.equal(all(m.tree,n=>n.type==='li').length,4);assert.match(text(m.tree),/S = \{5\}/);
    m.click('Giải lại bài này');assert.match(text(m.tree),/Bước 1\/4/);
    m.click('Dừng và chọn bài khác');assert.equal(m.focused.type,'h3');assert.match(text(m.tree),/Bắt đầu giải từng bước/);
  }finally{m.unmount();}
});

test('Giải đủ từng bài, tổng kết đúng bài và kết thúc không giữ phiên cũ',()=>{
  const m=mount(file);try{for(const p of solverProblems){
    all(m.tree,n=>n.type==='select')[0].props.onChange({target:{value:p.id}});m.draw();
    m.click('Bắt đầu giải từng bước');
    for(let i=0;i<p.steps.length;i++){
      assert.ok(text(m.tree).includes(p.steps[i].from));m.click(choiceLabel(p.steps[i],p.steps[i].correctId));
      m.click(i+1===p.steps.length?'Xem lời giải đầy đủ':'Sang bước tiếp theo');
    }
    assert.ok(text(m.tree).includes(p.conclusion));assert.match(text(m.tree),/0 bước dùng gợi ý và 0 bước đã thử lại/);
    m.click('Chọn bài khác hoặc kết thúc');assert.equal(m.focused.type,'h3');
  }}finally{m.unmount();}
});

test('SSR và tích hợp: lazy, nguồn, RAM, không điểm, không timer/storage/mạng',()=>{
  const html=require('react-dom/server').renderToStaticMarkup(React.createElement(load(file).default));
  assert.match(html,/đã học căn bậc hai/);assert.match(html,/MTM sưu tầm và biên soạn/);assert.match(html,/không tính điểm thi hoặc xếp hạng/);assert.match(html,/đổi chương hoặc tải lại/);
  const code=readFileSync(join(root,file),'utf8');assert.doesNotMatch(code,/fetch\(|localStorage|sessionStorage|setInterval|role="timer"/);
  const library=readFileSync(join(root,'src/native/chapters/PracticeLibrary.tsx'),'utf8');assert.match(library,/StepSolver=lazy/);assert.match(library,/key=\{'solver:'\+selected.id\+':'\+chapter.id\}/);
});
finish({note:'Kiểm dữ liệu tự luyện, tương tác hook và SSR. Không thay QA trình duyệt.'});
