import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
export function extractBibai(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='01215'||input.sourceId!=='4d4fe7521a792537a07a6719')return [];
 const header='事業費(千円) 事務事業評価\n事 務 事 業 名 担当課\n(R1決算額) 事務事業の今後の方向性';if(!input.text.includes(header))return [];
 const out=new Map<string,ProjectEvaluation>(),conflicts=new Set<string>();
 for(const m of input.text.matchAll(/^(\d+) ([^\n]+?) ([^\s]+(?:課|室|局|園|本部)) ([\d,]+) (現状維持|見直し|終 了) ([^\n]+)$/gm)){
  let department=m[3],raw=m[0],start=m.index!;
  if(department==='興課'){
   const prefix='生涯学習・スポーツ振\n';if(!input.text.slice(0,start).endsWith(prefix))continue;department='生涯学習・スポーツ振興課';start-=prefix.length;raw=prefix+raw;
  }
  const p=project(input,`${department}:${m[2]}`,m[2],null,raw,start);p.department=department;p.evaluatedFiscalYear=2019;
  p.amounts.push({kind:'actual',fiscalYear:2019,amountYen:Number(m[4].replaceAll(',',''))*1000,rawValue:m[4],rawUnit:'千円',evidence:evidence(input,raw,start)});
  p.ratings.push({kind:'self',label:'事務事業の今後の方向性',value:m[5]+' '+m[6],scale:null,evidence:evidence(input,raw,start)});
  p.evidence.push(evidence(input,header));p.warnings.push('施策評価表の下位事務事業一覧。令和元年度決算と方向性のみ。上位施策の指標・成果や総費用は下位事業へ配賦しない。同名称・同所管の再掲は値が一致する場合だけ証拠統合。');
  const key=department+'\n'+p.projectName,old=out.get(key);
  if(old){if(old.amounts[0].amountYen!==p.amounts[0].amountYen||old.ratings[0].value!==p.ratings[0].value){conflicts.add(key);continue;}old.evidence.push(evidence(input,raw,start));}else out.set(key,p);
 }
 return [...out].filter(([key])=>!conflicts.has(key)).map(([,p])=>p);
}
