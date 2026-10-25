import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {readEnrichmentBase,readCachedProof,composeEnrichment,type EnrichmentPatch} from '../enrichment-integration';
import {supplementalRecordSha256} from '../supplemental-integration';
import {sha256} from '../national-integration';
import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {assignment3Block,assignment3Fields} from './assignment3';
if(!process.argv[3])throw new Error('Usage: build-assignment3.ts <repository-root> <assignment-and-output-directory>');
const root=resolve(process.argv[2]);const work=resolve(process.argv[3]);
const assignment=JSON.parse(await readFile(join(work,'assignment-3.json'),'utf8'));
const base=await readEnrichmentBase(root);const patches:EnrichmentPatch[]=[];const reviews=[];
const explanations:Record<string,string>={
 '27214':'目的・概要と事業費/財源/人件費の左右列が交錯。目的見出しの前にある折返し開始も含む最初の完結文だけ補強。DO欄の複数年度は年度を単純に1年引かず、対象年度は保留。',
 '08205':'意図（どのように）の最初の完結文、直後の事業概要の最初の完結文、総括評価の事業の成果欄を独立に照合。途中切れ個票の未保存後半を補わない。活動/成果数値の空欄詰めと横並び比較は保留。',
 '13214':'事業番号と名称を照合し事業目的の完結単行を補強。事業概要/成果と課題は左の対象者や年度縦書きが交錯するため推測分離しない。',
 '25206':'施策評価の成果・課題は複数主要事業に共通であり、295事業それぞれへ転用できない。表紙は既存年度の証拠として収録済み。本文欠損をゼロとみなさない。',
 '33202':'既存一覧503件に対し主要事業の説明は(Ⅰ)目的/(Ⅱ)成果/(Ⅲ)方針と名称折返し/金額が交錯。単独名称行との一致だけで全一覧事業に段落を割り当てない。対象年度の厳密な対応も追加確認が必要。',
 '11365':'評価年度と並ぶ事業の実施理由の完結単行を補強。将来見込みの概要と実績、財源とコメントの列が交錯するため費用や年度を追加しない。',
 '35215':'事務事業・所属・手段・意図・指標・責任者コメントの多数列が同じ行へ交錯する。既存名称と評価は保持し、隣行の目的/成果/費用を推測して追加しない。',
 '15225':'既存44票の目的・成果は分離済み。2021実施と2022刊行を確認できるが刊行年を評価実施年へ転用しない。活動欄は目標・現状・課題と横断し独立文対応の再確認を要する。',
 '12211':'当該資料を直接参照する既存票はなく、同名事業の別コードを含む詳細資料。名称のみで異なる公式評価単位へ情報を転用しない。',
 '11201':'一覧は名称・所管・評点と複数年度評価の対応表で目的/活動/成果文章を掲載しない。詳細資料は表の左右列交錯で本文分離に原本位置確認を要する。',
 '35211':'具体施策番号ごとの本票から【事業の概要】と【事業の成果・課題】を分離。成果・課題欄には将来課題も併記されるため全てが確定実績ではない。施策総論は個別事業へ転記しない。120000字切詰末尾の未保存範囲は補わない。',
 '02445':'既存activitiesに概要/実績/成果/方向性の原文全体が保存済み。縦書き見出しが文の途中へ挟まるため、成果と次段方向性の境界が一意でない部分を再編集しない。費用種類不明。',
 '01202':'ロジックモデルの投入/行動/成果と年度別ロードマップが横方向に交錯。既存費用/指標は維持し、同じ行の将来目標を過年度成果に混ぜない。別年度資料との名称だけの対応も保留。',
 '15461':'一覧の評点以外の文章は未掲載。別年度詳細資料は名称・評価・費用列が交錯し、既存年度への上書きを避ける。',
 '13108':'審議会の発言録/施策評価資料と既存単独事業IDの対応が確定しない。個人の意見を自治体確定評価として転記しない。',
 '13205':'目的欄に対象者、成果指標欄に単位当たりコストと年度列が交錯。行政コストには人件費・減価償却・移転費用が含まれ通常事業費へ転用しない。',
 '11214':'事業内容に開始年度/見直し年度、成果説明にグラフ軸/数値が交錯。既存指標/5年決算は保持。2022実績の表紙は評価実施年を明示しないため評価年は補わない。',
 '19207':'本票事業名から計画節直前までの「事業内容（簡潔に）」欄全体を活動欄に補強。目的と手段の欄見出しが縦方向途中に現れるため隣接段落を無理に分離しない。',
 '30206':'事業名の直後から独立「事」ラベルまでの実施目的欄のみ補強。既存成果・評点を維持。事業費は種類未記載のため決算/予算を推定しない。',
 '02443':'概要・実績・成果は縦見出しが文章途中に入り、既存成果原文は保持済み。参考法令の条文を事業目的へ誤って転記しない。',
 '14210':'事業内容は既存activitiesに収録済み。成果/課題と対処方針が同じ行に交錯し、決算（見込）は確定決算に転用しない。',
 '06205':'事業の目的欄の最初の完結文だけ補強。目的末尾に活動文が先行する形があるため段落全体は採用しない。事後評価対象2024と評価実施年は同一と仮定しない。',
 '31329':'A表の「事業の成果・到達点」は将来到達目標で実績成果ではない。R4/R5実績とR6以降目標/実績の空欄列対応を推定しない。既存目的・活動保持。',
 '11227':'施策評価本文と14関連事業一覧の関係は多対多。施策共通の進捗/指標/金額を各事業に配賦しない。',
 '09208':'事業目的と対象者・判定理由、活動と必要性説明、成果と費用が横並びで強く交錯。既存確定評点を保持し本文を推測分離しない。',
 '34208':'事業名折返し・方向性・議会提言が同一行に交錯。現在の事業IDとの同定が確定しないため補強を保留。',
 '05214':'個票の目的・成果という共通欄の完結単行を目的として補強。活動欄は縦見出しと列境界が不明なため保留。前年度フォローアップと今回6事業を混同しない。',
 '06428':'行政改革の取組単位と通常予算事業IDの対応が本文にない。別名の事業へ改革項目の成果・意見を割り当てない。',
 '11385':'目的・活動は既存収録済み。活動結果・成果欄は空欄、評価には実績がないとの説明。成果を推定して新設しない。',
 '01559':'保存HTMLの文字化けが継続し、原文完全一致の正しい日本語事業同定はできない。再取得/文字復元は今回未実施。',
 '13221':'保存HTMLの文字化けが継続し、原文完全一致の正しい日本語事業同定はできない。再取得/文字復元は今回未実施。',
};
for(const a of assignment){
 const d=JSON.parse(await readFile(join(root,'apps/web/public/evaluation-evidence/documents',a.documentId+'.json'),'utf8'));
 const bytes=base.shards.get(a.code);const records:ProjectEvaluation[]=bytes?JSON.parse(bytes.toString()).projects:[];
 const matched=records.filter(p=>p.evidence.some(e=>e.sourceUrl===d.sourceUrl));const own:EnrichmentPatch[]=[];
 for(const p of matched){
  const b=assignment3Block(a.code,d.text,p);if(!b)continue;
  const fields=assignment3Fields(a.code,b.text,p);if(!fields.length)continue;
  // Bind identity to the same original PDF, not merely a matching display name.
  if(!p.evidence.some(e=>e.sourceUrl===d.sourceUrl&&e.sha256===d.sourceSha256))continue;
  const identity=await readCachedProof(root,a.code,a.documentId,b.identityQuote,d.text.indexOf(b.text)+b.text.indexOf(b.identityQuote));
  const patch:EnrichmentPatch={id:`enrich3-${a.documentId}-${sha256(Buffer.from(p.id)).slice(0,16)}`,municipalityCode:a.code,projectId:p.id,beforeRecordSha256:supplementalRecordSha256(p),identity:{reason:'既存レコードと同一の原典URL・内容ハッシュにある事業名称（記載時は番号も）を独立票境界内で照合した。',proofs:[identity]},set:{}};
  for(const f of fields){const proof=await readCachedProof(root,a.code,a.documentId,f.quote,d.text.indexOf(b.text)+b.text.indexOf(f.quote));(patch.set as any)[f.field]={value:f.value,proofs:[proof]};}
  own.push(patch);patches.push(patch);
 }
 const amountCounts=matched.flatMap(p=>p.amounts).reduce((m:Record<string,number>,a)=>{m[a.kind]=(m[a.kind]??0)+1;return m;},{});
 const numericScope=`既存費用内訳=${JSON.stringify(amountCounts)}、評価年収録${matched.filter(p=>p.evaluationYear!==null).length}/${matched.length}件、対象年度収録${matched.filter(p=>p.evaluatedFiscalYear!==null).length}/${matched.length}件。費用・年度の補強可否は以下の原典上の種別/列対応の限界で判断。`;
 const fields=own.reduce((n,p)=>n+Object.keys(p.set??{}).length,0);
 const quotes=own.length?[own[0].identity.proofs[0].quote,...Object.values(own[0].set??{}).map(v=>v.proofs[0].quote)]:a.evidenceQuotes.filter((q:string)=>d.text.includes(q));
 reviews.push({documentId:a.documentId,code:a.code,status:own.length?'enriched':a.status==='held'?'held':'reviewed_no_change',projectIds:own.map(p=>p.projectId),patchIds:own.map(p=>p.id),reason:`保存本文${d.text.length}字と既存原典参照${matched.length}件を照合。${own.length}既存レコードの${fields}項目を補強。${explanations[a.code]}`,evidenceQuotes:quotes.length?quotes:[d.text.slice(0,300)],remainingScope:numericScope+explanations[a.code]+' 元レコードの非空項目を置換せず、新しい事業件数は追加しない。'});
 console.log(a.code,a.documentId,own.length,fields);
}
const input={schemaVersion:1,generatedAt:'2026-10-18T23:30:00.000Z',patches};const buf=Buffer.from(JSON.stringify(input)+'\n');
await writeFile(join(work,'patches-3.json'),buf);await writeFile(join(work,'review-3.json'),JSON.stringify(reviews,null,2)+'\n');
const result=await composeEnrichment(root,base,new Map([[sha256(buf),buf]]),input.generatedAt);console.log(JSON.stringify(result.manifest.statistics));
