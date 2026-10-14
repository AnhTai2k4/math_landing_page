import {normalizeName,normalizePhone} from './roster';
export type AttendanceSession={classKey:string;label:string;startsAt:string;sourceIdentity:string;attendees:{name:string;phone:string;status:string}[]};
export type AttendanceMap={schoolYear:number;classes:Record<string,string>;fromDate?:string;toDate?:string};
/** Trả C/M/ON (có học), L/K (vắng), '' (trống) hoặc null (ghi chú không rõ, coi như không học). */
export function classifyCell(raw:string):string|null{
 const v=raw.trim(),n=normalizeName(v);if(!v)return '';
 if(/^on(l|line)?\b/.test(n)||/^c\s*\(\s*onl/.test(n))return 'ON';
 if(/^[cm]\b/.test(n))return n[0].toUpperCase();
 if(/^[lk]\b/.test(n))return n[0].toUpperCase();
 if(/^(p|ph)\b/.test(n)||/\bnghi\b|\bphep\b/.test(n))return 'L';
 if(/^(vao|den) muon/.test(n))return 'M';
 // Ghi chú "đã học bù T2", "chỉ học tối T6", "học hôm CN", "chuyển về lớp 9+", "ko đăng ký học nữa", "xin học bổ trợ..."
 // đều nghĩa là không học ở ca này.
 if(/^(buoi|du kien|doi|hoc|da hoc|chi hoc|chuyen|ko |khong|xin|nghi)/.test(n))return '';
 return null;
}
/** Chỉ đọc snapshot, khối chưa ánh xạ hoặc ghi chú mơ hồ cần đối soát. */
export function parseAttendanceSheet(snapshot:Record<string,string[][]>,config:AttendanceMap){
 if(!Number.isInteger(config.schoolYear)||config.schoolYear<2000||config.schoolYear>2200)throw Error('Năm học không hợp lệ');
 const mapping=Object.fromEntries(Object.entries(config.classes).map(([key,label])=>[normalizeName(key),label]));
 const sessions:AttendanceSession[]=[],pending:{tab:string;row:number;reason:string}[]=[];let blocks=0;
 for(const [tab,rows] of Object.entries(snapshot)){
  if(!/^(Thứ [2-7]|Chủ nhật)$/.test(tab))continue;
  const header=rows.find(r=>r[1]?.trim()==='TÊN LỚP');if(!header)throw Error('Thiếu hàng ngày');
  let current:{key:string;label:string;time:string}|null=null;
  for(const [i,row] of rows.entries()){
   const match=/^Lớp \(([^)]+)\)/i.exec(row[0]??'');
   if(match){blocks++;current=null;const key=normalizeName(match[1].split(/\s+-\s+/)[0]);const label=mapping[key];
    const time=/^(\d{1,2})(?:h(\d{2})?)?\s*-/.exec(row[1]??'');
    if(!label||!time||+time[1]>23||+(time[2]??0)>59){pending.push({tab,row:i+1,reason:'Khối chưa ánh xạ hoặc giờ không hợp lệ'});continue;}
    current={key,label,time:time[1].padStart(2,'0')+':'+(time[2]??'00')};continue;
   }
   if(!current)continue;const phone=normalizePhone(row[1]??'');if(!phone)continue;
   const name=(row[0]??'').trim();if(!name)continue;
   // Học sinh nghỉ hẳn/tạm nghỉ ghi ngay trong ô tên: bỏ cả dòng.
   if(/nghi han|tam nghi/.test(normalizeName(name)))continue;
   for(let col=2;col<header.length;col++){
    const d=/^(\d{1,2})\/(\d{1,2})$/.exec(header[col]?.trim()??'');if(!d)continue;
    const year=config.schoolYear+(+d[2]<6?1:0),date=`${year}-${d[2].padStart(2,'0')}-${d[1].padStart(2,'0')}`;
    if(new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('Ngày không hợp lệ');
    // 15/10 (Claude, theo sổ thật): ô thường kèm ghi chú "C (...)", "PH xin nghỉ...".
    // Xếp theo chữ đầu; ghi chú khác (buổi 1, dự kiến, đổi lịch) không tính có học nhưng không loại cả dòng.
    // Buổi trước mốc không ảnh hưởng hạn nộp; gửi cả năm làm RPC quá thời gian (15/10).
    if(config.fromDate&&date<config.fromDate||config.toDate&&date>config.toDate)continue;
    const status=classifyCell(row[col]??'');
    if(status===null){if(!config.fromDate||date>=config.fromDate)pending.push({tab,row:i+1,reason:'Ghi chú cần xác nhận'});continue;}
    const startsAt=date+'T'+current.time+':00+07:00',sourceIdentity=`diem-danh:${tab}:${date}:${current.time}:${current.key}`;
    let session=sessions.find(s=>s.sourceIdentity===sourceIdentity);
    if(!session){session={classKey:current.key,label:current.label,startsAt,sourceIdentity,attendees:[]};sessions.push(session);}
    session.attendees.push({name,phone,status});
   }
  }
 }
 return {sessions,pending,blocks};
}
