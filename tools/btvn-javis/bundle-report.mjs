import {build} from 'esbuild';
import {resolve,dirname} from 'node:path';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const out=resolve(process.argv[2]??'.qa-temp/dot-22/report.bundle.mjs');
mkdirSync(dirname(out),{recursive:true});
await build({entryPoints:['tools/btvn-javis/report-entry.mjs'],bundle:true,platform:'node',format:'esm',target:'node22',outfile:out,logLevel:'error'});
const bytes=readFileSync(out),receipt={sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,source:'buildClassReport + bestReceipt + class-schedule'};
writeFileSync(out+'.receipt.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
