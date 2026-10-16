export type EstimationChoice={id:string;lower:number;upper:number;text:string};
export type EstimationQuestion={id:string;a:number;b:number;product:number;roundedA:number;roundedB:number;choices:EstimationChoice[];correctId:string;steps:string[]};

export const estimationNumber=(n:number)=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const band=(lower:number,upper:number)=>`${estimationNumber(lower)} ≤ kết quả < ${estimationNumber(upper)}`;

/** Sáu bộ tự biên soạn; chỉ dùng phép nhân và làm tròn số đã học ở THCS. */
export function createEstimationRound(round=0):EstimationQuestion[]{
  const seed=Number.isSafeInteger(round)&&round>=0?round%6:0;
  const settings=[[49+2*seed,21+seed,10,500],[198+2*seed,31+seed,10,1000],[403+4*seed,49+seed,100,5000],[96+seed,105+seed,10,2000],[299+2*seed,201+seed,100,10000]];
  return settings.map(([a,b,unit,width],index)=>{
    const product=a*b,roundedA=Math.round(a/unit)*unit;
    // Thừa số b nhỏ hơn 100 dùng làm tròn chục để không trở thành 0.
    const roundedB=Math.round(b/Math.min(unit,10**Math.floor(Math.log10(b))))*Math.min(unit,10**Math.floor(Math.log10(b)));
    const slot=(index+seed)%3,lower=Math.floor(product/width)*width;
    const choices=Array.from({length:3},(_,i)=>{const from=lower+(i-slot)*width;return {id:'band-'+i,lower:from,upper:from+width,text:band(from,from+width)};});
    const tens=Math.round(b/10)*10,delta=b-tens,sign=delta<0?'−':'+';
    return {id:`estimate-${seed}-${index}`,a,b,product,roundedA,roundedB,choices,correctId:'band-'+slot,steps:[
      `Làm tròn: ${a} ≈ ${roundedA}; ${b} ≈ ${roundedB}. Ước lượng tích ≈ ${estimationNumber(roundedA*roundedB)}.`,
      `Kiểm tra bằng phân phối: ${a} × ${b} = ${a} × (${tens} ${sign} ${Math.abs(delta)}) = ${estimationNumber(a*tens)} ${sign} ${estimationNumber(a*Math.abs(delta))} = ${estimationNumber(product)}.`,
      `Vì ${estimationNumber(lower)} ≤ ${estimationNumber(product)} < ${estimationNumber(lower+width)}, chọn khoảng ${band(lower,lower+width)}.`,
      'Ước lượng giúp nhận ra cỡ của kết quả. Khi gần biên khoảng, cần tính chính xác để kết luận.',
    ]};
  });
}
