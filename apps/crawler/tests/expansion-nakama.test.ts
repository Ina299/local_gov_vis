import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {extractNakama} from '../src/evaluations/expansion/nakama';
const d=JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/eff710251997de1aff169018.json',import.meta.url),'utf8'));
test('Nakama separates four prospective and four retrospective evaluations and does not promote planned costs',()=>{
 const rs=extractNakama(d);assert.equal(rs.length,8);assert.equal(rs.filter(r=>r.evaluatedFiscalYear===2019).length,4);assert.equal(rs.filter(r=>r.evaluatedFiscalYear===2017).length,4);
 assert.ok(rs.every(r=>r.evaluationYear===2018&&r.amounts.length===0));for(const r of rs){assert.ok(d.text.includes(r.evidence[0].rawText));assert.ok(!r.evidence[0].rawText.includes('結果一覧表'));}
});
