import assert from 'node:assert/strict';
import {recallBatch,recallDecks,type RecallDeck} from '../src/native/chapters/quick-recall';
import {all,load,mount,React,require,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';

const {test,finish}=suite('D1706-RECALL-V3-');
const file='src/native/chapters/QuickRecall.tsx',extra='export {RecallSession};';
const source=recallDecks('10').find(deck=>deck.id==='g10-c3')!;
const session=(deck:RecallDeck=source)=>mount(file,{deck},'RecallSession',extra);
const sizePicker=(m:any)=>all(m.tree,n=>n.type==='select')[0];
const choose=(m:any,size:number)=>{sizePicker(m).props.onChange({target:{value:String(size)}});m.draw();};
const button=(m:any,label:string)=>{const node=all(m.tree,n=>n.type==='button'&&text(n)===label)[0];assert.ok(node,'Thiếu nút '+label);return node;};
const card=(m:any)=>all(m.tree,n=>n.props?.card)[0].props.card;
const history=(m:any)=>all(m.tree,n=>n.props?.items&&n.props?.onReturn)[0]?.props.items??[];
const finishCards=(m:any,count:number,miss:number[]=[]):string[]=>{
  const seen:string[]=[];
  for(let i=0;i<count;i++){seen.push(card(m).id);m.click('Lật thẻ xem công thức');m.click(miss.includes(i)?'Cần ôn lại':'Em đã nhớ');}
  return seen;
};

test('Lô 3 hoặc 5 thẻ duyệt nguyên thứ tự nguồn, không bỏ, lặp hoặc lẫn chương',()=>{
  for(const track of ['10','11','12'])for(const deck of recallDecks(track)){
    const before=JSON.stringify(deck);
    assert.deepEqual(recallBatch(deck,0),deck.cards.slice(0,5));
    for(const size of [3,5] as const){
      const seen=[];
      for(let offset=0;offset<deck.cards.length;offset+=size){
        const batch=recallBatch(deck,offset,size);assert.ok(batch.length>0&&batch.length<=size);
        seen.push(...batch.map(item=>item.id));
      }
      assert.deepEqual(seen,deck.cards.map(item=>item.id));assert.equal(new Set(seen).size,seen.length);
      assert.deepEqual(recallBatch(deck,deck.cards.length,size),[]);
    }
    assert.equal(JSON.stringify(deck),before);
  }
});

test('Mặc định 5 thẻ, chọn 3 trước khi lật, hướng dẫn và nhãn trợ năng rõ ràng',()=>{
  const m=session();assert.match(text(m.tree),/Thẻ 1\/5/);
  const picker=sizePicker(m),label=all(m.tree,n=>n.type==='label'&&n.props.htmlFor===picker.props.id)[0];
  assert.equal(text(label),'Số thẻ mỗi lượt');assert.equal(picker.props.value,5);assert.equal(picker.props.disabled,false);
  assert.deepEqual(all(picker,n=>n.type==='option').map(n=>n.props.value),[3,5]);
  assert.ok(all(m.tree,n=>n.props.id===picker.props['aria-describedby']).length===1);
  choose(m,3);assert.equal(sizePicker(m).props.value,3);assert.match(text(m.tree),/Thẻ 1\/3/);
  assert.equal(card(m).id,source.cards[0].id);assert.equal(history(m).length,0);assert.equal(m.focused,null);
  const before=text(m.tree);for(const invalid of [0,4,-3,NaN])choose(m,invalid);
  assert.equal(text(m.tree),before);m.unmount();
});

test('Khóa số thẻ ngay khi lật, ẩn lại vẫn giữ tiến độ và chặn callback chọn cũ',()=>{
  const m=session();choose(m,3);const oldChoose=sizePicker(m).props.onChange;
  m.click('Lật thẻ xem công thức');assert.equal(sizePicker(m).props.disabled,true);
  assert.match(text(m.tree),/số thẻ được giữ để không mất tiến độ/);
  oldChoose({target:{value:'5'}});sizePicker(m).props.onChange({target:{value:'5'}});m.draw();
  assert.equal(sizePicker(m).props.value,3);assert.equal(button(m,'Ẩn công thức').props['aria-expanded'],true);
  m.click('Ẩn công thức');assert.equal(sizePicker(m).props.disabled,true);
  m.click('Lật thẻ xem công thức');m.click('Em đã nhớ');assert.match(text(m.tree),/Thẻ 2\/3/);
  assert.equal(history(m).length,1);assert.equal(card(m).id,source.cards[1].id);m.unmount();
});

test('Bấm đúp chọn cỡ hoặc lật chỉ nhận lần chuyển đầu, callback cũ không lật thẻ kế',()=>{
  const m=session(),oldChoose=sizePicker(m).props.onChange;
  oldChoose({target:{value:'3'}});oldChoose({target:{value:'5'}});m.draw();assert.equal(sizePicker(m).props.value,3);
  const flip=button(m,'Lật thẻ xem công thức').props.onClick;flip();flip();m.draw();
  assert.equal(button(m,'Ẩn công thức').props['aria-expanded'],true);
  const wrong=button(m,'Cần ôn lại').props.onClick,right=button(m,'Em đã nhớ').props.onClick;
  wrong();wrong();right();m.draw();assert.match(text(m.tree),/Thẻ 2\/3/);
  assert.equal(history(m).length,1);assert.equal(history(m)[0].remembered,false);
  flip();oldChoose({target:{value:'5'}});wrong();right();m.draw();
  assert.equal(card(m).id,source.cards[1].id);assert.equal(button(m,'Lật thẻ xem công thức').props['aria-expanded'],false);
  assert.equal(history(m).length,1);assert.equal(sizePicker(m).props.value,3);m.unmount();
});

test('Lượt 3 thẻ ôn đúng thẻ khó, giữ độ dài lô nguồn rồi đổi sang 5 ở lô mới',()=>{
  const m=session();choose(m,3);assert.deepEqual(finishCards(m,3,[1]),source.cards.slice(0,3).map(c=>c.id));
  assert.equal(sizePicker(m).props.disabled,true);
  m.click('Ôn lại 1 thẻ cần nhớ');assert.equal(sizePicker(m).props.disabled,true);
  assert.match(text(m.tree),/Ôn lại · Thẻ 1\/1/);assert.equal(card(m).id,source.cards[1].id);
  finishCards(m,1);m.click('3 thẻ tiếp theo');
  assert.equal(card(m).id,source.cards[3].id);assert.equal(sizePicker(m).props.disabled,false);assert.equal(history(m).length,0);
  choose(m,5);assert.match(text(m.tree),/Thẻ 1\/5/);assert.equal(card(m).id,source.cards[3].id);
  assert.deepEqual(finishCards(m,5),source.cards.slice(3,8).map(c=>c.id));
  m.click('5 thẻ tiếp theo');assert.equal(card(m).id,source.cards[8].id);m.unmount();
});

test('Đổi 3 rồi 5 ở các lô mới vẫn duyệt hết một bộ, lô cuối ít thẻ không bỏ sót',()=>{
  const m=session(),seen:string[]=[];choose(m,3);seen.push(...finishCards(m,3));
  m.click('3 thẻ tiếp theo');choose(m,5);seen.push(...finishCards(m,5));
  m.click('5 thẻ tiếp theo');choose(m,3);seen.push(...finishCards(m,3));
  m.click('3 thẻ tiếp theo');choose(m,5);assert.match(text(m.tree),/Thẻ 1\/3/);seen.push(...finishCards(m,3));
  assert.deepEqual(seen,source.cards.map(c=>c.id));assert.equal(new Set(seen).size,source.cards.length);
  m.click('Ôn lại từ đầu');assert.equal(sizePicker(m).props.value,5);assert.equal(sizePicker(m).props.disabled,false);
  assert.equal(card(m).id,source.cards[0].id);assert.match(text(m.tree),/Thẻ 1\/5/);m.unmount();
});

test('Lô cuối thiếu 1 hoặc 2 thẻ sau ôn sai vẫn kết thúc đúng và không kéo thẻ ngoài lô',()=>{
  for(const remaining of [1,2]){
    const deck={...source,cards:source.cards.slice(0,6+remaining)},m=session(deck);choose(m,3);
    finishCards(m,3);m.click('3 thẻ tiếp theo');finishCards(m,3,[0]);
    m.click('Ôn lại 1 thẻ cần nhớ');finishCards(m,1);m.click(remaining+' thẻ tiếp theo');
    assert.match(text(m.tree),new RegExp('Thẻ 1/'+remaining));assert.equal(card(m).id,deck.cards[6].id);
    choose(m,5);assert.match(text(m.tree),new RegExp('Thẻ 1/'+remaining));
    assert.deepEqual(finishCards(m,remaining,[0]),deck.cards.slice(6).map(c=>c.id));
    m.click('Ôn lại 1 thẻ cần nhớ');assert.equal(card(m).id,deck.cards[6].id);finishCards(m,1);
    m.click('Ôn lại từ đầu');assert.equal(card(m).id,deck.cards[0].id);assert.match(text(m.tree),/Thẻ 1\/5/);m.unmount();
  }
});

test('Callback next và ôn sai cũ không ghi đè lượt mới hoặc nhảy qua lô',()=>{
  const m=session();choose(m,3);finishCards(m,3,[1]);
  const oldReview=button(m,'Ôn lại 1 thẻ cần nhớ').props.onClick,oldNext=button(m,'3 thẻ tiếp theo').props.onClick;
  oldReview();oldReview();oldNext();m.draw();assert.equal(card(m).id,source.cards[1].id);assert.match(text(m.tree),/Thẻ 1\/1/);
  finishCards(m,1);const next=button(m,'3 thẻ tiếp theo').props.onClick;next();next();m.draw();
  assert.equal(card(m).id,source.cards[3].id);m.click('Lật thẻ xem công thức');
  oldReview();oldNext();next();m.draw();assert.equal(card(m).id,source.cards[3].id);
  assert.equal(button(m,'Ẩn công thức').props['aria-expanded'],true);m.unmount();
});

test('Callback ôn lại từ đầu cũ không xóa tiến độ sau khi đã bắt đầu lại',()=>{
  const deck={...source,cards:source.cards.slice(0,3)},m=session(deck);choose(m,3);finishCards(m,3);
  const restart=button(m,'Ôn lại từ đầu').props.onClick;restart();restart();m.draw();
  m.click('Lật thẻ xem công thức');m.click('Em đã nhớ');restart();m.draw();
  assert.match(text(m.tree),/Thẻ 2\/3/);assert.equal(history(m).length,1);assert.equal(card(m).id,deck.cards[1].id);m.unmount();
});

test('Lượt 3 thẻ giữ focus ở công thức khi lật, tiêu đề khi chuyển và tổng kết',()=>{
  const m=session();choose(m,3);m.click('Lật thẻ xem công thức');
  const reveal=button(m,'Ẩn công thức'),answer=all(m.tree,n=>n.props.id===reveal.props['aria-controls'])[0];
  assert.equal(m.focused.id,answer.props.id);assert.equal(answer.props.role,'region');assert.equal(answer.props.tabIndex,-1);
  m.click('Em đã nhớ');assert.equal(m.focused.type,'h3');assert.equal(m.focused.text,source.cards[1].topic);
  finishCards(m,2);assert.equal(m.focused.text,'Đã xem hết 3 thẻ');
  m.click('3 thẻ tiếp theo');assert.equal(m.focused.text,source.cards[3].topic);assert.equal(sizePicker(m).props.disabled,false);m.unmount();
});

test('Chuyển chương dù cùng bộ được chọn vẫn tạo phiên riêng và SSR mặc định giữ 5 thẻ',()=>{
  const m=mount(file,{track:'10',chapter:'3'}),findSession=()=>all(m.tree,n=>n.props?.deck)[0];
  const key=findSession().key;
  m.draw({track:'10',chapter:'2'});assert.equal(findSession(),undefined);
  all(m.tree,n=>n.type==='select')[0].props.onChange({target:{value:'g10-c3'}});m.draw({track:'10',chapter:'2'});
  assert.equal(findSession().props.deck.id,'g10-c3');assert.notEqual(findSession().key,key);
  const Component=load(file).default;
  const html=require('react-dom/server').renderToStaticMarkup(React.createElement(Component,{track:'10',chapter:'3'}));
  assert.match(html,/5 thẻ, lượt đầy đủ/);assert.match(html,/value="5" selected=""/);assert.match(html,/Thẻ 1\/5/);
  assert.match(html,/Chọn 3 hoặc 5 thẻ trước khi lật thẻ đầu tiên/);m.unmount();
});

finish({note:'Kiểm lõi chia lô, hook và SSR local; chưa thay thế thao tác trình duyệt thật.'});
