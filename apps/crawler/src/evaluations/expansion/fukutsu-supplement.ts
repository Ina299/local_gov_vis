import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,project,evidence} from './shared';
/** R6 report only; the pre-existing R7 extraction remains frozen. */
export function extractFukutsuSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='40224'||input.sourceId!=='b7fdca7d1a5f3f59bc814aeb'||input.format!=='pdf'||!input.text.startsWith('令和６年度\n主要施策成果報告書\n（事務事業評価）'))return [];
 const heads=[...input.text.matchAll(/^([^\n]+) 単位：円\n大事業 ([^\n]+) 担当 ([^\n]+)\n/gm)];
 const out:ProjectEvaluation[]=[];
 for(let i=0;i<heads.length;i++){
  const h=heads[i],start=h.index!,raw=input.text.slice(start,heads[i+1]?.index??input.text.length);
  const footer=/\n-(\d+)-\s*$/.exec(raw);
  if(!footer||!raw.includes('【事後】課題 【事後】成果')||!raw.includes('課題に対する改善・改革案'))continue;
  const p=project(input,`2024-page:${footer[1]}`,h[1],null,raw,start);p.evaluatedFiscalYear=2024;p.department=h[3];
  const activity=/事業の内容（具体的なやり方、手順等。複数年度事業は全体像を記入）\n([\s\S]*?)\n事業の達成度を測る指標/.exec(raw);if(activity)p.activities=activity[1].trim();
  p.evidence.push(evidence(input,'令和６年度\n主要施策成果報告書\n（事務事業評価）'));
  p.warnings.push('令和6年度実績の個別事業票。評価実施年度は未明記。ページ末尾と事後評価見出しが揃った票のみ採用し、切詰末尾を除外。課題・成果は左右列が交差するため全文根拠で保持。予算・決算・財源の空欄位置と指標列の対応は未確定のため数値は未抽出。');out.push(p);
 }
 return out;
}
