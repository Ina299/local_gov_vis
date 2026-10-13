import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

export function extractTakko(input: CachedInput): ProjectEvaluation[] {
  if(input.municipalityCode!=='02443'||input.format!=='pdf'||!input.text.includes('田子町教育委員会')||!input.text.includes('―令和６年度の実績―')) return [];
  const headings=[...input.text.matchAll(/^◆ [^\n]+/gm)];
  const results:ProjectEvaluation[]=[];const seen=new Set<string>();
  for(let i=0;i<headings.length;i++){
    if(!headings[i][0].startsWith('◆ 事業個別評価表 '))continue;
    if(i===headings.length-1&&input.truncated)continue;
    const start=headings[i].index!;const block=input.text.slice(start,headings[i+1]?.index??input.text.length);
    const identity=block.match(/^事業名 (\d+) (.+?) ([◎○〇△])$/m);
    if(!identity||!/^実績(?: |$)/m.test(block)||!/^成果(?: |$)/m.test(block)||!/^評価と(?: |$)/m.test(block)||!block.includes('方向性'))continue;
    const code=identity[1];if(seen.has(code))throw new Error(`Duplicate Takko assessment: ${code}`);seen.add(code);
    const item=project(input,code,identity[2],2025,block,start);item.evaluatedFiscalYear=2024;
    item.ratings.push({kind:'self',label:'事業の評価',value:identity[3],scale:null,evidence:evidence(input,identity[0],start+identity.index!)});
    const from=block.search(/^実績(?: |$)/m);const to=block.search(/^評価と(?: |$)/m);
    if(to>from){item.outcomes=block.slice(from,to).trim();item.evidence.push(evidence(input,item.outcomes,start+from));}
    item.warnings.push('教育委員会の独立事業個別評価表。実績・成果はラベル位置からの原文抜粋であり、ラベルより前へ回り込んだ本文は個票全文出典を参照。本文中の委託額・補助額等を事業全体の費用と見なさず数値未構造化。外部アドバイザー総評は各票の自己評価と混同していません。');
    results.push(item);
  }
  return results;
}
