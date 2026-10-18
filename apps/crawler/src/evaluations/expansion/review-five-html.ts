import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
function htmlWarnings(p:ProjectEvaluation){p.warnings=['保存済み公式HTML本文から部分構造化。リンク先PDFの取得・照合は実施していません。文字位置と取得時の内容ハッシュを保持。'];}
export function extractReviewFiveHtml(input:CachedInput):ProjectEvaluation[]{
 const out:ProjectEvaluation[]=[];
 if(input.municipalityCode==='18207'&&input.sourceId==='b128d049a65ab2c9598681f3'){
  const map=new Map<string,ProjectEvaluation>();
  for(const m of input.text.matchAll(/^([^\n]+)\n([^\n]+(?:課|室|局|所|館|センター))\n(維持|終了|事務改善|内容拡大|内容縮小|廃止・休止|対象外)$/gm)){
   if(m[3]==='対象外')continue;
   const name=m[1].replace(/（PDF(?:：[\s\S]*?)?）$/,'');const key=`${name}:${m[2]}`;
   if(map.has(key)){const p=map.get(key)!;if(p.ratings[0].value!==m[3])throw new Error('Sabae conflicting duplicate');p.evidence.push(evidence(input,m[0],m.index));continue;}
   const p=project(input,key,name,2012,m[0],m.index);htmlWarnings(p);p.department=m[2];
   p.ratings.push({kind:'self',label:'平成25年の方向性',value:m[3],scale:null,evidence:evidence(input,m[0],m.index)});
   p.warnings.push('平成24年度評価結果の平成25年の方向性。実施対象年度は未確定。対象外と明記された行は評価済みレコードに含めません。');map.set(key,p);
  }out.push(...map.values());
 }
 if(input.municipalityCode==='07544'&&input.sourceId==='92f2632397549cf6adc0f8ff'){
  const starts=[...input.text.matchAll(/^(\d{1,2})\n/gm)].filter(m=>+m[1]>=1&&+m[1]<=27);
  const multiline=new Set([1,2,3,10,11,16,18,19,20,21,25,26,27]);
  starts.forEach((m,i)=>{let raw=input.text.slice(m.index,starts[i+1]?.index??input.text.length).split('このページの内容に関するお問い合わせ先')[0].trim();
   const lines=raw.split('\n');const n=multiline.has(+m[1])?2:1;const name=lines.slice(1,1+n).join('');
   const r=raw.match(/\n(拡充|終了|廃止|改善しながら[ \n]継続|現状のまま\n?継続)\n/);if(!r)throw new Error('Kawauchi direction missing');
   const p=project(input,m[1],name,2006,raw,m.index);htmlWarnings(p);p.evaluatedFiscalYear=2005;
   p.purpose=lines.slice(1+n).join('\n').split(r[0])[0].trim();
   const tail=raw.slice(r.index!+r[0].length).match(/^([\s\S]+?)\n([^\n]*(?:課|係|所|会))\n([\s\S]*)$/);
   if(tail){p.outcomes=tail[1];p.department=tail[2];}
   p.ratings.push({kind:'self',label:'今後の方向性',value:r[1].replaceAll('\n',''),scale:null,evidence:evidence(input,r[0],m.index!+r.index!)});
   p.warnings.push('金額欄は千円の単位のみ確認でき、予算・決算・人件費の種別が本文で確定しないため数値欄には登録していません。');out.push(p);
  });
 }
 if(input.municipalityCode==='22130'&&input.sourceId==='8a356182e300940040a1e6c6'){
  const starts=[...input.text.matchAll(/^(\d{4})\n([^\n]+)$/gm)];
  starts.forEach((m,i)=>{let raw=input.text.slice(m.index,starts[i+1]?.index??input.text.length);const name=m[2].match(/【([^【】]+)】/);if(!name||/[、／]/.test(name[1]))return;
   const p=project(input,m[1],name[1],2016,raw,m.index);htmlWarnings(p);p.evaluatedFiscalYear=2016;
   p.warnings.push('平成28年度上半期の行政経営計画進行管理。年度全体の最終評価ではありません。取組番号を保ち、財政効果額・市債残高等を個別事業費に変換していません。');out.push(p);
  });
 }
 if(input.municipalityCode==='12205'&&input.sourceId==='534e0cbbc99910b0f8546351'){
  const rows:[string,string,string][]=[
   ['若潮マラソン大会','要改善','1.若潮マラソン大会\n要改善'],
   ['社会教育施設運営事業（地区公民館）','要改善','5.社会教育施設運営事業（地区公民館）\n要改善'],
   ['起業支援補助金','不要・凍結','7.起業支援補助金\n不要・凍結'],
   ['高齢者等配食サービス事業','要改善','8.高齢者等配食サービス事業\n要改善'],
   ['子育て支援施設「元気な広場」の運営','要改善','9.子育て支援施設「元気な広場」の運営\n要改善'],
   ['中・軽度の心身障害者（児）医療費給付扶助費','要改善','10.中・軽度の心身障害者（児）医療費給付扶助費\n要改善'],
   ['防災行政無線事業','要改善','11.防災行政無線事業\n要改善'],
  ];
  const subsidies='2.補助金3事業\n観光振興支援事業補助金\n市民協働事業補助金\n環境保全団体支援事業補助金\n要改善\n要改善\n不要・凍結（統合可能）';
  ['観光振興支援事業補助金','市民協働事業補助金','環境保全団体支援事業補助金'].forEach((n,i)=>rows.push([n,i===2?'不要・凍結（統合可能）':'要改善',subsidies]));
  const museums='4.博物館管理運営費\n館山市立博物館（本館）\n館山城（八犬伝博物館）\n渚の博物館（館山市立博物館分館）\n現行通り・拡充\n現行通り・拡充\n現行通り・拡充';
  ['館山市立博物館（本館）','館山城（八犬伝博物館）','渚の博物館（館山市立博物館分館）'].forEach(n=>rows.push([n,'現行通り・拡充',museums]));
  const immigration='6.移住・定住促進事業\n移住相談業務委託\n移住者定住促進助成金\n要改善\n要改善';
  ['移住相談業務委託','移住者定住促進助成金'].forEach(n=>rows.push([n,'要改善',immigration]));
  for(const [name,rating,raw] of rows){if(!input.text.includes(raw))throw new Error('Tateyama reviewed table changed');const p=project(input,name,name,2023,raw);htmlWarnings(p);p.ratings.push({kind:'external',label:'市民判定人による事業仕分け',value:rating,scale:null,evidence:evidence(input,raw)});p.warnings.push('評価は事業又は施設ごとの判定。植栽関連4事業に共有された1判定は各事業に分配していません。');out.push(p);}
 }const unique=new Map<string,ProjectEvaluation>();for(const p of out){const prev=unique.get(p.projectName);if(input.municipalityCode==='22130'&&prev){prev.evidence.push(...p.evidence);prev.warnings.push('同一の下水道事業に関する複数の行政経営取組を1件に集約。取組番号は原文根拠に保持。');}else unique.set(p.projectName,p);}for(const p of out)p.evidence.push(evidence(input,input.text.slice(0,Math.min(300,input.text.length)),0));return [...unique.values()];
}
