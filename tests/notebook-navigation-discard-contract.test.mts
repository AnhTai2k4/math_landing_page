import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/migration/Notebook.tsx',import.meta.url),'utf8');
const rows:{name:string;pass:boolean;error?:string}[]=[];
function test(name:string,fn:()=>void){try{fn();rows.push({name,pass:true});}catch(e){rows.push({name,pass:false,error:e instanceof Error?e.message:String(e)});}}
test('Confirmed internal navigation has a dedicated discard operation',()=>assert.match(source,/function discardSessionDraft\(\)/));
test('Discard synchronously removes the same-tab recovery payload',()=>assert.match(source,/discardSessionDraft[\s\S]*sessionStorage\.removeItem\(DRAFT_KEY\)/));
test('Canceling navigation explicitly prevents the route change',()=>assert.match(source,/if\(!confirm\('Có nội dung sổ tay chưa lưu[\s\S]*e\.preventDefault\(\);return;/));
test('Storage failure blocks navigation instead of resurrecting discarded text',()=>assert.match(source,/if\(!discardSessionDraft\(\)\)e\.preventDefault\(\)/));
test('Storage failure has a visible Vietnamese explanation',()=>assert.match(source,/Không thể bỏ phần chưa lưu/));
const failed=rows.filter(r=>!r.pass),report={checkedAt:new Date().toISOString(),scope:'NOTEBOOK_INTERNAL_NAVIGATION_DISCARD_CONTRACT',total:rows.length,passed:rows.length-failed.length,failed:failed.length,rows};
if(process.env.MTM_TEST_REPORT)writeFileSync(process.env.MTM_TEST_REPORT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:report.failed,failures:failed}));process.exitCode=failed.length?1:0;
