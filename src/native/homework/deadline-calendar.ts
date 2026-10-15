import {foldCalendarLine} from '../../components/timetable-calendar';

// Chỉ xuất hạn thật còn hiệu lực. Không suy từ expectedDueAt hoặc lịch tham chiếu.
export function hasHomeworkDeadline(dueAt:unknown,now=Date.now()):dueAt is number{
  return typeof dueAt==='number'&&Number.isFinite(dueAt)&&dueAt>now&&dueAt<=Date.UTC(9999,11,31,23,59,59);
}
const utc=(at:number)=>new Date(at).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');

export async function createHomeworkDeadlineICS(lesson:{lessonCode:string;dueAt:number|null},now=Date.now()){
  if(!hasHomeworkDeadline(lesson.dueAt,now))throw Error('Chưa có hạn nộp đã xác nhận còn hiệu lực để thêm vào lịch.');
  const key=JSON.stringify([lesson.lessonCode,lesson.dueAt]);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));
  const uid=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Minh Thanh Math//Han BTVN//VI','CALSCALE:GREGORIAN',
    'BEGIN:VEVENT','UID:'+uid+'@minhthanhmath.vn','DTSTAMP:'+utc(now),'DTSTART:'+utc(lesson.dueAt),
    'SUMMARY:Hạn nộp BTVN MTM','DESCRIPTION:Hạn theo lịch lớp. Mở BTVN trên website MTM để kiểm tra lại nếu lịch thay đổi.',
    'URL:https://www.minhthanhmath.vn/btvn','END:VEVENT','END:VCALENDAR'];
  return lines.map(foldCalendarLine).join('\r\n')+'\r\n';
}
