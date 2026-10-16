import assert from 'node:assert/strict';
import {errorHuntCards,errorHuntRound} from '../src/native/chapters/error-hunt';
import {all,load,mount,React,require,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D21-ERROR-'),file='src/native/chapters/ErrorHunt.tsx';

test('Bộ 10 thẻ, mỗi lượt đủ 5 chủ đề, có cả đúng/sai và không lặp thẻ',()=>{
  assert.equal(errorHuntCards.length,10);assert.equal(new Set(errorHuntCards.map(c=>c.id)).size,10);
  assert.equal(errorHuntCards.filter(c=>c.valid).length,5);
  const seen=new Set<string>();
  for(let round=0;round<64;round++){
    const cards=errorHuntRound(round);assert.equal(cards.length,5);assert.equal(new Set(cards.map(c=>c.topic)).size,5);
    cards.forEach(c=>{assert.ok(errorHuntCards.includes(c));seen.add(c.id);});
  }
  assert.equal(seen.size,10);for(const bad of [NaN,Infinity,-1,1.5])assert.deepEqual(errorHuntRound(bad),errorHuntRound(0));
});

test('Kiểm toán độc lập: miền xác định, khai triển, căn, tập nghiệm, dấu và quy đồng',()=>{
  // Đối chiếu số học độc lập để bắt lỗi dữ liệu; chứng minh tổng quát nằm trong lời giải được reviewer rà.
  const identities:Record<string,(x:number)=>[number,number]>={
    'square-true':x=>[(x+3)**2,x*x+6*x+9],
    'root-true':x=>[Math.sqrt(x*x),-x],
    'cancel-true':x=>[Number(x*(x-2)===0),Number(x-2===0)],
    'inequality-true':x=>[Number(-2*x<6),Number(x>-3)],
    'fraction-true':x=>[1/x+1/2,(x+2)/(2*x)],
  };
  for(const [id,evaluate] of Object.entries(identities)){
    assert.equal(errorHuntCards.find(c=>c.id===id)!.valid,true);
    for(let n=-120;n<=120;n++){
      const x=n/4;if(id==='root-true'&&x>0||['cancel-true','fraction-true'].includes(id)&&x===0)continue;
      const [a,b]=evaluate(x);assert.ok(Math.abs(a-b)<1e-10,`${id} tại ${x}`);
    }
  }
  const counterexamples:Record<string,[number,number]>={
    'square-false':[(1+3)**2,1+9],
    'root-false':[Math.sqrt((-3)**2),-3],
    'cancel-false':[Number(0*(0-2)===0),Number(0-2===0)],
    'inequality-false':[Number(-2*0<6),Number(0< -3)],
    'fraction-false':[1/2+1/2,2/(2+2)],
  };
  for(const [id,[a,b]] of Object.entries(counterexamples)){assert.notEqual(a,b);const card=errorHuntCards.find(c=>c.id===id)!;assert.equal(card.valid,false);assert.match(card.explanation.join(' '),/Phản ví dụ/);}
  assert.match(errorHuntCards.find(c=>c.id==='root-true')!.condition,/≤ 0/);
  assert.match(errorHuntCards.find(c=>c.id==='cancel-true')!.condition,/≠ 0/);
  assert.match(errorHuntCards.find(c=>c.id==='fraction-false')!.condition,/≠ 0 và x ≠ −2/);
});

test('Lựa chọn false khác chưa chọn, khóa bấm lặp, callback cũ không trả lời câu mới',()=>{
  const m=mount(file);try{
    m.click('Bắt đầu săn lỗi 5 câu');assert.equal(m.focused.type,'h4');
    assert.doesNotMatch(text(m.tree),/Phản ví dụ x = 1/);
    const old=all(m.tree,n=>n.type==='button'&&text(n)==='Đúng')[0].props.onClick;
    m.click('Sai');assert.equal(m.focused.type,'div');assert.match(text(m.tree),/Em nhận xét chính xác/);
    assert.equal(all(m.tree,n=>n.type==='button'&&n.props['aria-pressed']!==undefined&&n.props.disabled).length,2);
    old();m.draw();assert.match(text(m.tree),/Em nhận xét chính xác/);
    const next=all(m.tree,n=>n.type==='button'&&text(n)==='Khẳng định tiếp theo')[0].props.onClick;
    m.click('Khẳng định tiếp theo');next();old();m.draw();
    assert.match(text(m.tree),/Câu 2\/5/);assert.doesNotMatch(text(m.tree),/Khẳng định đã cho là/);
    m.click('Dừng lượt tự luyện');assert.equal(m.focused.type,'h3');m.click('Bắt đầu săn lỗi 5 câu');assert.doesNotMatch(text(m.tree),/Khẳng định đã cho là/);
  }finally{m.unmount();}
});

test('Tổng kết đúng một lần, ôn đúng câu sai, kết thúc và lượt khác trong kho đã rà',()=>{
  const m=mount(file),cards=errorHuntRound(0);try{
    m.click('Bắt đầu săn lỗi 5 câu');
    for(let i=0;i<cards.length;i++){m.click((i===0?!cards[i].valid:cards[i].valid)?'Đúng':'Sai');m.click(i===4?'Xem tổng kết săn lỗi':'Khẳng định tiếp theo');}
    assert.match(text(m.tree),/Em nhận xét đúng 4\/5/);assert.equal(all(m.tree,n=>n.type==='details').length,5);
    m.click('Ôn lại câu nhận xét sai');assert.match(text(m.tree),/Ôn lại · Câu 1\/1/);m.click('Sai');m.click('Xem tổng kết săn lỗi');
    assert.match(text(m.tree),/Em nhận xét đúng 1\/1/);assert.doesNotMatch(text(m.tree),/Ôn lại câu nhận xét sai/);
    m.click('Chơi lượt khác trong 10 thẻ');assert.match(text(m.tree),/Câu 1\/5/);assert.ok(text(m.tree).includes(errorHuntRound(1)[0].statement));
    m.click('Dừng lượt tự luyện');m.click('Bắt đầu săn lỗi 5 câu');
    for(let i=0;i<5;i++){m.click(errorHuntRound(1)[i].valid?'Đúng':'Sai');m.click(i===4?'Xem tổng kết săn lỗi':'Khẳng định tiếp theo');}
    m.click('Kết thúc săn lỗi');assert.equal(m.focused.type,'h3');assert.match(text(m.tree),/Bắt đầu săn lỗi 5 câu/);
  }finally{m.unmount();}
});

test('SSR có hướng dẫn tương đương, nguồn và trạng thái local, không xuất lời giải trước chọn',()=>{
  const component=load(file).default,html=require('react-dom/server').renderToStaticMarkup(React.createElement(component));
  assert.match(html,/cùng tập nghiệm/);assert.match(html,/MTM sưu tầm và biên soạn/);assert.match(html,/không tính điểm thi hoặc xếp hạng/);
  assert.match(html,/Dừng lượt, đổi chương hoặc tải lại/);assert.doesNotMatch(html,/Phản ví dụ|role="timer"|<input/);
});
finish({note:'Toán, hook và SSR với dữ liệu tự luyện; không thay kiểm trình duyệt/ảnh.'});
