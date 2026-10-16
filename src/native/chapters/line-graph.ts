export type Line={a:number;b:number};
export type GraphQuestion={id:string;line:Line;choices:Line[]};
const slopes=[-2,-1,1,2];
export const lineKey=({a,b}:Line)=>a+':'+b;
export function lineFormula({a,b}:Line):string{
  const term=a===1?'x':a===-1?'−x':String(a).replace('-','−')+'x';
  return 'y = '+term+(b===0?'':b>0?' + '+b:' − '+Math.abs(b));
}
/** Câu tự luyện riêng, không ghi vào ngân hàng đề hoặc lịch sử chấm điểm. */
export function graphQuestion(a:number,b:number,position=0):GraphQuestion{
  if(!slopes.includes(a)||!Number.isInteger(b)||b< -2||b>2)throw Error('Hệ số ngoài miền trò đồ thị');
  const line={a,b},choices=[line,{a:-a,b},{a,b:b===2?1:b+1}];
  const offset=Number.isSafeInteger(position)?((position%3)+3)%3:0;
  return {id:lineKey(line),line,choices:[...choices.slice(offset),...choices.slice(0,offset)]};
}
export function graphRound(round=0):GraphQuestion[]{
  let seed=(Number.isSafeInteger(round)&&round>=0?round:0)>>>0;
  const pick=(size:number)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/2**32*size);};
  const pool=slopes.flatMap(a=>[-2,-1,0,1,2].map(b=>({a,b})));
  for(let i=pool.length-1;i>0;i--){const j=pick(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
  return pool.slice(0,5).map(({a,b})=>graphQuestion(a,b,pick(3)));
}
/** Đoạn của đường thẳng trong ô vuông [-5;5]², cùng thang đo hai trục. */
export function lineSegment({a,b}:Line):[LinePoint,LinePoint]{
  const bounds=[(-5-b)/a,(5-b)/a].sort((x,y)=>x-y);
  const left=Math.max(-5,bounds[0]),right=Math.min(5,bounds[1]);
  return [{x:left,y:a*left+b},{x:right,y:a*right+b}];
}
export type LinePoint={x:number;y:number};
export function graphExplanation({a,b}:Line):string[]{
  return ['Đồ thị cắt trục Oy tại P(0; '+b+'), nên hệ số tự do là '+b+'.',
    'Điểm Q(1; '+(a+b)+') nằm trên đồ thị. Khi x tăng từ 0 lên 1, y thay đổi '+a+' đơn vị, nên hệ số của x là '+a+'.',
    'Vậy hàm số là '+lineFormula({a,b})+'. Hai điểm P và Q có hoành độ khác nhau nên xác định duy nhất đường thẳng này.'];
}
