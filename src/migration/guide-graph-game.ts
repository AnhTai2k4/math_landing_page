export type GraphLine={a:number;b:number};
export const GRAPH_COEFFICIENTS=[-3,-2,-1,0,1,2,3] as const;
export const readGraphCoefficient=(value:string):number|null=>GRAPH_COEFFICIENTS.find(n=>String(n)===value)??null;
const signed=(value:number)=>String(value).replace('-','−');
export function graphFraction(numerator:number,denominator:number){
 if(!Number.isInteger(numerator)||!Number.isInteger(denominator)||denominator===0)throw new RangeError('Phân số cần tử, mẫu nguyên và mẫu khác 0.');
 if(denominator<0){numerator=-numerator;denominator=-denominator;}
 let left=Math.abs(numerator),right=denominator;
 while(right){const remainder=left%right;left=right;right=remainder;}
 const divisor=left||1,n=numerator/divisor,d=denominator/divisor;
 return d===1?signed(n):signed(n)+'/'+d;
}
export function graphEquation({a,b}:GraphLine){
 if(a===0)return'y = '+signed(b);
 const term=a===1?'x':a===-1?'−x':signed(a)+'x';
 return'y = '+term+(b>0?' + '+b:b<0?' − '+Math.abs(b):'');
}
export function graphInfo(line:GraphLine){
 const {a,b}=line;
 return{
  equation:graphEquation(line),
  values:[-1,0,1].map(x=>({x,y:a*x+b})),
  behaviour:a>0?'Khi x tăng, y tăng vì a > 0.':a<0?'Khi x tăng, y giảm vì a < 0.':'Hàm hằng: y không đổi khi x thay đổi vì a = 0. Đây không phải hàm bậc nhất.',
  ox:a===0?b===0?'Đồ thị trùng trục Ox: mọi điểm trên Ox đều thuộc đồ thị.':'Đồ thị không giao trục Ox vì y luôn bằng '+signed(b)+', khác 0.':'Giao trục Ox: ('+graphFraction(-b,a)+'; 0), vì y = 0 cho ax + b = 0.',
  oy:'Giao trục Oy: (0; '+signed(b)+'), vì x = 0 thì y = b.',
 };
}
export function compareGraphs(current:GraphLine,pinned:GraphLine){
 if(current.a===pinned.a)return current.b===pinned.b
  ?{kind:'same' as const,text:'Hai đồ thị trùng nhau vì cả a và b đều bằng nhau.'}
  :{kind:'parallel' as const,text:'Hai đồ thị song song vì cùng hệ số a nhưng khác b. Đổi b giữ nguyên độ dốc.'};
 let denominator=current.a-pinned.a,xNumerator=pinned.b-current.b,yNumerator=current.a*pinned.b-pinned.a*current.b;
 if(denominator<0){denominator=-denominator;xNumerator=-xNumerator;yNumerator=-yNumerator;}
 if(xNumerator===0)xNumerator=0;if(yNumerator===0)yNumerator=0;
 const x=xNumerator/denominator,y=yNumerator/denominator,inside=Math.abs(x)<=4&&Math.abs(y)<=4;
 return{kind:'intersect' as const,point:{x,y,xNumerator,yNumerator,denominator},inside,
  text:'Hai đồ thị cắt nhau tại ('+graphFraction(xNumerator,denominator)+'; '+graphFraction(yNumerator,denominator)+'). '+(inside?'Giao điểm nằm trong khung vẽ.':'Giao điểm nằm ngoài khung vẽ từ −4 đến 4 trên mỗi trục.')};
}
