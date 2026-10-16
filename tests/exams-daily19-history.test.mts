import assert from 'node:assert/strict';
import {recallDecks} from '../src/native/chapters/quick-recall';
import {all,load,mount,React,require,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D19-HISTORY-'),file='src/native/chapters/QuickRecall.tsx',extra='export {RecallSession,RecallHistory,CardContent};';
const history=(tree:any)=>all(tree,n=>n.props?.items&&n.props?.onReturn)[0];
test('Chỉ ghi thẻ đã đánh giá, lưu đúng thứ tự và lựa chọn, xem lại không đổi số thẻ',()=>{
  const deck=recallDecks('10')[0],m=mount(file,{deck},'RecallSession',extra);
  assert.equal(history(m.tree),undefined);m.click('Lật thẻ xem công thức');assert.equal(history(m.tree),undefined);
  m.click('Cần ôn lại');let component=history(m.tree);assert.equal(component.props.items.length,1);assert.equal(component.props.items[0].card.id,deck.cards[0].id);assert.equal(component.props.items[0].remembered,false);
  const before=text(m.tree);component.props.onReturn();m.draw();assert.equal(text(m.tree),before);assert.equal(m.focused.type,'h3');
  m.click('Lật thẻ xem công thức');m.click('Em đã nhớ');component=history(m.tree);assert.deepEqual(component.props.items.map((v:any)=>v.remembered),[false,true]);assert.match(text(m.tree),/Thẻ 3\/5/);m.unmount();
});
test('Ôn lại thẻ khó hoặc lấy bộ kế bỏ lịch sử cũ, không kéo thẻ khác bộ sang',()=>{
  const deck=recallDecks('10')[0],m=mount(file,{deck},'RecallSession',extra);
  for(let i=0;i<5;i++){m.click('Lật thẻ xem công thức');m.click(i===2?'Cần ôn lại':'Em đã nhớ');}
  assert.equal(history(m.tree).props.items.length,5);assert.equal(history(m.tree).props.done,true);
  m.click('Ôn lại 1 thẻ cần nhớ');assert.equal(history(m.tree),undefined);assert.match(text(m.tree),/Ôn lại · Thẻ 1\/1/);
  m.click('Lật thẻ xem công thức');m.click('Em đã nhớ');assert.equal(history(m.tree).props.items[0].card.id,deck.cards[2].id);
  m.click('5 thẻ tiếp theo');assert.equal(history(m.tree),undefined);assert.match(text(m.tree),new RegExp(deck.cards[5].topic));m.unmount();
});
test('Bộ chọn lịch sử và nút trở về không sửa đầu vào, đóng panel và gọi đúng callback',()=>{
  const cards=recallDecks('10')[0].cards.slice(0,2),items=cards.map((card,i)=>({card,remembered:i===1}));let returned=0;
  const baseline=JSON.stringify(items),m=mount(file,{items,done:false,onReturn(){returned++;}},'RecallHistory',extra);
  assert.match(text(m.tree),/Xem lại thẻ vừa ôn \(2\)/);assert.equal(all(m.tree,n=>n.type==='select')[0].props.value,0);assert.match(text(m.tree),/Cần ôn lại/);
  all(m.tree,n=>n.type==='select')[0].props.onChange({target:{value:'1'}});m.draw();assert.match(text(m.tree),/Em đã nhớ/);
  assert.equal(all(m.tree,n=>n.props?.card)[0].props.card.id,cards[1].id);
  const panel=all(m.tree,n=>n.type==='details')[0].ref.current;m.click('Về thẻ đang ôn');assert.equal(panel.open,false);assert.equal(returned,1);assert.equal(JSON.stringify(items),baseline);m.unmount();
});

test('Lô cuối ghi đúng số thẻ còn lại, kể cả khi quay về sau lượt ôn thẻ khó',()=>{
  const source=recallDecks('10').find(deck=>deck.id==='g10-c3')!;
  for(const remaining of [1,2,3,4]){
    const deck={...source,cards:source.cards.slice(0,5+remaining)},m=mount(file,{deck},'RecallSession',extra);
    for(let i=0;i<5;i++){m.click('Lật thẻ xem công thức');m.click(i===0?'Cần ôn lại':'Em đã nhớ');}
    const label=remaining+' thẻ tiếp theo';
    assert.equal(all(m.tree,n=>n.type==='button'&&text(n)===label).length,1);
    m.click('Ôn lại 1 thẻ cần nhớ');m.click('Lật thẻ xem công thức');m.click('Em đã nhớ');
    m.click(label);assert.match(text(m.tree),new RegExp('Thẻ 1/'+remaining));
    for(let i=0;i<remaining;i++){m.click('Lật thẻ xem công thức');m.click('Em đã nhớ');}
    m.click('Ôn lại từ đầu');assert.match(text(m.tree),/Thẻ 1\/5/);m.unmount();
  }
});
test('SSR lịch sử giữ nguyên công thức và ngữ cảnh của Hê-rông/trung tuyến',()=>{
  const mod=load(file,undefined,extra),deck=recallDecks('10').find(d=>d.id==='g10-c3')!;
  const items=deck.cards.filter(c=>c.id.endsWith(':heron')||c.id.endsWith(':median')).map(card=>({card,remembered:false}));
  for(const item of items){
    const html=require('react-dom/server').renderToStaticMarkup(React.createElement(mod.RecallHistory,{items:[item],done:true,onReturn(){}}));
    assert.match(html,/Ký hiệu và điều kiện/);assert.match(html,/không suy biến/);assert.match(html,/Về tổng kết lượt ôn/);assert.match(html,/Xem lại không thay đổi/);assert.match(html,/Cách dùng và điều cần nhớ/);
    if(item.card.id.endsWith(':median'))assert.match(html,/độ dài trung tuyến/);
  }
});
finish({note:'Kiểm hook/SSR; chưa có ảnh hoặc thao tác trên trình duyệt thật.'});
