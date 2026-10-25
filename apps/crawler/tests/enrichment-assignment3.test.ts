import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {assignment3Block,assignment3Fields} from '../src/evaluations/enrichment/assignment3';
import type {ProjectEvaluation} from '../../web/src/types/evaluation';
const project=(name:string)=>({projectName:name,projectCode:null,purpose:null,activities:null,outcomes:null,evaluationYear:null,evaluatedFiscalYear:null,evidence:[]} as unknown as ProjectEvaluation);
const doc=(id:string)=>JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`,import.meta.url),'utf8')).text as string;
test('Ishioka own sheet purpose and actual summary stay separate from adjacent project',()=>{
 const text=doc('be88aae95407655c96ef2a71'),p=project('出納事務費');const b=assignment3Block('08205',text,p)!;assert(b);assert(!b.text.includes('事業名 収入印紙等取扱事務費'));
 const fields=assignment3Fields('08205',b.text,p);assert.equal(fields.find(x=>x.field==='purpose')?.value,'公金の適正な収納、支出とその管理を行い、公金の健全な運営を図ります。');assert(fields.find(x=>x.field==='outcomes')?.quote.includes('現金、証券、基金等を適正に管理し、決算を調製しています。'));for(const f of fields)assert(text.includes(String(f.value)));
 assert.equal(assignment3Block('08205',text+'\n'+b.text,p),null,'repeated name is ambiguous');
});
test('mixed Tondabayashi cost column is not converted to purpose',()=>{
 const b=assignment3Block('27214',doc('2a2f8ceb94bfce64632dcb2d'),project('若者施策推進事業'))!;assert(b);assert.equal(assignment3Fields('27214',b.text,project('若者施策推進事業')).length,0);
});
test('Shinjo purpose does not absorb activity before the next inline label',()=>{
 const p=project('プレママ保健事業');const b='事業の目的 妊娠期を健やかに過ごせ、安心して出産に臨める。\nどのような状態に\nしたいのか\n産後の赤ちゃんのいる生活に見通しが持てる。\nプレママ広場での助産師・保健師による保健指導\n事業の内容 ・赤ちゃんの抱き方';
 assert.deepEqual(assignment3Fields('06205',b,p).map(x=>x.value),['妊娠期を健やかに過ごせ、安心して出産に臨める。']);
});
test('nonempty fields and purpose-like policy totals are never overwritten',()=>{
 const p=project('出納事務費');p.purpose='既存原文';const b=assignment3Block('08205',doc('be88aae95407655c96ef2a71'),p)!;assert(!assignment3Fields('08205',b.text,p).some(x=>x.field==='purpose'));
 assert.equal(assignment3Fields('25206','施策の成果\nすべての主要事業が達成。',project('主要事業')).length,0);
});
test('inline field headings preserve preceding narrative instead of sentence suffixes',()=>{
 const n='事業名 がん患者支援 担当課 健康課\nがん患者の生活の質の向上のため、購入費用につい\n事業内容（簡潔に） て、助成金を交付する。\n１ 計画（ＰＬＡＮ）';
 const f=assignment3Fields('19207',n,project('がん患者支援'))[0];assert(f.value.toString().startsWith('がん患者'));assert(f.value.toString().includes('て、助成金'));
 const t='（単位：千円） 36文字\n小学校に在籍する子どもが安全に活動できるように\n事業目的\n介助員等を配置する。 【A】事業費 1 2 3';
 const q=assignment3Fields('27214',t,project('支援'))[0];assert(q.value.toString().startsWith('小学校'));assert.notEqual(q.value,'介助員等を配置する。');
});
