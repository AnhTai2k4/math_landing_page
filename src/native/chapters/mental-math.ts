export type MentalQuestion={id:string;kind:'nine'|'ninety-nine'|'square'|'product'|'difference';prompt:string;spoken:string;answer:number;hint:string;steps:string[]};
export type MentalMode='mixed'|MentalQuestion['kind'];
export const mentalModes:readonly {id:MentalMode;label:string}[]=[{id:'mixed',label:'Tổng hợp 5 kỹ thuật'},{id:'nine',label:'Nhân với 9'},{id:'ninety-nine',label:'Nhân với 99'},{id:'square',label:'Bình phương số tận cùng là 5'},{id:'product',label:'Tích của tổng và hiệu'},{id:'difference',label:'Hiệu hai bình phương'}];

/** Miền hữu hạn, chỉ số nguyên. Đây là trò tự luyện, không phải ngân hàng đề. */
export function mentalQuestion(kind:MentalQuestion['kind'],a:number,b=0):MentalQuestion{
  const integer=(n:number,min:number,max:number)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
  if(kind==='nine'&&!integer(a,12,49)||kind==='ninety-nine'&&!integer(a,12,39)||kind==='square'&&(!integer(a,25,95)||a%10!==5)||
    (kind==='product'||kind==='difference')&&(!integer(a,20,90)||a%10!==0||!integer(b,2,9)))throw Error('Tham số câu tính nhẩm ngoài miền');
  const base={id:kind+':'+a+':'+b,kind};
  if(kind==='nine'||kind==='ninety-nine'){
    const m=kind==='nine'?9:99,round=m+1;
    return {...base,prompt:a+' × '+m,spoken:a+' nhân '+m,answer:a*m,
      hint:'Tách '+m+' thành '+round+' trừ 1, rồi dùng tính chất phân phối.',
      steps:[a+' × '+m+' = '+a+' × ('+round+' − 1)',
        '= '+a+' × '+round+' − '+a+' = '+(a*round)+' − '+a+' = '+(a*m)+'.']};
  }
  if(kind==='square'){
    const k=(a-5)/10,answer=a*a;
    return {...base,prompt:a+'²',spoken:a+' bình phương',answer,
      hint:'Viết '+a+' = '+(10*k)+' + 5, rồi khai triển bình phương của một tổng.',
      steps:[a+'² = ('+(10*k)+' + 5)² = 100 × '+k+'² + 100 × '+k+' + 25',
        '= 100 × '+k+' × ('+k+' + 1) + 25 = '+(100*k*(k+1))+' + 25 = '+answer+'.']};
  }
  if(kind==='product')return {...base,prompt:'('+a+' − '+b+') × ('+a+' + '+b+')',spoken:'mở ngoặc '+a+' trừ '+b+' đóng ngoặc, nhân mở ngoặc '+a+' cộng '+b+' đóng ngoặc',answer:a*a-b*b,
    hint:'Hai thừa số đối xứng quanh '+a+'. Dùng tích của tổng và hiệu.',
    steps:['('+a+' − '+b+') × ('+a+' + '+b+') = '+a+'² − '+b+'²',
      '= '+(a*a)+' − '+(b*b)+' = '+(a*a-b*b)+'.']};
  return {...base,prompt:(a+b)+'² − '+(a-b)+'²',spoken:(a+b)+' bình phương trừ '+(a-b)+' bình phương',answer:4*a*b,
    hint:'Dùng hiệu hai bình phương bằng tích của hiệu và tổng.',
    steps:[(a+b)+'² − '+(a-b)+'² = ('+(a+b)+' − '+(a-b)+') × ('+(a+b)+' + '+(a-b)+')',
      '= '+(2*b)+' × '+(2*a)+' = '+(4*a*b)+'.']};
}

/** Bộ mới chỉ đổi tham số, luôn kết thúc sau 5 câu, không đồng hồ hay lưu điểm. */
export function createMentalRound(round:number,mode:MentalMode='mixed'):MentalQuestion[]{
  let seed=(Number.isSafeInteger(round)&&round>=0?round:0)>>>0;
  const pick=(size:number)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/2**32*size);};
  if(mode!=='mixed'){
    if(!mentalModes.some(item=>item.id===mode))throw Error('Kỹ thuật tính nhẩm không hợp lệ');
    const pool:MentalQuestion[]=[];
    if(mode==='nine'||mode==='ninety-nine')for(let a=12;a<=(mode==='nine'?49:39);a++)pool.push(mentalQuestion(mode,a));
    else if(mode==='square')for(let a=25;a<=95;a+=10)pool.push(mentalQuestion(mode,a));
    else for(let a=20;a<=90;a+=10)for(let b=2;b<=9;b++)pool.push(mentalQuestion(mode,a,b));
    return Array.from({length:5},()=>pool.splice(pick(pool.length),1)[0]);
  }
  return [mentalQuestion('nine',12+pick(38)),mentalQuestion('ninety-nine',12+pick(28)),mentalQuestion('square',25+10*pick(8)),
    mentalQuestion('product',20+10*pick(8),2+pick(8)),mentalQuestion('difference',20+10*pick(8),2+pick(8))];
}

/** Không nhận chuỗi dở dang, biểu thức, phân cách nhóm hoặc số ngoài miền an toàn. */
export function mentalInteger(text:string):number|null{
  const value=text.trim();
  if(!/^[+-]?\d{1,15}$/.test(value))return null;
  const n=Number(value);return Number.isSafeInteger(n)?n:null;
}
