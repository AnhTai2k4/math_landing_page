export type ErrorHuntCard={id:string;topic:string;condition:string;statement:string;valid:boolean;explanation:string[]};

/** Câu tự luyện riêng do MTM biên soạn, không thay đổi ngân hàng đề đã đăng. */
export const errorHuntCards:ErrorHuntCard[]=[
  {id:'square-false',topic:'Bình phương một tổng',condition:'Với mọi số thực x.',statement:'(x + 3)² = x² + 9',valid:false,explanation:['Khai triển đúng: (x + 3)² = x² + 6x + 9. Phải có hạng tử 2 · x · 3.','Phản ví dụ x = 1: vế trái bằng 16, vế phải bằng 10. Vì vậy khẳng định không đúng với mọi x.']},
  {id:'square-true',topic:'Bình phương một tổng',condition:'Với mọi số thực x.',statement:'(x + 3)² = x² + 6x + 9',valid:true,explanation:['(x + 3)² = (x + 3)(x + 3) = x² + 3x + 3x + 9 = x² + 6x + 9.','Đây là hằng đẳng thức (a + b)² = a² + 2ab + b², đúng với mọi số thực a, b.']},
  {id:'root-false',topic:'Căn bậc hai số học',condition:'Với mọi số thực x.',statement:'√(x²) = x',valid:false,explanation:['Công thức đúng với mọi số thực x là √(x²) = |x|. Căn bậc hai số học luôn không âm.','Phản ví dụ x = −3: √((−3)²) = √9 = 3, khác −3. Chỉ khi x ≥ 0 mới có |x| = x.']},
  {id:'root-true',topic:'Căn bậc hai số học',condition:'Với mọi số thực x ≤ 0.',statement:'√(x²) = −x',valid:true,explanation:['Ta có √(x²) = |x|. Khi x ≤ 0, |x| = −x nên khẳng định đúng.','Điều kiện x ≤ 0 là cần thiết cho cách viết này; chẳng hạn x = −3 thì cả hai vế đều bằng 3.']},
  {id:'cancel-false',topic:'Chia hai vế cho biểu thức',condition:'Xét nghiệm x trong tập số thực.',statement:'x(x − 2) = 0 ⇔ x − 2 = 0',valid:false,explanation:['Phương trình x(x − 2) = 0 có nghiệm x = 0 hoặc x = 2. Phương trình x − 2 = 0 chỉ có nghiệm x = 2.','Phản ví dụ x = 0: phương trình trước đúng, phương trình sau sai. Chia cho x khi chưa biết x khác 0 có thể làm mất nghiệm.']},
  {id:'cancel-true',topic:'Chia hai vế cho biểu thức',condition:'Chỉ xét các số thực x ≠ 0.',statement:'x(x − 2) = 0 ⇔ x − 2 = 0',valid:true,explanation:['Do đã có điều kiện x ≠ 0, ta được chia hai vế cho x. Chiều ngược lại được nhân hai vế với x.','Trong miền x ≠ 0, cả hai phương trình đều có đúng nghiệm x = 2. Không được bỏ điều kiện khi áp dụng bước chia này.']},
  {id:'inequality-false',topic:'Bất phương trình và số âm',condition:'Xét nghiệm x trong tập số thực.',statement:'−2x < 6 ⇔ x < −3',valid:false,explanation:['Chia hai vế cho −2 phải đổi chiều bất đẳng thức: −2x < 6 ⇔ x > −3.','Phản ví dụ x = 0: −2 · 0 < 6 là đúng, còn 0 < −3 là sai. Hai bất phương trình đã cho không cùng tập nghiệm.']},
  {id:'inequality-true',topic:'Bất phương trình và số âm',condition:'Xét nghiệm x trong tập số thực.',statement:'−2x < 6 ⇔ x > −3',valid:true,explanation:['Chia hai vế cho số âm −2 làm đổi chiều dấu < thành >, đồng thời 6/(−2) = −3.','Vì vậy tập nghiệm của cả hai bất phương trình là các số thực x > −3. Tại x = −3, cả hai đều sai do dấu bất đẳng thức là nghiêm ngặt.']},
  {id:'fraction-false',topic:'Cộng hai phân thức',condition:'Với mọi số thực x ≠ 0 và x ≠ −2.',statement:'1/x + 1/2 = 2/(x + 2)',valid:false,explanation:['Phải quy đồng mẫu số: 1/x + 1/2 = 2/(2x) + x/(2x) = (x + 2)/(2x), với x ≠ 0. Không cộng trực tiếp hai mẫu.','Phản ví dụ x = 2, thỏa các điều kiện đã cho: vế trái bằng 1, vế phải bằng 1/2.']},
  {id:'fraction-true',topic:'Cộng hai phân thức',condition:'Với mọi số thực x ≠ 0.',statement:'1/x + 1/2 = (x + 2)/(2x)',valid:true,explanation:['Với x ≠ 0, mẫu chung 2x khác 0. Ta có 1/x = 2/(2x) và 1/2 = x/(2x).','Cộng hai tử trên cùng mẫu: 2/(2x) + x/(2x) = (x + 2)/(2x).']},
];

/** Mỗi lượt đủ 5 chủ đề. Chỉ đảo/chọn trong 10 thẻ đã được rà, không sinh lời giải mới. */
export function errorHuntRound(round=0):ErrorHuntCard[]{
  const n=Number.isSafeInteger(round)&&round>=0?round:0;
  const cards=Array.from({length:5},(_,i)=>errorHuntCards[2*i+(((n>>>i)&1)^(i%2))]);
  const offset=n%5;
  return [...cards.slice(offset),...cards.slice(0,offset)];
}
