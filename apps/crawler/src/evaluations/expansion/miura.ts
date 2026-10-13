import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractMiura(input: CachedInput): ProjectEvaluation[] {
  if(input.municipalityCode!=='14210'||input.sourceId!=='854bb8045dd409b2016516ef'||input.format!=='pdf'||!input.text.startsWith('令和８年度（令和７年度実施事務事業）'))return [];
  const rows:ProjectEvaluation[]=[];const seen=new Set<string>();
  for(const h of input.text.matchAll(/^No\. 事業名 部門[^\n]+\n部 教育部\n(\d+) ([^\n]+)/gm)){
    const start=h.index!;const tail=input.text.slice(start);const footer=tail.match(/^[-] \d+ [-]$/m);if(!footer)continue;
    const raw=tail.slice(0,footer.index!+footer[0].length);
    const name=h[2].split(' 課 ')[0];const dept=raw.match(/(?:^| )課 ([^\n]+)/m);
    if(!raw.includes('附 帯 意 見')||!dept||seen.has(h[1]))continue;seen.add(h[1]);
    const p=project(input,h[1],name,2026,raw,start);p.evaluatedFiscalYear=2025;p.department=dept[1];
    const activity=raw.match(/令和 7 年度 事業内容\n([\s\S]*?)\n令和 7 年度 達成目標/);
    if(activity){p.activities=activity[1].trim();p.evidence.push(evidence(input,p.activities,start+raw.indexOf(p.activities)));}
    for(const r of raw.matchAll(/^(事 業 手 法|目標と 実績|事 業 効 果) ([1-5]) ([^\n]+)/gm)){
      p.ratings.push({kind:'self',label:'教育委員会総合評価：'+r[1].replaceAll(' ',''),value:`${r[2]} ${r[3]}`,scale:'1～5',evidence:evidence(input,r[0],start+r.index!)});
    }
    p.warnings.push('令和8年度評価・令和7年度実施事業。金額欄は「決算（見込）」であり確定決算と区別できないため費用数値化は保留。目標と実績、成果課題と対処方針の左右欄が混在するため指標・outcomesへ推測転記せず個票原文に保持。評価項目のランクは教育委員会総合評価の3項目を転記しています。');
    rows.push(p);
  }
  return rows;
}
