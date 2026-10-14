import {loadModule,option,operatorRpc} from './btvn-operator.mjs';
try{
 const args=process.argv.slice(2),lesson=option(args,'--lesson'),cls=option(args,'--class');if(!lesson||!cls)throw Error('Thiếu buổi/lớp');
 const {buildClassReport}=await loadModule('server/btvn/scorebook.ts');
 const rows=await operatorRpc('mtm_btvn_scorebook',{p_from:'2026-10-15',p_apply:false});
 console.log(buildClassReport(rows,lesson,cls));
}catch{console.error('Chưa dựng được tin báo nhóm lớp. Kiểm cấu hình và phạm vi buổi/lớp.');process.exitCode=1;}
