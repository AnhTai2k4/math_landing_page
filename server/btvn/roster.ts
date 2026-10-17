import {randomBytes} from 'node:crypto';
import type {Student} from './repository';

export const normalizeName=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').trim().replace(/\s+/g,' ').toLowerCase();
export function normalizePhone(s:string){
  const n=s.replace(/[\s().-]/g,'').replace(/^\+84/,'0');
  return /^0\d{9}$/.test(n)?n:'';
}
export type RosterColumns={fullName:string;phone:string;parentPhone:string;parentName?:string;className:string;leave:string;birthDate:string};
export type RosterConfig={sheetId:string;enabled?:boolean;tabs:{tab:string;className:string;cohort?:string}[];columns:RosterColumns;outputDir?:string};
/** Kho ghép riêng tư phải được lưu atomically phía server, không đưa vào public/Git. */
export type IdentityRegistry=Record<string,string>;
export function importRoster(headers:string[],rows:string[][],config:RosterConfig,tab:string,registry:IdentityRegistry){
  const tabConfig=config.tabs.find(t=>t.tab===tab);if(!tabConfig)throw new Error('Tab chưa cấu hình');
  for(const column of Object.values(config.columns))if(headers.filter(h=>h===column).length!==1)throw new Error('Thiếu/trùng cột cấu hình');
  const students:Student[]=[],nextRegistry={...registry},seen=new Set<string>();let excluded=0;
  for(const row of rows){
    const cell=(key:keyof RosterColumns)=>String(row[headers.indexOf(config.columns[key]??'')]??'').trim();
    if(!cell('fullName'))continue;
    const notes=normalizeName(cell('fullName')+' '+cell('leave'));
    if(/nghi han|hoc 1 buoi roi nghi|tam nghi/.test(notes)){excluded++;continue;}
    const transfer=/chuyen (?:sang )?lop/.test(notes);
    const destination=transfer?config.tabs.filter(t=>notes.replace(/[()[\]]/g,'').trim().endsWith(normalizeName(t.className))):[];
    if(transfer&&destination.length!==1)throw new Error('Chuyển lớp chưa xác minh đích');
    // Ngày nghỉ bất kỳ khác cần quản lý xác minh, không tự suy ra còn học.
    if(cell('leave')&&!transfer){excluded++;continue;}
    const fullName=cell('fullName').replace(/[([]?\s*(?:CHUYỂN|CHUYEN)\s+(?:SANG\s+)?(?:LỚP|LOP).*$/iu,'').replace(/\(?\bONLINE\b\)?/gi,'').trim();
    if(!fullName)throw new Error('Thiếu tên sau tách ghi chú');
    const target=transfer?destination[0]:tabConfig;
    const className=transfer?target.className:cell('className')||tabConfig.className;
    if(!transfer&&normalizeName(className)!==normalizeName(tabConfig.className))throw new Error('Lớp không khớp cấu hình');
    const phone=normalizePhone(cell('phone')),parentPhone=normalizePhone(cell('parentPhone'));
    if(!phone&&!parentPhone)throw new Error('Cần đối soát số liên hệ');
    // Không dùng STT, thứ tự dòng hoặc số điện thoại làm mã. Đổi tên/ngày sinh/lớp cần đối soát alias trước import.
    const identity=JSON.stringify([normalizeName(fullName),cell('birthDate'),normalizeName(className)]);
    if(seen.has(identity))throw new Error('Định danh trùng: cần đối soát riêng');seen.add(identity);
    const oldIdentity=JSON.stringify([normalizeName(fullName),cell('birthDate'),normalizeName(tabConfig.className)]);
    if(transfer&&nextRegistry[identity]&&nextRegistry[oldIdentity]&&nextRegistry[identity]!==nextRegistry[oldIdentity])throw new Error('Hai mã chuyển lớp cần đối soát');
    const studentCode=nextRegistry[identity]??(transfer?nextRegistry[oldIdentity]:undefined)??('HS-'+randomBytes(16).toString('hex'));
    nextRegistry[identity]=studentCode;if(transfer)nextRegistry[oldIdentity]=studentCode;
    students.push({studentCode,fullName,phone,parentPhone,...(config.columns.parentName?{parentName:cell('parentName')}:{}),className,cohort:target.cohort??/^2K\d+/i.exec(className)?.[0]??''});
  }
  // Registry có thể có alias lịch sử cùng mã; hai người đang nhập không được dùng chung mã.
  if(new Set(students.map(s=>s.studentCode)).size!==students.length)throw new Error('Trùng mã nội bộ');
  return {students,registry:nextRegistry,excluded};
}
/** Dependency injection: Claude cấp trình đọc đã xác thực; Codex chỉ test bằng hàm giả. */
export async function readRosterSheet(config:RosterConfig,read:(sheetId:string,tab:string)=>Promise<string[][]>,registry:IdentityRegistry){
  if(config.enabled===false)throw new Error('Nhập danh sách đang tắt');
  let next={...registry};const students:Student[]=[];let excluded=0;
  // Đọc ghi chú chuyển trước tab đích để giữ mã cũ bất kể thứ tự tab.
  const snapshots=await Promise.all(config.tabs.map(async tab=>({tab,values:await read(config.sheetId,tab.tab)})));
  const ordered=snapshots.sort((a,b)=>Number(b.values.slice(1).some(r=>/chuyen (?:sang )?lop/.test(normalizeName(r.join(' ')))))-Number(a.values.slice(1).some(r=>/chuyen (?:sang )?lop/.test(normalizeName(r.join(' '))))));
  for(const {tab,values} of ordered){const [headers,...rows]=values;if(!headers)throw new Error('Tab rỗng');
    const result=importRoster(headers,rows,config,tab.tab,next);next=result.registry;
    for(const student of result.students){const previous=students.find(s=>s.studentCode===student.studentCode);
      if(previous){if(JSON.stringify(previous)!==JSON.stringify(student))throw new Error('Hai dòng cùng mã khác hồ sơ cần đối soát');}
      else students.push(student);}
    excluded+=result.excluded;}
  if(new Set(students.map(s=>s.studentCode)).size!==students.length)throw new Error('Mã trùng giữa các tab');
  return {students,registry:next,excluded};
}
