import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewNara} from '../src/evaluations/expansion/descending-nara';
import {naraRows} from '../src/evaluations/expansion/descending-nara-map';
import type {CachedInput} from '../src/evaluations/expansion/shared';
function source(id:string,code:string):CachedInput {
 const dir=new URL('../../web/public/evaluation-evidence/',import.meta.url);
 const meta=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,dir),'utf8')).sources.find((s:{id:string})=>s.id===id);
 const d=JSON.parse(readFileSync(new URL(`documents/${id}.json`,dir),'utf8'));let text=d.text,offset=[...text].length;
 for(const c of meta.text.continuations??[]){const bytes=readFileSync(new URL(c.assetPath,dir));assert.equal(bytes.length,c.assetBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),c.assetSha256);const part=JSON.parse(bytes.toString());assert.equal(c.startCharacter,offset);assert.equal(part.startCharacter,offset);assert.equal(part.sourceId,id);assert.equal(part.sourceUrl,d.sourceUrl);assert.equal(part.sourceSha256,d.sourceSha256);assert.equal(createHash('sha256').update(part.text).digest('hex'),c.textSha256);text+=part.text;offset+=[...part.text].length;}
 assert.equal(offset,meta.text.characters);assert.equal(createHash('sha256').update(text).digest('hex'),meta.text.fullTextSha256??meta.text.textSha256);
 return{municipalityCode:code,municipalityName:'test',sourceId:id,sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,sourceSha256:d.sourceSha256,fetchedAt:'2026-01-01T00:00:00Z',text,format:!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='pdftotext_from_verified_bytes'?'pdf':!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='visible_html_from_verified_bytes'?'html':meta.format,truncated:false};
}

const configs=naraRows as Array<{sourceId:string;municipalityCode:string;pageId?:string;rows:unknown[]}>;
const inputs=configs.map(c=>source(c.sourceId,c.municipalityCode));
for(const c of configs)if(c.pageId&&!inputs.some(i=>i.sourceId===c.pageId))inputs.push(source(c.pageId,c.municipalityCode));
const run=(id:string)=>reviewNara(inputs.find(i=>i.sourceId===id)!,inputs)!;
test('Nara proposals require full pinned bodies and literal evidence; no invented numeric fields',()=>{
 let count=0;
 for(const c of configs){const i=inputs.find(i=>i.sourceId===c.sourceId)!;const r=run(c.sourceId);assert.equal(r.projects.length,c.rows.length);count+=r.projects.length;
 for(const p of r.projects){assert.equal(p.amounts.length,0);assert.equal(p.ratings.length,0);assert.equal(p.indicators.length,0);for(const e of p.evidence){const src=inputs.find(x=>x.sourceUrl===e.sourceUrl)!;const m=e.cell!.match(/chars:(\d+)-(\d+)/)!;assert.equal(src.text.slice(+m[1],+m[2]),e.rawText);}}
 for(const bad of [{...i,text:i.text+'x'},{...i,truncated:true},{...i,sourceSha256:'x'},{...i,sourceUrl:i.sourceUrl+'x'}])assert.equal(reviewNara(bad,inputs)!.projects.length,0);
 }assert.equal(count,438);
});


test('Kurotaki excludes cross-year school support and funding/admin rounds',()=>{
 const early=run('edff5df4aed5813aa06dc272');assert.equal(early.projects.length,31);assert.equal(early.projects.filter(p=>p.evaluatedFiscalYear===2020).length,19);assert.equal(early.projects.filter(p=>p.evaluatedFiscalYear===2021).length,12);assert.ok(!early.projects.some(p=>p.projectName==='学校保健特別対策事業費補助金'));
 assert.equal(run('ff1b0f4e2ee4fdd4d9cf11b3').projects.length,13);assert.equal(run('b284a5e2ab172332f3537c23').projects.length,4);const late=run('e279c9ee0bff7910bd03d519').projects;assert.equal(late.length,2);assert.ok(late.every(p=>p.evaluatedFiscalYear===2024));
});
test('Kamimaki keeps cancellations and forecast warning and excludes historic work/alias duplication',()=>{
 const ps=run('de33e18053a219eef7fd209b').projects;assert.equal(ps.length,18);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2021&&p.amounts.length===0));assert.ok(ps.find(p=>p.projectName==='スポーツ協会事業')!.evidence.some(e=>e.rawText?.includes('中止')));assert.ok(ps.find(p=>p.projectName==='防犯カメラ改修工事'));assert.ok(!ps.some(p=>p.projectName==='プール補修工事'));assert.equal(ps.filter(p=>p.projectName.includes('まきっ')).length,1);
});
test('Mitsue preserves explicit report year with unknown multiyear fiscal period and excludes prefectural/planned work',()=>{
 const ps=run('5ec51cb30a70fb15c6af1651').projects;assert.equal(ps.length,24);assert.ok(ps.every(p=>p.evaluatedFiscalYear===null&&p.evaluationYear===2024));assert.ok(!ps.some(p=>p.projectName==='県営治山事業'||p.projectName==='美しい森林づくり基盤整備事業'));
});
test('Kashihara requires actual individual-sheet boundaries; no policy summary or template instructions',()=>{
 for(const [id,count] of [['01754fa0403312c0a92ae2be',17],['3294042dde48423d292fdbc2',35]] as const){const ps=run(id).projects;assert.equal(ps.length,count);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2017&&p.evaluationYear===2018));assert.equal(new Set(ps.map(p=>p.projectName.normalize('NFKC'))).size,count);}
});

test('Gose keeps explicit execution year separate from reimbursement and does not duplicate carryover accounts',()=>{
 const ps=run('a355359dd76abd07e1dff57b').projects;assert.equal(ps.length,238);
 const old=ps.find(p=>p.projectName.includes('物価高騰対策生活応援振興券事業費'))!;assert.equal(old.evaluatedFiscalYear,2022);assert.ok(old.evidence.some(e=>e.rawText?.includes('令和５年度分')));
 assert.ok(!ps.some(p=>p.projectName==='任意事業費'||p.projectName==='基幹系システム事業費＜繰越分＞'));
 assert.equal(ps.filter(p=>p.projectName==='特別支援教育支援事業費').length,1);
 assert.equal(ps.filter(p=>p.projectName.startsWith('北十三柳原線他整備事業費')).length,1);
 assert.ok(ps.some(p=>p.projectName==='「食」の自立支援事業委託（配食）'));
 const lodge=ps.find(p=>p.projectName==='国民宿舎事業費')!;assert.ok(lodge.evidence.filter(e=>e.rawText?.includes('年度別利用状況')).every(e=>!e.rawText?.includes('介護保険事業特別会計')));
});

test('Gose separates named child services from account totals and retains cancellations without resolving date conflicts',()=>{
 const ps=run('a355359dd76abd07e1dff57b').projects;
 assert.equal(ps.length,238);
 assert.ok(ps.some(p=>p.projectName==='女性相談事業'));
 assert.ok(!ps.some(p=>p.projectName==='女性政策費'||p.projectName==='児童福祉総務費'||p.projectName==='人権問題講演会開催費'));
 const cancelled=ps.find(p=>p.projectName==='４．１１「人権を確かめあう日」記念集会費')!;
 assert.ok(cancelled.evidence.some(e=>e.rawText?.includes('令和５年度は未開催')));
 assert.equal(ps.filter(p=>p.projectName==='物価高騰対応重点支援給付').length,1);
 assert.ok(!ps.some(p=>p.projectName==='道路新設改良費＜繰越分＞'||p.projectName==='国民宿舎管理運営費'));
 const council=ps.find(p=>p.projectName==='政務活動費交付')!;
 assert.ok(council.evidence.filter(e=>e.rawText?.includes('議会開催状況')).every(e=>!e.rawText?.includes('総\n\n務')));
});
test('Yamatokoriyama keeps named FY2024 delivery and preparation distinct from miscellaneous expense labels',()=>{
 const ps=run('6c578263da16f5a44bfd0d09').projects;assert.equal(ps.length,56);
 assert.ok(ps.every(p=>p.evaluatedFiscalYear===2024&&p.evaluationYear===2025));
 assert.ok(!ps.some(p=>p.projectName==='その他の事業'||p.projectName==='その他都市計画事業'||p.projectName==='交流事業'));
 const preparation=ps.find(p=>p.projectName==='重層的支援体制整備事業')!;
 assert.ok(preparation.evidence.some(e=>e.rawText?.includes('の準備事業として庁内調整会議等を行った。')));
 assert.ok(ps.find(p=>p.projectName==='産後ケア事業'));
 assert.ok(ps.find(p=>p.projectName==='配食サービス事業'));
});
