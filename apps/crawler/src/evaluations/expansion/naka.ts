import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractNaka(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='08226'||input.sourceId!=='e37268949319129dd4706386')return [];
 const map=new Map<string,ProjectEvaluation>();
 for(const h of input.text.matchAll(/^第[１-６]章 \d+ \d+ (.+) (現状維持|見直し|廃止|終了|統廃合)$/gm)){
  const pieces=h[1].split(' ');const department=pieces.pop()!;let name=pieces.join(' '),raw=h[0],start=h.index!;
  if(!name){const prevStart=input.text.lastIndexOf('\n',start-2)+1;const end=input.text.indexOf('\n',start+h[0].length+1);raw=input.text.slice(prevStart,end<0?input.text.length:end);name=raw.split('\n')[0]+raw.split('\n')[2];start=prevStart;}
  if(!name||name.includes('undefined'))continue;
  const r=project(input,`${department}:${name}`,name,2025,raw,start);r.projectCode=null;r.department=department;
  r.ratings.push({kind:'self',label:'2次評価結果',value:h[2],scale:null,evidence:evidence(input,h[0],h.index!)});
  r.warnings.push('公式事業評価対象事業一覧の名称・所属・2次評価のみ。対象実施年度は一覧に明記がないため未設定。施策の体系番号を事業コードにしない。');
  const prior=map.get(r.id);if(prior){prior.evidence.push(...r.evidence);prior.warnings.push('同名・同所属の一覧行が複数施策に現れるため一つの名称レコードに集約。独立事業数の確定には原個票の照合が必要。');}else map.set(r.id,r);
 }
 return [...map.values()];
}
