import {escapeCalendarText,foldCalendarLine} from '../../components/timetable-calendar';

type CalendarLesson={lessonCode:string;dueAt:number|null;date?:string};
const EVENT_MS=60000,MAX_ICS_TIME=Date.UTC(9999,11,31,23,59,59);

// Chỉ xuất hạn thật còn hiệu lực. Không suy từ expectedDueAt hoặc lịch tham chiếu.
export function hasHomeworkDeadline(dueAt:unknown,now=Date.now()):dueAt is number{
  return typeof dueAt==='number'&&Number.isSafeInteger(dueAt)&&Number.isFinite(now)&&dueAt>now&&dueAt<=MAX_ICS_TIME-EVENT_MS;
}
const utc=(at:number)=>new Date(at).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');

// SHA-256 đồng bộ để link.click() vẫn ở trong lượt bấm của người dùng.
// Giữ nguyên khóa JSON và thuật toán của UID cũ, không đưa mã buổi thô ra tệp.
const K=new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);
const rotate=(value:number,bits:number)=>(value>>>bits)|(value<<(32-bits));
function lessonDigest(lesson:CalendarLesson){
  const bytes=new TextEncoder().encode(JSON.stringify([lesson.lessonCode,lesson.dueAt]));
  const padded=new Uint8Array(Math.ceil((bytes.length+9)/64)*64);padded.set(bytes);padded[bytes.length]=0x80;
  const view=new DataView(padded.buffer),hash=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]),words=new Uint32Array(64);
  view.setUint32(padded.length-8,Math.floor(bytes.length/0x20000000));view.setUint32(padded.length-4,(bytes.length*8)>>>0);
  for(let offset=0;offset<padded.length;offset+=64){
    for(let i=0;i<16;i++)words[i]=view.getUint32(offset+i*4);
    for(let i=16;i<64;i++){const x=words[i-15],y=words[i-2];words[i]=(words[i-16]+(rotate(x,7)^rotate(x,18)^(x>>>3))+words[i-7]+(rotate(y,17)^rotate(y,19)^(y>>>10)))>>>0;}
    let [a,b,c,d,e,f,g,h]=hash;
    for(let i=0;i<64;i++){
      const t1=(h+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+K[i]+words[i])>>>0;
      const t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
      h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    [a,b,c,d,e,f,g,h].forEach((value,i)=>{hash[i]=(hash[i]+value)>>>0;});
  }
  return Array.from(hash,value=>value.toString(16).padStart(8,'0')).join('');
}
export const homeworkDeadlineFilename=(lesson:CalendarLesson)=>'MTM-han-BTVN-'+lessonDigest(lesson).slice(0,24)+'.ics';

export function createHomeworkDeadlineICS(lesson:CalendarLesson,now=Date.now()){
  if(!hasHomeworkDeadline(lesson.dueAt,now))throw Error('Chưa có hạn nộp đã xác nhận còn hiệu lực để thêm vào lịch.');
  if(!Number.isSafeInteger(now)||now<0||now>MAX_ICS_TIME)throw Error('Chưa xác định được thời gian tạo tệp lịch.');
  let date=lesson.dueAt;
  if(lesson.date!==undefined){
    const parsed=Date.parse(lesson.date+'T00:00:00+07:00');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(lesson.date)||!Number.isFinite(parsed)||new Date(parsed+7*3600000).toISOString().slice(0,10)!==lesson.date)throw Error('Ngày buổi học chưa hợp lệ để thêm vào lịch.');
    date=parsed;
  }
  const summary='Hạn BTVN MTM'+(lesson.date?' · buổi ':' · ')+new Date(date).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
  const uid=lessonDigest(lesson);
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Minh Thanh Math//Han BTVN//VI','CALSCALE:GREGORIAN',
    'BEGIN:VEVENT','UID:'+uid+'@minhthanhmath.vn','DTSTAMP:'+utc(now),'DTSTART:'+utc(lesson.dueAt),
    'DTEND:'+utc(lesson.dueAt+EVENT_MS),'SUMMARY:'+escapeCalendarText(summary),
    'DESCRIPTION:Hạn theo lịch lớp. Mở BTVN trên website MTM để kiểm tra lại nếu lịch thay đổi.',
    'URL:https://www.minhthanhmath.vn/btvn','BEGIN:VALARM','TRIGGER:-PT15M','ACTION:DISPLAY','DESCRIPTION:Hạn nộp BTVN MTM','END:VALARM',
    'END:VEVENT','END:VCALENDAR'];
  return lines.map(foldCalendarLine).join('\r\n')+'\r\n';
}
