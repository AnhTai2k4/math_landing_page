// Một request qua stdin, một văn bản qua stdout. Không mạng, không ghi dữ liệu.
import {buildClassReport,bestReceipt} from '../../server/btvn/scorebook.ts';
import {classOpeningTimes} from '../../server/btvn/class-schedule.ts';
import schedule from '../../server/btvn/class-schedule.json';

export function renderReport({rows,sessions,lop,so_buoi=1,now=Date.now()}){
 if(!Array.isArray(rows)||!Array.isArray(sessions)||!Number.isFinite(now)||!Number.isInteger(so_buoi)||so_buoi<1||so_buoi>20)throw Error();
 const own=rows.filter(r=>r.className===lop&&r.date>='2026-10-01'&&!r.sourceIdentity?.startsWith('qa:')&&Date.parse(classOpeningTimes({classNames:[lop],date:r.date})[lop])<=now);
 const lessons=[...new Map(own.map(r=>[r.lessonCode,r])).values()].sort((a,b)=>b.date.localeCompare(a.date)||a.lessonCode.localeCompare(b.lessonCode)).slice(0,so_buoi);
 const clean=v=>String(v).replace(/[\r\n|\x00-\x1f\x7f]/g,' ').replace(/\+?\d(?:[ .-]*\d){8,14}/g,'[đã ẩn số]').trim();
 // Dữ liệu ô Sheet/tiêu đề là text, không được chèn dòng mới hoặc giả mục báo cáo.
 const reportRows=own.map(r=>({...r,fullName:clean(r.fullName),title:clean(r.title)}));
 const reports=lessons.map(r=>buildClassReport(reportRows,r.lessonCode,lop,now));
 const tables=lessons.map(lesson=>[
  `${lesson.date} | ${clean(lesson.title)}`,
  'Họ tên | Điểm cao nhất | Muộn | Chưa nộp',
  ...own.filter(r=>r.lessonCode===lesson.lessonCode).map(r=>{const best=bestReceipt(r);return `${clean(r.fullName)} | ${best?best.score.toLocaleString('vi-VN',{maximumFractionDigits:2}):'Chưa có'} | ${best?(best.late===null?'Chờ xác minh':best.late?'Có':'Không'):'-'} | ${best?'Không':'Có'}`;})
 ].join('\n'));
 const ended=s=>{
  const at=Date.parse(s.startsAt);if(!Number.isFinite(at))throw Error();
  const day=s.startsAt.slice(0,10),weekday=new Date(day+'T00:00:00Z').getUTCDay()||7;
  const slot=schedule[lop]?.find(v=>v.weekday===weekday&&v.start===s.startsAt.slice(11,16));
  return Date.parse(day+'T'+(slot?.end??'23:59')+':00+07:00')<=now;
 };
 const latest=sessions.filter(s=>s.label===lop&&ended(s)).sort((a,b)=>Date.parse(b.startsAt)-Date.parse(a.startsAt));
 let attendance='Chưa có buổi điểm danh đã học được xác minh cho lớp này.';
 if(latest.length){
  const session=latest[0];
  if(latest.filter(s=>s.startsAt===session.startsAt).length!==1)throw Error();
  const labels={C:'có mặt',M:'có mặt',L:'vắng có phép',P:'vắng có phép','PH P':'vắng có phép',K:'vắng',ON:'online'};
  if(!session.attendees.length||session.attendees.some(a=>!labels[a.status])){
   attendance=`Buổi ${session.startsAt.slice(0,16)}: chưa đủ trạng thái điểm danh đã xác minh, cần đối soát trước khi báo phụ huynh.`;
  }else attendance=[`Lớp ${lop}, buổi ${session.startsAt.slice(0,16)} (giờ Việt Nam)`,...session.attendees.map(a=>`${clean(a.name)} | ${labels[a.status]}`)].join('\n');
 }
 // Làm sạch cả nội dung buildClassReport nhưng giữ xuống dòng.
 return ['(a) TIN BÁO PHỤ HUYNH',reports.join('\n\n')||'Chưa có BTVN của buổi đã học cho lớp này.',
  '(b) BẢNG ĐIỂM NGẮN',tables.join('\n\n')||'Chưa có điểm.', '(c) ĐIỂM DANH',attendance].join('\n\n').split('\n').map(line=>line.replace(/\+?\d(?:[ .-]*\d){8,14}/g,'[đã ẩn số]')).join('\n');
}

try{
 let raw='';for await(const chunk of process.stdin){raw+=chunk;if(raw.length>24*1024*1024)throw Error();}
 process.stdout.write(renderReport(JSON.parse(raw)));
}catch{process.stderr.write('Chưa dựng được báo cáo lớp.');process.exitCode=1;}
