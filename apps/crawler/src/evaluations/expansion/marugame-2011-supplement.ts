import type{ProjectEvaluation}from'../../../../web/src/types/evaluation';import{type CachedInput,evidence,project}from'./shared';
/** Explicit named project subsections; policy-level ratings remain outside the records. */
export function extractMarugame2011Supplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='37202'||input.sourceId!=='a326780197bf7e9078d25004'||input.format!=='pdf')return[];
 const t=input.text;const headers=[...t.matchAll(/【([^】\n]+)】/g)];const out=new Map<string,ProjectEvaluation>();
 for(let i=0;i<headers.length;i++){
  const h=headers[i];if(!h[1].endsWith('事業'))continue;
  let end=headers[i+1]?.index??t.length;const boundary=t.slice(h.index!,end).search(/^(?:２次評価での所見等|2次評価での所見等|【今後|主要な施策|政策の柱|■)/m);if(boundary>=0)end=h.index!+boundary;
  const deptEnd=t.slice(h.index!,end).match(/＜[^＜＞\n]+(?:課|部|局|館|センター)＞/);if(deptEnd)end=Math.min(end,h.index!+deptEnd.index!+deptEnd[0].length);
  if(input.truncated&&end===t.length)continue;
  const raw=t.slice(h.index!,end);let body=raw.slice(h[0].length).trim();if(body.length<30)continue;
  const p=project(input,'plan2011-'+h[1],h[1],2011,raw,h.index);p.activities=body;p.department=raw.match(/＜([^＜＞\n]+(?:課|部|局|館|センター))＞/)?.[1]??null;
  p.evidence.push(evidence(input,t.slice(0,65),0));p.warnings.push('前期基本計画評価内の【事業名】で独立する実施状況本文。施策全体の1次・2次・外部評価評点は転用しない。期間は平成19～23年度の計画評価で複数年度実績を含み、単一対象実績年度を設定しない。部署は当該区間で明示された場合のみ。改ページ見出しと原文の段組は保持し、本文数値を推定で費用・指標へ分配しない。');
  const old=out.get(h[1]);if(old){old.evidence.push(...p.evidence);old.activities+='\n'+body;}else out.set(h[1],p);
 }
 return [...out.values()];
}
