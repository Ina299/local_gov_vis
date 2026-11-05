import {createHash} from 'node:crypto';
import type {LayoutReview} from './descending-layouts-r2';
import {type CachedInput,project,evidence} from './shared';
const expectedHash='aabe3ed2bdb4b8cfb855163db0b7ed873811a98bfe2baa877a1cec9c97fe6308';
export function reviewOitaGrants(i:CachedInput):LayoutReview|null{
 if(i.municipalityCode!=='44201'||i.sourceId!=='edcd468eb353e8769c2ddfb8')return null;
 const r:LayoutReview={projects:[],units:[],status:'reviewed_individual_grants',reason:'Three explicit business sheets; budgets distinct from forecasts and two-year totals.',proofs:[]};
 if(i.truncated||i.format!=='pdf'||createHash('sha256').update(i.text).digest('hex')!==expectedHash){r.status='source_integrity_hold';r.reason='Complete hash-matched source required';return r;}
 const hs=[...i.text.matchAll(/^事業番号 [123](?: |$)/gm)];if(hs.length!==3)return r;
 for(let n=0;n<hs.length;n++){
  const start=hs[n].index!,body=i.text.slice(start,hs[n+1]?.index??i.text.length);
  let name:string,raw:string;
  if(n<2){const m=body.match(/^事務事業名 (.+?) 事業費 ([0-9,]+) 千円 ([0-9,]+) 千円 ([0-9,]+) 千円$/m);if(!m)continue;name=m[1];raw=m[0];}
  else{raw='憩い・交流拠点施設「たのうらら」の整備による賑わい創出、周遊促進を通じた地域の魅力発信プロジェク\n事務事業名\nト';if(!body.includes(raw))continue;name=raw.replace('\n事務事業名\n','');}
  const yearProof=n<2?'事業概要説明書 年 度 令和7年度（予算） 令和7年度（決算見込） 令和8年度（予算）':'事業概要説明書 年 度 R5-6年度（予算） R5-6年度（決算） R7年度（予算） R7年度（決算見込） R8年度（予算）';
  if(!body.includes(yearProof)||!body.includes('実績評価')||!body.includes('外部評価委員からの意見'))continue;
  const p=project(i,'grant-sheet-'+(n+1),name,null,raw,start+body.indexOf(raw));p.projectCode=String(n+1);p.evaluatedFiscalYear=2025;p.evidence.push(evidence(i,yearProof,start+body.indexOf(yearProof)));
  const dept=body.match(/担当所属 ([^\n]+?) 担当班/);if(dept){p.department=dept[1];p.evidence.push(evidence(i,dept[0],start+body.indexOf(dept[0])));}
  const cost=body.match(/事業費 ((?:[0-9,]+ 千円 ?)+)/);if(!cost)continue;const values=[...cost[1].matchAll(/([0-9,]+) 千円/g)].map(m=>m[1]);if(values.length!==(n<2?3:5))continue;
  const quote=body.slice(body.indexOf(yearProof),body.indexOf(cost[0])+cost[0].length),ev=evidence(i,quote,start+body.indexOf(yearProof));
  for(const [year,k]of [[2025,n<2?0:2],[2026,n<2?2:4]])p.amounts.push({kind:'budget',fiscalYear:year,amountYen:Number(values[k].replaceAll(',',''))*1000,rawValue:values[k],rawUnit:'千円',evidence:ev});
  const indicators=n===0?['大会実施等による観光消費額','大会の参加者及び観覧者数']:n===1?['市内創業支援機関等の支援による若年層の創業割合','若年層の創業相談件数','若手起業家育成施設の利用者数']:[];
  for(const label of indicators){const line=body.split('\n').find(l=>l.includes(label+'（'));if(!line)continue;const m=line.match(new RegExp(label+'（([^）]+)） ([0-9,.]+) ([0-9,.]+) ([0-9.]+)% ([0-9,.]+)'));if(!m)continue;const proof=body.slice(body.indexOf('令和7年度 令和7年度 令和８年度'),body.indexOf(line)+line.length);if(!proof.includes('目標値 実績値'))continue;p.indicators.push({name:label,fiscalYear:2025,target:m[2],actual:m[3],unit:m[1],evidence:evidence(i,proof,start+body.indexOf(proof))});}
  p.warnings.push('令和７年度決算見込を実決算に変換しない。令和５～６年度合算額を年度別に配賦しない。予算額は令和７・８年度の明示列のみ。外部評価意見欄は空欄のため評価を補わない。');r.projects.push(p);r.units.push({start,name,status:'supported',reason:'Explicit annual business identity, department and labeled budget columns; forecasts and aggregate spending omitted.'});
 }
 return r;
}
