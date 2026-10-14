export const homeworkStorageNotice='Bài làm lưu trên máy chủ MTM theo tài khoản em. Điểm lấy lần cao nhất và tính vào sổ BTVN của lớp.';
export default function RoomNotice({isHomework=false,focused=false}:{isHomework?:boolean;focused?:boolean}){
 return <p className={focused?'fr-local':undefined}>{isHomework?(focused?'':'Đồng hồ chỉ bắt đầu khi vào làm bài. ')+homeworkStorageNotice:focused?<>Tự luyện trên thiết bị này.<br/>Điểm không phải kết quả xác thực.</>:'Đồng hồ chỉ bắt đầu khi vào làm bài. Bài và kết quả lưu trên trình duyệt này; đây là điểm tự luyện, không phải kết quả xác thực.'}</p>;
}
