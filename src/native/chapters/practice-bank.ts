// KT-06 (Đợt 3): ngân hàng đề Luyện tập (khoảng 3 MB JSON). Chỉ nạp bằng import() động (qua PracticeShelf.tsx)
// sau khi khung trang /luyen-tap đã vẽ. Nội dung, ID, hash giữ nguyên như khi nhập tĩnh trước đây.
import tests from './practice-tests.json';
import archives from './archived-tests.json';
import exactTests from './exact-tests.json';
import {lessonName,type PracticeItem} from './practice-shared';

const rawBank=[...tests,...exactTests] as unknown as PracticeItem[];
const foundationLabel=(p:PracticeItem)=>p.track==='10'?'Hệ thống công thức và lý thuyết cả chương':p.track==='11'?p.order===1?'Góc và công thức lượng giác':'Hàm số và phương trình lượng giác':p.order===1?'Đạo hàm, biến thiên và cực trị':'Khảo sát đồ thị và bài toán ứng dụng';
export const bank=rawBank.map(p=>{const coverage=p.isFoundation?foundationLabel(p):p.sourceEdition?lessonName(p.coverage):p.coverage;return {...p,coverage,presentationTitle:p.presentationTitle??(["HSA","TSA"].includes(p.track)?p.exam.title:`Toán ${p.track} · Chương ${p.chapter} · ${p.isChapterEnd?"Kiểm tra kết thúc chương":"Bài "+p.order+": "+coverage}`)};});
const currentIds=new Set(bank.map(p=>p.exam.id));
export const pilotBank=(archives as unknown as PracticeItem[]).filter(p=>!currentIds.has(p.exam.id));
