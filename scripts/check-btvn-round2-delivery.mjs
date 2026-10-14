import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base='T:/Claude/SanPham/btvn-web-diem-danh/phieu-a/';
const hash=b=>createHash('sha256').update(b).digest('hex');
const files=readdirSync('dist/assets').filter(f=>/\.(js|css)$/.test(f));
const leaked=files.filter(f=>/HS-TEST-0[1-5]|09000000\d{2}|FAKE-SHEET|Nguyễn Thử Một|Học sinh thử Một|1VeSHq3Gx2WJn8F7HHC11oj9cx9132MxFcUzBrJYfRF4/.test(readFileSync('dist/assets/'+f,'utf8')));
assert.deepEqual(leaked,[]);
const protectedFiles=['src/native/exams/FocusRoom.tsx','src/native/exams/focus-room.css','src/native/chapters/PracticeShelf.tsx','src/native/chapters/practice-bank.ts'].map(file=>{
  const current=readFileSync(file),original=execFileSync('git',['show','HEAD:'+file],{maxBuffer:20*1024*1024});
  const normalized=b=>b.toString('utf8').replace(/\r\n/g,'\n');assert.equal(hash(normalized(current)),hash(normalized(original)));
  return {file,sha256:hash(current),unchanged:true};
});
const run=JSON.parse(readFileSync(base+'WATCHER-QA-DOT-2.json'));assert.equal(run.passed,true);
const staged=execFileSync('git',['diff','--cached','--name-only'],{encoding:'utf8'}).trim();assert.equal(staged,'');
const sourceFiles=['src/App.tsx','src/migration/route-policy.ts','src/native/homework/HomeworkSession.tsx','src/native/homework/btvn-contract.ts',...readdirSync('server/btvn').filter(f=>/\.(ts|json)$/.test(f)).map(f=>'server/btvn/'+f),'scripts/watch-btvn-materials.mjs','scripts/check-btvn-http.mjs','scripts/check-btvn-round2-delivery.mjs','tests/exams-btvn.test.mts','tests/exams-btvn-round2.test.mts','tsconfig.btvn.json'];
const report={at:new Date().toISOString(),branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),staged:false,
  privacy:{directory:'dist/assets',scanned:files.length,leaked,passed:true},protectedFiles,
  sources:sourceFiles.map(file=>({file,sha256:hash(readFileSync(file))})),
  artifacts:['BIEN-BAN-DOT-2.md','DE-XUAT-KY-THUAT.md','CACH-CHAY-THU.md','BAI-HOC-DOT-2.md','ket-qua-gia-dot-2.csv','WATCHER-QA-DOT-2.json','npm-test-dot-2.log','test-dot-2-final.log','build-dot-2.log','tsc-dot-2.log','bundle-dot-2.log'].map(file=>({file,sha256:hash(readFileSync(base+file))})),
  tests:'13/13 test files; log attached',typescript:true,build:true,bundle:true,realStudentDataRead:false,liveSheetsTested:false,httpNetworkRound2Tested:false,browserVerified:false,claudeReview:false,javisReview:false,bridgeSent:false,notionUpdated:false,scheduled:false,serviceCreated:false,published:false};
assert.match(readFileSync(base+'npm-test-dot-2.log','utf8'),/13\/13/);
assert.match(readFileSync(base+'test-dot-2-final.log','utf8'),/1\/1/);
assert.match(readFileSync(base+'build-dot-2.log','utf8'),/built in/);
assert.equal(readFileSync(base+'tsc-dot-2.log','utf8').trim(),'');
writeFileSync(base+'FINAL-RECEIPT-DOT-2.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({privacyPassed:true,scanned:files.length,protectedUnchanged:protectedFiles.length,staged:false,published:false}));
