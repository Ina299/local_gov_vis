import {extractBibai} from '../src/evaluations/expansion/bibai';
import {extractAkashiListSupplement} from '../src/evaluations/expansion/akashi-list-supplement';
import {extractMiyakoExternalSupplement} from '../src/evaluations/expansion/miyako-external-supplement';
import {extractMoriya} from '../src/evaluations/expansion/moriya';
import {extractTakahashiResultsSupplement} from '../src/evaluations/expansion/takahashi-results-supplement';
import {extractReviewFiveLaterLists} from '../src/evaluations/expansion/review-five-later-lists';
import {extractReviewFiveAdditional} from '../src/evaluations/expansion/review-five-additional';
import {extractReviewFiveLists} from '../src/evaluations/expansion/review-five-lists';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import type {CachedInput} from '../src/evaluations/expansion/shared';
import {extractFujiSupplement} from '../src/evaluations/expansion/fuji-supplement';
import {extractYasugiSupplement} from '../src/evaluations/expansion/yasugi-supplement';
import {extractMiyakoSupplement} from '../src/evaluations/expansion/miyako-supplement';
import {extractTakahashiSupplement} from '../src/evaluations/expansion/takahashi-supplement';
import {extractNamie} from '../src/evaluations/expansion/namie';
import {extractTagami} from '../src/evaluations/expansion/tagami';
import {extractMinami} from '../src/evaluations/expansion/minami';
import {extractAtsugi} from '../src/evaluations/expansion/atsugi';
import {extractReviewFiveSummaries} from '../src/evaluations/expansion/review-five-summaries';
import {extractReviewFiveHtml} from '../src/evaluations/expansion/review-five-html';
const base=new URL('../../web/public/evaluation-evidence/',import.meta.url);
function input(code:string,id:string):CachedInput{const m=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,base),'utf8'));const s=m.sources.find((x:{id:string})=>x.id===id),d=JSON.parse(readFileSync(new URL(s.text.assetPath,base),'utf8'));return {...d,municipalityName:m.municipalityName,format:s.format,sourcePageUrl:s.url,fetchedAt:s.acquisition.fetchedAt};}
test('Fuji annual summaries merge same-name sheets and current-year cost columns',()=>{
 const a=input('22210','4059ad0f5ae3060bb6ac5ad5'),p=extractFujiSupplement(a);assert.equal(p.length,111);assert.equal(new Set(p.map(x=>x.projectName)).size,111);
 const x=p.find(x=>x.projectName==='火災予防査察事業')!;assert.equal(x.ratings[0].value,'B');assert.deepEqual(x.amounts.map(a=>[a.kind,a.fiscalYear,a.amountYen]),[['budget',2023,0],['actual',2023,0]]);assert.ok(p.every(x=>x.evaluationYear===null&&x.evaluatedFiscalYear===2023));
 const b=extractFujiSupplement(input('22210','d651b74c2eb38cec51690c20'));assert.ok(b.every(x=>!x.projectName.includes('ほか')&&x.amounts.length===0));
});
test('Yasugi selects one known fiscal-year total and does not inherit multi-year ratings',()=>{
 const p=extractYasugiSupplement(input('32206','b41489d9691306ad7764ba25'));assert.equal(p.length,33);assert.equal(p[0].projectName,'結婚活動支援事業');assert.equal(p[0].amounts[0].amountYen,819000);assert.ok(p.every(x=>x.evaluatedFiscalYear===2024&&x.ratings.length===0));
});
test('Miyako extracts intact rows with annual scope; split row names are not repaired',()=>{
 const p=extractMiyakoSupplement(input('03202','0c67ee79add79c827c2638b8'));assert.equal(p.length,68);assert.ok(p.some(x=>x.projectName==='崎山松月線道路改良事業'));assert.ok(!p.some(x=>x.projectName==='田鎖老木線外1路線（牛伏地'));assert.ok(p.every(x=>x.amounts.length===0&&x.ratings.length===2&&x.evaluatedFiscalYear===2023));
});
test('Takahashi mixed-year expense table remains untyped; Namie explicit settlement cost is retained',()=>{
 const p=extractTakahashiSupplement(input('33209','05ca47e410a35b929f34d13d'));assert.equal(p.length,1);assert.equal(p[0].projectName,'病後児保育事業');assert.equal(p[0].ratings[1].value,'改善の余地あり');assert.equal(p[0].amounts.length,0);
 const n=extractNamie(input('07547','9558e3150cc1eeb1c6582162'));assert.equal(n.length,19);assert.equal(n[0].amounts[0].amountYen,2285078);assert.ok(n.every(p=>p.amounts.every(a=>a.kind==='actual'&&a.fiscalYear===2024)));
});
test('education evaluators keep current ratings, and child projects do not inherit parent costs',()=>{
 const t=extractTagami(input('15361','182a077a731b5380c490a824'));assert.equal(t.length,74);assert.equal(t.find(x=>x.projectName==='ストレッチ教室')!.ratings[0].value,'s');assert.ok(t.every(x=>x.outcomes));
 const m=extractMinami(input('36387','9de68dc3f1561c15e6d850ed'));assert.ok(m.length>70);assert.ok(m.filter(p=>p.projectName.includes('／')).every(p=>p.amounts.length===0));
});
test('Atsugi appendix excludes narrative reprints; council rows have no invented amounts',()=>{
 const a=extractAtsugi(input('14212','071959416cdc00bc79bae728'));assert.equal(a.length,424);assert.equal(new Set(a.map(p=>p.projectCode)).size,424);assert.ok(a.every(p=>p.ratings.length===3&&p.amounts.length===0));
 const p=extractReviewFiveSummaries(input('20209','4bcb5d91538cc787b2d2ef85'));assert.equal(p.length,4);assert.equal(p.find(x=>x.projectName==='入野谷')!.ratings[0].value,'廃止');
});
test('HTML retains rated Sabae rows and full Kawauchi statements without assuming money kinds',()=>{
 const s=extractReviewFiveHtml(input('18207','b128d049a65ab2c9598681f3'));assert.equal(s.length,483);assert.ok(s.every(x=>x.ratings[0].value!=='対象外'&&!x.projectName.endsWith('（PDF）')));
 const k=extractReviewFiveHtml(input('07544','92f2632397549cf6adc0f8ff'));assert.equal(k.length,27);assert.equal(k[0].projectName,'川内村総合行政情報システム保守管理');assert.ok(k.every(p=>p.evaluatedFiscalYear===2005&&p.amounts.length===0));
});
test('all sampled evidence offsets resolve to exact original substrings and reject other municipality codes',()=>{
 for(const [code,id,f] of [
 ['22210','4059ad0f5ae3060bb6ac5ad5',extractFujiSupplement],['32206','b41489d9691306ad7764ba25',extractYasugiSupplement],['03202','0c67ee79add79c827c2638b8',extractMiyakoSupplement],['33209','05ca47e410a35b929f34d13d',extractTakahashiSupplement],['07547','9558e3150cc1eeb1c6582162',extractNamie],['15361','182a077a731b5380c490a824',extractTagami],['36387','9de68dc3f1561c15e6d850ed',extractMinami],['14212','071959416cdc00bc79bae728',extractAtsugi],['20209','4bcb5d91538cc787b2d2ef85',extractReviewFiveSummaries],['07544','92f2632397549cf6adc0f8ff',extractReviewFiveHtml],
 ] as const){const s=input(code,id);assert.deepEqual(f({...s,municipalityCode:'00000'}),[]);for(const p of f(s))for(const e of [...p.evidence,...p.amounts.map(a=>a.evidence),...p.ratings.map(r=>r.evidence)]){const m=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(s.text.slice(+m[1],+m[2]),e.rawText);}}
});

test('Kami grant scores use the final current-year column; Sayama excludes wrapped project names',()=>{
 const k=extractReviewFiveLists(input('04445','5b1fcf399c79fbedc07efae0'));assert.equal(k.length,229);assert.equal(k.find(p=>p.projectCode==='補助金:120')!.ratings[0].value,'Ｂ');assert.equal(k.find(p=>p.projectCode==='施設:25')!.ratings.length,0);
 const s=extractReviewFiveLists(input('11215','cb50e2cc124fb4bd9b7daf5d'));assert.equal(s.length,145);assert.ok(!s.some(p=>p.projectCode==='105'));assert.equal(s.find(p=>p.projectCode==='3')!.ratings[0].value,'非常に高い');
 const t=extractReviewFiveHtml(input('12205','534e0cbbc99910b0f8546351'));assert.equal(t.length,15);assert.equal(t.find(p=>p.projectName==='環境保全団体支援事業補助金')!.ratings[0].value,'不要・凍結（統合可能）');
});
test('additional selected evaluations preserve partial scope and separate external directions',()=>{
 const h=extractReviewFiveAdditional(input('34212','4228fa5ae7f3842dbf4a3b7e'));assert.equal(h.length,13);assert.ok(h.every(p=>p.evaluationYear===null&&p.evaluatedFiscalYear===2021));assert.ok(h.find(p=>p.projectName==='学校教育推進事業')!.ratings.length>1);
 const s=extractReviewFiveAdditional(input('18207','04e8c220e4562ccead93d04f'));assert.equal(s.length,4);assert.equal(s[1].ratings[1].value,'事務改善（業務プロセスの改善）');assert.ok(s.every(p=>p.amounts.length===0&&p.evaluatedFiscalYear===2024));
 const i=extractReviewFiveAdditional(input('46219','bafa9b4fa056d966def8f77b'));assert.equal(i.length,7);assert.equal(i[6].projectName,'小中学校文化スポーツ推進事業');assert.equal(i[6].ratings[1].value,'廃止');assert.ok(i.every(p=>p.evaluatedFiscalYear===null&&p.amounts.length===0));
});
test('same-name projects preserve distinct departments and merge identical fiscal-year reprints',()=>{
 const s=extractReviewFiveLists(input('11215','cb50e2cc124fb4bd9b7daf5d'));
 for(const name of ['人権施策推進事業','平和意識高揚事業'])assert.deepEqual(s.filter(p=>p.projectName===name).map(p=>p.department).sort(),['政策企画課','社会教育課']);
 const m=extractMiyakoSupplement(input('03202','624788e99c62d521d74014ca'));assert.equal(m.length,82);const pollution=m.filter(p=>p.projectName==='公害対策事業');assert.equal(pollution.length,1);assert.equal(pollution[0].evidence.filter(e=>e.rawText.includes('公害対策事業')).length,2);assert.ok(m.every(p=>p.evaluatedFiscalYear===2018));
});

test('new annual lists exclude policy totals and avoid reimporting existing Kuki sheets',()=>{
 const m=extractMoriya(input('08224','2a445a84b974fed7524967b8'));assert.equal(m.length,10);assert.ok(m.every(p=>p.ratings.length===3&&p.evaluatedFiscalYear===2024&&p.amounts.length===0));assert.ok(!m.some(p=>p.projectName==='更生保護活動支援事業'));
 const k=extractReviewFiveLaterLists(input('11232','70581de7069cb530ee1fac2b'));assert.equal(k.length,124);assert.ok(k.every(p=>Number(p.projectCode!.split(':')[1])>64));
 const h=extractReviewFiveLaterLists(input('32202','c8a2d61f5dce19995e435429'));assert.equal(h.length,71);assert.ok(h.every(p=>p.evaluatedFiscalYear===null));assert.equal(h.find(p=>p.projectName==='物品出納事務')!.department,'会計課');
 const c=extractReviewFiveLaterLists(input('13102','dad5034c4d31b21aa495146f'));assert.equal(c.length,63);assert.equal(c.find(p=>p.projectName==='感染症予防事業')!.amounts[0].amountYen,3004513518);assert.ok(c.every(p=>p.evaluatedFiscalYear===2023&&p.evaluationYear===null));
 const t=extractTakahashiResultsSupplement(input('33209','3964cf0e3dafcaf911183018'));assert.equal(t.length,12);assert.ok(t.every(p=>p.amounts.length===0));
});

test('Bibai expense totals are fiscal-year labelled and source lines remain exact',()=>{
 const source=input('01215','4d4fe7521a792537a07a6719'),p=extractBibai(source);assert.equal(p.length,354);assert.equal(p.find(p=>p.projectName==='農商工連携推進助成事業')!.amounts[0].amountYen,1595000);assert.ok(p.every(p=>p.evaluatedFiscalYear===2019&&p.evaluationYear===null));
 for(const r of p)for(const e of [...r.evidence,...r.amounts.map(a=>a.evidence)]){const m=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(source.text.slice(+m[1],+m[2]),e.rawText);}
});
test('Akashi summary excludes wrapped account fragments and Miyako external avoids unknown same-period names',()=>{
 const a=extractAkashiListSupplement(input('28203','4cbc582d4c942530ea1cd737'));assert.equal(a.length,40);assert.ok(!a.some(p=>['公共用地取得費','貸付金'].includes(p.projectName)));
 const m=extractMiyakoExternalSupplement(input('03202','2deb2c2c7340e4686fd1ee02'));assert.equal(m.length,5);assert.ok(!m.some(p=>p.projectName==='鉄道利用促進事業'));assert.ok(m.every(p=>p.evaluationYear===2017&&p.evaluatedFiscalYear===null));
 const mi=extractMinami(input('36387','9de68dc3f1561c15e6d850ed'));assert.equal(mi.length,85);assert.ok(!mi.some(p=>p.projectName.endsWith('／施設利用状況')));
 const e=input('34209','446b28e05121f4e08ad40530');const rows=extractReviewFiveLaterLists(input('34209','882e284c09423483f05564fd'),[e]);assert.equal(rows.length,11);assert.ok(rows.find(p=>p.projectName==='女子野球チーム支援事業')!.evidence.some(x=>x.sourceUrl===e.sourceUrl));
});
