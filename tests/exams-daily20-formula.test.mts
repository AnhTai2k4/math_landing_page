import assert from 'node:assert/strict';
import {formulaDecks,formulaRound} from '../src/native/chapters/formula-match';
import {recallDecks} from '../src/native/chapters/quick-recall';
import {all,load,mount,React,require,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D20-FORMULA-'),file='src/native/chapters/FormulaMatch.tsx',extra='export {FormulaSession,FormulaContent};';
const decks=['10','11','12'].flatMap(formulaDecks);
test('25 thẻ giữ nguyên nguồn, bộ nhiễu trong cùng phần, đúng một đáp án và phủ vị trí',()=>{
  assert.equal(decks.length,5);assert.equal(decks.flatMap(d=>d.cards).length,25);
  for(const deck of decks){
    const source=recallDecks(String(deck.grade)).find(d=>d.id===deck.id)!;
    for(const card of deck.cards)assert.deepEqual(card,source.cards.find(c=>c.id===card.id));
    const positions=new Set<number>();
    for(let round=0;round<30;round++){
      const questions=formulaRound(deck,round);assert.equal(questions.length,5);assert.equal(new Set(questions.map(q=>q.card.id)).size,5);
      for(const q of questions){assert.equal(q.choices.length,3);assert.equal(new Set(q.choices.map(c=>c.id)).size,3);assert.equal(q.choices.filter(c=>c.id===q.card.id).length,1);assert.ok(q.choices.every(c=>deck.cards.some(card=>card.id===c.id&&card.topic===c.topic)));positions.add(q.choices.findIndex(c=>c.id===q.card.id));}
    }
    assert.deepEqual([...positions].sort(),[0,1,2]);
  }
  assert.deepEqual(formulaDecks('hsa'),[]);
});
const choice=(m:any,id:string)=>all(m.tree,n=>n.type==='button'&&n.props.onClick&&text(n)===decks.flatMap(d=>d.cards).find(c=>c.id===id)!.topic)[0];
test('Chọn một lần, giữ phản hồi, sự kiện cũ không đổi câu mới hoặc lượt ôn cùng câu',()=>{
  const deck=decks[0],questions=formulaRound(deck),m=mount(file,{deck},'FormulaSession',extra);
  m.click('Bắt đầu nhận diện 5 câu');assert.equal(m.focused.type,'h3');
  const old=choice(m,questions[0].card.id).props.onClick,wrong=questions[0].choices.find(c=>c.id!==questions[0].card.id)!;
  choice(m,wrong.id).props.onClick();m.draw();assert.equal(m.focused.type,'div');old();m.draw();
  assert.match(text(m.tree),/Em xem lại tên thẻ/);assert.ok(all(m.tree,n=>n.type==='button'&&n.props['aria-pressed']!==undefined).every(n=>n.props.disabled));
  m.click('Câu tiếp theo');old();m.draw();assert.doesNotMatch(text(m.tree),/Chính xác!/);
  for(let i=1;i<5;i++){choice(m,questions[i].card.id).props.onClick();m.draw();m.click(i===4?'Xem tổng kết ghép thẻ':'Câu tiếp theo');}
  assert.match(text(m.tree),/Em chọn đúng 4\/5/);m.click('Ôn lại câu ghép sai');assert.match(text(m.tree),/Ôn lại · Câu 1\/1/);
  old();m.draw();assert.doesNotMatch(text(m.tree),/Chính xác!/);choice(m,questions[0].card.id).props.onClick();m.draw();m.click('Xem tổng kết ghép thẻ');assert.match(text(m.tree),/Em chọn đúng 1\/1/);
  m.click('Chơi lại 5 câu');assert.match(text(m.tree),/Câu 1\/5/);m.unmount();
});
test('Không xuất usage trước chọn; tổng kết đủ nguồn, trò kết thúc hữu hạn và trả focus',()=>{
  const deck=decks[1],m=mount(file,{deck},'FormulaSession',extra);m.click('Bắt đầu nhận diện 5 câu');
  assert.doesNotMatch(text(m.tree),/Cách dùng và điều cần nhớ/);
  assert.equal(all(m.tree,n=>n.props?.card)[0].props.card.id,formulaRound(deck)[0].card.id);
  for(let i=0;i<5;i++){choice(m,formulaRound(deck)[i].card.id).props.onClick();m.draw();assert.match(text(m.tree),/Cách dùng và điều cần nhớ/);m.click(i===4?'Xem tổng kết ghép thẻ':'Câu tiếp theo');}
  assert.match(text(m.tree),/Em chọn đúng 5\/5/);assert.equal(all(m.tree,n=>n.type==='details').length,5);assert.doesNotMatch(text(m.tree),/Ôn lại câu ghép sai/);
  m.click('Kết thúc lượt chơi');assert.equal(m.focused.type,'h3');assert.match(text(m.tree),/Bắt đầu nhận diện 5 câu/);m.unmount();
});
test('Chọn bộ và đổi phạm vi không mang lựa chọn cũ, chương thiếu bộ báo đúng',()=>{
  const m=mount(file,{track:'10',chapter:'3'});assert.equal(all(m.tree,n=>n.type==='select')[0].props.value,'g10-c3');
  m.draw({track:'10',chapter:'2'});assert.equal(all(m.tree,n=>n.type==='select')[0].props.value,'');assert.match(text(m.tree),/Chương này chưa có bộ/);
  all(m.tree,n=>n.type==='select')[0].props.onChange({target:{value:'g10-c1'}});m.draw();assert.equal(all(m.tree,n=>n.props?.deck)[0].key,'10:2:g10-c1');
  m.draw({track:'12',chapter:'1'});assert.equal(all(m.tree,n=>n.type==='select')[0].props.value,'g12-c1');m.unmount();
});
test('SSR giữ công thức/điều kiện đầy đủ cho Hê-rông, các nút có nhãn và nguồn',()=>{
  const mod=load(file,undefined,extra),card=decks[1].cards.find(c=>c.id.endsWith(':heron'))!;
  const html=require('react-dom/server').renderToStaticMarkup(React.createElement(mod.FormulaContent,{card,usage:true}));
  assert.match(html,/không suy biến/);assert.match(html,/Cách dùng và điều cần nhớ/);assert.match(html,/<math /);assert.match(html,/<msqrt>/);
  const publicHtml=require('react-dom/server').renderToStaticMarkup(React.createElement(mod.default,{track:'10',chapter:'3'}));
  assert.match(publicHtml,/MTM sưu tầm và biên soạn/);assert.match(publicHtml,/không tính điểm/);assert.doesNotMatch(publicHtml,/role="timer"/);
});
test('Điều kiện rađian và liên tục đã hiện khi chưa chọn tên thẻ',()=>{
  const mod=load(file,undefined,extra),render=(id:string,usage=false)=>require('react-dom/server').renderToStaticMarkup(React.createElement(mod.FormulaContent,{card:decks.flatMap(d=>d.cards).find(c=>c.id===id)!,usage}));
  const trig=render('g12-c1:derivative-trig'),extrema=render('g12-c1:extrema');
  assert.match(trig,/Biến góc đo bằng rađian\./);
  assert.match(extrema,/Hàm liên tục quanh điểm xét, có đạo hàm ở hai phía\./);
  assert.doesNotMatch(trig+extrema,/Cách dùng và điều cần nhớ/);
  assert.match(render('g12-c1:extrema',true),/Cách dùng và điều cần nhớ/);
  // Các gợi ý cách ghép tên vẫn chờ phản hồi, chỉ điều kiện cần được đưa lên trước.
  assert.doesNotMatch(render('g10-c1:implication'),/Mệnh đề đảo chưa chắc đúng/);
});
finish({note:'Hook/SSR và đối chiếu nguồn; không thay QA trình duyệt hoặc MathType mới.'});
