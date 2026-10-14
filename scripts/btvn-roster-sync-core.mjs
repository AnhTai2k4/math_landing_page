// Server/operator-only. Import không đọc file/env, không mạng; test tiêm transport.
import {createHash} from 'node:crypto';
export const digest=value=>createHash('sha256').update(value).digest('hex');
export function makeSyncPayload(bundle,config){
 if(!bundle?.sheetId||!Array.isArray(bundle.students)||!bundle.students.length||!bundle.registry||config.legacyReconciled!==true)throw Error('Cần bundle và đối soát legacy');
 const sheetHash=digest(bundle.sheetId),seen=new Set();
 const students=bundle.students.map(s=>{
  if(!/^HS-[0-9a-f]{32}$/i.test(s.studentCode??'')||seen.has(s.studentCode.toUpperCase()))throw Error('Mã nội bộ không hợp lệ/trùng');
  seen.add(s.studentCode.toUpperCase());
  if(!Object.values(bundle.registry).includes(s.studentCode))throw Error('Registry thiếu định danh');
  const sourceIdentity=`btvn:${sheetHash}:${digest(s.studentCode.toUpperCase())}`;
  return {sourceIdentity,proposedCode:s.studentCode.toUpperCase(),fullName:s.fullName,phone:s.phone??'',parentPhone:s.parentPhone??'',cohort:s.cohort,className:s.className,...(config.legacyMappings?.[s.studentCode]?{studentId:config.legacyMappings[s.studentCode]}:{})};
 });
 const labels=[...new Set(students.map(s=>s.className))];
 const classes=labels.map(label=>{const grade=config.classGrades?.[label];if(!Number.isInteger(grade)||grade<6||grade>12)throw Error('Cần grade đã xác minh cho mọi lớp');return {label,grade};});
 return {sheetId:bundle.sheetId,sheetHash,legacyReconciled:true,excluded:bundle.excluded??0,students,classes};
}
export async function callOperatorRpc(name,args,env,fetchImpl=fetch){
 if(!['mtm_btvn_sync_roster','mtm_btvn_configure_publish_scope'].includes(name))throw Error('RPC ngoài phạm vi');
 const base=new URL(env.SUPABASE_URL??'');
 if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash||!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Cấu hình operator chưa đủ');
 const response=await fetchImpl(new URL(`/rest/v1/rpc/${name}`,base),{method:'POST',redirect:'error',signal:AbortSignal.timeout(120000),headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(args)});
 if(!response.ok)throw Error('RPC chưa hoàn tất; đối soát riêng trước thử lại');
 return response.json();
}
export const codeCsv=rows=>'\uFEFF'+[['ho_ten','lop','khoa','ma','trang_thai'],...rows.map(s=>[s.fullName,s.className,s.cohort,s.code??'',s.code?'ma_da_doi_chieu':'giu_ma_cu_thieu_ban_tho'])].map(r=>r.map(v=>'"'+String(v??'').replace(/^[\s]*[=+\-@]/,"'$&").replace(/"/g,'""')+'"').join(',')).join('\r\n')+'\r\n';
