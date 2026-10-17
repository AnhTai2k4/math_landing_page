export type Interval={from:number;to:number;leftClosed:boolean;rightClosed:boolean};
export type IntervalOperation='intersection'|'union';
export type IntervalQuestion={id:string;a:Interval;b:Interval;operation:IntervalOperation;result:Interval[];choices:{id:string;value:Interval[];text:string}[];correctId:string;steps:string[]};

const valid=(i:Interval)=>Number.isSafeInteger(i.from)&&Number.isSafeInteger(i.to)&&i.from<=i.to&&typeof i.leftClosed==='boolean'&&typeof i.rightClosed==='boolean';
const nonempty=(i:Interval)=>i.from<i.to||i.leftClosed&&i.rightClosed;
export const intervalContains=(i:Interval,x:number)=>Number.isFinite(x)&&(x>i.from||x===i.from&&i.leftClosed)&&(x<i.to||x===i.to&&i.rightClosed);
export const intervalText=(i:Interval)=>!nonempty(i)?'∅':i.from===i.to?'{'+i.from+'}':(i.leftClosed?'[':'(')+i.from+'; '+i.to+(i.rightClosed?']':')');
export const intervalSetText=(parts:Interval[])=>parts.length?parts.map(intervalText).join(' ∪ '):'∅';
export const intervalDescription=(parts:Interval[])=>parts.length?parts.map(i=>i.from===i.to?'chỉ gồm số '+i.from:'từ '+i.from+' đến '+i.to+', '+(i.leftClosed?'lấy':'không lấy')+' đầu '+i.from+', '+(i.rightClosed?'lấy':'không lấy')+' đầu '+i.to).join('; hoặc '):'tập rỗng, không có phần tử';

/** Khoảng hữu hạn, có thể cho kết quả rỗng, một điểm hoặc hai khoảng rời nhau. */
export function combineIntervals(a:Interval,b:Interval,operation:IntervalOperation):Interval[]{
  if(!valid(a)||!valid(b)||(operation!=='intersection'&&operation!=='union'))throw Error('Khoảng hoặc phép toán không hợp lệ');
  if(operation==='intersection'){
    const from=Math.max(a.from,b.from),to=Math.min(a.to,b.to);
    if(from>to)return [];
    const value={from,to,leftClosed:intervalContains(a,from)&&intervalContains(b,from),rightClosed:intervalContains(a,to)&&intervalContains(b,to)};
    return nonempty(value)?[value]:[];
  }
  const parts=[a,b].filter(nonempty).map(i=>({...i})).sort((x,y)=>x.from-y.from||Number(y.leftClosed)-Number(x.leftClosed));
  if(parts.length<2)return parts;
  const [left,right]=parts;
  if(left.to<right.from||left.to===right.from&&!left.rightClosed&&!right.leftClosed)return parts;
  return [{from:left.from,to:Math.max(left.to,right.to),leftClosed:left.leftClosed,rightClosed:left.to>right.to?left.rightClosed:left.to<right.to?right.rightClosed:left.rightClosed||right.rightClosed}];
}

const interval=(from:number,to:number,leftClosed:boolean,rightClosed:boolean):Interval=>({from,to,leftClosed,rightClosed});
/** Năm câu tự biên soạn mỗi lượt, sáu phép tịnh tiến luân phiên, không dùng đề gốc. */
export function createIntervalRound(round=0):IntervalQuestion[]{
  const seed=Number.isSafeInteger(round)&&round>=0?round%6:0,shift=seed-2;
  const make=(from:number,to:number,left:boolean,right:boolean)=>interval(from+shift,to+shift,left,right);
  const settings:[Interval,Interval,IntervalOperation][]=[
    [make(-4,2,true,false),make(-1,4,false,true),'intersection'],
    [make(-4,0,false,true),make(0,3,false,false),'union'],
    [make(-4,0,false,false),make(0,3,true,true),'intersection'],
    [make(-3,1,false,true),make(1,4,true,false),'intersection'],
    [make(-4,0,true,false),make(0,3,false,true),'union'],
  ];
  return settings.map(([a,b,operation],index)=>{
    const result=combineIntervals(a,b,operation),text=intervalSetText(result),alternatives:Interval[][]=[];
    const candidates=[combineIntervals(a,b,operation==='intersection'?'union':'intersection'),[],[interval(a.to,a.to,true,true)],
      result.map(i=>({...i,leftClosed:!i.leftClosed,rightClosed:!i.rightClosed})).filter(nonempty),[interval(Math.min(a.from,b.from),Math.max(a.to,b.to),true,true)],
      [interval(a.from-1,b.to+1,false,false)]];
    for(const candidate of candidates)if(intervalSetText(candidate)!==text&&!alternatives.some(i=>intervalSetText(i)===intervalSetText(candidate)))alternatives.push(candidate);
    const correct=(seed+index)%3,choices=Array.from({length:3},(_,i)=>{const value=i===correct?result:alternatives.shift()!;return {id:'choice-'+i,value,text:intervalSetText(value)};});
    const bounds=[...new Set([a.from,a.to,b.from,b.to])].sort((x,y)=>x-y);
    return {id:'interval-'+seed+'-'+index,a,b,operation,result,choices,correctId:'choice-'+correct,steps:[
      operation==='intersection'?'Giao A ∩ B gồm các số đồng thời thuộc cả A và B.':'Hợp A ∪ B gồm các số thuộc ít nhất một trong hai tập A, B.',
      'A: '+intervalDescription([a])+'. B: '+intervalDescription([b])+'.',
      ...bounds.map(x=>'Tại '+x+': '+(intervalContains(a,x)?'thuộc A':'không thuộc A')+', '+(intervalContains(b,x)?'thuộc B':'không thuộc B')+' nên '+(result.some(i=>intervalContains(i,x))?'lấy':'không lấy')+' điểm này.'),
      result.length===0?'Hai tập không có điểm chung, kể cả ở các đầu mút. Kết quả là ∅.':result.length===1&&result[0].from===result[0].to?'Hai tập chỉ chung điểm '+result[0].from+'. Viết {'+result[0].from+'}, không viết khoảng mở có hai đầu bằng nhau.':'Giữ phần trục số thỏa điều kiện '+(operation==='intersection'?'đồng thời thuộc cả hai tập.':'thuộc ít nhất một tập; nếu điểm tiếp xúc không thuộc tập nào thì giữ hai khoảng rời nhau.'),
      (operation==='intersection'?'A ∩ B':'A ∪ B')+' = '+text+'. Đọc bằng lời: '+intervalDescription(result)+'.',
    ]};
  });
}
