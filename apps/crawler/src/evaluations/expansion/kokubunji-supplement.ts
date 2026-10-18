import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, project } from './shared';
const missing:Record<string,string[]>={
 '24224b508ff81b0fb509464b':['0147010','0149880'],
 '353f18b99e2a77e1c0806b2b':['0131797','0107960','0131210','0137050','0137310','0137950'],
 '4f6a1d600aef5057b8eaa633':['0104137'],
 '63c2863a31241b52feb0dca4':['0113280','0108470'],
 '857006594412a17d4440c8c3':['0108465'],
 '862a6246050d11b48e198efe':['0119920'],
 'e8b7dffc52bd7b24487c2a4b':['0119930','0120295','0120900','0123750'],
};
export function extractKokubunjiSupplement(input:CachedInput):ProjectEvaluation[]{
 const codes=missing[input.sourceId];
 if(input.municipalityCode!=='13214'||input.format!=='pdf'||input.truncated||!codes)return[];
 const headers=[...input.text.matchAll(/^事務事業評価票 所管課 (.+)$/gm)];const records:ProjectEvaluation[]=[];
 for(let i=0;i<headers.length;i++){
  const h=headers[i];let raw=input.text.slice(h.index!,headers[i+1]?.index??input.text.length);const footer=raw.match(/^-[0-9]+-$/m);if(!footer)continue;raw=raw.slice(0,footer.index!+footer[0].length);
  const title=raw.match(/^事業番号 (\d+) 事務事業 (.+?) 細事業 (.+)$/m);
  if(!title||!codes.includes(title[1])||!raw.includes('次年度の実施方針と予算計上の考え方'))continue;
  const r=project(input,title[1],title[2],2025,raw,h.index!);r.department=h[1];
  const analysis=raw.indexOf('現状分析');if(analysis>=0)r.activities='予算編成に係る現状分析・次年度方針（原文欄）\n'+raw.slice(analysis);
  r.warnings.push('令和7年度公表資料に含まれる新規・移管等の予算編成評価。令和6年度成果欄が空欄等のため事後の対象年度を設定していません。予算・決算・比率の横並び列は推定せず原文保持。');records.push(r);
 }
 return records;
}
