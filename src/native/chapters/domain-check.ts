export type DomainChoice={id:string;text:string;reason:string};
export type DomainQuestion={id:string;expression:string;choices:DomainChoice[];correctId:string;solution:string[];tip:string};

/** Bốn câu tự luyện riêng, ôn kiến thức đã học ở THCS; không thuộc ngân hàng đề. */
export const domainQuestions:DomainQuestion[]=[
  {id:'fraction',expression:'(x + 1) / (x − 2)',correctId:'except-two',choices:[
    {id:'except-two',text:'x ≠ 2',reason:'Mẫu x − 2 phải khác 0. Tử số được phép bằng 0.'},
    {id:'except-minus-one',text:'x ≠ −1',reason:'Không cần loại nghiệm của tử số. Tại x = −1, biểu thức bằng 0 và vẫn xác định.'},
    {id:'above-two',text:'x > 2',reason:'Mẫu chỉ cần khác 0, không cần dương. Chẳng hạn x = 1 vẫn cho giá trị −2.'},
  ],solution:['Điều kiện: x − 2 ≠ 0 ⇔ x ≠ 2.','Vậy tập xác định là D = ℝ ∖ {2}.','Kiểm biên: x = 2 làm mẫu bằng 0 nên phải loại; x = −1 cho giá trị 0 nên được nhận.'],tip:'Phân thức: loại nghiệm của mẫu, không loại nghiệm của tử.'},
  {id:'square-root',expression:'√(x + 3)',correctId:'at-least-minus-three',choices:[
    {id:'above-minus-three',text:'x > −3',reason:'Căn bậc hai của 0 vẫn xác định. Điều kiện này bỏ mất x = −3.'},
    {id:'at-least-minus-three',text:'x ≥ −3',reason:'Biểu thức dưới căn phải không âm, được phép bằng 0.'},
    {id:'at-most-minus-three',text:'x ≤ −3',reason:'Điều kiện đúng là x + 3 ≥ 0. Ví dụ x = −4 làm biểu thức dưới căn âm.'},
  ],solution:['Điều kiện: x + 3 ≥ 0 ⇔ x ≥ −3.','Vậy tập xác định là D = [−3; +∞).','Kiểm biên: x = −3 cho √0 = 0 nên được nhận; x = −4 không xác định trong ℝ.'],tip:'Căn ở tử hoặc đứng riêng: biểu thức dưới căn được phép bằng 0.'},
  {id:'root-denominator',expression:'1 / √(x − 1)',correctId:'above-one',choices:[
    {id:'at-least-one',text:'x ≥ 1',reason:'Tại x = 1, căn có giá trị 0 nhưng nằm ở mẫu, nên phép chia không xác định.'},
    {id:'except-one',text:'x ≠ 1',reason:'Chỉ loại x = 1 là chưa đủ. Các giá trị x < 1 làm biểu thức dưới căn âm.'},
    {id:'above-one',text:'x > 1',reason:'Cần đồng thời có căn xác định và mẫu khác 0, nên biểu thức dưới căn phải dương.'},
  ],solution:['Căn xác định: x − 1 ≥ 0. Mẫu khác 0: √(x − 1) ≠ 0.','Kết hợp: x − 1 > 0 ⇔ x > 1. Vậy D = (1; +∞).','Kiểm biên: x = 1 làm mẫu bằng 0 nên bị loại; x = 2 cho giá trị 1 nên được nhận.'],tip:'Căn ở mẫu: gộp hai điều kiện thành biểu thức dưới căn lớn hơn 0.'},
  {id:'quadratic-root-denominator',expression:'1 / √(4 − x²)',correctId:'inside',choices:[
    {id:'inside',text:'−2 < x < 2',reason:'Căn ở mẫu cần 4 − x² > 0, tương đương |x| < 2.'},
    {id:'closed',text:'−2 ≤ x ≤ 2',reason:'Hai đầu mút x = −2 và x = 2 đều làm mẫu bằng 0, nên không được lấy dấu bằng.'},
    {id:'except-ends',text:'x ≠ −2 và x ≠ 2',reason:'Ngoài việc loại hai đầu mút, phải loại cả |x| > 2. Ví dụ x = 3 làm 4 − x² = −5.'},
  ],solution:['Căn ở mẫu nên 4 − x² > 0.','4 − x² > 0 ⇔ x² < 4 ⇔ |x| < 2 ⇔ −2 < x < 2.','Vậy D = (−2; 2). Hai đầu mút ±2 bị loại vì mẫu bằng 0; x = 0 cho giá trị 1/2.'],tip:'Điều kiện x² < a² với a > 0 cho −a < x < a, phải xét cả hai phía.'},
];
