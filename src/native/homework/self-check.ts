export const HOMEWORK_CHECKS = [
  {id:'conditions',label:'Điều kiện và nghiệm',detail:'Ghi điều kiện xác định, loại nghiệm không thỏa và kiểm tra kết luận.',hint:'Đọc lại mẫu số, căn thức, logarit hoặc điều kiện riêng của đề. Thử nghiệm tìm được vào điều kiện và bài gốc.'},
  {id:'signs',label:'Dấu và phép biến đổi',detail:'Soát dấu âm, ngoặc và chiều bất đẳng thức sau từng phép biến đổi.',hint:'Nhìn lại các bước đổi dấu, bỏ ngoặc, chuyển vế; khi nhân hoặc chia bất đẳng thức với số âm phải đổi chiều.'},
  {id:'units',label:'Đơn vị và làm tròn',detail:'Đối chiếu đơn vị, chế độ góc khi dùng máy và yêu cầu làm tròn.',hint:'Xem đề cần đơn vị nào, độ hay radian và làm tròn đến đâu. Giữ số chính xác ở bước giữa, chỉ làm tròn kết quả theo yêu cầu.'},
  {id:'answers',label:'Đủ ô trả lời',detail:'Kiểm từng câu, từng ý Đúng/Sai và các ô nhập, kể cả câu đã đánh dấu quay lại.',hint:'Đi từ câu đầu đến câu cuối. Với Đúng/Sai, kiểm đủ từng ý; với câu trả lời ngắn, đọc lại số, dấu và định dạng ô nhập.'},
  {id:'data',label:'Khớp dữ kiện của đề',detail:'Đọc lại câu hỏi để kết quả đúng đại lượng, phạm vi và dữ kiện đã cho.',hint:'Đối chiếu điều đề hỏi với kết luận, kiểm dữ kiện đã chép và xem kết quả có hợp lý trong tình huống của bài không.'},
] as const;

export type HomeworkCheckFocus='all'|typeof HOMEWORK_CHECKS[number]['id'];
export function homeworkChecksForFocus(focus:HomeworkCheckFocus='all'){
  return [...HOMEWORK_CHECKS.filter(item=>item.id===focus),...HOMEWORK_CHECKS.filter(item=>item.id!==focus)];
}
export function summarizeHomeworkChecks(selected:readonly string[],focus:HomeworkCheckFocus='all'){
  const checked=new Set(selected),remaining=homeworkChecksForFocus(focus).filter(item=>!checked.has(item.id));
  return {done:HOMEWORK_CHECKS.length-remaining.length,total:HOMEWORK_CHECKS.length,remaining,next:remaining[0]??null};
}
