import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractFussaRowsSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='13218'||input.sourceId!=='bf0a98bc9eebcddc6ffa3c8a'||input.truncated||!input.text.startsWith('令和７年度行政評価対象事業（令和６年度実施事業）一覧'))return[];
 const result:ProjectEvaluation[]=[];
 for(const m of input.text.matchAll(/^(\d+) [0-9０-９]+_\S+ [0-9０-９]+_\S+ (\S+) (\S+) ([ＡＢＣＤ]) (事業[^\n。]+。)/gm)){
  const p=project(input,m[1],m[2],2025,m[0],m.index);p.department=m[3];p.evaluatedFiscalYear=2024;
  p.ratings.push({kind:'self',label:'行政評価結果',value:`${m[4]} ${m[5]}`,scale:null,evidence:evidence(input,m[0],m.index)});
  p.warnings.push('事業別結果一覧の番号・名称・所管課長名・評価の対応が確定する行を抽出。所管は原文の課長職名で保持。別列の改善検討結果・備考が行の前後へ分断されるためそれらは取り込まない。費用・指標未掲載。');result.push(p);
 }
 return result;
}
