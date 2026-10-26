/** Offline continuation/layout review. Source-specific bindings, never fuzzy name matching. */
import { reviewOfflineSource, type SourceReview } from './offline-source-phase';
import { evidence, project, type CachedInput } from './shared';
const hakodate: Record<string, [string, string, string[]]> = {
 '243c15b265baf13353badc26': ['73', '道路整備事業費（起債事業費）', ['道路整備事業費', '起債事業']],
 '3fbbe92364c49a696cc5c046': ['83', '空き家等対策推進事業費', ['空き家等対策推進事業費']],
 '437e876fbcb89bd8638965a3': ['27', 'B類疾病', ['B類疾病', '定期予防接種費']],
 '4d8f0b134a2243622b70f664': ['74', '道路整備事業費（単独事業費）', ['道路整備事業費', '単独事業']],
 '5df180eb0a39be17295a3185': ['88', '街路灯維持管理費（椴法華支所）', ['街路灯維持管理費', '椴法華支所市民福祉課']],
 '680831a1a8db90cbd5492e02': ['81', '公園等整備費（起債事業費）', ['公園等整備費', '起債事業']],
 'a879ee105ce97de36a12f09a': ['4', '防災行政無線整備費', ['防災行政無線整備費']],
 'aad129e7843788de350409cf': ['84', '都市空間形成推進事業（美しいまちづくり検討会関係経費）', ['都市空間形成推進事業（美しいまちづくり検討会関係経費）']],
 'aba5b266f966ab923eecba49': ['25', '健康増進センター事業', ['健康増進センター事業', '健康増進事業業務委託料']],
 'b76df19b49952abb410fb3c0': ['76', '横断歩道滑り止め舗装事業費 ７か所', ['横断歩道滑り止め舗装事業費 ７か所']],
 'cdc2dea5990d676309f6b025': ['80', '街路整備事業費（地特事業費）', ['街路整備事業費', '地特事業']],
};
const continuations = ['e77c0e1cc6cbbc4834ff478b', '6000164feeffb3bf81208d35', '015be81566c7f99ca7c6dff1', 'eecfd3ba538e2e47637354af', 'dc00fdfdacc88d812fad19db'];
export const continuationSourceIds = new Set([...Object.keys(hakodate), ...continuations, '15d7a81b4fe97d1c76a9f9f9', 'cb625c09117b6bec9da0a13f', 'df52ad93846580efd42de26e', '67c3262684f9e2cb2c7b0a4b', 'a86ace3177f71817528ab4e8']);
const held = (reason: string): SourceReview => ({projects: [], holds: [{unit: 'document', reason}]});
export function reviewContinuationSource(input: CachedInput, title: string, inputs: CachedInput[]): SourceReview {
 const t = input.text, spec = hakodate[input.sourceId];
 if (spec) {
  const [number, name, anchors] = spec, header = t.slice(0, t.indexOf('１．'));
  if (input.truncated || !t.includes('参考：他の自治体の状況') || !header.includes(`\n${number}\n`) || !anchors.every(x => header.includes(x))) return held('Curated title/header/serial or complete-sheet binding failed');
  let purpose = t.match(/【目的】\s*([\s\S]*?)\s*【必要性】/)?.[1].trim();
  if (['3fbbe92364c49a696cc5c046','a879ee105ce97de36a12f09a'].includes(input.sourceId)) purpose = t.match(/【目的】\s*([^\n]+。)\n/)?.[1];
  if (!purpose) return held('Explicit bounded purpose missing');
  const p = project(input, number, name, 2015, t); p.purpose = purpose;
  p.evidence.push(evidence(input, purpose));
  p.warnings.push('個別に確認した整理番号・事業名・予算事項／所管の組合せで識別。評価調書年度は平成27年度、評価対象会計年度は未確定。金額・指標は列座標未確認のため未抽出。');
  return {projects:[p],holds:[]};
 }
 if (input.sourceId === 'e77c0e1cc6cbbc4834ff478b') {
  if(input.truncated) return held('Hash-verified complete education volume required');
  const starts=[...t.matchAll(/事務事業評価シート/g)].map(m=>m.index!), result:SourceReview={projects:[],holds:[]};
  for(const [i,start] of starts.entries()) {
   const raw=t.slice(start,starts[i+1]??t.length), header=raw.slice(0,raw.indexOf('事 業 概 要'));
   let name=header.match(/事務事業名\s+所管部署名\s+([^\n]+)/)?.[1];
   if(!name) name=header.match(/事務事業名\s+([\s\S]*?)\n\s*本\s*\n/)?.[1].replace(/\n/g,'');
   const activity=raw.match(/事 業 概 要\s+([\s\S]*?)(?=令和\d年度)/)?.[1].trim();
   const codes=[...header.matchAll(/\b\d{8}\b/g)].map(m=>m[0]);
   if(!name || name.length>80 || /☑|□|所管|予算/.test(name) || !activity || !raw.includes('評価日') || !raw.includes('令和8年6月30日') || !raw.includes('今後の方針')) {result.holds.push({unit:`chars:${start}`,reason:'Individual name/body/evaluation-date completeness not established'});continue;}
   const p=project(input,codes.length===1?codes[0]:name,name,2026,raw,start); p.projectCode=codes.length===1?codes[0]:null; p.evaluatedFiscalYear=2025;p.activities=activity;
   p.evidence.push(evidence(input,activity,start+raw.indexOf(activity)));
   p.warnings.push('令和7年度シート、評価日令和8年6月30日を区別。事業概要のみ抽出。複数年度の予算・決算・目標・実績列、選択肢位置は未変換。');result.projects.push(p);
  }
  return result;
 }
 if(input.sourceId==='15d7a81b4fe97d1c76a9f9f9') {
  if(input.truncated) return held('Complete volume required');
  const starts=[...t.matchAll(/令和7年度\s*事業評価シート/g)].map(m=>m.index!),result:SourceReview={projects:[],holds:[]};
  for(const [i,start] of starts.entries()) {
   const raw=t.slice(start,starts[i+1]??t.length), assessed=raw.split(/\n評価結果\n/)[1];
   const name=assessed?.match(/事業名称\s*\n[^\n]+\n([^\n]+)/)?.[1]?.trim();
   const purpose=raw.match(/\n事業目的\s*\n([\s\S]*?)\n事業概要/)?.[1].trim();
   const activity=raw.match(/\n事業概要\s*\n([\s\S]*?)\n実施背景/)?.[1].trim();
   if(!name || !raw.slice(0,raw.indexOf('評価結果')).includes(name) || !purpose || !activity || !assessed?.includes('今後の取組') || !/\n\d+\s*$/.test(raw)) {result.holds.push({unit:`chars:${start}`,reason:'Three-page individual identity/purpose/final evaluation boundaries not established'});continue;}
   const p=project(input,name,name,2025,raw,start);p.projectCode=null;p.purpose=purpose;p.activities=activity;
   for(const value of [purpose,activity])p.evidence.push(evidence(input,value,start+raw.indexOf(value)));
   p.warnings.push('令和7年度評価。複数年の実績と決算（見込）を含むため単一の評価対象会計年度は未確定。数値と左右列の評価文章は未変換。');result.projects.push(p);
  }
  return result;
 }
 return reviewOfflineSource(input,title,inputs,true);
}
