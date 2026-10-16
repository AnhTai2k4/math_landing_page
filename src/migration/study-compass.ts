export const studyGoals=[
  {id:'understand',label:'Hiểu chắc bài đang học'},
  {id:'mistakes',label:'Gỡ một câu từng làm sai'},
  {id:'challenge',label:'Thử sức một chút'},
] as const;
export const studyDurations=[10,20,30] as const;
type StudyStep={minutes:number;title:string;detail:string;href:string;link:string};
export type StudyPlan={goal:string;minutes:number;steps:StudyStep[]};

export function makeStudyPlan(goal:string,minutes:number):StudyPlan|null{
  const selected=studyGoals.find(item=>item.id===goal);
  if(!selected||!studyDurations.some(value=>value===minutes))return null;
  const short=minutes/5,long=minutes-2*short;
  const finish:StudyStep={minutes:short,title:'Chốt một điều em đã hiểu',detail:'Tự viết lại cách làm và một điều cần tránh. Nếu dùng Sổ tay, em tự thêm rồi lưu việc học.',href:'/so-tay',link:'Mở Sổ tay'};
  const steps:StudyStep[]=goal==='understand'?[
    {minutes:short,title:'Nhớ lại trước khi xem',detail:'Không nhìn vở, viết điều kiện và công thức của bài đang học. Chọn đúng khối, chương ở Luyện tập rồi mở Ôn nhanh công thức để đối chiếu.',href:'/luyen-tap',link:'Mở ôn công thức'},
    {minutes:long,title:'Thử giải và tự giải thích',detail:'Trong nhóm lớp 10, 11 hoặc 12, mở Tự luyện · Giải từng bước. Chọn bài vừa sức, tự nghĩ trước khi chọn bước và đọc giải thích.',href:'/luyen-tap',link:'Mở Luyện tập'},finish,
  ]:goal==='mistakes'?[
    {minutes:short,title:'Chọn đúng một câu cần gỡ',detail:'Mở lịch sử ở Thi thử trên máy em đã dùng, xem kết quả một lượt đã nộp và chọn một câu sai hoặc chưa làm. Chưa có lịch sử thì chọn bài tự luyện ở Luyện tập.',href:'/thi-thu',link:'Mở Thi thử và lịch sử'},
    {minutes:long,title:'Giải lại trước khi xem lời giải',detail:'Che lời giải, làm lại trên nháp rồi đối chiếu từng bước. Xác định lỗi ở điều kiện, công thức hay tính toán. Nếu chưa có lượt cũ, thử Tự luyện · Giải từng bước.',href:'/luyen-tap',link:'Chưa có lượt cũ? Mở bài tự luyện'},finish,
  ]:[
    {minutes:short,title:'Khởi động nhẹ',detail:'Chọn nhóm lớp 10, 11 hoặc 12 và chương đang học, mở Trò tự luyện · Tính nhẩm 5 câu. Không cần chạy theo thời gian.',href:'/luyen-tap',link:'Mở trò tính nhẩm'},
    {minutes:long,title:'Thử một cách làm mới',detail:'Mở Tự luyện · Giải từng bước, chọn một bài phù hợp kiến thức đã học. Nêu lý do cho mỗi bước, dùng gợi ý khi cần.',href:'/luyen-tap',link:'Mở giải từng bước'},finish,
  ];
  return {goal:selected.label,minutes,steps};
}
