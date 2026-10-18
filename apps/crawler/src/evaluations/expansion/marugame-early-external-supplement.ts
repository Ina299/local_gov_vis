import type{ProjectEvaluation}from'../../../../web/src/types/evaluation';import{type CachedInput,evidence,project}from'./shared';
export function extractMarugameEarlyExternalSupplement(input:CachedInput):ProjectEvaluation[]{
 const year=input.sourceId==='92398ea92cd522ec55c66b03'?2009:input.sourceId==='934d512c8aed92080638bfd3'?2008:null;
 if(!year||input.municipalityCode!=='37202'||input.format!=='pdf')return[];
 const t=input.text;const headings=[...t.matchAll(/^[（(]([^\n）)]+)[）)]$/gm)];const out=new Map<string,ProjectEvaluation>();
 for(let i=0;i<headings.length;i++){
  const h=headings[i];if(!h[1].endsWith('事業'))continue;
  let end=headings[i+1]?.index??t.length;
  const stop=t.slice(h.index!,end).search(/^(?:施策番号 |評価結果表|総合計画の体系|■|３[．.]行政評価|３[．.]\s*行政評価|【行政活動全般について】)/m);if(stop>=0)end=h.index!+stop;
  if(input.truncated&&end===t.length)continue;
  const raw=t.slice(h.index!,end);const body=raw.slice(h[0].length).trim();if(!body.includes('・')||body.length<15)continue;
  const p=project(input,'external-comment-'+h[1],h[1],year,raw,h.index);p.outcomes=body;p.evidence.push(evidence(input,t.slice(0,60),0));
  p.warnings.push('個別事項・事務事業に関する外部委員意見の明示事業見出しを単位とする部分収録。施策の進捗度評点は転用せず、合同事業名の意見は分解しない。同名の再掲意見は同一レコードへ証拠統合。本文中に混在する部署名を推定分離せず、数値も費用・指標へ転記しない。');
  const prior=out.get(h[1]);if(prior){prior.evidence.push(...p.evidence);prior.outcomes+='\n'+body;}else out.set(h[1],p);
 }
 return [...out.values()];
}
