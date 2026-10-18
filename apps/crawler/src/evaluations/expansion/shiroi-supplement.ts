import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
/** Complete, single-line names only; wrapped project-name cells stay in the review queue. */
export function extractShiroi2016(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='12232'||input.sourceId!=='0976e2dc64011c03757c7de7')return [];
 const starts=[...input.text.matchAll(/^([0-9]{4})-([^\n]*)\n/gm)],rows:ProjectEvaluation[]=[];
 for(let i=0;i<starts.length;i++){
  const h=starts[i],raw=input.text.slice(h.index!,starts[i+1]?.index??input.text.length);
  // Any content after the upper code could be a wrapped name prefix: do not guess.
  if(h[2].trim())continue;
  const preceding=input.text.slice(0,h.index).trimEnd().split('\n').at(-1)??'';
  if(!/[◎○△×]|継続|見直し|その他|高い|普通|低い|重点化|効率化|簡素化|終了|班$|課$|室$/.test(preceding))continue;
  const m=raw.match(/^\d{4}-\n(\d+) (\d-\d{2})[ \n]([^\s]+(?:事業|費|運営|管理|整備)) (健康福祉部|市民経済部|環境建設部|教育部|総務部|企画財政部|都市建設部)(?=\s)/);
  if(!m)continue;
  const ratings=raw.match(/[◎○△×](?: [◎○△×]){4}(?! [◎○△×])/);if(!ratings)continue;
  const end=ratings.index!+ratings[0].length,exact=raw.slice(0,end);
  const r=project(input,`${h[1]}-${m[2]}`,m[3],2016,exact,h.index!);r.evaluatedFiscalYear=2015;r.department=m[4];
  r.ratings.push({kind:'self',label:'評価欄（活動達成度・成果・総合評価・妥当性・効率の原文順）',value:ratings[0],scale:null,evidence:evidence(input,ratings[0],h.index!+ratings.index!)});
  r.warnings.push('平成27年度事業219件のうち名称が一行で確定する評価行のみ。5記号は原文の並びを保持し各記号の列ラベル対応は推測しない。折返し名称、年度別方向性、個票詳細、費用は未抽出。');rows.push(r);
 }
 return rows;
}
