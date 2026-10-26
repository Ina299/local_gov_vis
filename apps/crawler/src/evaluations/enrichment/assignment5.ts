import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=process.argv[2]??process.cwd(),dir=process.argv[3]??resolve(root,'apps/crawler/output/enrichment-assignment5');
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const base=resolve(root,'apps/web/public'),manifest=resolve(root,'data/evaluations/enrichment-provenance.json');
const index=existsSync(manifest)?read(manifest).baseIndex:read(resolve(base,'evaluations-index.json'));
// The CLI input directory holds assignment-5.json; output patches always hash the immutable prior layer.
const assignment=read(resolve(dir,'assignment-5.json'));
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)+'\n').digest('hex');
const patches:any[]=[],reviews:any[]=[];
for(const item of assignment){
 const code=item.code,id=item.documentId,d=read(resolve(base,`evaluation-evidence/documents/${id}.json`));
 const row=index.municipalities.find((x:any)=>x.municipalityCode===code);
 const records=row?.datasetPath?read(resolve(base,row.datasetPath)).projects:[];
 const related=records.filter((p:any)=>p.evidence.some((e:any)=>e.sourceUrl===d.sourceUrl&&e.sha256===d.sourceSha256));
 const proof=(quote:string,start=d.text.indexOf(quote))=>{if(quote.trim().length<8&&start>=0){const end=start+quote.length+12;start=Math.max(0,start-12);quote=d.text.slice(start,end);}if(start<0||d.text.slice(start,start+quote.length)!==quote)throw Error('bad quote');return {sourceId:id,sourceUrl:d.sourceUrl,sourceSha256:d.sourceSha256,textSha256:d.textSha256,quote,cell:`extracted-text:chars:${start}-${start+quote.length}`};};
 let count=0;const fields:Record<string,number>={};
 if(code==='28203'){
  const hs=[...d.text.matchAll(/^令和７年度 事務事業点検シート/gm)];
  for(let i=0;i<hs.length;i++){
   const start=hs[i].index!,raw=d.text.slice(start,hs[i+1]?.index??d.text.length);
   const no=raw.match(/整理番号 ([^\n]+?)(?: 事務事業名|$)/m)?.[1]?.replaceAll(/\s/g,'');
   const name=raw.match(/事務事業名\n([^\n]+)\n分割/ )?.[1]??raw.match(/整理番号 [^\n]+? 事務事業名 ([^\n]+)/)?.[1];if(!no||!name)continue;
   const ps=related.filter((p:any)=>p.projectName===name&&p.projectCode?.replaceAll(/\s/g,'')===no);if(ps.length!==1)continue;
   const p=ps[0],set:any={};
   const purpose=raw.match(/目的（誰を・何を、どういう状態にしたいのか）\n([^]*?)(?=^[^\n]*成果指標)/m);
   const outcomes=raw.match(/指標で表せない成果\n([^]*?)(?=^観点（)/m);
   for(const [key,m]of [['purpose',purpose],['outcomes',outcomes]] as const){
    if(p[key]!==null||!m)continue;const value=m[1].trim();if(value.length<10||!/[ぁ-んァ-ヶ一-龠]{3}/.test(value))continue;
    set[key]={value,proofs:[proof(m[0],start+m.index!)]};fields[key]=(fields[key]??0)+1;
   }
   if(Object.keys(set).length){const old=patches.find(x=>x.projectId===p.id);if(old){Object.assign(old.set,set);continue;}patches.push({id:`enrich-5-${code}-${createHash('sha256').update(p.id).digest('hex').slice(0,16)}`,municipalityCode:code,projectId:p.id,beforeRecordSha256:sha(p),identity:{reason:'既存レコードと同じ原典URL・原典ハッシュの個票に記載された整理番号及び事業名が完全一致する。',proofs:[proof(raw.slice(0,Math.max(raw.indexOf('分割/統合'),raw.indexOf('事務事業名')+name.length+12)),start)]},set});count++;}
  }
 }

 const add=(p:any,values:Record<string,{value:any;proofs:any[]}>,identityQuote:string)=>{
  const set=Object.fromEntries(Object.entries(values).filter(([k])=>p[k]===null));if(!Object.keys(set).length)return;
  let patch=patches.find(x=>x.projectId===p.id);
  if(!patch){patch={id:`enrich-5-${code}-${createHash('sha256').update(p.id).digest('hex').slice(0,16)}`,municipalityCode:code,projectId:p.id,beforeRecordSha256:sha(p),identity:{reason:'既存レコードの原典URLと原典ハッシュが一致し、同じ原典の事業名に対応する独立個票の項目を確認した。',proofs:[proof(identityQuote)]},set:{}};patches.push(patch);count++;}
  for(const[k,v]of Object.entries(set)){if(!patch.set[k]){patch.set[k]=v;fields[k]=(fields[k]??0)+1;}}
 };
 if(code==='11232'){
  const hs=[...d.text.matchAll(/^令和５年度 事務事業評価シート/gm)];
  for(let i=0;i<hs.length;i++){const raw=d.text.slice(hs[i].index,hs[i+1]?.index??d.text.length),h=raw.match(/事務事業名 ([^\n]+?) 事務事業整理番号 (\d+)/);if(!h)continue;
   const p=related.find((p:any)=>p.projectCode===h[2]&&p.projectName===h[1]);if(!p)continue;const values:any={};
   for(const[k,m]of [['purpose',raw.match(/事務事業本来 ([^]*?)(?=\n所管部課)/)],['activities',raw.match(/２．事務事業の実施結果\n([^]*?)(?=\n令和３年度 令和４年度 令和５年度)/)]] as const){if(m&&m[1].trim().length>10)values[k]={value:m[1].trim(),proofs:[proof(m[0])]};}
   add(p,values,h[0]);
  }
 }
 if(code==='22210'){
  const hs=[...d.text.matchAll(/^事務事業評価調書/gm)];
  for(let i=0;i<hs.length;i++){const raw=d.text.slice(hs[i].index,hs[i+1]?.index??d.text.length),h=raw.match(/事務事業名 ([^\n]+?) 担当課 ([^\n]+)/);if(!h)continue;
   const ps=related.filter((p:any)=>p.projectName===h[1]);if(ps.length!==1)continue;const p=ps[0],values:any={};
   const pur=raw.match(/目的志向型(?:\n| )([^]*?)(?=\n事務分掌)/),act=raw.match(/令和７年度 ([^]*?)(?=\n令和８年度)/);
   for(const[k,m]of [['purpose',pur],['activities',act]] as const){if(m&&m[1].trim().length>10)values[k]={value:m[1].trim(),proofs:[proof(m[0])]};}
   if(act)values.evaluatedFiscalYear={value:2025,proofs:[proof(act[0])]};add(p,values,h[0]);
  }
 }



 if(id==='446b28e05121f4e08ad40530'){
  const original=read(resolve(base,'evaluation-evidence/documents/1a50b0c38ed8dbabae1fdf68.json'));
  const src=read(resolve(base,'evaluation-evidence/municipalities/34209.json')).sources.find((x:any)=>x.id===id);
  const hs=[...d.text.matchAll(/^[⑴-⑻] ([^\n]+)$/gm)].filter((m:any)=>!m[1].includes('課）'));
  for(let i=0;i<hs.length;i++){const h=hs[i],ps=records.filter((p:any)=>p.projectName.normalize('NFKC')===h[1].normalize('NFKC')&&p.evaluationYear===2025);if(ps.length!==1)continue;const p=ps[0];
   if(p.evidence.some((e:any)=>e.sourceUrl===d.sourceUrl))continue;
   if(!p.evidence.some((e:any)=>e.sourceUrl===original.sourceUrl&&e.sha256===original.sourceSha256))continue;
   const at=original.text.indexOf(p.projectName);if(at<0)continue;const left=at<0?0:original.text.lastIndexOf('\n',at)+1,right=at<0?original.text.indexOf('\n'):original.text.indexOf('\n',at),iq=original.text.slice(left,right<0?undefined:right);
   let end=hs[i+1]?.index??d.text.indexOf('４ 評価全体');if(end<0)end=d.text.length;
   const quote=d.text.slice(h.index,end).trim(),pr=proof(quote,h.index);
   patches.push({id:`enrich-5-${code}-${createHash('sha256').update(p.id).digest('hex').slice(0,16)}`,municipalityCode:code,projectId:p.id,beforeRecordSha256:sha(p),identity:{reason:'令和７年度の既存個票と同年度外部評価の対象一覧を事業名で一意照合し、原典の年度見出しと外部評価の事業名を保持する。既存個票の本文末尾が切詰の場合は既存構造化名称との完全一致に限定する。',proofs:[{sourceId:original.sourceId,sourceUrl:original.sourceUrl,sourceSha256:original.sourceSha256,textSha256:original.textSha256,quote:iq,cell:`extracted-text:chars:${left}-${left+iq.length}`},proof(h[0]),proof(d.text.slice(0,205))]},append:{evidence:[{value:{sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,format:src.format,fetchedAt:src.acquisition.fetchedAt,sha256:d.sourceSha256,rawText:quote,page:null,sheet:null,cell:pr.cell},proofs:[pr]}]}});count++;fields.evidence=(fields.evidence??0)+1;
  }
 }
 if(code==='11230'&&id!=='ff808650a4e0bba52dd8946c'){
  const original=read(resolve(base,'evaluation-evidence/documents/ff808650a4e0bba52dd8946c.json'));
  const hs=[...d.text.matchAll(/^No\. \d+\n第５次新座市総合計画実施計画 事務事業評価シート/gm)];
  for(let i=0;i<hs.length;i++){const raw=d.text.slice(hs[i].index,hs[i+1]?.index??d.text.length),h=raw.match(/^事業 ([^\n]+)/m);if(!h)continue;
   const ps=records.filter((p:any)=>p.projectName.normalize('NFKC')===h[1].normalize('NFKC')&&p.evaluatedFiscalYear===2025);if(ps.length!==1)continue;const p=ps[0];
   if(!p.evidence.some((e:any)=>e.sourceUrl===original.sourceUrl&&e.sha256===original.sourceSha256))continue;
   const at=original.text.indexOf(p.projectName);if(at<0)continue;
   const m=raw.match(/事業概要 ([^]*?)(?=\n事業の成果・分析)/);if(!m||m[1].trim().length<10||m[1].length>1500||/[^\n] [^\n]/.test(m[1])||!m[1].trim().endsWith('。'))continue;
   add(p,{outcomes:{value:m[1].trim(),proofs:[proof(m[0])]}},h[0]);
   const patch=patches.find(x=>x.projectId===p.id);if(!patch)continue;
   const start=original.text.lastIndexOf('\n',at)+1,end=original.text.indexOf('\n',at),quote=original.text.slice(start,end<0?undefined:end);
   patch.identity={reason:'既存の令和７年度実績一覧と同年度個票を事業名称のNFKC一致で一意照合し、元一覧の事業行と追加個票の事業名を両方保持した。',proofs:[{sourceId:original.sourceId,sourceUrl:original.sourceUrl,sourceSha256:original.sourceSha256,textSha256:original.textSha256,quote,cell:`extracted-text:chars:${start}-${start+quote.length}`},proof(h[0]),proof('（対象：令和７年度実施事業）')]};
  }
 }
 if(code==='08364'){
  for(const p of related){const pattern=`事務事業名 ${p.projectName}\n`,at=d.text.indexOf(pattern);if(at<0)continue;const end=d.text.indexOf('Ⅱ 予算区分',at);if(end<0)continue;const raw=d.text.slice(at,end),m=raw.match(/目的 ([^]*?)(?=\n事務事業内容)/);if(m)add(p,{purpose:{value:m[1].trim(),proofs:[proof(m[0])]}},pattern.trim());}
 }
 if(code==='11239'){
  const hs=[...d.text.matchAll(/^事 務 事 業 名 ([^\n]+?) 整理№ (\d+)/gm)];
  for(let i=0;i<hs.length;i++){const h=hs[i],raw=d.text.slice(h.index,hs[i+1]?.index??d.text.length),ps=related.filter((p:any)=>p.projectName.normalize('NFKC')===h[1].normalize('NFKC'));if(ps.length!==1)continue;const values:any={};
   const pur=raw.match(/目標（対象を[^\n]+\n([^]*?)(?=^[^\n]*事業概要（)/m),act=raw.match(/事業概要（取組内容[^\n]+\n([^]*?)(?=\n令和5年度 令和6年度 令和7年度)/);
   for(const[k,m]of [['purpose',pur],['activities',act]] as const){if(m&&m[1].trim().length>10)values[k]={value:m[1].trim(),proofs:[proof(m[0])]};}add(ps[0],values,h[0]);
  }
 }
 if(code==='17203'){
  const hs=[...d.text.matchAll(/^点検評価票/gm)];
  for(let i=0;i<hs.length;i++){const raw=d.text.slice(hs[i].index,hs[i+1]?.index??d.text.length),h=raw.match(/事業名 ([^\n]+)/);if(!h)continue;const ps=related.filter((p:any)=>p.projectName===h[1]);if(ps.length!==1)continue;
   const m=raw.match(/Ｄ\no\n([^]*?)(?=\n評価（達成度）)/);if(m&&m[1].trim().length>10)add(ps[0],{outcomes:{value:m[1].trim(),proofs:[proof(m[0])]}},h[0]);
  }
 }
 const yearSpec:Record<string,[string,number,string]>= {
 '342589c95d598fe58bc0dc29':['evaluatedFiscalYear',2024,'令和６年度事務事業評価'],
 'c6d923373dff284f2fd2ee2f':['evaluatedFiscalYear',2025,'令和７年度総括表'],
 '2ef3b8da58b31cc65db3f293':['evaluationYear',2024,'令和 6 年度（2024 年度）\n行政評価結果'],
 'ea9ebb6e7d11bed0052b77ef':['evaluationYear',2025,'令和 7 年度（2025 年度）\n行政評価結果']
 };
 if(yearSpec[id]){const[k,value,q]=yearSpec[id];if(!d.text.includes(q))throw Error('year quote missing '+id);
  for(const p of related){if(p[k]!==null)continue;const pos=d.text.indexOf(p.projectName);if(pos<0)continue;const identity=d.text.slice(Math.max(0,pos-20),pos+p.projectName.length+30);add(p,{[k]:{value,proofs:[proof(q)]}},identity);}
 }
 reviews.push({...item,enrichmentStatus:count?'enriched':'unreviewed',enrichedRecords:count,fields,referencedRecords:related.length,remainingScope:item.remainingScope,evidenceQuotes:item.evidenceQuotes});
}

const residual:Record<string,string>={
 '02207':'旧計画の政策票に複数構成事業・実績見込・将来目標が混在。現104件の個別年度/事業との同一性を確定できない。文字化け票は名称復元も不確実。',
 '28203':'番号・名称が一致する完全ページの目的/非数値成果のみ補完。内容欄と成果指標表の境界、折返し名称、未保存末尾は未確定。評価票には複数費用年度があるため評価年から対象年度を補わない。',
 '03202':'R6個票への対象年度補完以外は施策と事業の横長表、外部委員会意見と市対応列の混在により個別成果範囲が未確定。',
 '11230':'令和7年度個票の成果・分析欄を既存同年度一覧へ結合。名称が折返し/表記差で一意照合できない個票は保留。目的・活動・今後方針は左右列が交錯し、原文上の欄境界が未確定。成果候補も行内空白による左列混入又は文末未完結の72件を除外した。',
 '44204':'明示された評価結果表紙の評価年のみ補完。詳細調書は事業内容/活動実績/費用/評価が横に混在し、事業名の折返しと活動文章の対応が未確定。',
 '32206':'R7総括表による対象年度以外はR2〜R7の評価/課題/委員意見と目的・手段が同じ行へ交錯。年度別の個別所見範囲が未確定。',
 '22210':'一意に名称対応した個別調書の目的/実績欄のみ補完。名称折返し・欄見出し位置が異なる票は保留。予定内容は実績へ混入させない。',
 '34212':'既存活動欄は独立事業段落を保持済み。残りの分析/目的/成果指標は戦略・事業群単位の評価に属し、複数下位事業への一意対応が未確定。',
 '33209':'一覧は目的・手法・部会長/本部意見・費用の横列が交錯。同番号で個票との同一性は認められるが、各欄の文章境界と費用総額/内訳の別が未確定。',
 '43100':'既存activitiesに事業別実績段落を保持。目的は施策方向性単位、検証指標・現状課題・学識意見は複数事業にまたがり個別目的/成果へ割当不能。',
 '34209':'同年度・同名かつ元個票の保存本文に事業名を確認できた外部意見1件は証拠へ追加。残り5件は元個票本文が切詰められ名称の原文対応証拠を保持できず保留。対応表はR6提言と後年度対応が混在し年度を確定できない。個票は事業内容と一次/二次評価の列が交錯し、目的/活動/対象年度の安全な分離は未確定。',
 '44205':'改革項目は複数業務の集合で、既存6独立取組との同一事業境界を確定できない。',
 '21221':'事業目的/内容/成果と決算内訳・課題・次年度取組が同一行へ交錯し、文字列の個別欄境界が未確定。',
 '08224':'HTMLは文字化け。現在91件の正常PDFレコードはあるが、このHTMLを新たな目的/年度の根拠にできない。',
 '32202':'個票本文のグリフ文字化けと12万字切詰により、正常一覧71事業への名称/年度/本文の対応が不確実。',
 '11232':'完全個票の目的と実施結果を補完。末尾未完結票、一覧だけの事業、横並び総合評価理由/今後方向性は未分離。',
 '12212':'政策・制度説明と提言資料で、個別事業に一意対応する既存レコードがなく補強対象を特定できない。',
 '45401':'事業費・事業内容・評定の現年列と旧年列が交錯。既存活動欄を置換せず、別の個別成果文章と評価実施年は未確定。',
 '14211':'大学連携の総括提言と複数年度取組が混在。既存61取組の単一実績年度や目的/成果範囲に対応する根拠が確定しない。',
 '44212':'目的・内容・活動実績の欄に年度別計画/決算額や施策指標が横並びで混在。既存384件のうち本文切詰より後は個別文章を確認できない。',
 '12441':'目的/対象/手段/期待成果と指標名が横並びで混在。期待成果を達成実績と扱えず、事業目的の文章だけの範囲も未確定。',
 '06204':'グリフ文字化けにより事業名も復元できず、既存レコードへの補強根拠を特定できない。',
 '11239':'個票の目標と事業概要の完整欄のみ補完。対象一覧だけの事業、12万字切詰以後、年度別指標と達成度所見の交錯箇所は未分離。',
 '17203':'独立したDo実績欄のみ補完。欄見出しが分断された票やPlan目的/指標が混在する欄、学校や方針全体への評価意見は未分離。',
 '40349':'現レコードには事業目的・実施方法と外部評価証拠を保持済み。委員の要望・改善意見を達成成果と見なさず、成果欄は追加しない。',
 '08364':'現レコードで明示目的/活動は保持済み又は名称表記が異なり今回の一意照合に不適合。R5計画と過年度決算を単一対象実績年に読み替えない。',
 '11362':'みなの教育プランが複数施策へ反復し、個別活動の事業同一性・横列の文章対応が不確実。既存補強対象なし。',
 '01207':'HTML文字化けで事業名・年度・内容を読めず、補強対象の既存レコードもない。',
 '20590':'保存HTMLはニュース/ナビゲーションのみで評価本文なし。補強対象の既存レコードもない。',
 '01643':'保存HTMLはナビゲーションのみで評価本文なし。補強対象の既存レコードもない。'
};
for(const r of reviews){
 const relevant=patches.filter(p=>[...Object.values(p.set??{}).flatMap((v:any)=>v.proofs),...Object.values(p.append??{}).flatMap((v:any)=>v.flatMap((x:any)=>x.proofs))].some((q:any)=>q.sourceId===r.documentId));
 r.projectIds=relevant.map(p=>p.projectId);r.patchIds=relevant.map(p=>p.id);r.status=relevant.length?'enriched':(['40349','08364','20590','01643'].includes(r.code)?'reviewed_no_change':'held');
 r.reason=relevant.length?`既存${relevant.length}事業について原典ハッシュ・名称/番号・年度対応と空欄を照合し、確定欄のみ補強。`:residual[r.code];
 r.remainingScope=residual[r.code];delete r.enrichmentStatus;delete r.extractor;
 if(relevant.length){const q=relevant.flatMap(p=>Object.values(p.set??{}).flatMap((v:any)=>v.proofs)).find((q:any)=>q.sourceId===r.documentId);if(q)r.evidenceQuotes=[q.quote,...r.evidenceQuotes.slice(0,1)];}
}
writeFileSync(resolve(dir,'patches-5.json'),JSON.stringify({schemaVersion:1,generatedAt:'2026-10-18T00:00:00Z',patches},null,2)+'\n');
writeFileSync(resolve(dir,'review-5.json'),JSON.stringify(reviews,null,2)+'\n');
console.log(JSON.stringify({patches:patches.length,documents:reviews.filter(x=>x.enrichedRecords).length,fields:reviews.map(x=>x.fields).reduce((a,x)=>{for(const[k,v]of Object.entries(x))a[k]=(a[k]??0)+(v as number);return a;},{})}));
