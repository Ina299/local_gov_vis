import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractKomatsu(input: CachedInput): ProjectEvaluation[] {
 if(input.municipalityCode!=='17203'||input.sourceId!=='014f5506d214ec30a928b3c7'||input.format!=='pdf'||!input.text.includes('（令和６年度事業対象）\n令和７年８月'))return [];
 const rows:ProjectEvaluation[]=[];
 for(const h of input.text.matchAll(/^点検評価票\n/gm)){
  const start=h.index!;const tail=input.text.slice(start);const footer=tail.match(/用語説明[\s\S]*?\n(\d+)(?=\n|$)/);if(!footer)continue;
  const raw=tail.slice(0,footer.index!+footer[0].length);
  if(raw.slice(h[0].length).includes('\n点検評価票'))continue;
  const dept=raw.match(/(?:^| )継続 ([^\n]+)/m);if(!dept)continue;
  let name=raw.match(/(?:^| )事業名 ([^\n]+)/m)?.[1];
  if(!name){
   const title=raw.match(/\n([^\n]+)\nl 事業名\n(.+?) 継続/);if(!title)continue;
   name=title[1]+(title[1]==='小松市社会教育賞'?'・':'')+title[2];
  }
  const p=project(input,`個票p${footer[1]}`,name,2025,raw,start);p.department=dept[1];p.evaluatedFiscalYear=2024;
  const a=raw.indexOf('評価（達成度）'),z=raw.indexOf('Ａ 十分達成',a);
  if(a<0||z<a)continue;
  const panel=raw.slice(a,z);const grades=[...panel.matchAll(/(?:^|\s)([ＡＢ])(?=\s|$)/g)];
  if(grades.length!==1)continue;
  p.ratings.push({kind:'self',label:'点検評価票 評価（達成度）',value:grades[0][1].normalize('NFKC'),scale:'A:十分達成 B:おおむね達成 C:やや不十分 D:達成できず',evidence:evidence(input,panel,start+a)});
  p.warnings.push('令和6年度事業対象、令和7年8月報告の個別点検評価票。縦中央の項目見出しと本文が交錯するため目的・活動・成果の文章は個票全文に保持し、項目ごとの推測分割はしていません。共通アクションプラン指標や過年度数値の配賦、費用数値化は保留。');
  rows.push(p);
 }
 return rows;
}
