/** Rebuild the published enrichment input from immutable cached text; no network or public writes. */
import {spawnSync} from 'node:child_process';
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(fileURLToPath(new URL('../../../..',import.meta.url)));
if(process.argv.length!==3)throw Error('Use reproduce.ts <new-output-directory>');
const out=resolve(process.argv[2]),pub=join(root,'apps/web/public'),rel=relative(pub,out);
if(!rel||(!rel.startsWith('..'+sep)&&rel!=='..'))throw Error('Output must be outside public');
await mkdir(out,{recursive:false});
const manifest=JSON.parse(await readFile(join(root,'data/evaluations/enrichment-provenance.json'),'utf8'));
const inputDate=JSON.parse(await readFile(join(root,manifest.inputs[0].path),'utf8')).generatedAt;
for(let i=1;i<=5;i++)await copyFile(join(root,`data/evaluations/enrichment-review-batch1/assignment-${i}.json`),join(out,`assignment-${i}.json`));
const run=(args:string[],exe=process.execPath)=>{const p=spawnSync(exe,args,{cwd:root,stdio:'inherit'});if(p.status!==0)throw Error(`Reproduction failed: ${args[0]}`);};
run(['apps/crawler/src/evaluations/enrichment/assignment1.mjs',root,out]);
run(['--import','tsx','apps/crawler/src/evaluations/enrichment/assignment2.ts','--assignment-file',join(out,'assignment-2.json'),'--output-dir',out,'--generated-at',inputDate]);
run(['--import','tsx','apps/crawler/src/evaluations/enrichment/build-assignment3.ts',root,out]);
run(['--import','tsx','apps/crawler/scripts/enrichment/build-assignment4.ts',out]);
run(['apps/crawler/scripts/enrichment/finalize-review4.py',out],'python3');
run(['--import','tsx','apps/crawler/scripts/enrichment/augment-assignment4-finance.ts',out]);
run(['--import','tsx','apps/crawler/src/evaluations/enrichment/assignment5.ts',root,out]);
const patches=[];
for(let i=1;i<=5;i++){
 patches.push(...JSON.parse(await readFile(join(out,`patches-${i}.json`),'utf8')).patches);
 assert.deepEqual(JSON.parse(await readFile(join(out,`review-${i}.json`),'utf8')),JSON.parse(await readFile(join(root,`data/evaluations/enrichment-review-batch1/review-${i}.json`),'utf8')),`Review ${i} differs`);
}
assert.equal(manifest.inputs.length,1);
const input={schemaVersion:1,generatedAt:inputDate,patches};
assert.deepEqual(input,JSON.parse(await readFile(join(root,manifest.inputs[0].path),'utf8')),'Published patches differ');
await writeFile(join(out,'all-patches.json'),JSON.stringify(input)+'\n');
console.log(JSON.stringify({reproduced:true,patches:patches.length,documents:578}));
