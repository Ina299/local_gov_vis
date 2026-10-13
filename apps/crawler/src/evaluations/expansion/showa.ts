import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

export function extractShowa(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '07446' || input.format !== 'pdf' || !input.text.includes('令和５年度昭和村教育委員会の点検･評価報告書')) return [];
  const headers = [...input.text.matchAll(/^No\.(\d+\(\d+\)[①-⑳])\n令和４年度 事業評価シート\n/gm)];
  const result: ProjectEvaluation[] = [];
  const seen = new Set<string>();
  for (let i=0;i<headers.length;i++) {
    if (input.truncated && i===headers.length-1) continue;
    const start=headers[i].index!;
    const block=input.text.slice(start,headers[i+1]?.index ?? input.text.length);
    const name=block.match(/^事業名 [①-⑳] (.+)$/m)?.[1];
    const internal=block.match(/^内部評価 ([Ａ-ＤA-D]) コメント ([^\n]+)/m);
    const external=block.match(/^外部評価 ([Ａ-ＤA-D]) 評価委員意見 ([^\n]+)/m);
    if(!name || !internal || !external || !block.includes('事業の対象')) continue;
    const code=headers[i][1];
    if(seen.has(code)) throw new Error(`Duplicate Showa project number: ${code}`);
    seen.add(code);
    const item=project(input,code,name,2023,block,start);
    item.evaluatedFiscalYear=2022;
    const costStart=block.indexOf('令和４年度決算 前年度決算額');
    const costEnd=block.indexOf('実績・成果',costStart);
    if(costStart>=0 && costEnd>costStart){
      const cost=block.slice(costStart,costEnd);
      const amounts=cost.match(/^([\d,]+) 千円 ([\d,]+) 千円/m);
      if(amounts){
        for(const [column,year] of [[1,2022],[2,2021]]) item.amounts.push({kind:'actual',fiscalYear:year,
          amountYen:Number(amounts[column].replace(/,/g,''))*1000,rawValue:amounts[column],rawUnit:'千円',
          evidence:evidence(input,cost,start+costStart)});
      }
    }
    for(const [kind,match,label] of [['self',internal,'内部評価'],['external',external,'外部評価']] as const){
      item.ratings.push({kind,label,value:match[1],scale:null,evidence:evidence(input,match[0],start+match.index!)});
    }
    const outcomeStart=block.indexOf('実績・成果'); const outcomeEnd=block.indexOf('必要性（',outcomeStart);
    if(outcomeStart>=0 && outcomeEnd>outcomeStart){
      item.outcomes=block.slice(outcomeStart,outcomeEnd).trim();
      item.evidence.push(evidence(input,item.outcomes,start+outcomeStart));
    }
    item.warnings.push('教育委員会報告書内の独立事業評価シート。事業費は令和4年度決算と前年度決算を区別。実績・成果欄はラベル位置からの原文抜粋であり、ラベルより前に回り込む文章は個票全文の出典を参照。');
    result.push(item);
  }
  return result;
}
