import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractNagatoSupplement(input: CachedInput): ProjectEvaluation[] {
 if(input.municipalityCode!=='35211'||input.sourceId!=='057374058fcf0e556f7429de')return [];
 const heads=[...input.text.matchAll(/^具体施策 (\d+)$/gm)];
 const records = heads.flatMap((h,i)=>{
  if(input.truncated&&i===heads.length-1)return [];
  const raw=input.text.slice(h.index!,heads[i+1]?.index??input.text.length).trimEnd();
  const title=raw.match(/^事 業 名 (.+)$/m);const rating=raw.match(/総合評価 ([^\n]+)/);
  if(!title||!rating||!raw.includes('事業の成果・課題'))return [];
  const department=raw.match(/^主管課・班名 (.+?) 決算額（円）$/m)?.[1]??null;
  const r=project(input,`${h[1]}:${department}:${title[1]}`,title[1],2024,raw,h.index!);r.projectCode=null;r.evaluatedFiscalYear=2023;
  r.department=raw.match(/^主管課・班名 (.+?) 決算額（円）$/m)?.[1]??null;
  const amount=raw.match(/^予算費目\(目\) .+ ([\d,]+)$/m);
  if(r.department&&amount)r.amounts.push({kind:'actual',fiscalYear:2023,amountYen:Number(amount[1].replaceAll(',','')),rawValue:amount[1],rawUnit:'円',evidence:evidence(input,amount[0],h.index!+amount.index!)});
  r.ratings.push({kind:'self',label:'総合評価',value:rating[1],scale:null,evidence:evidence(input,rating[0],h.index!+rating.index!)});
  const start=raw.indexOf('【事業の概要】'),out=raw.indexOf('【事業の成果・課題】');
  r.purpose=raw.slice(start+'【事業の概要】'.length,out).trim();
  r.outcomes=raw.slice(out+'【事業の成果・課題】'.length,raw.lastIndexOf('事業の')).trim();
  r.warnings.push('具体施策コードは事業固有コードではないため未設定。令和6年度評価の対象は本文に明記された令和5年度実施事業。');return [r];
 });
 const unique=new Map<string,ProjectEvaluation>();
 for(const r of records){const prior=unique.get(r.id);if(prior){prior.evidence.push(...r.evidence);prior.outcomes += '\n'+r.outcomes;prior.warnings.push('同一部署・名称・具体施策の続紙を統合し、反復掲載された決算額は一度のみ計上。');}else unique.set(r.id,r);}
 return [...unique.values()];
}
