import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractAsakawa } from '../src/evaluations/expansion/asakawa';
const doc=JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/519f5827b43940e59ccfc9e2.json',import.meta.url),'utf8'));
test('Asakawa keeps individual education assessments and excludes policy totals and shared comments',()=>{
 const records=extractAsakawa(doc);assert.equal(records.length,28);
 assert.ok(records.every(p=>p.evaluationYear===null&&p.evaluatedFiscalYear===2021&&p.amounts.length===0));
 assert.equal(records.find(p=>p.projectName==='中央公民館耐震補強事業')?.ratings[0].value,'Ｃ');
 assert.equal(records.find(p=>p.projectName==='文化祭、芸能祭')?.ratings[0].value,'Ｂ');
 for(const p of records){assert.equal(p.ratings.length,1);assert.ok(!p.evidence[0].rawText.includes('評価委員の評価'));for(const e of p.evidence)assert.ok(doc.text.includes(e.rawText));}
});
test('Asakawa does not publish rows cut off before the reviewed closing boundary',()=>{
 const cut=doc.text.indexOf('◎町武道館 完了');
 assert.equal(extractAsakawa({...doc,text:doc.text.slice(0,cut+15)}).some(p=>p.projectName==='町武道館'),false);
 assert.equal(extractAsakawa({...doc,sourceId:'unreviewed'}).length,0);
});
