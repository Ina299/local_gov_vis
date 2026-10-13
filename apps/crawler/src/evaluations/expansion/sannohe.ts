import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** Numbered education project sheets; policy headings and repeat appearances are not new projects. */
export function extractSannohe(input: CachedInput): ProjectEvaluation[] {
  if(input.municipalityCode!=='02441'||input.format!=='pdf'||!input.text.startsWith('令和７年度\n三戸町教育委員会')||!input.text.includes('－令和７年度事業の点検評価－'))return [];
  const headings=[...input.text.matchAll(/^〔([^〕]+)〕 ([^\n]+)/gm)];
  const rows:ProjectEvaluation[]=[];const byName=new Map<string,ProjectEvaluation>();
  for(let i=0;i<headings.length;i++){
    const h=headings[i];if(i===headings.length-1&&input.truncated)continue;
    const start=h.index!;const block=input.text.slice(start,headings[i+1]?.index??input.text.length);
    const name=h[2].split('（再掲')[0].trim();
    if(!block.includes('◆目的')||!block.includes('実 績')||!block.includes('◆成果')||!block.includes('方向性'))continue;
    if(h[2].includes('再掲')){
      // The source explicitly calls the teaching practice sheet a reprint of the teaching skills lecture.
      const target=name==='授業実践支援事業（三戸地方教育研究所）'?'授業技術研修講座（三戸地方教育研究所）':name;
      const original=byName.get(target);if(!original)throw new Error(`Unresolved Sannohe reprint: ${name}`);
      original.evidence.push(evidence(input,block,start));original.warnings.push('原典が再掲と明示する別施策欄を証拠として保持し、事業件数・金額を重複計上しません。');continue;
    }
    if(byName.has(name))throw new Error(`Unreviewed Sannohe duplicate: ${name}`);
    const p=project(input,`${i+1}:${h[1]}`,name,null,block,start);p.evaluatedFiscalYear=2025;
    const purposeStart=block.indexOf('◆目的');const activityStart=block.indexOf('実 績');const outcomeStart=block.indexOf('成果と',activityStart);const explicitIssue=block.indexOf('◆課題',outcomeStart);const issueStart=explicitIssue>=0?explicitIssue:block.indexOf('事業の 継続',outcomeStart);
    if(outcomeStart<activityStart||issueStart<outcomeStart)throw new Error('Unresolved Sannohe narrative boundary');
    let purposeEnd=block.indexOf('◆事業費',purposeStart);if(purposeEnd<0||purposeEnd>activityStart)purposeEnd=activityStart;
    p.purpose=block.slice(purposeStart,purposeEnd).trim();
    p.activities=block.slice(activityStart,outcomeStart).trim();
    p.outcomes=block.slice(outcomeStart,issueStart).trim();
    for(const raw of [p.purpose,p.activities,p.outcomes])p.evidence.push(evidence(input,raw,start+block.indexOf(raw)));
    p.warnings.push('令和7年度実施事業の教育点検評価。評価実施年度は確定せずnull。事業費欄は予算・決算の別が明示されず、一部に実績支給額との不一致もあるため数値化せず原文保持。実績・成果は叙述であり、数値成果指標への分類や推測補完は未実施。');
    rows.push(p);byName.set(name,p);
  }
  return rows;
}
