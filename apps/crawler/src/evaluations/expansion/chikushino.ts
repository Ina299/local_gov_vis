import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

export function extractChikushino(input: CachedInput): ProjectEvaluation[] {
  if(input.municipalityCode!=='40217'||input.format!=='pdf'||!input.text.includes('令和７年度\n筑紫野市事務事業外部評価委員会\n答申結果および検討方針'))return [];
  const headers=[...input.text.matchAll(/^№([０-９]+)\n/gm)];
  const results:ProjectEvaluation[]=[];const seen=new Set<string>();
  for(let i=0;i<headers.length;i++){
    if(i===headers.length-1&&input.truncated)continue;
    const start=headers[i].index!;const block=input.text.slice(start,headers[i+1]?.index??input.text.length);
    const identity=block.match(/^事務事業名 ([^\n]+)\n所管課等名 ([^\n]+)\n評価結果 ([^\n]+)/m);
    const requestStart=block.indexOf('【改善項目①】');const responseStart=block.indexOf('（１）');
    if(!identity||requestStart<0||responseStart<=requestStart||!block.includes('検討方針'))continue;
    const code=headers[i][1].normalize('NFKC');if(seen.has(code))throw new Error(`Duplicate Chikushino opinion: ${code}`);seen.add(code);
    const item=project(input,code,identity[1],2025,block,start);item.department=identity[2];
    const line=block.match(/^評価結果 [^\n]+/m)!;
    item.ratings.push({kind:'external',label:'外部評価委員会 評価結果',value:identity[3],scale:null,evidence:evidence(input,line[0],start+line.index!)});
    const requests=block.slice(requestStart,responseStart).trim();
    item.ratings.push({kind:'external',label:'改善要望事項等',value:requests,scale:null,evidence:evidence(input,requests,start+requestStart)});
    const response=block.slice(responseStart).trim();
    item.evidence.push(evidence(input,response,start+responseStart));
    item.warnings.push('外部評価答申と市の検討方針を部分構造化したレコードで、完全な事務事業評価個票ではありません。検討方針は個票全文の出典に保持し、実施済み活動や成果として転記していません。資料中に言及される将来年度や上位基本事業の指標を、この事業の対象年度・成果数値と見なしていません。');
    results.push(item);
  }
  return results;
}
