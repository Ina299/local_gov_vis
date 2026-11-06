import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewHyogo} from '../src/evaluations/expansion/descending-hyogo';
import {hyogoRows} from '../src/evaluations/expansion/descending-hyogo-map';
import type {CachedInput} from '../src/evaluations/expansion/shared';
function source(id:string,code:string):CachedInput {
 const dir=new URL('../../web/public/evaluation-evidence/',import.meta.url);
 const meta=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,dir),'utf8')).sources.find((s:{id:string})=>s.id===id);
 const d=JSON.parse(readFileSync(new URL(`documents/${id}.json`,dir),'utf8'));let text=d.text,offset=[...text].length;
 for(const c of meta.text.continuations??[]){const bytes=readFileSync(new URL(c.assetPath,dir));assert.equal(bytes.length,c.assetBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),c.assetSha256);const part=JSON.parse(bytes.toString());assert.equal(c.startCharacter,offset);assert.equal(part.startCharacter,offset);assert.equal(part.sourceId,id);assert.equal(part.sourceUrl,d.sourceUrl);assert.equal(part.sourceSha256,d.sourceSha256);assert.equal(createHash('sha256').update(part.text).digest('hex'),c.textSha256);text+=part.text;offset+=[...part.text].length;}
 assert.equal(offset,meta.text.characters);assert.equal(createHash('sha256').update(text).digest('hex'),meta.text.fullTextSha256??meta.text.textSha256);
 return{municipalityCode:code,municipalityName:'test',sourceId:id,sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,sourceSha256:d.sourceSha256,fetchedAt:'2026-01-01T00:00:00Z',text,format:!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='pdftotext_from_verified_bytes'?'pdf':!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='visible_html_from_verified_bytes'?'html':meta.format,truncated:false};
}

const configs=hyogoRows as Array<{sourceId:string;municipalityCode:string;pageId?:string;rows:unknown[]}>;
const inputs=configs.map(c=>source(c.sourceId,c.municipalityCode));
for(const c of configs)if(c.pageId&&!inputs.some(i=>i.sourceId===c.pageId))inputs.push(source(c.pageId,c.municipalityCode));
const run=(id:string)=>reviewHyogo(inputs.find(i=>i.sourceId===id)!,inputs)!;
test('Hyogo proposals require full pinned bodies and literal evidence; no invented numeric fields',()=>{
 let count=0;
 for(const c of configs){const i=inputs.find(i=>i.sourceId===c.sourceId)!;const r=run(c.sourceId);assert.equal(r.projects.length,c.rows.length);count+=r.projects.length;
 for(const p of r.projects){assert.equal(p.amounts.length,0);assert.equal(p.ratings.length,0);assert.equal(p.indicators.length,0);for(const e of p.evidence){const src=inputs.find(x=>x.sourceUrl===e.sourceUrl)!;const m=e.cell!.match(/chars:(\d+)-(\d+)/)!;assert.equal(src.text.slice(+m[1],+m[2]),e.rawText);}}
 for(const bad of [{...i,text:i.text+'x'},{...i,truncated:true},{...i,sourceSha256:'x'},{...i,sourceUrl:i.sourceUrl+'x'}])assert.equal(reviewHyogo(bad,inputs)!.projects.length,0);
 }assert.equal(count,3328);
});



test('Inami complete annual sheets exclude next-year wholly carried-over projects',()=>{
 const ps=run('5ab9e8fdc9ee5aee927abad4').projects;assert.equal(ps.length,78);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2024&&p.evaluationYear===null));
 for(const n of ['稲美北東部地区整備計画等策定事業','稲美中央公園全体構想策定事業','中学校エレベーター設置（実施設計）事業','いなみ野体育センター空調設備基礎調査事業'])assert.ok(!ps.some(p=>p.projectName===n));
 assert.ok(ps.some(p=>p.projectName==='重度障害者医療費助成・高齢重度障害者医療費助成事業'));assert.ok(ps.some(p=>p.projectName==='住民税非課税世帯等に対する臨時特別給付金給付事業'));assert.ok(!ps.some(p=>p.projectName.includes('担当課')));
});
for(const [sid,year,report,count]of [['4bad4f3ba197da937016a6b6',2007,2008,111],['01158a23769d3c9a13f766b0',2010,2011,107],['478fffb21426ff6ed1ab23d2',2011,2012,96],['5f2c88c7936da920a44d4983',2012,2013,105]]as const)test(`Inagawa ${year} explicit target/report years and complete names only`,()=>{
 const ps=run(sid).projects;assert.equal(ps.length,count);assert.ok(ps.every(p=>p.evaluatedFiscalYear===year&&p.evaluationYear===report));assert.equal(new Set(ps.map(p=>p.projectName.normalize('NFKC').replace(/\s+/g,''))).size,count);
 assert.ok(!ps.some(p=>['り事業','業','ト事業','本町対岸遺跡及び大坂口番所推定地詳','（再掲）'].includes(p.projectName)));assert.ok(ps.every(p=>p.projectCode===null&&p.department===null));
});
test('Sasayama list identities do not inherit policy grades or invent carryover/year associations',()=>{
 for(const [sid,year,count]of [['90572ac34172e092a07cf972',2017,160],['3e2156f671a70a8fdecfde82',2018,171],['eb4a71343dcae9331ff18190',2016,174],['e3878ade2f60c5c03a968b0d',2015,26],['c32aaab46573f93e222931e3',2014,62]]as const){
  const ps=run(sid).projects;assert.equal(ps.length,count);assert.ok(ps.every(p=>p.evaluatedFiscalYear===year&&p.warnings.some(w=>w.includes('List-level identity'))));assert.ok(ps.every(p=>!p.projectName.includes('繰越')&&!/\d,\d/.test(p.projectName)));
  assert.ok(!ps.some(p=>['下水道事業','市単独事業','事業名','事業コード','地域支援事業償還金','高額医療費共同事業拠出金','県営土地改良事業'].includes(p.projectName)));if(year<2017)assert.ok(ps.every(p=>p.evaluationYear===null));
 }
});
test('Awaji budget related materials and joint cross-year grants remain outside evaluation candidates',()=>{
 for(const id of ['f6ccf980b9afe5dc9e7e7721','d01430eaa02afdc1bfc0df18','a6b5f27b09a38a95f6676b0f','29d969ee5bf4fd4184f5e0ec','efb6a2b57bb7def5b4c8241f'])assert.ok(!configs.some(c=>c.sourceId===id));
});
for(const [sid,year,count]of [['2f361c684fbe2856437d9689',2011,632],['6173941d80f4f6da1b453e54',2010,601],['b8285a353df66a1b3da8cf7a',2009,522],['ac5332c108d6aa6f063dfe6c',2008,89]]as const)test(`Sasayama ${year} complete annual names reject fragment and numeric-column inference`,()=>{
 const ps=run(sid).projects;assert.equal(ps.length,count);assert.ok(ps.every(p=>p.evaluatedFiscalYear===year&&p.evaluationYear===null));assert.equal(new Set(ps.map(p=>p.projectName.normalize('NFKC').replace(/\s+/g,''))).size,count);
 assert.ok(!ps.some(p=>['備補助金事務事業','制事業','金事業','事業','負担軽減事業','助事業','事務事業','局事業','理事業','ト」事業','助成事業','会事業','援協議会事業','支援事業','研究事業','各助成金事業','各負担金事業','県営土地改良事業'].includes(p.projectName)));
});
test('Sasayama FY2007 keeps wrapped title qualifiers and rejects descriptions posing as titles',()=>{
 const ps=run('f54a43aebbed7ce3b3271439').projects;assert.equal(ps.length,339);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2007&&p.evaluationYear===2008));
 for(const n of ['放課後児童対策事業（民営）','食文化センター事業（各種料理教室）','こんだ薬師温泉施設運営事業','本庁舎・第2庁舎管理事務','篠山体育振興会事務局事務','災害情報の収集･管理業務'])assert.ok(ps.some(p=>p.projectName===n));
 for(const n of ['放課後児童対策事業','こんだ薬師温泉施設運営支援','本庁舎・第2庁舎の維持管理','選挙管理委員会事務','紀支部支援事業','ラザ施設管理'])assert.ok(!ps.some(p=>p.projectName===n));
});

for(const [sid,fy,count]of [['6d11a627e95289515c8c7c93',2012,16],['99bb5bc168629657e8c4b220',2013,36]]as const)test(`Sasayama coverage supplement ${fy} preserves explicit targetperiod and omits ambiguous outcomes`,()=>{const ps=run(sid).projects;assert.equal(ps.length,count);assert.ok(ps.every(p=>p.evaluatedFiscalYear===fy&&p.evaluationYear===null&&p.warnings.some(w=>w.includes('Coverage supplement'))));});

test('Hyogo wrapped additions preserve all1856 previously published candidate objects',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/hyogo-published-1856-hashes.json',import.meta.url),'utf8'));
 const ps=JSON.parse(readFileSync(new URL('../../../data/evaluations/descending-layouts/28/candidates.json',import.meta.url),'utf8'))as {id:string}[];const byId=new Map(ps.map(p=>[p.id,p]));assert.equal(fixture.base,'093104c48ab7ff0291212f45a1ecd9a8ff07e0a0');assert.equal(fixture.rows.length,1856);
 for(const old of fixture.rows){assert.ok(byId.has(old.id),old.id);assert.equal(createHash('sha256').update(JSON.stringify(byId.get(old.id))).digest('hex'),old.sha256);}
});
test('Sasayama wrapped titles exclude mixed KPI prefixes, reprints and qualified-title aliases',()=>{
 for(const sid of ['6173941d80f4f6da1b453e54','b8285a353df66a1b3da8cf7a']){const ps=run(sid).projects;assert.ok(ps.every(p=>!p.projectName.includes('【再掲】')&&!p.projectName.includes('繰越')));assert.ok(!ps.some(p=>['行:(4)-1アクション事業','ま:P52会）事業'].includes(p.projectName)));}
 const ps=run('6173941d80f4f6da1b453e54').projects;assert.ok(ps.some(p=>p.projectName==='母子保健推進員活動事業（愛育班活動）'));assert.ok(ps.some(p=>p.projectName==='要支援・要介護認定調査・主治医意見書作成依頼事業'));
 assert.ok(!run('2f361c684fbe2856437d9689').projects.some(p=>p.projectName==='がん検診等受診者健診等受診補助事業'));
});

 test('Sasayama FY2008 keeps account and geographic qualifiers and holds retirement ambiguity',()=>{
 const ps=run('ac5332c108d6aa6f063dfe6c').projects;
 for(const name of ['低所得者対策事業[特別会計]','介護認定訪問調査(東部）','介護認定訪問調査(西部）','汚水処理施設共同整備事業（ミックス）','国内交流推進事業岐阜県高山市','住宅防火診断義務'])assert.ok(ps.some(p=>p.projectName===name));
 for(const name of ['低所得者対策事業[一般会計]','老人保健医療費適正化対策事業','老人保健医療費給付事業','継続的評価分析支援事業','長寿祝い金支給事務','高齢者福祉の充実','住宅防火診断業務','介護認定訪問調査'])assert.ok(!ps.some(p=>p.projectName===name));
 });

test('Sasayama FY2007 title segments do not borrow policy suffixes or adjacent branch names',()=>{
 const ps=run('f54a43aebbed7ce3b3271439').projects;
 const activity=ps.find(p=>p.projectName==='生産組合活動支援事業')!;assert.ok(activity);assert.ok(activity.evidence.some(e=>e.rawText.includes('手の育 業')));
 const taki=ps.find(p=>p.projectName==='市保健衛生推進協議会多紀支部事務局')!;assert.ok(taki);assert.ok(!taki.evidence[0].rawText.includes('城東'));
 for(const name of ['市保健衛生推進協議会城東支部事務局','公立保育所事業（事務・管理・運営）','母子保健推進員活動事業（愛育班活動）','メディカルコントロール体制構築事業','メディカルコントロール体制の推進事業'])assert.ok(ps.some(p=>p.projectName===name));
 assert.ok(!ps.some(p=>['任意事業','市保健衛生推進協議会事務局','メディカルコントロール事業','政策事業'].includes(p.projectName)));
});


test('Sasayama FY2007 repeated generic rows stay held and qualified titles are not split or aliased',()=>{
 const result=run('f54a43aebbed7ce3b3271439'),ps=result.projects;
 assert.equal(result.units.filter(u=>u.status==='identity_or_period_hold').length,12);
 assert.equal(new Set(ps.map(p=>p.projectName.normalize('NFKC').replace(/\s+/g,''))).size,339);
 for(const name of ['高齢者大学かやのみ学園、羽束学園','相談事業（女性問題、DV、セクハラ、子育て、介護、人間関係等）','子どもの居場所づくり推進事業（通学合宿）','ちっびこ伝統産業体験交流事業','「まちづくり防犯グループ」登録申請事務','漏水減免事務'])assert.ok(ps.some(p=>p.projectName===name),name);
 for(const name of ['相談事業','交流事業','任意事業','高齢者大学羽束学園','〔住宅資金特別会計〕償還推進事業','篠山市公民館運営審議会事務局事務'])assert.ok(!ps.some(p=>p.projectName===name),name);
 assert.equal(ps.filter(p=>p.projectName==='償還推進事業').length,1);
 const src=inputs.find(i=>i.sourceId==='f54a43aebbed7ce3b3271439')!;
 const tail=ps.find(p=>p.projectName==='漏水減免事務')!;assert.ok(tail.evidence.some(e=>e.cell&&Number(e.cell.match(/chars:(\d+)/)?.[1])>src.text.indexOf('28/28')));
});


test('Sasayama FY2011 keeps complete service titles apart from prior actual and future target columns',()=>{
 const ps=run('2f361c684fbe2856437d9689').projects;
 assert.ok(ps.every(p=>p.evaluatedFiscalYear===2011&&p.evaluationYear===null&&p.amounts.length===0&&p.ratings.length===0&&p.indicators.length===0));
 for(const name of ['健診等受診補助事業','保健事業担当者研修・保健師研修・栄養士研修・予防接種従事者研修等事業','篠山東部学校給食センター地元産物活用事業','篠山西部学校給食センター地元産物活用事業','地域福祉事業（日置ふれあい館）','地域福祉事業（古市ふれあい館）','青少年健全育成団体連携事業（市PTA協議会・市子ども会連絡協議会）'])assert.ok(ps.some(p=>p.projectName===name),name);
 assert.ok(!ps.some(p=>p.projectName==='がん検診等受診者健診等受診補助事業'));
 const expense=ps.find(p=>p.projectName==='兵庫医科大学医師確保対策費補助金')!;assert.ok(expense);assert.ok(!expense.evidence[0].rawText.includes('補助金額'));
});

test('Sasayama FY2011 does not turn component lists, repeated identities or detached codes into extra records',()=>{
 const result=run('2f361c684fbe2856437d9689'),ps=result.projects;
 assert.equal(result.units.filter(u=>u.status==='identity_or_period_hold').length,25);
 for(const name of ['介護保険苦情相談事業','各補助金事業','各助成金事業','各負担金事業','県営土地改良事業','22年工業統計調査事業','24年経済センサス調査事業','丹南音頭保存会補助事業','④まるいの事業'])assert.ok(!ps.some(p=>p.projectName===name),name);
 for(const name of ['観光PR事業','体験教育推進事業','かぞくdeおいしんぼクッキング事業','子育てふれあいセンター事業','国際交流推進事業'])assert.equal(ps.filter(p=>p.projectName===name).length,1,name);
 // This identity already existed before this tranche: retain it, but add no second ambiguous row.
 const retained=ps.filter(p=>p.projectName==='資源ごみ拠点回収事業');assert.equal(retained.length,1);assert.ok(retained[0].evidence.some(e=>e.cell==='extracted-text:chars:65761-65771'&&e.rawText==='資源ごみ拠点回収事業'));
 assert.ok(ps.every(p=>p.projectCode===null));
});


test('Sasayama FY2010 retains explicit institution and service qualifiers without numerical attribution',()=>{
 const ps=run('6173941d80f4f6da1b453e54').projects;
 assert.equal(ps.length,601);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2010&&p.evaluationYear===null&&p.projectCode===null&&p.amounts.length===0&&p.ratings.length===0&&p.indicators.length===0));
 for(const name of ['無年金外国籍高齢者等福祉給付金支給事業','体育指導委員会事業「ミニ駅伝大会」','ごみ収集及び運搬に関する事務事業','農業近代化資金等利子補給事業','地元産物活用事業（東部給食センター）','地元産物活用事業（西部給食センター）','生活・人権相談事業（畑ふれあい館）','生活・人権相談事業（日置ふれあい館）','交流施設等運営事業（黒豆の館）','交流施設等運営事業（丹波旬の市南部店）','市営駐輪場使用料徴収業務（一時利用）','市営駐輪場使用料徴収業務（定時利用）'])assert.ok(ps.some(p=>p.projectName===name),name);
 const first=ps.find(p=>p.projectName==='無年金外国籍高齢者等福祉給付金支給事業')!;assert.ok(first.evidence.some(e=>e.rawText==='無年金外国籍高齢者等福祉給'));assert.ok(first.evidence.some(e=>e.rawText==='付金支給事業'));
});

test('Sasayama FY2010 rejects disconnected titles, ambiguous annual identities and duplicate section names',()=>{
 const result=run('6173941d80f4f6da1b453e54'),ps=result.projects;assert.equal(result.units.filter(u=>u.status==='identity_or_period_hold').length,56);
 for(const name of ['県営土地改良事業','22年工業統計調査事業','22年経済センサス調査事業','施設管理業務','施設維持管理事業','各種受付事務','視聴覚教育支援事業','業','事業','地域交流事業'])assert.ok(!ps.some(p=>p.projectName===name),name);
 for(const name of ['トライやる・ウィーク、トライやる・アクション事業','救急車、消防広報車購入整備事業','アグリ産業クラスター構想（研究会）事業'])assert.equal(ps.filter(p=>p.projectName===name).length,1,name);
 assert.ok(!ps.some(p=>/^(?:行[:：]|ま P52)/.test(p.projectName)));assert.equal(new Set(ps.map(p=>p.projectName.normalize('NFKC').replace(/\s+/g,''))).size,ps.length);
});


test('Sasayama FY2009 literal combined services preserve source spelling and target fiscal year',()=>{
 const ps=run('b8285a353df66a1b3da8cf7a').projects;assert.equal(ps.length,522);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2009&&p.evaluationYear===null&&p.projectCode===null&&p.amounts.length===0&&p.ratings.length===0&&p.indicators.length===0));
 for(const name of ['休日診療所事業・病院群輪番制事業','ちびっ子伝統産業体験交流事業事業','住宅防火診断義務','牛ヶ瀬保館費地域福祉事業','安全安心な学校給食の推進（西部）事業','特色ある献立づくり（東部）の実施事業','特色ある献立づくり(西部）の実施事業','教育振興基本計画策定事業','開発支援事務（消防施設設置）','築城４００年記念事業'])assert.ok(ps.some(p=>p.projectName===name),name);
 const combined=ps.find(p=>p.projectName==='休日診療所事業・病院群輪番制事業')!;assert.ok(combined.evidence.some(e=>e.rawText==='休日診療所事業・病院群輪番'));assert.ok(combined.evidence.some(e=>e.rawText==='制事業'));
 // FY2010 has detached fragments; the explicit adjacent FY2009 source does not release that separate source's hold.
 assert.ok(!run('6173941d80f4f6da1b453e54').projects.some(p=>p.projectName==='休日診療所事業・病院群輪番制事業'));
});

test('Sasayama FY2009 holds repeated section identities and carryover rather than filling from neighbouring years',()=>{
 const result=run('b8285a353df66a1b3da8cf7a'),ps=result.projects;assert.equal(result.units.filter(u=>u.status==='identity_or_period_hold').length,66);
 for(const name of ['消防地水利調査事務','災害情報の収集･管理業務','子どもの居場所づくり事業','県営土地改良事業','21年工業統計調査事務','安全安心な学校給食の推進（東部）事業','ちびっ子伝統産業体験交流事業','住宅防火診断業務'])assert.ok(!ps.some(p=>p.projectName===name),name);
 assert.ok(ps.every(p=>!p.projectName.includes('繰越')&&!p.projectName.includes('【再掲】')));assert.equal(new Set(ps.map(p=>p.projectName.normalize('NFKC').replace(/\s+/g,''))).size,ps.length);
});

test('Kami public works preassessments preserve review year without turning open-ended plans into annual actuals',()=>{
 const ps=run('e9a0f4641c13a4ceeb14ee89').projects;assert.equal(ps.length,3);
 assert.deepEqual(ps.map(p=>p.projectName),['境自治会集会所整備事業（香住区境地内）','小代南部健康高原専用水道ろ過施設整備事業（小代区新屋地内）','村岡歯科診療所整備事業（村岡区村岡地内）']);
 assert.ok(ps.every(p=>p.evaluationYear===2025&&p.evaluatedFiscalYear===null&&p.amounts.length===0&&p.ratings.length===0&&p.indicators.length===0&&p.outcomes===null));
 assert.ok(ps.every(p=>p.warnings.some(w=>w.includes('事前審査')&&w.includes('実施済み'))));
 for(const p of ps){assert.ok(p.evidence.some(e=>e.rawText.includes('令和8年度以降')));assert.ok(p.evidence.some(e=>/^令和7年(?:11月12日|12月11日)$/.test(e.rawText)));}
});
