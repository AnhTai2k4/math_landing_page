import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/migration/Notebook.tsx',import.meta.url),'utf8');
const rows:{name:string;pass:boolean;error?:string}[]=[];
function test(name:string,fn:()=>void){try{fn();rows.push({name,pass:true});}catch(e){rows.push({name,pass:false,error:e instanceof Error?e.message:String(e)});}}
test('Saved tasks expose an edit action',()=>assert.match(source,/aria-label=\{'Sửa việc '/));
test('Editing has explicit save and cancel controls',()=>{assert.match(source,/Lưu thay đổi/);assert.match(source,/Hủy sửa/);});
test('Calendar implements keyboard date movement',()=>{assert.match(source,/onKeyDown=\{e=>moveCalendarFocus/);assert.match(source,/ArrowRight/);assert.match(source,/PageDown/);});
test('Calendar uses a roving tab stop',()=>assert.match(source,/tabIndex=\{date===key\?0:-1\}/));
test('Changing day checks unsaved task text',()=>assert.match(source,/confirmDayChange/));
test('Cross-tab storage changes are surfaced',()=>assert.match(source,/addEventListener\('storage'/));
const failed=rows.filter(r=>!r.pass),report={checkedAt:new Date().toISOString(),scope:'NOTEBOOK_UI_SAFETY_CONTRACT',total:rows.length,passed:rows.length-failed.length,failed:failed.length,rows};
if(process.env.MTM_TEST_REPORT)writeFileSync(process.env.MTM_TEST_REPORT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:report.failed,failures:failed}));
process.exitCode=failed.length?1:0;
