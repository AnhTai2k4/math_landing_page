// Soạn tin báo phụ huynh cho MỌI lớp: mỗi lớp lấy các buổi BTVN đã mở, ghi một tệp .txt/lớp vào thư mục riêng tư.
// node scripts/report-btvn-all.mjs --out <thư mục riêng tư>
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {loadModule,option,operatorRpc} from './btvn-operator.mjs';
try{
 const args=process.argv.slice(2),out=option(args,'--out');if(!out)throw Error('Cần --out <thư mục>');
 const {buildClassReport}=await loadModule('server/btvn/scorebook.ts');
 const rows=await operatorRpc('mtm_btvn_scorebook',{p_from:'2026-10-15',p_apply:false});
 const pairs=[...new Map(rows.filter(r=>r.date>='2026-10-01'&&!r.sourceIdentity?.startsWith('qa:')).map(r=>[r.className+'|'+r.lessonCode,[r.className,r.lessonCode,r.date]])).values()].sort((a,b)=>a[0].localeCompare(b[0])||b[2].localeCompare(a[2]));
 mkdirSync(out,{recursive:true});const byClass={};
 for(const [cls,lesson] of pairs){try{(byClass[cls]??=[]).push(buildClassReport(rows,lesson,cls));}catch{}}
 for(const [cls,texts] of Object.entries(byClass))writeFileSync(join(out,'tin-bao-ph-'+cls.replace(/[^0-9A-Za-zÀ-ỹ+]+/g,'-')+'.txt'),texts.join('\n\n---\n\n')+'\n');
 console.log(JSON.stringify({lop:Object.keys(byClass).length,buoi:pairs.length}));
}catch{console.error('Chưa soạn được tin báo. Kiểm cấu hình RPC.');process.exitCode=1;}
