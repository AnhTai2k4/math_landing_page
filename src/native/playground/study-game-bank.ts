/** Ngân hàng tự biên soạn, không phải bằng chứng tiến độ BTVN của một lớp. */
export type StudyGrade = 10 | 11 | 12;
export interface StudyTopic {id:string;grade:StudyGrade;chapter:string;lesson:string;label:string}
export interface StudyGameQuestion {id:string;grade:StudyGrade;chapter:string;lesson:string;type:string;level:2|3|4;prompt:string;answers:readonly [string,string,string];correct:0|1|2;explanation:string;tip:string}
export const STUDY_GAME_TOPICS:readonly StudyTopic[] = [
  {id:'g10-sets',grade:10,chapter:'Mệnh đề và tập hợp',lesson:'Mệnh đề, phép toán tập hợp, đếm phần tử',label:'Mệnh đề và tập hợp'},
  {id:'g11-trig',grade:11,chapter:'Hàm số lượng giác và phương trình lượng giác',lesson:'Giá trị, công thức và phương trình lượng giác cơ bản',label:'Lượng giác: công thức và phương trình'},
  {id:'g12-derivatives',grade:12,chapter:'Ứng dụng đạo hàm để khảo sát hàm số',lesson:'Đơn điệu, cực trị, giá trị lớn nhất và nhỏ nhất',label:'Đạo hàm: đơn điệu và cực trị'},
];
type Seed = [string,StudyGameQuestion['level'],string,readonly [string,string,string],0|1|2,string,string];
const seeds:Record<StudyGrade,readonly Seed[]> = {
  10:[
    ['Giao hai khoảng',2,'A = [−2; 3), B = (1; 5]. Tìm A ∩ B.',['(1; 3)','[1; 3]','(−2; 5]'],0,'Phần chung phải có x > 1 và x < 3. Vì vậy A ∩ B = (1; 3).','Kiểm cả điều kiện ở hai đầu mút.'],
    ['Hợp hai khoảng',2,'A = [−2; 3), B = [1; 5]. Tìm A ∪ B.',['(−2; 5)','[−2; 5]','[1; 3)'],1,'Hai khoảng giao nhau. Hợp phủ từ −2 đến 5 và chứa cả hai đầu, nên A ∪ B = [−2; 5].','Hợp gồm phần tử thuộc ít nhất một tập.'],
    ['Phần bù',2,'Trong ℝ, lấy phần bù của (−∞; −1] ∪ [2; +∞).',['[−1; 2]','(−∞; 2)','(−1; 2)'],2,'Bỏ các số x ≤ −1 và x ≥ 2, còn −1 < x < 2. Hai đầu mút đều bị loại.','Phần bù đổi cả điều kiện tại đầu mút.'],
    ['Đếm phần tử',3,'Có 26 bạn học câu lạc bộ A, 20 bạn học B; 34 bạn học ít nhất một. Có bao nhiêu bạn học cả hai?',['12','6','14'],0,'|A ∩ B| = |A| + |B| − |A ∪ B| = 26 + 20 − 34 = 12.','Khi cộng hai tập, phần giao bị đếm hai lần.'],
    ['Phủ định mệnh đề',3,'Phủ định của “Với mọi x ∈ ℝ, x² > 0” là gì?',['∀x ∈ ℝ: x² ≤ 0','∃x ∈ ℝ: x² ≤ 0','∃x ∈ ℝ: x² < 0'],1,'Phủ định đổi “với mọi” thành “tồn tại” và đổi > thành ≤. Kết quả: ∃x ∈ ℝ sao cho x² ≤ 0.','Đổi lượng từ và phủ định mệnh đề phía sau.'],
    ['Hiệu tập hợp',3,'A = {x ∈ ℤ | −3 < x ≤ 3}, B = {x ∈ ℤ | x² ≤ 4}. Tìm A ∖ B.',['{−3; 3}','{−2; 2}','{3}'],2,'A = {−2; −1; 0; 1; 2; 3}, B = {−2; −1; 0; 1; 2}. Chỉ phần tử 3 thuộc A và không thuộc B.','Liệt kê tập số nguyên rồi loại phần giao.'],
    ['Đếm phần bù',4,'Lớp có 32 bạn, |A| = 18, |B| = 15, |A ∩ B| = 8. Có bao nhiêu bạn không thuộc A lẫn B?',['7','1','9'],0,'|A ∪ B| = 18 + 15 − 8 = 25. Có 32 − 25 = 7 bạn nằm ngoài cả hai tập.','Tính hợp trước, lấy tổng số trừ hợp sau.'],
    ['Mệnh đề kéo theo',4,'Có bao nhiêu x ∈ ℤ ∩ [−3; 3] làm mệnh đề “x² ≤ 4 ⇒ x < 0” sai?',['2','3','5'],1,'Kéo theo sai khi x² ≤ 4 đúng và x < 0 sai. Các số nguyên thỏa là 0, 1, 2, nên có 3 giá trị.','p ⇒ q chỉ sai khi p đúng và q sai.'],
  ],
  11:[
    ['Giá trị lượng giác',2,'sin α = 3/5, π/2 < α < π. Tính cos α.',['−4/5','4/5','−3/5'],0,'cos²α = 1 − 9/25 = 16/25. Góc ở góc phần tư II nên cos α < 0, suy ra cos α = −4/5.','Xác định dấu theo góc phần tư trước khi lấy căn.'],
    ['Giá trị lượng giác',2,'cos α = −12/13, π < α < 3π/2. Tính tan α.',['−5/12','5/12','12/5'],1,'Ở góc phần tư III, sin α = −√(1 − 144/169) = −5/13. tan α = (−5/13)/(−12/13) = 5/12.','Ở góc phần tư III, sin và cos đều âm.'],
    ['Công thức góc đôi',2,'sin α + cos α = 1/2. Tính sin 2α.',['3/4','−1/4','−3/4'],2,'Bình phương: 1 + 2 sin α cos α = 1/4. Do đó sin 2α = 2 sin α cos α = −3/4.','Bình phương tổng vẫn có hạng tử chéo.'],
    ['Công thức góc đôi',3,'tan α = 2. Tính cos 2α.',['−3/5','3/5','−4/5'],0,'cos 2α = (1 − tan²α)/(1 + tan²α) = (1 − 4)/(1 + 4) = −3/5.','tan α xác định nên công thức theo tan dùng được.'],
    ['Phương trình cơ bản',3,'sin x = √3/2 có bao nhiêu nghiệm trong [0; 2π)?',['1','2','4'],1,'Trong một chu kỳ, x = π/3 hoặc x = 2π/3. Cả hai đều thuộc [0; 2π), nên có 2 nghiệm.','Vẽ đường tròn lượng giác để kiểm hai họ nghiệm.'],
    ['Đếm nghiệm',3,'cos(2x) = 0 có bao nhiêu nghiệm trong [0; 2π)?',['2','3','4'],2,'2x = π/2 + kπ nên x = π/4 + kπ/2. Với k = 0, 1, 2, 3, có đúng 4 nghiệm trong khoảng đã cho.','Đổi miền của 2x hoặc kiểm đủ các giá trị k.'],
    ['Phương trình lượng giác',4,'Nghiệm của sin x + cos x = √2 là họ nào (k ∈ ℤ)?',['π/4 + 2kπ','π/4 + kπ','3π/4 + 2kπ'],0,'sin x + cos x = √2 sin(x + π/4). Suy ra sin(x + π/4) = 1, nên x = π/4 + 2kπ.','Giá trị bằng biên trên chỉ đạt một họ mỗi chu kỳ.'],
    ['Phân tích phương trình',4,'sin(2x) = cos x có bao nhiêu nghiệm trong [0; 2π)?',['2','4','6'],1,'cos x(2 sin x − 1) = 0. cos x = 0 cho π/2, 3π/2; sin x = 1/2 cho π/6, 5π/6. Bốn nghiệm phân biệt.','Không chia cho cos x vì có thể làm mất nghiệm.'],
  ],
  12:[
    ['Xét dấu đạo hàm',2,'f(x) = x³ − 3x² + 2 nghịch biến trên khoảng nào?',['(0; 2)','(−∞; 0)','(2; +∞)'],0,'f′(x) = 3x(x − 2). Đạo hàm âm khi 0 < x < 2, nên hàm số nghịch biến trên (0; 2).','Lập dấu của cả hai nhân tử đạo hàm.'],
    ['Giá trị cực trị',2,'f(x) = x³ − 3x + 1. Giá trị cực đại bằng bao nhiêu?',['−1','3','1'],1,'f′(x) = 3(x − 1)(x + 1), đổi dấu từ + sang − tại x = −1. f(−1) = −1 + 3 + 1 = 3.','Phân biệt điểm cực đại và giá trị cực đại.'],
    ['Hàm phân thức',2,'f(x) = (2x + 1)/(x − 1). Nhận xét nào đúng?',['Đồng biến trên ℝ','Nghịch biến trên ℝ','Nghịch biến trên (1; +∞)'],2,'Tập xác định: ℝ ∖ {1}. f′(x) = −3/(x − 1)² < 0. Hàm nghịch biến trên từng khoảng xác định, đặc biệt (1; +∞).','Không gộp hai khoảng qua điểm ngoài tập xác định.'],
    ['Tối ưu trên đoạn',3,'f(x) = x³ − 3x trên [0; 2]. Giá trị nhỏ nhất bằng bao nhiêu?',['−2','0','2'],0,'f′(x) = 3x² − 3 = 0 cho x = 1 trong đoạn. So sánh f(0) = 0, f(1) = −2, f(2) = 2; nhỏ nhất là −2.','Kiểm cả điểm tới hạn và hai đầu đoạn.'],
    ['Số cực trị',3,'f(x) = x⁴ − 2x² có bao nhiêu điểm cực trị?',['2','3','1'],1,'f′(x) = 4x(x − 1)(x + 1). Dấu lần lượt −, +, −, + qua −1, 0, 1. Có 3 lần đổi dấu, tức 3 điểm cực trị.','Nghiệm đạo hàm cần được kiểm đổi dấu.'],
    ['Tham số đơn điệu',3,'f(x) = x³ − 3mx. Để f đồng biến trên ℝ, m thuộc miền nào?',['m < 0','m ≥ 0','m ≤ 0'],2,'f′(x) = 3x² − 3m ≥ 0 với mọi x khi và chỉ khi m ≤ 0. Khi m = 0, f(x) = x³ vẫn đồng biến trên ℝ.','Đạo hàm có thể bằng 0 tại điểm riêng lẻ.'],
    ['Tối ưu phân thức',4,'f(x) = x + 4/x trên [1; 4]. Giá trị nhỏ nhất bằng bao nhiêu?',['4','5','3'],0,'f′(x) = 1 − 4/x², bằng 0 tại x = 2 trong đoạn. f(1) = 5, f(2) = 4, f(4) = 5. Giá trị nhỏ nhất là 4.','Mẫu khác 0 trên đoạn; so sánh đủ ba ứng viên.'],
    ['Tham số cực trị',4,'f(x) = x³ − 3x² + mx có hai điểm cực trị khi nào?',['m ≤ 3','m < 3','m > 3'],1,'f′(x) = 3x² − 6x + m. Để có hai nghiệm đơn và đổi dấu hai lần cần Δ = 36 − 12m > 0, tương đương m < 3.','Δ = 0 chỉ cho nghiệm kép, không tạo cực trị.'],
  ],
};
export const STUDY_GAME_QUESTIONS:readonly StudyGameQuestion[] = STUDY_GAME_TOPICS.flatMap(topic => seeds[topic.grade].map((q,index) => ({id:`${topic.id}-${index+1}`,grade:topic.grade,chapter:topic.chapter,lesson:topic.lesson,type:q[0],level:q[1],prompt:q[2],answers:q[3],correct:q[4],explanation:q[5],tip:q[6]})));
export function studyGameTopics(grade:StudyGrade) {return STUDY_GAME_TOPICS.filter(topic=>topic.grade===grade);}
/** Chỉ dùng một chương học sinh đã xác nhận, không tự mở chương kế tiếp. */
export function studyGameQuestions(grade:StudyGrade,topicId:string) {return STUDY_GAME_QUESTIONS.filter(question=>question.grade===grade&&question.id.startsWith(`${topicId}-`)&&STUDY_GAME_TOPICS.some(topic=>topic.id===topicId&&topic.grade===grade));}
export const STUDY_GAME_GRADE_KEY='mtm-study-game-grade-v1';
export function readStudyGameGrade(storage:Pick<Storage,'getItem'>|undefined):StudyGrade|null {try{const value=storage?.getItem(STUDY_GAME_GRADE_KEY);return value==='10'||value==='11'||value==='12'?Number(value) as StudyGrade:null;}catch{return null;}}
export function saveStudyGameGrade(storage:Pick<Storage,'setItem'>|undefined,grade:StudyGrade):boolean {if(![10,11,12].includes(grade))return false;try{storage?.setItem(STUDY_GAME_GRADE_KEY,String(grade));return Boolean(storage);}catch{return false;}}
