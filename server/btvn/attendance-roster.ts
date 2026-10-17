import type {AttendanceMap} from './attendance-sheet';
export type AttendanceRow={label:string;fullName:string;phone:string;source:string;school?:string};
const fold=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/\s*[\(\[].*$/,'').replace(/\s+/g,' ').trim();
const phones=(s:unknown)=>(String(s??'').match(/\d[\d .\-]{7,}\d/g)??[]).map(x=>x.replace(/\D/g,'').slice(-9)).filter(x=>x.length===9);
/** Không DB. knownPhonesByCohort là {"2K9":[SĐT,...]}; thiếu thì bỏ kiểm lẫn khoá. */
export function buildAttendanceRoster(tabs:Record<string,string[][]>,config:Pick<AttendanceMap,'classes'>,knownPhonesByCohort?:Record<string,string[]>){
 const map=Object.fromEntries(Object.entries(config.classes).map(([k,v])=>[k.toLowerCase().trim(),v]));
 const keys=Object.keys(map).sort((a,b)=>b.length-a.length);
 const known=new Map<string,Set<string>>();
 for(const [cohort,list] of Object.entries(knownPhonesByCohort??{}))for(const phone of list)for(const p of phones(phone)){
  if(!known.has(p))known.set(p,new Set());known.get(p)!.add(cohort);
 }
 const blocks:{label:string|null;source:string;rows:{fullName:string;phone:string;school?:string}[]}[]=[];
 for(const [tab,rows] of Object.entries(tabs)){
  let cur:typeof blocks[number]|null=null,schoolColumn=-1;
  const hsa=()=>/chủ nhật/i.test(tab)?'2K9 HSA (CN)':/thứ 5/i.test(tab)?'2K9 HSA (THỨ 5)':null;
  for(const [i,row] of rows.entries()){
   const schoolHeader=row.findIndex(cell=>/^(truong|truong hoc|truong dang hoc)$/.test(fold(String(cell??''))));
   if(schoolHeader>=0){schoolColumn=schoolHeader;continue;}
   const c0=String(row?.[0]??'').trim();
   const m=c0.match(/^Lớp\s*\(([^)]*)\)/i)||c0.match(/^Lớp\s+(HSA)\s*\((2K9)\)/i);
   if(m||/^HSA$/i.test(c0)){
    const key=m?.[1].toLowerCase().trim()??'hsa';
    const label=/hsa/i.test(key)?hsa():map[key]??map[keys.find(k=>key.startsWith(k))??'']??null;
    cur={label,source:`${tab}#${i}`,rows:[]};blocks.push(cur);continue;
   }
   if(!cur?.label||/nghỉ hẳn|tạm nghỉ|đã nghỉ|chuyển lớp/i.test(row.join(' '))||!/[a-zà-ỹ]{2,}\s+[a-zà-ỹ]/i.test(c0))continue;
   const ph=phones(row[1]);
   if(ph.length){
    const raw=schoolColumn>=0?String(row[schoolColumn]??''):'';
    if(raw.length>160||/[\u0000-\u001f\u007f-\u009f]/.test(raw))throw Error('Trường học trong sổ điểm danh không hợp lệ');
    const school=raw.normalize('NFC').trim().replace(/\s+/g,' ');
    cur.rows.push({fullName:c0.replace(/\s*[\(\[].*$/,'').trim(),phone:'0'+ph[0],...(schoolColumn>=0?{school:['chưa cập nhật','chua cap nhat'].includes(school.toLowerCase())?'':school}:{})});
   }
  }
 }
 const rows:AttendanceRow[]=[],seen=new Set<string>();let skippedMixedBlocks=0;
 for(const b of blocks){
  if(!b.label)continue;
  const cohort=b.label.split(' ')[0],matched=b.rows.filter(r=>known.has(r.phone.slice(-9)));
  const same=matched.filter(r=>known.get(r.phone.slice(-9))!.has(cohort));
  if(matched.length>=3&&same.length/matched.length<0.5){skippedMixedBlocks++;continue;}
  for(const r of b.rows){const key=b.label+'|'+fold(r.fullName)+'|'+r.phone;if(seen.has(key))continue;seen.add(key);rows.push({label:b.label,...r,source:b.source});}
 }
 return {rows,blocks:blocks.filter(b=>b.label).length,skippedMixedBlocks};
}
