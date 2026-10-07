import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/migration/Notebook.tsx',import.meta.url),'utf8');
const rows:{name:string;pass:boolean;error?:string}[]=[];
function test(name:string,fn:()=>void){try{fn();rows.push({name,pass:true});}catch(e){rows.push({name,pass:false,error:e instanceof Error?e.message:String(e)});}}
test('Session draft uses a dedicated versioned key',()=>assert.match(source,/DRAFT_KEY='mtm:guest-notebook:draft:v1'/));
test('Draft is read from sessionStorage',()=>assert.match(source,/sessionStorage\.getItem\(DRAFT_KEY\)/));
test('Dirty task and goal input are written to sessionStorage',()=>assert.match(source,/sessionStorage\.setItem\(DRAFT_KEY/));
test('Saved or discarded input removes the recovery payload',()=>assert.match(source,/sessionStorage\.removeItem\(DRAFT_KEY\)/));
test('Recovery payload has a strict size bound',()=>assert.match(source,/12000/));
test('Recovered input is announced to the user',()=>assert.match(source,/Đã khôi phục phần chưa lưu/));
test('Invalid recovery payload is reported without blocking saved notebook data',()=>assert.match(source,/Bản nháp phục hồi không hợp lệ/));
const failed=rows.filter(r=>!r.pass),report={checkedAt:new Date().toISOString(),scope:'NOTEBOOK_SESSION_DRAFT_RECOVERY_CONTRACT',total:rows.length,passed:rows.length-failed.length,failed:failed.length,rows};
if(process.env.MTM_TEST_REPORT)writeFileSync(process.env.MTM_TEST_REPORT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:report.failed,failures:failed}));process.exitCode=failed.length?1:0;
