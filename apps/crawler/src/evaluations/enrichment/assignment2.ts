/** Offline, null-only narrative enrichment; no source or published asset mutation. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readEnrichmentBase } from '../enrichment-integration';
import type { ProjectEvaluation, EvaluationAmount } from '../../../../web/src/types/evaluation';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
type Field='purpose'|'activities'|'outcomes';
interface Assignment {documentId:string;code:string;reason:string;remainingScope:string;evidenceQuotes?:string[]}
interface Proof {sourceId:string;sourceUrl:string;sourceSha256:string;textSha256:string;quote:string;cell:string}
interface FieldValue {value:string;proofs:Proof[]}
interface Patch {id:string;municipalityCode:string;projectId:string;beforeRecordSha256:string;identity:{reason:string;proofs:Proof[]};set:Partial<Record<Field,FieldValue>>;append?:{amounts:{value:EvaluationAmount;proofs:Proof[]}[]}}
// Reviewed qualitative outcomes only: exclude blank cells, future effects and right-column action plans.
const akitakataOutcomes=new Set(["消防施設整備事業", "防犯施設管理事業", "不当要求行為等対策事業", "河川維持管理事業", "市有住宅管理事業", "人権会館管理運営事業（甲田）", "団体育成事業（甲田）", "総合相談事業（八千代）", "総合相談事業（甲田）", "公有財産事業", "庁舎管理事業", "財産区運営事業", "財団法人指導事業", "各種計画進行管理等事業", "県道維持管理事業", "市道・橋梁・法定外公共物管理事業", "市道道路維持事業", "農道維持管理事業", "啓発・広報活動事業（甲田）", "地域交流･福祉事業（甲田）", "八千代支所窓口事務", "美土里支所窓口事務", "高宮支所窓口事務", "甲田支所窓口事務", "レセプト点検事務事業", "国民健康保険制度運営事業", "国民健康保険保健事業", "介護保険料賦課徴収事業", "児童手当（子ども手当）給付事業", "相談指導事業", "地域振興支援事業", "まちづくり委員会開催事業", "公害防止・苦情対策事業", "一般廃棄物処理施設の設置等申請許可事務事業", "環境基本計画実施事業", "芸北広域環境施設組合", "産業廃棄物処理業者指導業務", "犬の登録・狂犬病予防注射事業", "建築物・危険物規制事業", "消防資機材整備事業", "通信指令施設の運用、管理事業", "消費者行政推進事業", "ひろしまの森づくり事業", "林道整備事業", "林業用施設災害復旧事業", "企業誘致促進事業", "下水道事業経理事務", "し尿収集事業", "JFAサッカーアカデミー調査研究事業", "美術館管理運営事業", "生涯スポーツ推進事業"]);
const financialReview:Record<string,string>={"34214": "24・25・26年度のコスト/財源表は決算・予算の区別なし。人件費と直接費は読めてもactual/fullCostの年度別確定に使わない。評価実施年度は表紙の平成25年度事務事業とは別で未確定。", "29209": "R5決算・R6予算現額・R7予算の完全列は既存収録済み。R6決算（見込）は確定決算へ変換せず、欠落列は保留。", "11243": "既存は令和4〜7年度の事業費決算列。今回、7列の完全形が一致する票のみ令和7/8年度予算を追記。人員は投入人員であり金額にしない。", "39412": "実績事業費は既存収録済み。計画額は予算と明記されず予算額へ転用しない。財源内訳や複数施設一括費用を別途加算しない。", "33204": "施策票内の事務事業行の費用は種別・年度の単独対応が未確定。施策総額は個別事業へ配分しない。", "44213": "事業費推移は令和3〜11年度欄に5値等の欠落があり、予算/決算の明記もない。過去年度を決算と推測せず原文保持。", "40224": "予算現額・決算額は既存収録済み。明示された列見出しと先頭2数値を照合したが、既存budget/actualと一致するため費用追加なし。財源内訳を費用と重ねない。", "33205": "令和8〜11実施計画額と令和7施策実績が混在。年次の施策費・計画費を事業別決算へ転用しない。", "01224": "事中/事後評価の費用列・年度は既存値を維持。列交差する説明/事中見込を事後決算へ二重追加しない。", "12233": "政策実行事業の決算内数は既存収録済み。上位予算事業総額を加算しない。対象年度と評価実施年度の別は新たな明記なし。", "04212": "事務事業の指標/定性評価が中心で個別費用表はない。評価令和7/対象令和6は既存収録。", "01217": "直接事業費の2022〜2024実績/2025当初は既存。今回、完全4列の2024正職員人件費(B)・総事業費(A+B)を追加。2025人件費等は予算/実績を同kindで混同しないため追加しない。", "02441": "事業費、支給額、貸与額/償還額、基金総額が混在し、同一費用種別として扱えない。対象年度2025は既存、実施評価年度は未明記。", "16323": "2020〜2023決算は既存。2024は予算見込額/実績見込で確定決算へ変換しない。", "08208": "指標の目標/実績はあるが主要事業の独立費用欄なし。施策単位指標を事業費へ転用しない。", "03203": "2015〜2019の直接費・人件費・総費用は全て既存。2020は目標列で実績へ加算しない。", "07446": "当年度・前年度決算は既存。報告年度2023/実施年度2022も既存。", "14207": "事業費の2数値列は年度/予算決算見出しが抽出欠落。令和6決算対象は既存だが、裸の数値を当年度決算と推定しない。", "04207": "2024決算費は既存収録済み。2025は評価年度であり費用年度とは区別する。", "13116": "直接費の予算/決算は既存。今回、令和4年度決算の人件費17000千円・人件費込29648千円を追加。将来の人件費列を実績扱いしない。"};
export async function buildAssignment2Enrichment(root:string,assigned:Assignment[],generatedAt:string){
 const pub=join(root,'apps/web/public');const base=await readEnrichmentBase(root);const patches:Patch[]=[];const review=[];
 for(const a of assigned){
  const d=JSON.parse(readFileSync(join(pub,'evaluation-evidence/documents',a.documentId+'.json'),'utf8'));const text:string=d.text;
  const bytes=base.shards.get(a.code);const records:ProjectEvaluation[]=bytes?JSON.parse(bytes.toString()).projects:[];
  const matches=records.filter(r=>r.evidence.some(e=>e.sha256===d.sourceSha256&&e.sourceUrl===d.sourceUrl));
  const added:Patch[]=[];
  for(const r of matches){
   const set:Patch['set']={};const amounts:{value:EvaluationAmount;proofs:Proof[]}[]=[];let identity='';
   const ev=r.evidence.find(e=>e.sha256===d.sourceSha256&&e.sourceUrl===d.sourceUrl&&e.cell?.startsWith('extracted-text:chars:'));
   let block=ev?.rawText??'';let offset=block?text.indexOf(block):-1;
   const proof=(quote:string,start:number):Proof=>({sourceId:a.documentId,sourceUrl:d.sourceUrl,sourceSha256:d.sourceSha256,textSha256:d.textSha256,quote,cell:`extracted-text:chars:${start}-${start+quote.length}`});
   const add=(field:Field,raw:string,start:number)=>{const value=raw.trim();const at=start+raw.indexOf(value);if(r[field]!==null||value.length<8||value.length>6000||text.slice(at,at+value.length)!==value)return;set[field]={value,proofs:[proof(value,at)]};};
   const addAmount=(kind:EvaluationAmount['kind'],fy:number,rawValue:string,quote:string,start:number,yearProof:Proof,unit:'千円'|'円'='千円')=>{
    if(r.amounts.some(x=>x.kind===kind&&x.fiscalYear===fy)||!/^[-]?\d[\d,]*(?:\.\d+)?$/.test(rawValue))return;
    const q=proof(quote,start);const municipality=JSON.parse(readFileSync(join(pub,'evaluation-evidence/municipalities',a.code+'.json'),'utf8'));const src=municipality.sources.find((x:{id:string})=>x.id===a.documentId);
    amounts.push({value:{kind,fiscalYear:fy,amountYen:Number(rawValue.replaceAll(',',''))*(unit==='千円'?1000:1),rawValue,rawUnit:unit,evidence:{sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,format:src.format,fetchedAt:src.acquisition.fetchedAt,sha256:d.sourceSha256,rawText:quote,page:null,sheet:null,cell:q.cell}},proofs:[q,yearProof]});
   };
   const slice=(field:Field,begin:string,end:string)=>{const x=block.indexOf(begin),y=block.indexOf(end,x+begin.length);if(x>=0&&y>x)add(field,block.slice(x+begin.length,y),offset+x+begin.length);};
   // Older base records carry a name-only proof. Rebind only a unique explicit
   // individual sheet heading, never a contents entry or normalized fuzzy name.
   if(a.code==='40224'){
    const key='\n'+r.projectName+'\n単位：円';const start=text.indexOf(key);if(start<0||text.indexOf(key,start+1)>=0)continue;
    const after=text.indexOf('\n単位：円',start+key.length);const end=after<0?text.length:text.lastIndexOf('\n',after-1);
    block=text.slice(start+1,end);offset=start+1;identity=block.slice(0,block.indexOf('\n事業の目的・背景'));
    if(!block.includes('\n事業費の内訳\n'))continue;
    const cost=/予算現額 決算額 不用額\n国庫支出金 県支出金 繰入金 市債 その他特定財源 一般財源 繰越額\n([\d,]+) ([\d,]+)[^\n]*/.exec(block);
    if(cost&&r.evaluatedFiscalYear===2025&&r.amounts.some(x=>x.kind==='actual'&&x.fiscalYear===2025&&x.amountYen===Number(cost[2].replaceAll(',','')))){const yp=proof(text.slice(0,50),0);addAmount('budget',2025,cost[1],block.slice(0,block.indexOf('事業の目的・背景')),offset,yp,'円');}
    slice('purpose','事業の目的・背景\n','事業の内容（');
    slice('activities','事業の内容（具体的手法・手順等。複数年度事業は全体像を記入）\n','（事業の達成度を測る指標）');
    const marker='事業実施後の成果等\n';const x=block.indexOf(marker);if(x>=0){const ends=['（事業の達成度を測る指標）','事業費の内訳'].map(s=>block.indexOf(s,x+marker.length)).filter(n=>n>x);if(ends.length)add('outcomes',block.slice(x+marker.length,Math.min(...ends)),offset+x+marker.length);}
   }
   if(a.code==='01217'){
    const key='事業名： '+r.projectName+' ';const start=text.indexOf(key);if(start<0||text.indexOf(key,start+1)>=0)continue;
    const end=text.indexOf('事業名： ',start+key.length);block=text.slice(start,end<0?text.length:end);offset=start;identity=block.slice(0,block.indexOf('\n'));
    const cost=/事業費の推移 単位 4年度実績 5年度実績 6年度実績 7年度当初\n事 業 費 \(A\) 千円 [^\n]+\n正職員人件費 \(B\) 千円 ([\d,.-]+) ([\d,.-]+) ([\d,.-]+) ([\d,.-]+)\n総 事 業 費 \(A\+B\) 千円 ([\d,.-]+) ([\d,.-]+) ([\d,.-]+) ([\d,.-]+)/.exec(block);
    if(cost&&r.evaluatedFiscalYear===2024){const header=text.slice(0,text.indexOf('【事業番号'));const yp=proof(header,0);addAmount('personnel',2024,cost[3],cost[0],offset+cost.index,yp);addAmount('fullCost',2024,cost[7],cost[0],offset+cost.index,yp);}
    slice('activities','手段（事務事業の内容、手法）\n','指標名 単位');
    slice('purpose','意図（この事業によって対象をどのような状態にしたいのか）\n','指標名 単位');
   }
   if(a.code==='34214'&&offset>=0&&akitakataOutcomes.has(r.projectName)){
    const start=block.lastIndexOf('ｱｳﾄ');const footer=start<0?null:/^\d+ .+\.xlsx?\s*$/m.exec(block.slice(start));
    if(footer)add('outcomes',block.slice(start,start+footer.index),offset+start);
   }
   if(a.code==='39412'&&offset>=0){
    const position=/^施策 ?目標 .+$/m.exec(block);const start=position?position.index+position[0].length+1:-1;const stop=block.indexOf('。',start);const content=block.indexOf('事 業 内 容',start);
    if(start>=0&&stop>start&&content>stop&&block.slice(start,stop).includes('事 業 目 的'))add('purpose',block.slice(start,stop+1),offset+start);
   }
   if(a.code==='04212'){
    const key='名称 '+r.projectName+'\n';const start=text.indexOf(key);if(start>=0&&text.indexOf(key,start+1)<0){const end=text.indexOf('【事務事業の指標】',start);if(end>start){const raw=text.slice(start+key.length,end);if(raw.includes('目的・意図')){offset=start;identity=key.trim();add('purpose',raw,start+key.length);}}}
   }
   if(a.code==='07446'&&offset>=0){
    const nameLine=/^事業名 .+$/m.exec(block);if(nameLine){const start=nameLine.index+nameLine[0].length+1;const stop=block.indexOf('。',start);const content=block.indexOf('事業の内容',start);if(stop>start&&content>stop&&block.slice(start,stop).includes('事業の目的'))add('purpose',block.slice(start,stop+1),offset+start);}
   }
   if(a.code==='11243'){
    const key='事務事業名 '+r.projectName+'\n';const start=text.indexOf(key);if(start>=0&&text.indexOf(key,start+1)<0){const next=text.indexOf('令和7年度 事務事業評価シート',start);block=text.slice(start,next<0?text.length:next);offset=start;identity=key.trim();const cost=/令和4年度 令和5年度 令和6年度 令和7年度 令和8年度\n区分 区 分\n決算\(千円\) 決算\(千円\) 決算\(千円\) 予算\(千円\) 決算\(千円\) 増減額\(千円\) 予算\(千円\)\n事\n① 事業費 ([\d,.-]+) ([\d,.-]+) ([\d,.-]+) ([\d,.-]+) ([\d,.-]+) ([\d,.-]+) ([\d,.-]+)/.exec(block);if(cost&&r.evaluatedFiscalYear===2025){const q=proof(cost[0],offset+cost.index);addAmount('budget',2025,cost[4],cost[0],offset+cost.index,q);addAmount('budget',2026,cost[7],cost[0],offset+cost.index,q);}const h=/^施策の展開 .+$/m.exec(block);if(h){const from=h.index+h[0].length+1;const end=/^令和\d年度 令和/m.exec(block.slice(from));if(end){const raw=block.slice(from,from+end.index);if(raw.includes('事 業 概 要'))add('activities',raw,offset+from);}}}
   }
   if(a.code==='13116'&&r.projectName==='国際アート・カルチャー都市推進事業'){
    const start=text.indexOf('２．事業費の推移'),end=text.indexOf('国、都支出金',start);const raw=text.slice(start,end);
    if(start>=0&&end>start&&raw.includes('人件費 Ｂ Ｂ ― 17,000 ― 17,000 17,000 0')&&raw.includes('事業費（人件費含む） Ｃ＝Ａ＋Ｂ ― 21,761 ― 29,648 25,253 -4,395')){const yp=proof(text.split('\n')[0],0);identity=text.split('\n').find(l=>l.startsWith('事務事業名 '))!;offset=0;addAmount('personnel',2022,'17,000',raw,start,yp);addAmount('fullCost',2022,'29,648',raw,start,yp);}
   }
   if(a.code==='16323'&&offset>=0){slice('activities','内容（どのような手段で行うか）\n','３ 活動指標の実績');}
   if(a.code==='29209'&&offset>=0){
    const heading='２ 事業の概要・実施内容\n';const section=block.indexOf(heading);const start=section<0?-1:section+heading.length;const stop=block.indexOf('。',start);const overview=block.indexOf('事 業 概 要',start);const bareEffect=block.indexOf('\n事業実施効果\n',start);
    if(start>=0&&stop>start&&(overview<0||stop<overview)&&(bareEffect<0||stop<bareEffect)&&block.slice(start,stop).includes('事 業 目 的'))add('purpose',block.slice(start,stop+1),offset+start);
   }
   if(a.code==='44213'){
    const key='事務事業名 '+r.projectName+' 事務事業項目';const start=text.indexOf(key);if(start<0||text.indexOf(key,start+1)>=0)continue;
    const end=text.indexOf('事務事業事後評価表',start+key.length);block=text.slice(start,end<0?text.length:end);offset=start;identity=block.slice(0,block.indexOf('\n'));
    slice('purpose','③意図（この事務事業を実施することで期待できる効果、今後の見通し等）\n','(２)成果指標');
   }
   if(!Object.keys(set).length&&!amounts.length)continue;
   if(!identity){const nameLine=block.split('\n').find(l=>l.includes(r.projectName));if(!nameLine)continue;identity=nameLine;}
   const identityStart=text.indexOf(identity,offset);if(identityStart<0)continue;
   const p:Patch={id:`enrichment-2-${a.documentId}-${hash(r.id).slice(0,16)}`,municipalityCode:a.code,projectId:r.id,beforeRecordSha256:hash(JSON.stringify(r)+'\n'),identity:{reason:'既存レコードと同じ原典URL及び内容ハッシュの本文を、事業名欄と原文位置で照合した独立評価票。',proofs:[proof(identity,identityStart)]},set,...(amounts.length?{append:{amounts}}:{})};const prior=patches.find(x=>x.projectId===p.projectId);if(prior){const equal=Object.entries(p.set).every(([k,v])=>prior.set[k as Field]?.value===v!.value);if(equal){prior.identity.proofs.push(...p.identity.proofs);for(const [k,v]of Object.entries(p.set))prior.set[k as Field]!.proofs.push(...v!.proofs);added.push(prior);}}else{patches.push(p);added.push(p);}
  }
  const fields=[...new Set(added.flatMap(p=>[...Object.keys(p.set),...(p.append?.amounts.length?['amounts']:[])]))];
  review.push({documentId:a.documentId,code:a.code,status:added.length?'enriched':matches.length?'reviewed_no_change':'held',projectIds:matches.map(p=>p.id),patchIds:added.map(p=>p.id),reason:added.length?`既存${matches.length}件を同一原典と照合し${added.length}件の未設定${fields.join('/')}を境界確定の原文で補強。` :matches.length?`既存${matches.length}件を同じ原典ハッシュで照合。追加候補欄は縦中央見出し・横並び列の混線、または既に設定済みで、今回確定できるnull欄補強なし。 ${a.reason}`:a.reason+' 当該出典URL及び内容ハッシュを保持する既存レコードがなく、同名別年度・別粒度の票へ転用しない。',evidenceQuotes:added.length?added.slice(0,2).flatMap(p=>[p.identity.proofs[0].quote,(Object.values(p.set)[0]??p.append!.amounts[0]).proofs[0].quote]):[text.slice(0,Math.min(300,text.length)),...(a.evidenceQuotes??[]).filter(q=>text.includes(q)).slice(0,2)],remainingScope:a.remainingScope.replace(/[^。]*凍結[^。]*。?|旧抽出結果の修正はこの増分では行わない。|既存部分抽出の数値・記述改善は別の訂正経路で照合が必要。/g,'')+(['29209','39412','07446'].includes(a.code)&&fields.includes('purpose')?' 目的は最初の完結文までの部分補強で、後続の目的説明は引き続き全文根拠を参照。':'')+` 費用・年度照合：同一出典の既存${matches.length}票中、費用あり${matches.filter(p=>p.amounts.length).length}票・対象年度あり${matches.filter(p=>p.evaluatedFiscalYear!==null).length}票・評価年度あり${matches.filter(p=>p.evaluationYear!==null).length}票。${financialReview[a.code]??'当該資料は別版/複数年度/列混線により既存事業への単独費用・年度対応を確定できない。'} 新規件数は増やさない。`});
 }
 return {manifest:{schemaVersion:1,generatedAt,patches},review};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.length!==6||args[0]!=='--assignment-file'||args[2]!=='--output-dir'||args[4]!=='--generated-at'||!Number.isFinite(Date.parse(args[5])))throw new Error('Use --assignment-file <JSON> --output-dir <directory> --generated-at <ISO timestamp>');
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../../..');
 const result=await buildAssignment2Enrichment(root,JSON.parse(readFileSync(resolve(args[1]),'utf8')),args[5]);
 const output=resolve(args[3]);mkdirSync(output,{recursive:true});
 writeFileSync(join(output,'patches-2.json'),JSON.stringify(result.manifest,null,2)+'\n');
 writeFileSync(join(output,'review-2.json'),JSON.stringify(result.review,null,2)+'\n');
 process.stdout.write(JSON.stringify({patches:result.manifest.patches.length,documents:result.review.length})+'\n');
}
