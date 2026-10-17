export type SolutionStep={id:string;text:string;reason:string;hint:string};
export type SolutionPuzzle={id:string;title:string;problem:string;route:string;steps:readonly SolutionStep[]};

// MTM tự biên soạn. Thứ tự dưới đây là lộ trình cụ thể của trò chơi,
// không phủ nhận các lời giải tương đương khác.
export const SOLUTION_PUZZLES:readonly SolutionPuzzle[]=[
 {id:'linear',title:'Phương trình bậc nhất',problem:'Giải phương trình 3(x − 2) + 4 = 10.',route:'Khai triển → thu gọn → chuyển hằng số → tìm x → thử lại.',steps:[
  {id:'expand',text:'Khai triển: 3x − 6 + 4 = 10.',reason:'Nhân 3 với cả x và −2, giữ nguyên hai vế phương trình.',hint:'Theo lộ trình, hãy bỏ ngoặc bằng phép phân phối trước.'},
  {id:'collect',text:'Thu gọn: 3x − 2 = 10.',reason:'Hai hằng số −6 và 4 có tổng bằng −2.',hint:'Gộp hai hằng số ở vế trái sau khi khai triển.'},
  {id:'add',text:'Cộng 2 vào hai vế: 3x = 12.',reason:'Cộng cùng một số vào hai vế cho phương trình tương đương.',hint:'Đưa vế trái về 3x bằng cách cộng 2 vào cả hai vế.'},
  {id:'divide',text:'Chia hai vế cho 3: x = 4.',reason:'Vì 3 khác 0, được phép chia cả hai vế cho 3.',hint:'Từ 3x = 12, chia cả hai vế cho hệ số của x.'},
  {id:'check',text:'Thử lại: 3(4 − 2) + 4 = 10. Vậy S = {4}.',reason:'Giá trị tìm được làm hai vế phương trình ban đầu bằng nhau.',hint:'Kết thúc bằng cách thay x vào phương trình ban đầu.'},
 ]},
 {id:'rational',title:'Phân thức có điều kiện',problem:'Giải phương trình (x² − 4)/(x − 2) = 5.',route:'Điều kiện → phân tích tử → rút gọn → tìm x → đối chiếu và thử.',steps:[
  {id:'domain',text:'Điều kiện xác định: x ≠ 2.',reason:'Mẫu x − 2 phải khác 0, kể cả khi sau đó rút gọn được.',hint:'Xét mẫu số trước khi biến đổi phân thức.'},
  {id:'factor',text:'Phân tích tử: x² − 4 = (x − 2)(x + 2).',reason:'Áp dụng hằng đẳng thức hiệu hai bình phương.',hint:'Sau điều kiện, phân tích tử để thấy nhân tử chung với mẫu.'},
  {id:'cancel',text:'Với x ≠ 2, rút gọn phương trình thành x + 2 = 5.',reason:'Chỉ được khử nhân tử x − 2 vì đã biết nó khác 0.',hint:'Giữ điều kiện khi khử nhân tử chung ở tử và mẫu.'},
  {id:'solve',text:'Trừ 2 ở hai vế: x = 3.',reason:'Từ x + 2 = 5 suy ra x = 5 − 2 = 3.',hint:'Giải phương trình bậc nhất sau khi rút gọn.'},
  {id:'check',text:'x = 3 thỏa điều kiện; (3² − 4)/(3 − 2) = 5. Vậy S = {3}.',reason:'Nghiệm khác 2 và thỏa đúng phương trình phân thức ban đầu.',hint:'Đối chiếu điều kiện rồi thay vào phân thức ban đầu.'},
 ]},
 {id:'radical',title:'Phương trình chứa căn',problem:'Giải phương trình √(2x + 3) = 3.',route:'Điều kiện → bình phương → tìm x → đối chiếu → thử lại.',steps:[
  {id:'domain',text:'Điều kiện: 2x + 3 ≥ 0, tức x ≥ −3/2.',reason:'Biểu thức dưới căn bậc hai phải không âm trong tập số thực.',hint:'Xét biểu thức dưới căn trước khi bình phương.'},
  {id:'square',text:'Hai vế không âm, bình phương được 2x + 3 = 9.',reason:'Vế trái là căn bậc hai số học và vế phải bằng 3, nên bước này tương đương trên điều kiện.',hint:'Sau điều kiện, kiểm tra dấu hai vế rồi bình phương.'},
  {id:'solve',text:'Giải: 2x = 6, suy ra x = 3.',reason:'Trừ 3 rồi chia 2 ở cả hai vế.',hint:'Giải phương trình bậc nhất vừa nhận được.'},
  {id:'compare',text:'Đối chiếu: 3 ≥ −3/2, nên x = 3 thỏa điều kiện.',reason:'Giá trị tìm được nằm trong miền xác định của căn thức.',hint:'Trước khi kết luận, đối chiếu giá trị x với điều kiện.'},
  {id:'check',text:'Thử lại: √(2 · 3 + 3) = √9 = 3. Vậy S = {3}.',reason:'Thay vào phương trình ban đầu để kiểm tra và kết luận tập nghiệm.',hint:'Kết thúc bằng phép thử trong phương trình chứa căn ban đầu.'},
 ]},
];

export function stepChoices(puzzle:SolutionPuzzle):readonly SolutionStep[]{
 return [2,0,4,1,3].map(index=>puzzle.steps[index]);
}
