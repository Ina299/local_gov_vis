import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewHiroshima} from '../src/evaluations/expansion/descending-hiroshima';
import {hiroshimaRows} from '../src/evaluations/expansion/descending-hiroshima-map';
import type {CachedInput} from '../src/evaluations/expansion/shared';
function source(id:string,code:string):CachedInput {
 const dir=new URL('../../web/public/evaluation-evidence/',import.meta.url);
 const meta=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,dir),'utf8')).sources.find((s:{id:string})=>s.id===id);
 const d=JSON.parse(readFileSync(new URL(`documents/${id}.json`,dir),'utf8'));let text=d.text,offset=[...text].length;
 for(const c of meta.text.continuations??[]){const bytes=readFileSync(new URL(c.assetPath,dir));assert.equal(bytes.length,c.assetBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),c.assetSha256);const part=JSON.parse(bytes.toString());assert.equal(c.startCharacter,offset);assert.equal(part.startCharacter,offset);assert.equal(part.sourceId,id);assert.equal(part.sourceUrl,d.sourceUrl);assert.equal(part.sourceSha256,d.sourceSha256);assert.equal(createHash('sha256').update(part.text).digest('hex'),c.textSha256);text+=part.text;offset+=[...part.text].length;}
 assert.equal(offset,meta.text.characters);assert.equal(createHash('sha256').update(text).digest('hex'),meta.text.fullTextSha256??meta.text.textSha256);
 return{municipalityCode:code,municipalityName:'test',sourceId:id,sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,sourceSha256:d.sourceSha256,fetchedAt:'2026-01-01T00:00:00Z',text,format:!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='pdftotext_from_verified_bytes'?'pdf':!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='visible_html_from_verified_bytes'?'html':meta.format,truncated:false};
}

test('Hiroshima reviewed rows bind full source identity, complete body, exact quotes and explicit years',()=>{
 for(const c of hiroshimaRows){const i=source(c.sourceId,c.municipalityCode),r=reviewHiroshima(i)!;assert.equal(r.projects.length,c.rows.length);assert.equal(new Set(r.projects.map(p=>p.id)).size,r.projects.length);for(const p of r.projects){assert.equal(p.amounts.length,0);assert.equal(p.ratings.length,0);assert.equal(p.indicators.length,0);for(const e of p.evidence){const m=e.cell!.match(/chars:(\d+)-(\d+)/)!;assert.equal(i.text.slice(+m[1],+m[2]),e.rawText);}}for(const bad of [{...i,text:i.text+'x'},{...i,truncated:true},{...i,sourceSha256:'x'},{...i,sourceUrl:i.sourceUrl+'x'}])assert.equal(reviewHiroshima(bad)!.projects.length,0);assert.equal(reviewHiroshima({...i,municipalityCode:'99999'}),null);}
});

test('Kitahiroshima continues beyond the first asset and uses sheet133 actual title, not its policy header',()=>{const ps=reviewHiroshima(source('5565c33146172695cb5c5757','34369'))!.projects;assert.equal(ps.length,140);assert.ok(ps.some(p=>p.projectName==='入札制度電子化推進事業'));assert.ok(!ps.some(p=>p.projectName==='Ⅴ＿住民のための行財政運営'));assert.ok(ps.every(p=>p.evaluatedFiscalYear===2024));});
test('Sera separates taxi service aliases from existing expansion projects without rewriting earlier values',()=>{for(const id of ['e437868f5e87946c1f215df9','7ddaf70925bf3dbcd1deee78','b2404f08720894e2616e58c6'])assert.ok(!reviewHiroshima(source(id,'34462'))!.projects.some(p=>p.projectName==='せらまちタクシー'));});
test('Saka identifies the target year and concrete annual activities, never chapter labels or regex fragments',()=>{const ps=reviewHiroshima(source('7d13b86ebfc55a173ca30e38','34309'))!.projects;assert.ok(ps.length>0);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2019&&p.evaluationYear===null));for(const c of hiroshimaRows.filter(c=>c.municipalityCode==='34309'))assert.ok(!reviewHiroshima(source(c.sourceId,c.municipalityCode))!.projects.some(p=>['英語で教室','生涯スポーツの推進','計画的な事業'].includes(p.projectName)));});
test('Reviewed navigation and policy outlines produce no business rows',()=>{for(const c of hiroshimaRows.filter(c=>c.rows.length===0))assert.equal(reviewHiroshima(source(c.sourceId,c.municipalityCode))!.projects.length,0);});

test('Onomichi implementation rows exclude future school-support plans, third-party activities and financing aliases',()=>{
 for(const [id,year,count] of [['48be9ad3aad229f15735beb3',2023,11],['097054f0189853a027f9fb02',2024,9],['249f56389f65298e60bf6d47',2025,9]] as const){
  const ps=reviewHiroshima(source(id,'34205'))!.projects;
  assert.equal(ps.length,count);assert.ok(ps.every(p=>p.evaluatedFiscalYear===year&&p.evaluationYear===null));
  assert.ok(ps.some(p=>p.projectName==='特別教室等空調設備事業の推進'));
  assert.ok(!ps.some(p=>['子どもの居場所づくり事業','校内教育支援センター推進事業'].includes(p.projectName)));
  if(year===2024)assert.ok(!ps.some(p=>p.projectName==='日本遺産ゲートウェイ機能強化事業'));
 }
});
test('Fuchu same-name ICT units remain held; Miyoshi recommendations do not invent a target fiscal year',()=>{
 const f=reviewHiroshima(source('49c4562787f48283d4c44c26','34208'))!;
 assert.equal(f.projects.length,14);assert.ok(!f.projects.some(p=>p.projectName.includes('ICT')));
 const ps=reviewHiroshima(source('4b2559af3ca2033540caa856','34209'))!.projects;
 assert.equal(ps.length,8);assert.ok(ps.every(p=>p.evaluationYear===2024&&p.evaluatedFiscalYear===null));
});

test('Takehara excludes ambiguous list-to-sheet identities and prior-year library relocation',()=>{
 const old=reviewHiroshima(source('743451c8733c2d7371089a17','34203'))!.projects;
 assert.equal(old.length,21);assert.equal(old.filter(p=>p.projectName==='公民館運営事業').length,1);
 assert.ok(!old.some(p=>p.projectName.includes('図書館移転')));assert.ok(old.every(p=>p.evaluatedFiscalYear===2018));
 const current=reviewHiroshima(source('8ebbed9d5bcf26a8dbf7c150','34203'))!.projects;
 assert.equal(current.length,34);assert.ok(current.some(p=>p.projectName==='北海道余市町歴史交流事業'));
 assert.ok(current.some(p=>p.projectName==='今井政之顕彰施設整備検討事業'));
});
test('Onomichi coverage additions preserve explicit FY and do not repair corrupted OCR title suffixes',()=>{
 const ps=reviewHiroshima(source('eeb6f9bb3c2f44b3d04b01fc','34205'))!.projects;
 assert.equal(ps.length,10);assert.equal(ps[0].projectName,'尾道市美術展事業');assert.ok(ps.every(p=>p.evaluatedFiscalYear===2014));
 assert.ok(!ps[0].projectName.includes('実路'));assert.equal(ps[0].department,null);
 const prior=reviewHiroshima(source('e299c6de2073b91f7effd68f','34205'))!.projects;
 assert.equal(prior.length,5);assert.ok(prior.some(p=>p.projectName==='特別支援教育推進事業'));
});
test('Kure keeps named implemented programmes separate from its 17 policy indicators',()=>{
 const ps=reviewHiroshima(source('2b519a995cdae15d17fdf0fd','34202'))!.projects;
 assert.equal(ps.length,12);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2025&&p.indicators.length===0));
 assert.ok(ps.some(p=>p.projectName==='「育ちと学びをつなぐ」幼保小協働推進事業'));
});

test('Saka annual gap review uses assessed-year library activities and collapses repeated council mentions',()=>{
 for(const c of hiroshimaRows.filter(c=>c.municipalityCode==='34309'&&c.year!==null&&c.year>=2013&&c.year<=2018)){
  const ps=reviewHiroshima(source(c.sourceId,c.municipalityCode))!.projects;
  for(const name of ['図書館利用講座','読書活動推進講座'])assert.equal(ps.filter(p=>p.projectName===name).length,1);
 }
 const ps=reviewHiroshima(source('7d13b86ebfc55a173ca30e38','34309'))!.projects;
 assert.equal(ps.filter(p=>p.projectName==='坂町道徳教育推進協議会').length,1);
 const prior=reviewHiroshima(source('e5c6523084502deeec039466','34309'))!.projects;
 assert.ok(!prior.some(p=>p.projectName==='図書館利用講座'));
 assert.ok(!prior.some(p=>p.projectName==='町内駅伝競走大会'));
});
test('Saka event review excludes cancelled events and inconsistent festival ordinal identities',()=>{
 for(const id of ['90a341714420a90cf3a63214','7bf6d509b4c79f59ba41295c']){
  const ps=reviewHiroshima(source(id,'34309'))!.projects;
  assert.ok(!ps.some(p=>p.projectName==='坂町平和音楽祭'||p.projectName==='ＮＨＫのど自慢'));
 }
 for(const c of hiroshimaRows.filter(c=>c.municipalityCode==='34309'&&(c.year===2023||c.year===2024)))assert.ok(!reviewHiroshima(source(c.sourceId,c.municipalityCode))!.projects.some(p=>/第(?:15|１５)回吹奏楽/.test(p.projectName)));
 const ps=reviewHiroshima(source('b9344c367ad96e228dc72152','34309'))!.projects;
 for(const name of ['俳句王国がゆく','坂町平和音楽祭','神楽の祭典','尾木ママ講演会','子育てコンサート'])assert.equal(ps.filter(p=>p.projectName===name).length,1);
 assert.ok(ps.every(p=>p.amounts.length===0&&p.ratings.length===0&&p.indicators.length===0));
});

test('Saka community activity review separates executed years, cancelled festivals and historical references',()=>{
 const names=(id:string)=>reviewHiroshima(source(id,'34309'))!.projects.map(p=>p.projectName);
 for(const id of ['90a341714420a90cf3a63214','7bf6d509b4c79f59ba41295c'])assert.ok(!names(id).includes('図書館こどもまつり'));
 assert.ok(names('7165760cfcafcf8bc68fab39').includes('図書館こどもまつり'));
 assert.ok(!names('29462634940779f1015fe793').includes('坂町を知ろう'));
 assert.ok(!names('47348d4bbf1d3a4df2a3616e').includes('坂町を知ろう'));
 assert.ok(names('08370e552ea8b35028e9b88c').includes('坂町を知ろう'));
 for(const n of ['宝くじまちの音楽会','ラジオふるさと自慢うた自慢','広響＆萩原麻未コンサート']){
  assert.ok(names('07cbdeee1c8cfac58a2cdcca').includes(n));
  assert.ok(!names('ede19b1365e901eb8d2c1ce5').includes(n));
 }
});
test('Saka designated school programmes keep town scope and do not backdate future plans',()=>{
 const old=reviewHiroshima(source('29462634940779f1015fe793','34309'))!.projects;
 assert.ok(!old.some(p=>p.projectName==='人権教育総合推進地域事業'));
 const future=reviewHiroshima(source('90a341714420a90cf3a63214','34309'))!.projects;
 assert.ok(!future.some(p=>p.projectName==='探究的な学習の在り方に関する研究推進地域事業'));
 const current=reviewHiroshima(source('7165760cfcafcf8bc68fab39','34309'))!.projects;
 const selected=current.find(p=>p.projectName==='探究的な学習の在り方に関する研究推進地域事業')!;
 assert.ok(selected);assert.equal(selected.evaluatedFiscalYear,2022);assert.ok(selected.warnings.some(w=>w.includes('町の独自事業とは扱わない')));
 assert.equal(selected.amounts.length,0);assert.equal(selected.ratings.length,0);assert.equal(selected.indicators.length,0);
});
test('Sera preserves the literal fair title and does not turn birth-grant recipients into expenditure',()=>{
 const ps=reviewHiroshima(source('7ddaf70925bf3dbcd1deee78','34462'))!.projects;
 assert.ok(ps.some(p=>p.projectName==='福祉用具提示・体験フェア'));
 assert.ok(!ps.some(p=>p.projectName==='福祉用具展示・体験フェア'));
 const p=ps.find(p=>p.projectName==='はぴはぴ祝金事業')!;assert.ok(p);assert.equal(p.evaluatedFiscalYear,2023);assert.equal(p.amounts.length,0);
 assert.ok(!ps.some(p=>p.projectName==='紹介チャンネル掲載事業'));
});
test('Hiroshima refuses an invented title even when source bytes and quote remain unchanged',()=>{
 const c=hiroshimaRows.find(c=>c.sourceId==='02e1e4e07c7f437778e4a884')!;const before=c.rows[0].name;
 try{c.rows[0].name='原文にない事業名';assert.throws(()=>reviewHiroshima(source(c.sourceId,c.municipalityCode)),/title/);}finally{c.rows[0].name=before;}
});

test('Onomichi resolves culture and combined career sheets with bounded source evidence',()=>{
 for(const id of ['48be9ad3aad229f15735beb3','097054f0189853a027f9fb02','249f56389f65298e60bf6d47']){
  const ps=reviewHiroshima(source(id,'34205'))!.projects;
  for(const name of ['文化財愛護少年団事業','文化遺産パートナー養成講座'])assert.equal(ps.filter(p=>p.projectName===name).length,1);
 }
 for(const id of ['fede86bf82341474079d1c78','3ee3370f414dc61f49b936c7','e299c6de2073b91f7effd68f']){
  const ps=reviewHiroshima(source(id,'34205'))!.projects;
  assert.equal(ps.filter(p=>p.projectName.includes('キャリア')&&p.projectName.includes('勤労観')).length,1);
  assert.ok(!ps.some(p=>p.projectName==='職業観、勤労観の育成を図る事業'));
 }
 const old=reviewHiroshima(source('8a545b3f077af11b2c0472ea','34205'))!.projects;
 for(const name of ['尾道市美術展事業','家庭教育支援事業の推進'])assert.ok(old.some(p=>p.projectName===name));
 assert.ok(!old.some(p=>p.projectName.includes('推遡')||p.projectName.includes('小学教')));
});
test('Takehara body headers resolve interleaved names without correcting old table-of-contents labels',()=>{
 const old=reviewHiroshima(source('14b6083b6d35807412cadd08','34203'))!.projects;
 assert.ok(old.some(p=>p.projectName==='スタートカリキュラム'));
 assert.ok(!old.some(p=>p.projectName==='スタートカリュキラム'||p.projectName==='人材育成の推進'));
 const renamed=reviewHiroshima(source('b4b9165bf22d7fb9891e6a33','34203'))!.projects;
 assert.ok(renamed.some(p=>p.projectName==='幼保小連携教育'));
 assert.ok(!renamed.some(p=>p.projectName==='スタートカリキュラム'));
 const latest=reviewHiroshima(source('8ebbed9d5bcf26a8dbf7c150','34203'))!.projects;
 for(const name of ['特別支援教育','介助員配置','道徳教育推進','体力テストの分析を通した指導の工夫改善','トップアスリート等スポーツ教室'])assert.equal(latest.filter(p=>p.projectName===name).length,1);
 assert.ok(latest.every(p=>p.amounts.length===0&&p.ratings.length===0&&p.indicators.length===0));
});

test('Takehara independent labels use different source positions and preserve a single combined counselling unit',()=>{
 const old=reviewHiroshima(source('743451c8733c2d7371089a17','34203'))!.projects;
 assert.ok(old.some(p=>p.projectName==='組織的な生徒指導体制の確立'));
 assert.ok(!old.some(p=>p.projectName==='生徒指導支援員'||p.projectName==='教育相談事業'));
 for(const id of ['1cf5ac05cbb416fa376789d1','b4b9165bf22d7fb9891e6a33','79d92670653ab02fd1ac07b4']){
  const ps=reviewHiroshima(source(id,'34203'))!.projects;
  const a=ps.find(p=>p.projectName==='特別支援教育')!,b=ps.find(p=>p.projectName==='介助員配置')!;
  assert.ok(a&&b);assert.notEqual(a.id,b.id);assert.notEqual(a.evidence[0].cell,b.evidence[0].cell);
 }
});

test('Kure annual named activities preserve old centre identity and exclude next-year services and shared KPI costs',()=>{
 const old=reviewHiroshima(source('9dd9727937ed824a4938fa62','34202'))!.projects;
 assert.ok(old.some(p=>p.projectName==='呉市適応指導教室の運営'));
 assert.ok(!old.some(p=>p.projectName==='いいばしょサポーターの派遣'));
 const ps=reviewHiroshima(source('2b519a995cdae15d17fdf0fd','34202'))!.projects;
 assert.ok(ps.some(p=>p.projectName==='いいばしょサポーターの派遣'));
 assert.ok(!ps.some(p=>p.projectName.includes('呉こどもチャット相談')||p.projectName==='ＳＳＲ'));
 assert.ok(ps.every(p=>p.amounts.length===0&&p.ratings.length===0&&p.indicators.length===0));
});
test('Saka literal annual courses avoid splitting age counts and do not backdate designated programmes',()=>{
 const old=reviewHiroshima(source('c4d03a632696949eb0cee4cd','34309'))!.projects;
 assert.equal(old.filter(p=>p.projectName==='水泳教室').length,1);
 assert.ok(!old.some(p=>p.projectName==='１年生水泳教室'));
 for(const n of ['体操教室','友遊サタデー','海外研修事業','ひろしま県民ウオーキング大会'])assert.ok(old.some(p=>p.projectName===n));
 const next=reviewHiroshima(source('abd560855eb0bf3301cd5bc1','34309'))!.projects;
 for(const n of ['１年生水泳教室','２、３年生水泳教室'])assert.equal(next.filter(p=>p.projectName===n).length,1);
 assert.ok(!reviewHiroshima(source('29462634940779f1015fe793','34309'))!.projects.some(p=>p.projectName==='１年生水泳教室'));
 const n='「英語で教室から世界とつながる」プラットフォーム事業';
 assert.ok(!reviewHiroshima(source('08370e552ea8b35028e9b88c','34309'))!.projects.some(p=>p.projectName===n));
 assert.ok(reviewHiroshima(source('47348d4bbf1d3a4df2a3616e','34309'))!.projects.some(p=>p.projectName===n));
});
test('Onomichi legacy books preserve the change of support scheme and do not duplicate component music activities',()=>{
 const old=reviewHiroshima(source('45399a74fe0fd15a9b0b68f2','34205'))!.projects;
 const next=reviewHiroshima(source('88c8acb3dd563a208b7035b8','34205'))!.projects;
 assert.ok(old.some(p=>p.projectName==='学校支援地域本部事業'));
 assert.ok(!next.some(p=>p.projectName==='学校支援地域本部事業'));
 assert.ok(next.some(p=>p.projectName==='地域教育支援活動促進事業'));
 for(const ps of [old,next]){
  assert.ok(ps.some(p=>p.projectName==='小中学校の芸術活動を推進する事業'));
  assert.ok(!ps.some(p=>p.projectName==='感動と夢の学校音楽振興事業'));
  assert.ok(ps.every(p=>p.amounts.length===0&&p.ratings.length===0&&p.indicators.length===0));
 }
});
test('Hiroshima city keeps explicit named grant and facility units separate from policy and plan totals',()=>{
 const old=reviewHiroshima(source('d23c00cd3bb2aed6ea16812e','34100'))!.projects;
 const next=reviewHiroshima(source('17b9ab9bcd52af6de179e1e2','34100'))!.projects;
 assert.ok(old.some(p=>p.projectName==='北部地区学校給食センター(仮称)の整備'));
 assert.ok(next.some(p=>p.projectName==='北部地区学校給食センターの整備'));
 assert.ok(next.some(p=>p.projectName==='ひろしまＬＭＯ一括交付金'));
 for(const ps of [old,next])assert.ok(!ps.some(p=>p.projectName==='学校給食の充実'||p.projectName==='下水道事業の経営改善'));
});

test('Saka signboard completion binds the assessed year and does not turn the next-year reference into a new project',()=>{
 const name='町内史跡案内看板事業';
 const ps=reviewHiroshima(source('7bf6d509b4c79f59ba41295c','34309'))!.projects;
 const p=ps.find(p=>p.projectName===name)!;assert.ok(p);assert.equal(p.evaluatedFiscalYear,2021);
 assert.ok(p.evidence.some(e=>e.rawText?.includes('今年度終了')));
 assert.ok(!reviewHiroshima(source('7165760cfcafcf8bc68fab39','34309'))!.projects.some(p=>p.projectName===name));
});
test('Onomichi operational names respect blank repeated headings and keep separate standard tests and school support',()=>{
 for(const [id,y] of [['45399a74fe0fd15a9b0b68f2',2010],['88c8acb3dd563a208b7035b8',2011]] as const){
  const ps=reviewHiroshima(source(id,'34205'))!.projects;
  for(const n of ['標準学力検査','学校選択制度を充実する取組','尾道教育研究会を支援する取組','図書館資料の整備・充実'])assert.equal(ps.filter(p=>p.projectName===n&&p.evaluatedFiscalYear===y).length,1);
  assert.ok(!ps.some(p=>p.projectName==='基礎的・基本的な知識・技能の習得'||p.projectName==='学識経験者の意見等'));
 }
 const ps=reviewHiroshima(source('88c8acb3dd563a208b7035b8','34205'))!.projects;
 assert.ok(ps.some(p=>p.projectName==='中学校学力向上対策事業'));
 assert.ok(!ps.some(p=>p.projectName==='学校共同事務の効率的な運用を図る取組'));
});
test('Onomichi legacy cultural and repair subunits do not duplicate an existing parent or invent shared costs',()=>{
 for(const [id,y] of [['45399a74fe0fd15a9b0b68f2',2010],['88c8acb3dd563a208b7035b8',2011]] as const){
  const ps=reviewHiroshima(source(id,'34205'))!.projects;
  assert.ok(ps.some(p=>p.projectName===`せとだパリ祭 ${y}`));
  assert.ok(ps.some(p=>p.projectName==='東尾道市民スポーツ広場整備'));
  assert.ok(!ps.some(p=>p.projectName==='仲道郁代ピアノコンサート'||p.projectName==='その他、既存の社会体育施設等の修繕'));
  assert.ok(ps.every(p=>p.amounts.length===0&&p.ratings.length===0&&p.indicators.length===0));
 }
 assert.ok(!reviewHiroshima(source('88c8acb3dd563a208b7035b8','34205'))!.projects.some(p=>p.projectName==='秘書検定講座'));
});
test('Hiroshima city annual service results do not backdate online appointments or split application counts',()=>{
 const old=reviewHiroshima(source('d23c00cd3bb2aed6ea16812e','34100'))!.projects;
 const next=reviewHiroshima(source('17b9ab9bcd52af6de179e1e2','34100'))!.projects;
 for(const n of ['申請書作成支援システムの導入','広島市オンライン手続ポータルサイト'])assert.ok(old.some(p=>p.projectName===n));
 const name='マイナンバーカード関連業務のオンライン来庁予約';assert.ok(next.some(p=>p.projectName===name));assert.ok(!old.some(p=>p.projectName===name));
 for(const ps of [old,next])assert.equal(ps.filter(p=>p.projectName==='相談支援包括化推進員の配置').length,1);
});
test('Onomichi OCR followup uses readable names and bounds the current sheet rather than repairing garbled names',()=>{
 const ps=reviewHiroshima(source('eeb6f9bb3c2f44b3d04b01fc','34205'))!.projects;
 for(const n of ['地域教育支援活動促進事業','市民音楽芸能祭','けんみん文化祭','囲碁のまちづくり活動の支援'])assert.equal(ps.filter(p=>p.projectName===n).length,1);
 assert.ok(!ps.some(p=>p.projectName==='新人演奏会'||p.projectName==='展覧会企画運営事業'));
 assert.ok(ps.every(p=>p.evaluatedFiscalYear===2014));
});
