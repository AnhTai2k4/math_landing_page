// Đóng gói trên PC, VPS chạy Node 22 không cần repo/esbuild.
import {build} from 'esbuild';
import {resolve,dirname} from 'node:path';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const out=resolve(process.argv[2]??'.qa-temp/dot-21/attendance.bundle.mjs');
mkdirSync(dirname(out),{recursive:true});
await build({entryPoints:['tools/btvn-javis/attendance-entry.mjs'],bundle:true,platform:'node',format:'esm',target:'node22',outfile:out,logLevel:'error'});
const bytes=readFileSync(out),receipt={sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,source:'server/btvn/attendance-roster.ts + attendance-sheet.ts'};
writeFileSync(out+'.receipt.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
