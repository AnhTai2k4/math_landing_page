export const HOMEWORK_WARMUP_TOPICS=[
  {id:'conditions',title:'Điều kiện xác định'},
  {id:'signs',title:'Dấu và phép biến đổi'},
  {id:'solutions',title:'Thử nghiệm vào bài gốc'},
] as const;
export type WarmupTopic=typeof HOMEWORK_WARMUP_TOPICS[number]['id'];
export type WarmupCard={id:string;topic:WarmupTopic;prompt:string;answer:number;steps:readonly string[];takeaway:string};
export const HOMEWORK_WARMUP_CARDS:readonly WarmupCard[]=[
  {id:'denominator',topic:'conditions',prompt:'Biểu thức (2x + 1)/(x − 3) xác định khi x khác giá trị nào?',answer:3,steps:['Mẫu số phải khác 0: x − 3 ≠ 0.','Suy ra x ≠ 3. Giá trị phải loại là 3.'],takeaway:'Ghi điều kiện trước khi rút gọn hoặc giải phương trình có mẫu.'},
  {id:'square-root',topic:'conditions',prompt:'Căn thức √(x + 4) xác định khi x ≥ m. Nhập m.',answer:-4,steps:['Biểu thức dưới căn bậc hai phải không âm: x + 4 ≥ 0.','Chuyển vế được x ≥ −4, nên m = −4.'],takeaway:'Căn bậc hai cho phép biểu thức dưới căn bằng 0.'},
  {id:'two-exclusions',topic:'conditions',prompt:'Với 1/(x² − 9), có hai giá trị của x phải loại. Nhập giá trị dương phải loại.',answer:3,steps:['Mẫu khác 0: x² − 9 ≠ 0.','Phân tích x² − 9 = (x − 3)(x + 3), nên x ≠ 3 và x ≠ −3.','Giá trị dương phải loại là 3.'],takeaway:'Kiểm đủ cả hai giá trị bị loại, dù thẻ này chỉ yêu cầu giá trị dương.'},
  {id:'brackets',topic:'signs',prompt:'Thu gọn 3 − 2(x − 4) = ax + b. Nhập b.',answer:11,steps:['Nhân −2 vào từng hạng tử: 3 − 2x + 8.','Gộp hằng số: −2x + 11. Vậy a = −2 và b = 11.'],takeaway:'Dấu trừ trước ngoặc tác động tới mọi hạng tử trong ngoặc.'},
  {id:'inequality',topic:'signs',prompt:'Giải bất phương trình −3x < 12 được x > m. Nhập m.',answer:-4,steps:['Chia cả hai vế cho −3, một số âm, nên đổi chiều bất đẳng thức.','x > 12/(−3) = −4. Vậy m = −4.'],takeaway:'Nhân hoặc chia hai vế bất đẳng thức với số âm phải đổi chiều.'},
  {id:'identity',topic:'signs',prompt:'Khai triển (x − 5)² = x² + ax + 25. Nhập a.',answer:-10,steps:['Dùng (u − v)² = u² − 2uv + v² với u = x, v = 5.','(x − 5)² = x² − 10x + 25. Vậy a = −10.'],takeaway:'Bình phương một hiệu có hạng tử ở giữa là −2uv.'},
  {id:'product',topic:'solutions',prompt:'Phương trình (x − 2)(x + 3) = 0 có một nghiệm dương. Nhập nghiệm đó.',answer:2,steps:['Tích bằng 0 khi x − 2 = 0 hoặc x + 3 = 0.','Hai nghiệm là x = 2 và x = −3.','Nghiệm dương là 2; thay vào được (2 − 2)(2 + 3) = 0.'],takeaway:'Phương trình tích cần xét từng thừa số, rồi chọn đúng yêu cầu của đề.'},
  {id:'rational',topic:'solutions',prompt:'Giải x/(x − 1) = 2, với x ≠ 1. Nhập nghiệm.',answer:2,steps:['Vì x ≠ 1, nhân hai vế với x − 1 được x = 2(x − 1).','x = 2x − 2 nên x = 2. Giá trị 2 thỏa điều kiện x ≠ 1.','Thay vào bài gốc: 2/(2 − 1) = 2, đúng.'],takeaway:'Sau biến đổi, thử lại nghiệm vào điều kiện và phương trình ban đầu.'},
  {id:'extraneous',topic:'solutions',prompt:'Giải √(x + 4) = x − 2. Nhập nghiệm duy nhất.',answer:5,steps:['Vế trái không âm nên x − 2 ≥ 0. Kết hợp điều kiện căn, cần x ≥ 2.','Bình phương hai vế: x + 4 = (x − 2)² = x² − 4x + 4.','x² − 5x = 0 nên x = 0 hoặc x = 5. Loại x = 0 vì không thỏa x ≥ 2.','Với x = 5: √(5 + 4) = 3 = 5 − 2. Vậy nghiệm là x = 5.'],takeaway:'Bình phương có thể sinh nghiệm ngoại lai, luôn đối chiếu bài gốc.'},
];
export function warmupCards(topic:WarmupTopic){return HOMEWORK_WARMUP_CARDS.filter(card=>card.topic===topic);}
export function checkWarmupAnswer(card:WarmupCard,text:string):'invalid'|'correct'|'retry'{
  const value=text.trim().replace(',','.').replace('−','-');
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)||value.length>30)return 'invalid';
  const number=Number(value);
  return !Number.isFinite(number)?'invalid':number===card.answer?'correct':'retry';
}
