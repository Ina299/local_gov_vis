import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractReviewFiveAdditional(input:CachedInput):ProjectEvaluation[]{
 const out:ProjectEvaluation[]=[];
 if(input.municipalityCode==='34212'&&input.sourceId==='4228fa5ae7f3842dbf4a3b7e'){
  const map=new Map<string,ProjectEvaluation>();
  for(const m of input.text.matchAll(/^([^\n]*? [ＡＢＣ][＊*]? )([^ \n（）]+事業)（([^（）\n]+課)）$/gm)){
   const key=m[2]+m[3],p=map.get(key)??project(input,key,m[2],null,m[0],m.index);p.evaluatedFiscalYear=2021;p.department=m[3];
   if(map.has(key))p.evidence.push(evidence(input,m[0],m.index));
   p.ratings.push({kind:'self',label:'個別評価指標の達成度（事業総合評価ではない）',value:m[1].match(/[ＡＢＣ][＊*]?/)![0],scale:null,evidence:evidence(input,m[0],m.index)});map.set(key,p);
  }out.push(...map.values());for(const p of out)p.warnings.push('同一事業に複数の指標評価があります。指標名の折返しを推測で結合せず、確実な事業名・担当課・達成度の行を保持。');
 }
 if(input.municipalityCode==='18207'&&input.sourceId==='04e8c220e4562ccead93d04f'){
  const table=input.text.slice(input.text.indexOf('５ 評価対象事業および評価結果一覧\n№'),input.text.indexOf('６ 総括\n（１）'));
  if(!table.includes('4 農林政策課'))throw new Error('Sabae external table changed');
  const rows=[['こどもエコクラブ活動支援事業','環境政策課','維持','維持'],['ものづくり振興交付金事業','産業振興課','維持','事務改善（業務プロセスの改善）'],['福井鉄道福武線支援事業','交通・にぎわい創出課','維持','維持'],['森林空間いきもの調査事業','農林政策課','事務改善（業務プロセスの改善）','事務改善（総合的な改善）']];
  rows.forEach(([name,dept,self,external],i)=>{if(!input.text.includes(name))throw new Error('Sabae name changed');const p=project(input,String(i+1),name,2025,table);p.department=dept;p.evaluatedFiscalYear=2024;p.evidence.push(evidence(input,name));p.ratings.push({kind:'self',label:'内部評価の方向性',value:self,scale:null,evidence:evidence(input,table)},{kind:'external',label:'外部評価の方向性',value:external,scale:null,evidence:evidence(input,table)});p.warnings.push('外部評価の対象4事業。予算書の親事業名・親事業予算額はこの個別事業へ転記していません。');out.push(p);});
 }
 if(input.municipalityCode==='46219'&&input.sourceId==='bafa9b4fa056d966def8f77b'){
  if(!input.text.startsWith('平成29年度\n事務事業評価結果一覧'))return [];
  const names=['行政嘱託員設置事業','共生協働推進事業','高齢者実態把握事業','生活困窮者自立支援相談事業','糖尿病性腎症重症化予防事業','生活習慣病重症化予防事業','小中学校文化スポーツ推進事業'];
  const dirs=['見直しの上で継続','現状のまま継続','見直しの上で継続','現状のまま継続','現状のまま継続','現状のまま継続','廃止'];
  const rows=[...input.text.matchAll(/(現状のまま継続|見直しの上で継続|廃止) \1$/gm)];if(rows.length!==7)throw new Error('Ichikikushikino row boundaries changed');
  rows.forEach((m,i)=>{const raw=input.text.slice(m.index,rows[i+1]?.index??input.text.indexOf('一次評価 二次評価 一次評価 二次評価',m.index));const p=project(input,String(i+1),names[i],2017,raw,m.index);for(const kind of ['self','internal'] as const)p.ratings.push({kind:'self',label:kind==='self'?'一次評価の方向性':'二次評価の方向性',value:dirs[i],scale:null,evidence:evidence(input,raw,m.index)});p.warnings.push('7件の横長表を資料別確認して折返し名を復元。H28実績は指標の年度であり、種別の明示がない事業費の年度・予決算は推測していません。');out.push(p);});
 }
 for(const p of out)p.evidence.push(evidence(input,input.text.slice(0,Math.min(1800,input.text.length)),0));return out;
}
