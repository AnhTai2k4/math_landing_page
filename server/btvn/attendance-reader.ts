import {normalizeName,normalizePhone} from './roster';
/** Dòng/cột đánh số từ 0. Định danh nguồn ghép UUID do Claude đối soát,
 * không tự ghép người chỉ theo tên hoặc suy từ lớp 8+/9+. */
export type AttendanceConfig={tab:string;identityMap?:Record<string,string>;blocks:{key:string;firstRow:number;lastRow:number;startsAt:string;nameColumn:number;phoneColumn:number;identityColumn?:number;dateColumns:{column:number;date:string}[]}[]};
export const attendanceIdentityKey=(name:string,phone:string)=>JSON.stringify([normalizeName(name),normalizePhone(phone)]);
export type AttendanceSlot={sourceIdentity:string;fullName:string;phone:string;startsAt:number;source:string};
export function readAttendance(rows:string[][],config:AttendanceConfig){
  const slots:AttendanceSlot[]=[],pending:{source:string;reason:string}[]=[];
  for(const block of config.blocks){
    if(!block.key||!Number.isInteger(block.firstRow)||!Number.isInteger(block.lastRow)||block.firstRow<0||block.lastRow<block.firstRow||!/^([01]\d|2[0-3]):[0-5]\d$/.test(block.startsAt))throw new Error('Cấu hình khối ca không hợp lệ');
    const columns=[block.nameColumn,block.phoneColumn,...(block.identityColumn===undefined?[]:[block.identityColumn]),...block.dateColumns.map(d=>d.column)];
    if(columns.some(c=>!Number.isInteger(c)||c<0)||new Set(columns).size!==columns.length)throw new Error('Cột trùng hoặc không hợp lệ');
    for(const d of block.dateColumns){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!Number.isFinite(Date.parse(d.date))||new Date(d.date+'T00:00:00Z').toISOString().slice(0,10)!==d.date)throw new Error('Ngày ca phải có năm và hợp lệ');
      const startsAt=Date.parse(d.date+'T'+block.startsAt+':00+07:00');
      for(let i=block.firstRow;i<=block.lastRow;i++){
        const row=rows[i]??[],name=row[block.nameColumn]?.trim();if(!name)continue;
        const source=`${config.tab}/${block.key}/${i+1}/${d.column+1}`;
        const phone=normalizePhone(row[block.phoneColumn]??''),identity=block.identityColumn===undefined?config.identityMap?.[attendanceIdentityKey(name,phone)]:row[block.identityColumn]?.trim();
        const earlier=block.dateColumns.filter(x=>x.date<=d.date).map(x=>(row[x.column]??'').trim());
        // Các ghi chú thay lịch/ngày bắt đầu cần người đối soát; không đoán hiệu lực.
        if(/NGHỈ HẲN/i.test(name)||earlier.some(x=>/NGHỈ HẲN/i.test(x)))continue;
        if(!identity||!phone||!normalizeName(name)||/ĐỔI LỊCH|DỰ KIẾN|BUỔI 1|XIN NGHỈ|TẠM NGHỈ/i.test(name)||earlier.some(x=>!['','C','C (onl)','M','L','K','P','PH P'].includes(x))){
          pending.push({source,reason:'Thiếu định danh đã đối soát hoặc ghi chú cần xác nhận'});continue;
        }
        slots.push({sourceIdentity:identity,fullName:name,phone,startsAt,source});
      }
    }
  }
  return {slots,pending};
}
export function nextActualClass(slots:AttendanceSlot[],identity:string,after:number){
  if(!identity||!Number.isFinite(after))throw new Error('Thiếu định danh/mốc buổi trước');
  return slots.filter(s=>s.sourceIdentity===identity&&s.startsAt>after).sort((a,b)=>a.startsAt-b.startsAt)[0]??null;
}
export async function readAttendanceSource(config:AttendanceConfig,read:(tab:string)=>Promise<string[][]>){return readAttendance(await read(config.tab),config);}
