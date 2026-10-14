// Chỉ gọi RPC scope: không đọc bundle/roster. Mặc định dry-run.
import {callOperatorRpc} from './btvn-roster-sync-core.mjs';
const args=process.argv.slice(2);if(args.length>1||args.length===1&&args[0]!=='--live')throw Error('Chỉ nhận --live');
try{const result=await callOperatorRpc('mtm_btvn_configure_publish_scope',{p_labels:['2K9 9+','2K9 8+'],p_apply:args[0]==='--live'},process.env);console.log(JSON.stringify({applied:result.applied,classes:result.classes}));}catch{console.error('Scope chưa hoàn tất; kiểm owner/lớp đã đồng bộ.');process.exitCode=1;}
