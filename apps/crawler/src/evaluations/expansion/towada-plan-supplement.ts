import type{ProjectEvaluation}from'../../../../web/src/types/evaluation';import{type CachedInput,evidence,project}from'./shared';
const already=new Set(['新規就農者支援','中央病院の医師確保','デジタル化推進事業','ひとり親家庭に対する支援の充実','公共交通の維持・確保']);
const yearQuote='令和７年度は、第２次十和田市総合計画第３期実施計画に掲載されている事業のうち、令和６年度に実施した事業について内部評価を実施しました。';
export function extractTowadaPlanSupplement(input:CachedInput,inputs:CachedInput[]=[]):ProjectEvaluation[]{
 if(input.sourceId!=='f72414e3adfdfe70ae8c359f'||input.municipalityCode!=='02206'||input.truncated)return[];
 const cover=inputs.find(d=>d.sourceId==='2b7102130083bd0c1448b53d'&&d.text.includes(yearQuote));
 const guide=inputs.find(d=>d.sourceId==='ef1ba34e4de44851161968d9'&&d.text.includes('決算額を記載しています。')&&d.text.includes('令和６年度における事業実績を記載しています。'));
 const starts=[...input.text.matchAll(/^事業名称 (.+?) 計画番号\n事業開始年度 .*? 所管部署 (.+?) ([０-９0-9]+)\n/gm)];const out:ProjectEvaluation[]=[];
 for(let i=0;i<starts.length;i++){
  const m=starts[i];if(already.has(m[1]))continue;const start=m.index!,raw=input.text.slice(start,starts[i+1]?.index??input.text.length).replace(/\n\d+\s*$/,'');const rating=raw.match(/^達成状況 (.+?) 今後の方向性 (.+)$/m);if(!rating)continue;
  const p=project(input,m[3].normalize('NFKC'),m[1],cover?2025:null,raw,start);p.evaluatedFiscalYear=guide||cover?2024:null;p.department=m[2];
  if(cover)p.evidence.push(evidence(cover,yearQuote));if(guide)p.evidence.push(evidence(guide,'②総事業費\n決算額を記載しています。\n③事業実績\n令和６年度における事業実績を記載しています。'));
  p.ratings=[['達成状況',rating[1]],['今後の方向性',rating[2]]].map(([label,value])=>({kind:'self',label,value,scale:null,evidence:evidence(input,rating[0],start+rating.index!)}));
  const cost=raw.match(/令和６年度 令和７年度 令和８年度\n総事業費（千円）\n([^\n]+)/);const values=cost?.[1].split(' ');
  if(guide&&cost&&values&&values.length===3&&/^[0-9０-９,，]+$/.test(values[0]))p.amounts.push({kind:'actual',fiscalYear:2024,amountYen:Number(values[0].normalize('NFKC').replaceAll(',',''))*1000,rawValue:values[0],rawUnit:'千円',evidence:evidence(input,cost[0],start+cost.index!)});
  if(cost){const activities=raw.slice(cost.index!+cost[0].length,rating.index).trim();if(activities)p.activities=activities;}
  const indicator=raw.match(/成果指標\n令和６年度 令和７年度 令和８年度 令和８年度\n([^\n]+)\n令和６年度 令和７年度 令和８年度\n総事業費/);
  const one=indicator?.[1].match(/^([^①-⑳0-9０-９\s][^*]+?) ([0-9０-９,.，]+)\s*([^\s0-9０-９*]*) \* \* ([0-9０-９,.，]+)\s*([^\s0-9０-９*]*)$/);
  if(one&&one[3]===one[5]){const ev=evidence(input,indicator![0],start+indicator!.index!);p.indicators.push({name:'【成果指標】'+one[1],fiscalYear:2024,target:null,actual:one[2],unit:one[3]||null,evidence:ev},{name:'【成果指標】'+one[1],fiscalYear:2026,target:one[4],actual:null,unit:one[5]||null,evidence:ev});}
  p.warnings.push('実施計画という表題だが令和6年度事業実績・達成状況を記載した内部評価表。既存外部評価5事業は二重登録しない。総事業費は別紙の決算額定義で令和6年度列のみ抽出し、令和7/8年度列や別年度注記付き・複数行成果指標は推定しない。令和8年度目標を令和6年度の目標には転用しない。');
  const follow=inputs.find(d=>d.sourceId==='8e59c12d3e59581074b8faeb');if(follow){const match=[...follow.text.matchAll(/^[①-⑤](.+?)[\n]?（主管課：([^）]+)）/gm)].find(q=>q[1]===p.projectName);if(match){const headings=[...follow.text.matchAll(/^[①-⑤](.+?)[\n]?（主管課：([^）]+)）/gm)];const next=headings.find(q=>q.index!>match.index!);const fraw=follow.text.slice(match.index,next?.index??follow.text.length).trim();p.evidence.push(evidence(follow,fraw,match.index));p.warnings.push('前年外部評価のフォローアップに同名事業の対応報告があり原文証拠を統合。前年評点や当年度予定値を新規の実績評価へ転用しない。');}}
  out.push(p);
 }
 return out;
}
