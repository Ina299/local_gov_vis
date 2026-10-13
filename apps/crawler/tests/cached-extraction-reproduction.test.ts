import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
test('published additions reproduce byte-for-byte from hash-checked cached text, including every field evidence range',()=>{
 const temp=mkdtempSync(join(tmpdir(),'cached-evaluation-'));
 try{
  for(const name of readdirSync(join(root,'data/evaluations')).filter(n=>/^cached-extraction-audit(?:-batch\d+)?\.json$/.test(n))){
  const audit=JSON.parse(readFileSync(join(root,'data/evaluations',name),'utf8'));
  execFileSync(process.execPath,['--import','tsx','apps/crawler/src/extract-cached-evaluations.ts','--output-dir',join(temp,'shards'),'--generated-at',audit.generatedAt,'--codes',audit.municipalities.map((r:{code:string})=>r.code).join(',')],{cwd:root,stdio:'pipe'});
  for(const row of audit.municipalities)assert.deepEqual(readFileSync(join(temp,'shards',`${row.code}.json`)),readFileSync(join(root,'apps/web/public/evaluations-municipal',`${row.code}.json`)));
  assert.deepEqual(JSON.parse(readFileSync(join(temp,'extraction-audit.json'),'utf8')),audit);
  }
 }finally{rmSync(temp,{recursive:true,force:true});}
});
