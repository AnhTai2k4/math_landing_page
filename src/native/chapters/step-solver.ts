export type SolverChoice={id:string;text:string;explanation:string};
export type SolverStep={title:string;from:string;hint:string;choices:SolverChoice[];correctId:string};
export type SolverProblem={id:string;title:string;statement:string;condition:string;steps:SolverStep[];conclusion:string};

/** Bài tự luyện do MTM biên soạn, độc lập với đề đã đăng và không ghi điểm. */
export const solverProblems:SolverProblem[]=[
  {id:'fraction',title:'Phương trình có mẫu',statement:'Giải phương trình (x + 1)/(x − 2) = 2.',condition:'Xét x trong tập số thực. Mọi phép biến đổi phải giữ điều kiện mẫu khác 0.',steps:[
    {title:'Đặt điều kiện xác định',from:'Mẫu số là x − 2.',hint:'Phân thức xác định khi mẫu số khác 0.',correctId:'domain',choices:[
      {id:'positive',text:'x > 2',explanation:'Mẫu số được phép âm. Chỉ cần mẫu khác 0, không bắt buộc dương.'},
      {id:'domain',text:'x ≠ 2',explanation:'x − 2 ≠ 0 tương đương x ≠ 2. Giữ điều kiện này đến cuối bài.'},
      {id:'zero',text:'x = 2',explanation:'Tại x = 2, mẫu bằng 0 nên phân thức không xác định.'},
    ]},
    {title:'Khử mẫu đúng điều kiện',from:'Với x ≠ 2: (x + 1)/(x − 2) = 2.',hint:'Nhân cả hai vế với x − 2, một biểu thức đã biết khác 0.',correctId:'multiply',choices:[
      {id:'multiply',text:'x + 1 = 2(x − 2)',explanation:'Nhân hai vế với x − 2 khác 0 cho phép khử mẫu và là biến đổi tương đương trong điều kiện x ≠ 2.'},
      {id:'drop',text:'x + 1 = 2',explanation:'Không thể chỉ bỏ mẫu ở vế trái. Khi nhân, vế phải cũng phải nhân với x − 2.'},
      {id:'expand',text:'x + 1 = 2x − 2',explanation:'2(x − 2) = 2x − 4. Cần nhân 2 với cả hai hạng tử trong ngoặc.'},
    ]},
    {title:'Giải phương trình bậc nhất',from:'x + 1 = 2(x − 2) = 2x − 4.',hint:'Trừ x ở hai vế rồi cộng 4 ở hai vế.',correctId:'five',choices:[
      {id:'three',text:'x = 3',explanation:'Từ x + 1 = 2x − 4 suy ra 1 = x − 4, nên x = 5.'},
      {id:'minus',text:'x = −5',explanation:'Trừ x rồi cộng 4 ở hai vế cho 1 + 4 = x, không phải x = −5.'},
      {id:'five',text:'x = 5',explanation:'x + 1 = 2x − 4 ⇔ 1 = x − 4 ⇔ x = 5.'},
    ]},
    {title:'Đối chiếu và kết luận',from:'Giá trị vừa tìm là x = 5; điều kiện ban đầu là x ≠ 2.',hint:'Thay 5 vào phương trình gốc: (5 + 1)/(5 − 2).',correctId:'accept',choices:[
      {id:'exclude',text:'Loại x = 5 vì x phải nhỏ hơn 2',explanation:'Điều kiện đúng là x ≠ 2, không phải x < 2. Với x = 5, mẫu bằng 3 và phương trình gốc đúng.'},
      {id:'accept',text:'S = {5}, vì 5 ≠ 2 và 6/3 = 2',explanation:'x = 5 thỏa điều kiện và phương trình gốc. Vậy tập nghiệm là S = {5}.'},
      {id:'add',text:'S = {2; 5}',explanation:'x = 2 làm mẫu bằng 0 nên không thể là nghiệm.'},
    ]},
  ],conclusion:'S = {5}. Luôn giữ điều kiện x ≠ 2 khi khử mẫu.'},
  {id:'product',title:'Đưa về phương trình tích',statement:'Giải phương trình x² − 5x + 6 = 0.',condition:'Xét x trong tập số thực. Một tích bằng 0 khi ít nhất một thừa số bằng 0.',steps:[
    {title:'Phân tích thành nhân tử',from:'x² − 5x + 6 = 0.',hint:'Tìm hai số có tổng bằng 5 và tích bằng 6.',correctId:'factor',choices:[
      {id:'sum',text:'(x + 2)(x + 3) = 0',explanation:'Khai triển biểu thức này được x² + 5x + 6, sai dấu của hạng tử bậc nhất.'},
      {id:'factor',text:'(x − 2)(x − 3) = 0',explanation:'(x − 2)(x − 3) = x² − 3x − 2x + 6 = x² − 5x + 6.'},
      {id:'mixed',text:'(x − 2)(x + 3) = 0',explanation:'Khai triển được x² + x − 6, không phải đa thức ban đầu.'},
    ]},
    {title:'Dùng quy tắc tích bằng 0',from:'(x − 2)(x − 3) = 0.',hint:'Chỉ cần một trong hai thừa số bằng 0; không yêu cầu cả hai cùng bằng 0.',correctId:'or',choices:[
      {id:'or',text:'x − 2 = 0 hoặc x − 3 = 0',explanation:'Trong tập số thực, ab = 0 tương đương a = 0 hoặc b = 0.'},
      {id:'and',text:'x − 2 = 0 và x − 3 = 0 đồng thời',explanation:'Không cần cả hai thừa số đồng thời bằng 0. Điều kiện đó còn yêu cầu x vừa bằng 2 vừa bằng 3, vô lý.'},
      {id:'divide',text:'Chia cho x − 2 để chỉ còn x − 3 = 0',explanation:'Chưa biết x − 2 khác 0. Chia ngay sẽ làm mất nghiệm x = 2.'},
    ]},
    {title:'Giải hai trường hợp',from:'x − 2 = 0 hoặc x − 3 = 0.',hint:'Cộng số đối của hằng số vào hai vế của từng phương trình.',correctId:'roots',choices:[
      {id:'negative',text:'x = −2 hoặc x = −3',explanation:'x − 2 = 0 cho x = 2; x − 3 = 0 cho x = 3.'},
      {id:'one',text:'Chỉ x = 3',explanation:'Còn trường hợp x − 2 = 0 cho x = 2. Cần xét đủ cả hai trường hợp.'},
      {id:'roots',text:'x = 2 hoặc x = 3',explanation:'x − 2 = 0 ⇔ x = 2; x − 3 = 0 ⇔ x = 3.'},
    ]},
    {title:'Kiểm tra tập nghiệm',from:'Hai giá trị tìm được là 2 và 3.',hint:'Thay từng giá trị vào x² − 5x + 6.',correctId:'both',choices:[
      {id:'none',text:'S = ∅ vì 2 và 3 khác nhau',explanation:'Phương trình có thể có nhiều nghiệm. Không yêu cầu hai nghiệm phải bằng nhau.'},
      {id:'both',text:'S = {2; 3}, vì 4 − 10 + 6 = 0 và 9 − 15 + 6 = 0',explanation:'Cả hai giá trị đều thỏa phương trình gốc. Các biến đổi tương đương nên không còn nghiệm nào khác.'},
      {id:'five',text:'S = {5}, lấy tổng hai giá trị',explanation:'Không cộng các nghiệm để tạo nghiệm mới. Với x = 5, vế trái bằng 6, khác 0.'},
    ]},
  ],conclusion:'S = {2; 3}. Quy tắc tích bằng 0 dùng “hoặc”, không dùng “và đồng thời”.'},
  {id:'radical',title:'Bình phương và nghiệm ngoại lai',statement:'Giải phương trình √(x + 1) = x − 1.',condition:'Xét x trong tập số thực. Căn bậc hai số học luôn không âm.',steps:[
    {title:'Tìm điều kiện cần của nghiệm',from:'√(x + 1) = x − 1.',hint:'Cần x + 1 ≥ 0 để căn xác định và x − 1 ≥ 0 để hai vế bằng nhau.',correctId:'domain',choices:[
      {id:'root',text:'Chỉ cần x ≥ −1, không cần xét dấu vế phải',explanation:'x ≥ −1 mới chỉ đảm bảo căn xác định. Để phương trình đúng, vế phải cũng phải không âm.'},
      {id:'domain',text:'x ≥ 1',explanation:'Cần x ≥ −1 và x ≥ 1. Kết hợp được x ≥ 1. Mọi nghiệm của phương trình đều phải thỏa điều kiện này.'},
      {id:'reverse',text:'x ≤ 1',explanation:'Vế phải x − 1 phải không âm, tức x − 1 ≥ 0 hay x ≥ 1, không phải x ≤ 1.'},
    ]},
    {title:'Bình phương hai vế',from:'Với x ≥ 1, cả √(x + 1) và x − 1 đều không âm.',hint:'Hai số không âm bằng nhau khi và chỉ khi bình phương của chúng bằng nhau.',correctId:'square',choices:[
      {id:'square',text:'x + 1 = (x − 1)²',explanation:'Trong điều kiện x ≥ 1, bình phương là biến đổi tương đương. Luôn giữ điều kiện đó.'},
      {id:'drop',text:'x + 1 = x − 1',explanation:'Bỏ dấu căn bằng bình phương vế trái thì vế phải cũng phải được bình phương.'},
      {id:'bad',text:'x + 1 = x² − 1',explanation:'(x − 1)² = x² − 2x + 1, không phải x² − 1.'},
    ]},
    {title:'Thu gọn phương trình sau bình phương',from:'x + 1 = (x − 1)².',hint:'Khai triển (x − 1)² rồi chuyển toàn bộ về một vế.',correctId:'expand',choices:[
      {id:'wrong',text:'x² − x = 0',explanation:'x + 1 = x² − 2x + 1 ⇔ x² − 3x = 0. Phải chuyển cả hạng tử x.'},
      {id:'constant',text:'x² − 3x + 2 = 0',explanation:'Hằng số 1 ở hai vế triệt tiêu, không cộng thành 2.'},
      {id:'expand',text:'x² − 3x = 0',explanation:'x + 1 = x² − 2x + 1 ⇔ 0 = x² − 3x.'},
    ]},
    {title:'Tìm các giá trị cần đối chiếu',from:'x² − 3x = 0.',hint:'Đặt x làm nhân tử chung, rồi dùng quy tắc tích bằng 0.',correctId:'candidates',choices:[
      {id:'minus',text:'x = 0 hoặc x = −3',explanation:'x² − 3x = x(x − 3), nên các giá trị là 0 và 3.'},
      {id:'candidates',text:'x = 0 hoặc x = 3, sau đó đối chiếu x ≥ 1',explanation:'x(x − 3) = 0 ⇔ x = 0 hoặc x = 3. Đây là các nghiệm của phương trình sau bình phương; cần lọc theo điều kiện.'},
      {id:'only',text:'Chỉ x = 0 vì có nhân tử x',explanation:'Còn nhân tử x − 3 có thể bằng 0, cho x = 3. Phải xét đủ hai trường hợp.'},
    ]},
    {title:'Loại nghiệm ngoại lai và thử lại',from:'Các giá trị sau bình phương: 0 và 3; điều kiện cần: x ≥ 1.',hint:'x = 0 không thỏa điều kiện. Với x = 3, kiểm tra √(3 + 1) và 3 − 1.',correctId:'accept',choices:[
      {id:'keep',text:'S = {0; 3}, giữ cả hai nghiệm sau bình phương',explanation:'x = 0 bị loại: không thỏa x ≥ 1, và trong phương trình gốc √1 = 1 khác −1.'},
      {id:'none',text:'S = ∅ vì đã bình phương',explanation:'Bình phương không có nghĩa là mọi giá trị đều bị loại. x = 3 thỏa điều kiện và cho hai vế cùng bằng 2.'},
      {id:'accept',text:'S = {3}, loại 0; với 3 thì √4 = 2 = 3 − 1',explanation:'x = 0 không thỏa điều kiện; x = 3 thỏa và đúng phương trình gốc. Vậy S = {3}.'},
    ]},
  ],conclusion:'S = {3}. Khi bình phương, phải giữ điều kiện dấu và kiểm tra lại phương trình gốc.'},
];
