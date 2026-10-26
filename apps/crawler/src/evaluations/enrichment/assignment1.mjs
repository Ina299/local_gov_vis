import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
if(!process.argv[3])throw Error('Usage: node assignment1.mjs <repository> <assignment-and-output-directory>');
const root=resolve(process.argv[2]),dir=resolve(process.argv[3]);
const read=p=>JSON.parse(readFileSync(p,'utf8'));const hash=x=>createHash('sha256').update(x).digest('hex');
const pub=join(root,'apps/web/public'), assignment=read(join(dir,'assignment-1.json'));
const manifestPath=join(root,'data/evaluations/enrichment-provenance.json');
const manifest=existsSync(manifestPath)?read(manifestPath):null;
const index=manifest?manifest.baseIndex:read(join(pub,'evaluations-index.json'));
if(manifest&&hash(JSON.stringify(index)+'\n')!==manifest.baseIndexSha256)throw Error('Enrichment base index hash mismatch');
const datasets=new Map(index.municipalities.filter(r=>r.datasetPath).map(r=>[r.municipalityCode,read(join(pub,r.datasetPath)).projects]));
const patches=[],reviews=[];
function proof(d,quote){const start=d.text.indexOf(quote);if(!quote||start<0)throw Error('nonliteral proof');return {sourceId:d.sourceId,sourceUrl:d.sourceUrl,sourceSha256:d.sourceSha256,textSha256:hash(d.text),quote,cell:`extracted-text:chars:${start}-${start+quote.length}`};}
const metadata=new Map();
function ev(d,p){if(!metadata.has(d.municipalityCode))metadata.set(d.municipalityCode,read(join(pub,'evaluation-evidence/municipalities',d.municipalityCode+'.json')));const src=metadata.get(d.municipalityCode).sources.find(s=>s.id===d.sourceId);if(!src?.acquisition?.fetchedAt)throw Error('Missing acquisition metadata');return {sourceUrl:p.sourceUrl,sourcePageUrl:p.sourceUrl,format:src.format,fetchedAt:src.acquisition.fetchedAt,sha256:p.sourceSha256,rawText:p.quote,page:null,sheet:null,cell:p.cell};}
function span(s,begin,end){const a=s.indexOf(begin);const b=s.indexOf(end,a+begin.length);return a>=0&&b>a?s.slice(a,b).trim():null;}
function set(p,d,key,value){if(p.before[key]!==null||!value)return;p.set[key]={value,proofs:[proof(d,value)]};}
function create(d,record){return {id:`enrichment-1-${hash(record.id).slice(0,24)}`,municipalityCode:d.municipalityCode,projectId:record.id,beforeRecordSha256:hash(JSON.stringify(record)+'\n'),identity:{reason:'既存票と同一の原典URL及び内容ハッシュを照合し、原典先頭の事業名称を含む単独個票と対応した。',proofs:[proof(d,d.text.slice(0,d.text.indexOf('\n',d.text.indexOf('事業名'))+1)||d.text.slice(0,500))]},set:{},before:record};}
for(const source of assignment){
 const d=read(join(pub,'evaluation-evidence/documents',`${source.documentId}.json`));const records=(datasets.get(source.code)??[]).filter(p=>p.evidence.some(e=>e.sourceUrl===d.sourceUrl&&e.sha256===d.sourceSha256));const review={documentId:source.documentId,code:source.code,status:'unreviewed',reason:'原典と現公開レコードの同一性及び補強可能欄を精査中。',evidenceQuotes:source.evidenceQuotes,remainingScope:source.remainingScope,projectIds:records.map(p=>p.id),patchIds:[]};
 if(['40205','43216'].includes(source.code)&&records.length===1&&d.text.includes('事務事業')){
  const r=records[0],p=create(d,r);
  if(source.code==='40205'){
   const section=span(d.text,'２．事務事業の概要及び目的','３．活動指標');
   if(section){set(p,d,'activities',span(section,'手 方法・働きかけ','対象をどのように'));const a=section.indexOf('対象をどのように');if(a>=0)set(p,d,'purpose',section.slice(a).trim());}
   review.remainingScope='概要・目的の第２節から手段と意図を原文ラベルごと分離。既存成果/指標/費用は保持。評価実施年度は対象年度見出しと作成年が異なるため推定せず、費用の欠落列・非数値指標は別途精査。';
  } else {
   set(p,d,'activities',span(d.text,'【事業の内容】','【主な予算費目】'));
   const m=/①\s*6年度事務事業の成果・実績/.exec(d.text);if(m){const end=d.text.indexOf('②',m.index+m[0].length);if(end>=0)set(p,d,'outcomes',d.text.slice(m.index,end).trim());}
   review.remainingScope='事業の内容・業務の流れと令和６年度成果実績を原文区分のまま分離。将来計画・総括の選択肢は実施成果としない。費用表の欠落第４年度見出しと列対応不確定は保留。';
  }
  delete p.before;
  if(Object.keys(p.set).length){patches.push(p);review.patchIds.push(p.id);review.status='enriched';review.reason=`原典単独個票と既存票をURL・ハッシュ・事業名称で照合し、未入力${Object.keys(p.set).join('／')}を完全一致原文から補強。`;review.evidenceQuotes=[...p.identity.proofs,...Object.values(p.set).flatMap(x=>x.proofs)].map(x=>x.quote);}
  else {review.status='held';review.reason='同一個票は特定できたが、既存非null値又は本文の確定区分外のため補強を保留。';}
 }

 if(source.code==='02206'&&records.length===1){
  const r=records[0],p=create(d,r);const first=d.text.split('重点化内容')[0];
  const purpose=/^目的 .+$/m.exec(first);if(purpose)set(p,d,'purpose',purpose[0]);
  set(p,d,'activities',span(first,'実施内容','事業実績'));
  set(p,d,'outcomes',span(first,'達成状況','今後の方向性'));
  const fyQuote='事業実績（成果指標以外） 令和６年度 令和７年度 令和８年度';
  if(r.evaluatedFiscalYear===null&&first.includes(fyQuote))p.set.evaluatedFiscalYear={value:2024,proofs:[proof(d,fyQuote)]};
  const cycle=/令和７年度第[２2]回外部評価委員会/.exec(d.text);if(cycle&&r.evaluationYear===null)p.set.evaluationYear={value:2025,proofs:[proof(d,cycle[0])]};
  p.append={ratings:[]};
  for(const label of ['達成状況','今後の方向性']){const m=new RegExp(`^${label} (.+)$`,'m').exec(first);if(m){const e=proof(d,m[0]);p.append.ratings.push({value:{kind:'self',label,value:m[1],scale:null,evidence:ev(d,e)},proofs:[e]});}}
  const table=span(first,'現状値の推移','令和６年度 令和７年度 令和８年度\n事業費');
  if(table){const vals=[];for(const m of table.matchAll(/^([①②③]?)(.+?) ([①②③]?)([\d,０-９]+)(件|人|科) ([①②③]?)([\d,０-９]+)(件|人|科)$/gm))if(m[5]===m[8])vals.push({name:m[2],actual:m[4],target:m[7],unit:m[5],raw:m[0]});
   p.append.indicators=vals.flatMap(v=>[2024,2026].map(y=>{const e=proof(d,table);return {value:{name:'【成果指標】'+v.name,fiscalYear:y,actual:y===2024?v.actual:null,target:y===2026?v.target:null,unit:v.unit,evidence:ev(d,e)},proofs:[e]};}));
  }
  delete p.before;patches.push(p);review.status='enriched';review.patchIds.push(p.id);review.reason='既存の名称のみの個票と同一原典を確認し、目的・実施内容・成果評価・明示年度・自己評価を原文から補強。';review.evidenceQuotes=[...p.identity.proofs,...Object.values(p.set).flatMap(x=>x.proofs)].map(x=>x.quote);review.remainingScope='事業費は当年度/翌年度の決算・予算区分が検証票単体で明記されず保留。公共交通の121,481と参考121,482千円の差は未解決。成果指標の令和８年度目標を令和６年度実績と分離。折返し指標名とデジタル満足度の特殊単位は保留。';
 }

 if(['15307','20202','47207'].includes(source.code)&&records.length){
  const delimiter=source.code==='15307'?/令和６年度事業の政策評価シート/g:source.code==='20202'?/令和\s*8年度\s*事務事業評価表/g:/行政評価シート（令和６年度実施事業）/g;
  const starts=[...d.text.matchAll(delimiter)];const normalize=x=>x.replace(/\s/g,'');
  for(let i=0;i<starts.length;i++){
   if(i===starts.length-1&&d.truncated)continue;
   const block=d.text.slice(starts[i].index,starts[i+1]?.index??d.text.length);
   const h=source.code==='20202'?/事務事業名 ([\s\S]*?)\n担当所属/.exec(block):source.code==='15307'?/事業名 ([\s\S]*?) 運営方法[^\n]*\n/.exec(block):/事業No\. ([^ ]+) 所管課[^\n]*\n経費区分[^\n]*事業名 ([^\n]+)/.exec(block);
   if(!h)continue;const matched=records.filter(r=>source.code==='47207'?r.projectCode===h[1]:normalize(r.projectName)===normalize(h[1]));if(matched.length!==1)continue;
   const r=matched[0],p=create(d,r);p.identity.proofs=[proof(d,h[0])];
   if(source.code==='15307'){
    const start=h.index+h[0].length,end=block.indexOf('Do（実施）',start);if(end>start)set(p,d,'activities',block.slice(start,end).trim());
    set(p,d,'outcomes',span(block,'３成果指標（令和６年度実績）','Check（評価）'));
   } else if(source.code==='20202'){
    const purpose=span(block,'趣旨・目的','内容 活動指標')?.split('\n内容\n')[0];
    if(purpose&&!/[①②③]|対象指標|単位/.test(purpose))set(p,d,'purpose',purpose);
   } else {
    const activityRegion=span(block,'事業\n','R4年度 R5年度 R6年度');
    const activityHead=activityRegion?[...activityRegion.matchAll(/^事業\n/gm)].at(-1):null;
    if(activityHead)set(p,d,'activities',activityRegion.slice(activityHead.index));
    const outcomeStart=r.id.endsWith('-p50')?'「養殖魚類種苗の輸送費支援」について、当初の輸送回数を12回に分けて輸送する計画だったが、本':'R6年度アウトカム指標';
    const outcome=span(block,outcomeStart,'第１次評価');
    if(outcome&&outcome.replace(/R6年度アウトカム指標|未達成理由|（未達成の場合に記入）|\d+ ページ|\s/g,'').length)set(p,d,'outcomes',outcome);
   }
   delete p.before;if(Object.keys(p.set).length){patches.push(p);review.patchIds.push(p.id);}
  }
  review.status=review.patchIds.length?'enriched':'held';review.reason='既存出典に属する各票を資料中の事業名又は事業コードで一意対応し、完結した個票内の見出し区間のみ補強。';review.evidenceQuotes=[d.text.slice(starts[0]?.index??0,(starts[0]?.index??0)+160)];review.remainingScope=source.code==='15307'?'終端切断の個票を除外。目次のみの既存事業は補強しない。成果欄は成果指標と要因分析の原文区間を保持し、設定なし・非数値指標を数値化しない。':source.code==='20202'?'本文の完結個票と同名の既存票のみ目的を補強。活動説明は右列の指標名が混在するため保留。目次のみの事業及び末尾未完票へ本文の別事業内容を転用しない。':'事業コードで特定した個票の事業内容とアウトカム未達成理由を分離。未達成理由の本文が空で見出し・ページ番号のみの欄はnullを保持。めざす目的欄は見出し前後に文章が跨がるため保留。将来予算・目標や丸印位置を推測して追加しない。';
 }

 if(source.code==='13212'&&records.length){
  for(const r of records){const raws=r.evidence.filter(e=>e.sourceUrl===d.sourceUrl&&d.text.includes(e.rawText));const e=raws.find(e=>e.rawText.includes('評価者意見の概要'));if(!e)continue;const a=e.rawText.indexOf('評価者意見の概要'),v=e.rawText.slice(a).trim();const p=create(d,r);p.identity.proofs=[proof(d,e.rawText)];set(p,d,'outcomes',v);delete p.before;if(Object.keys(p.set).length){patches.push(p);review.patchIds.push(p.id);}}
  review.status=review.patchIds.length?'enriched':'reviewed_no_change';review.reason='既存31票の元証拠に含む評価者意見の概要を同一票の評価記述として分離し、意見である原文見出しを保持。';review.remainingScope='外部意見の記述を数値実績や因果効果に置き換えない。別章６提案は複数事業・制度全体への提言を含むため単票に重ねて割り当てない。';
 }
 if(source.code==='35206'&&records.length){
  for(const r of records){if(['30','50','233'].includes(r.projectCode))continue;const line=d.text.split('\n').find(l=>l.startsWith(r.projectCode+' ')&&l.includes(r.projectName));if(!line)continue;const tail=line.slice(line.indexOf(r.projectName)+r.projectName.length).trim();const m=/^(.+。) ([\d,]+|－|-) ([\d,]+|－|-)(?: |$)/.exec(tail);if(!m)continue;const p=create(d,r);p.identity.proofs=[proof(d,line)];set(p,d,'activities',m[1]);delete p.before;if(Object.keys(p.set).length){patches.push(p);review.patchIds.push(p.id);}}
  review.status=review.patchIds.length?'enriched':'held';review.reason='一覧の既存事業番号と名称が同じ一行内で一致し、事業内容の句点と二つの費用列の境界が確定する行のみ補強。';review.remainingScope='事業番号30・50・233は説明の冒頭が前行へ折り返され、一行の末尾断片だけになるため除外。他の説明が事業番号行の前後に折り返された行、名称の改行・表記差、複数列混線は分離を保留。R6決算/R7予算の既存値は保持し、方向性を活動に混入しない。';
 }
 if(source.documentId==='db0d1e8fda886d55fbade986'){
  const starts=[...d.text.matchAll(/事務事業評価シート 事業番号 (\d+)/g)];
  for(let i=0;i<starts.length;i++){const m=starts[i],block=d.text.slice(m.index,starts[i+1]?.index??d.text.length);const r=records.find(p=>p.projectCode===m[1]);if(!r)continue;const start=block.indexOf('【事業費の推移');const end=block.indexOf('内容 ',start);if(start<0||end<0)continue;const raw=block.slice(start,end);if(!raw.includes('決算額')||!raw.includes('千円'))continue;const p=create(d,r);p.identity.proofs=[proof(d,block.slice(0,block.indexOf('２.担当部名')))];p.identity.reason='既存の同一原典URL・ハッシュの評価票と、同資料付属の事業番号を照合し、対応する内部個票の決算推移表を同定した。';p.append={amounts:[]};
   for(const m of raw.matchAll(/^H(19|20|21) ([\d,]+)(?: |$)/gm)){const fiscalYear=1988+Number(m[1]),value=Number(m[2].replace(/,/g,''))*1000;if(r.amounts.some(a=>a.kind==='actual'&&a.fiscalYear===fiscalYear))continue;const e=proof(d,raw);p.append.amounts.push({value:{kind:'actual',fiscalYear,amountYen:value,rawValue:m[2],rawUnit:'千円',evidence:ev(d,e)},proofs:[e]});}
   delete p.before;if(p.append.amounts.length){patches.push(p);review.patchIds.push(p.id);}
  }
  review.status=review.patchIds.length?'enriched':'reviewed_no_change';review.reason='同原典の評価番号で内部付属票を対応付け、決算額と千円が明記された過年度推移表の第一列だけ補強。';review.remainingScope='見出し前後に文章が跨る第８・９欄の目的/活動の境界は保留。人件費概算を実支出に混ぜず、H22予算とH19～H21決算を区別。既存非null金額は変更しない。';
 }

 if(source.code==='40220'&&records.length){
  for(const r of records){const e=r.evidence.find(e=>e.sourceUrl===d.sourceUrl&&d.text.includes(e.rawText));if(!e)continue;const m=/■事業概要■( ■事業評価■)?\n([\s\S]*?)\n（(?:一般|特別)/.exec(e.rawText);if(!m||!r.department||!m[2].startsWith(r.department))continue;const value=m[2].slice(r.department.length).trim();if(!value.endsWith('。')||(m[1]&&value.includes('\n')))continue;const p=create(d,r);p.identity.proofs=[proof(d,e.rawText)];set(p,d,'activities',value);delete p.before;if(Object.keys(p.set).length){patches.push(p);review.patchIds.push(p.id);}}
  review.status=review.patchIds.length?'enriched':'held';review.reason='既存の事業別原文証拠と照合し、事業概要から会計科目までの完結説明を活動として分離。右列評価が並ぶ年度は一行完結のみ採用。';review.remainingScope='既存の実績成果欄は保持。右列評価が混入する複数行の概要、会計行より前後へ折返す説明、末尾切断部分は未分離。施策総括は同名だけでは個票と同一性を決めない。';
 }

 if(source.code==='13106'&&records.length===1){const p=create(d,records[0]);set(p,d,'outcomes',span(d.text,'目的達成度 3','［総合評価］'));delete p.before;if(Object.keys(p.set).length){patches.push(p);review.patchIds.push(p.id);}review.status=review.patchIds.length?'enriched':'reviewed_no_change';review.reason='既存行政経営推進の目的・活動は保持し、同一票の目的達成度評価とその説明を原文ラベル付きで分離。';review.remainingScope='既存費用・指標・評価尺度は変更しない。総合評価欄の横並び方向性選択肢は新たな達成度として追加しない。';}
 if(review.status==='unreviewed'){
  const shortNavigation=d.text.length<200;
  review.status=shortNavigation?'reviewed_no_change':'held';
  review.reason=shortNavigation?'保存本文全体は案内題名・リンク名のみで、個別事業の目的、実施説明、成果又は費用本文が存在しない。':source.reason;
  const scopes={
   '37202':'旧年度横長表は同年度同名候補があるが、名称折返しと説明・指標・所見の横列混線で事業ごとの値の帰属が未確定。元PDFの段組座標で再照合するまで別資料の同名票へ補強しない。',
   '12231':'目的・概要と実績が同じ行へ横並び抽出され、文章の左右列分離が確定しない。既存2025評価年度を非null変更する操作は今回仕様外。施策評価や集計表の合計値を個別事業へ転用しない。',
   '12228':'既存50行は2026評価・2025実施で本資料と同年度だが、横長一覧の目的/事業概要/成果/方向性が行間で混在し、同名だけで各文章の帰属を確定できない。欄座標による再照合待ち。',
   '14217':'５交付金個票は複数年度の取組と左列概要/KPIが混線。重点プロジェクト資料は同名表現があっても実施年度・個票単位が相違し、既存10取組や５交付金事業との同一性を確定できない。共同自治体KPIの合計値を南足柄単独へ補強しない。',
   '24204':'第２章は施策の実行宣言・総括で、現公開第３章個票50事業と一致する固有事業名が確認できない。計画施策の成果/予算を個別事業に割り当てない。',
   '20206':'施策評価資料と既存28事業行は同じ2021年度だが、地域生活支援事業等の言及を含む施策全体の説明を単一事業成果へ配分できない。',
   '20210':'既存の事業別評価・提言はoutcomesとして収録済み。抽出の背景は事業目的そのものではなく、小中学校合同記述や政策/会計全体の提言は一票に帰属不可。参考資料の予算/現計/決算と人件費の列対応未確定。',
   '40220':'施策総括は既存決算個票と呼称・集計範囲が異なる。R2～R4は同年度でも総括内呼称と個票コード対応が確定せず、R6は長期回顧で単年帰属不可。',
   '36341':'東部15市町村共同DMOの説明・受託事業で、石井町の既存事業レコードがなく単独自治体帰属も未確定。新規事業化や共同額の配分はしない。',
  };
  review.remainingScope=shortNavigation?'リンク先本文は今回保存キャッシュに含まれず補強不可。既存レコードの非null値や他事業へ案内題名を転用しない。':scopes[source.code]??'保存本文の文字化けにより事業名・年度・値を確定できない。推定復号は正式な原文証拠に置き換えず、既存票への対応を保留。';
  review.evidenceQuotes=source.evidenceQuotes.filter(q=>d.text.includes(q));if(!review.evidenceQuotes.length)review.evidenceQuotes=[d.text.slice(0,Math.min(300,d.text.length))];
 }
 reviews.push(review);
}
writeFileSync(join(dir,'patches-1.json'),JSON.stringify({schemaVersion:1,generatedAt:'2026-10-18T00:00:00.000Z',patches},null,2)+'\n');
// Financial candidates are withheld: the assessment year does not identify the fiscal year of 本年度実績.
for(const review of reviews.filter(r=>r.code==='40205')){
 review.remainingScope+=' 飯塚37資料の再点検全体で得た費用44値・指標8値の追加候補は不採用。表題の評価年度と「本年度実績」の対応する対象会計年度が資料に明記されず、FY2023へ割り当てられない。前年度の相対年換算も行わない。折返し指標名は原文連続文字列として確定できず保留。';
}
writeFileSync(join(dir,'review-1.json'),JSON.stringify(reviews,null,2)+'\n');
console.log(JSON.stringify({patches:patches.length,fields:patches.reduce((s,p)=>s+Object.keys(p.set).length,0),unreviewed:reviews.filter(r=>r.status==='unreviewed').length}));
