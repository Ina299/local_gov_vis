import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractIzumiRowsSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='46208'||input.sourceId!=='a99cdc6bae0f16571c001170'||input.truncated||!input.text.startsWith('令和７年度施策及び事務事業評価結果（令和6年度実施事務事業分）'))return[];
 const rows:{name:string;dept:string;grade:string;direction:string;investment:string;raw:string;start:number}[]=[];
 for(const m of input.text.matchAll(/^(?:\d+-\d+ \S+ [A-DＡ-Ｄ] )?(?:● )?(\S+) (\S+) ([A-DＡ-Ｄ]) (方向性を維持|改善・見直し|他事業と統合) (現状のまま|拡大|縮小)$/gm)){
  if(m[1]==='●')continue;
  rows.push({name:m[1],dept:m[2],grade:m[3],direction:m[4],investment:m[5],raw:m[0],start:m.index!});
 }
 for(const m of input.text.matchAll(/^([^\n ]+)\n● (\S+) ([A-DＡ-Ｄ]) (方向性を維持|改善・見直し|他事業と統合) (現状のまま|拡大|縮小)\n(課|流課)$/gm))rows.push({name:m[2],dept:m[1]+m[6],grade:m[3],direction:m[4],investment:m[5],raw:m[0],start:m.index!});
 rows.sort((a,b)=>a.start-b.start);const out=new Map<string,ProjectEvaluation>();
 for(const r of rows){
  let name=r.name.replace(/（再掲）$/,'');if(name==='安心サポートセンター運営事業'&&r.name.endsWith('（再掲）'))name='安心サポートセンター事業';
  const key=`${r.dept}/${name}`;const old=out.get(key);
  if(old){old.evidence.push(evidence(input,r.raw,r.start));if(old.ratings[0].value!==r.grade){old.ratings.push({kind:'self',label:'同名・同所管の別掲載行 総合評価',value:r.grade,scale:null,evidence:evidence(input,r.raw,r.start)});old.warnings.push('環境保全事業は同年度・同所管・同名の2行で総合評価A/Bが不一致。別事業と断定せず1件に統合し、両方の評点と原文証拠を保持。どちらかを正値として選択していない。');}continue;}
  if(r.name.endsWith('（再掲）'))continue;
  const p=project(input,key,name,2025,r.raw,r.start);p.department=r.dept;p.evaluatedFiscalYear=2024;
  for(const[label,value]of[['総合評価',r.grade],['事業の方向性',r.direction],['投資の方向性',r.investment]])p.ratings.push({kind:'self',label,value,scale:null,evidence:evidence(input,r.raw,r.start)});
  p.warnings.push('事務事業評価結果一覧の事業別3評価欄を部分構造化。左側の施策評価は転用しない。再掲6行は同名・同所管（安心サポートセンターは運営の省略を照合）の既出事業に証拠統合。費用と指標数値は未掲載。');out.set(key,p);
 }
 return [...out.values()];
}
