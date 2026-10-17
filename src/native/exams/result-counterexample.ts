export type CounterexampleCard={id:string;topic:string;domain:string;statement:string;variable:'x'|'n';min:number;max:number;hint:string;example:number;explanation:string[]};
export const COUNTEREXAMPLE_VERSION='v1';
/** Bài riêng do MTM biên soạn, nền tảng mệnh đề và tập hợp lớp 10. */
export const counterexampleCards:readonly CounterexampleCard[]=[
  {id:'square-positive',topic:'Phân biệt điều kiện và kết luận',domain:'x là số thực.',statement:'Với mọi số thực x, nếu x² > 0 thì x > 0.',variable:'x',min:-8,max:8,hint:'Bình phương của một số âm khác 0 có dấu gì?',example:-1,explanation:['Một số âm khác 0 có bình phương dương nhưng bản thân nó không dương.','Chỉ một giá trị làm điều kiện đúng và kết luận sai đã đủ bác bỏ mệnh đề với mọi x. Không cần thử hết số thực.']},
  {id:'strict-boundary',topic:'Chú ý dấu bất đẳng thức',domain:'x là số thực.',statement:'Với mọi số thực x, nếu x > 1 thì x² > x + 2.',variable:'x',min:-8,max:8,hint:'Thử số nguyên nhỏ nhất lớn hơn 1. Dấu > có nhận dấu bằng không?',example:2,explanation:['Tại x = 2, điều kiện 2 > 1 đúng. Kết luận đòi hỏi 4 > 4 nên sai.','Ta có x² − x − 2 = (x − 2)(x + 1). Khi x > 1, muốn kết luận đúng còn cần x > 2.']},
  {id:'divisibility',topic:'Kéo theo và chiều đảo',domain:'n là số nguyên dương.',statement:'Với mọi số nguyên dương n, nếu n chia hết cho 4 thì n chia hết cho 8.',variable:'n',min:1,max:24,hint:'Một bội của 4 có nhất thiết là bội của 8 không?',example:4,explanation:['Ta có 4 = 4 · 1 nên 4 chia hết cho 4; 4 không chia hết cho 8. Vì vậy chiều kéo theo đã cho sai.','Chiều đúng là: nếu n chia hết cho 8 thì n chia hết cho 4, vì n = 8k = 4 · (2k) với k nguyên.']},
  {id:'interval-endpoint',topic:'Đầu mút của khoảng và đoạn',domain:'x là số thực.',statement:'Với mọi số thực x, nếu −2 ≤ x < 3 thì −2 < x < 3.',variable:'x',min:-4,max:4,hint:'Điều kiện và kết luận khác nhau ở đầu mút nào?',example:-2,explanation:['Tại x = −2, điều kiện −2 ≤ x < 3 đúng nhưng kết luận −2 < x < 3 sai.','Miền [−2; 3) có chứa −2, còn khoảng (−2; 3) không chứa −2. Không thể bỏ đầu mút trái mà giữ nguyên tập hợp.']},
];
export type CounterexampleCheck={ok:true;value:number;premise:boolean;conclusion:boolean;counterexample:boolean;detail:string}|{ok:false;message:string};
/** Chỉ nhận số nguyên trong miền nhỏ đã nêu, không thực thi biểu thức nhập vào. */
export function checkCounterexample(card:CounterexampleCard,input:string):CounterexampleCheck{
  const raw=input.trim().replace('−','-');
  if(!/^[+-]?\d{1,3}$/.test(raw))return{ok:false,message:'Em nhập một số nguyên, ví dụ −2 hoặc 3. Không nhập biểu thức hoặc số thập phân.'};
  const value=Number(raw);
  if(!Number.isSafeInteger(value)||value<card.min||value>card.max)return{ok:false,message:`Trong lượt này, em chọn số nguyên từ ${card.min} đến ${card.max}.`};
  let premise:boolean,conclusion:boolean,detail:string;
  switch(card.id){
    case 'square-positive':premise=value*value>0;conclusion=value>0;detail=`(${value})² = ${value*value}; ${value*value} > 0 là ${premise?'đúng':'sai'}, còn ${value} > 0 là ${conclusion?'đúng':'sai'}.`;break;
    case 'strict-boundary':premise=value>1;conclusion=value*value>value+2;detail=`${value} > 1 là ${premise?'đúng':'sai'}; (${value})² = ${value*value}, ${value} + 2 = ${value+2}, nên ${value*value} > ${value+2} là ${conclusion?'đúng':'sai'}.`;break;
    case 'divisibility':premise=value%4===0;conclusion=value%8===0;detail=`${value} chia cho 4 dư ${value%4}, chia cho 8 dư ${value%8}. Điều kiện ${premise?'đúng':'sai'}, kết luận ${conclusion?'đúng':'sai'}.`;break;
    case 'interval-endpoint':premise=value>=-2&&value<3;conclusion=value>-2&&value<3;detail=`Với x = ${value}, −2 ≤ x < 3 là ${premise?'đúng':'sai'}; −2 < x < 3 là ${conclusion?'đúng':'sai'}.`;break;
    default:return{ok:false,message:'Chưa có cách đối chiếu cho thẻ này. Em kết thúc lượt rồi thử lại.'};
  }
  return{ok:true,value,premise,conclusion,counterexample:premise&&!conclusion,detail};
}
