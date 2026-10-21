import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
export function extractMoriya(input:CachedInput):ProjectEvaluation[]{
 const heading='令和 7年度 基本事業(取組)評価シート （令和 6年度実績評価）';
 const columns='R05年度 R06年度 R07年度 コスト 成 果 事 業';
 if(input.municipalityCode!=='08224'||!input.text.includes(heading)||!input.text.includes(columns))return [];
 const out:ProjectEvaluation[]=[];
 for(const m of input.text.matchAll(/^([^ ]+(?:事業|費|指導)) 対象 ([^ \n]+(?:課|所|館|局)) ([\d,]+) ([\d,]+) ([\d,]+)(?: [○◎△])? (維持|増加|削減) (向上|横ばい|低下) (維持|拡大|改善・効率化|統合|縮小|廃止)$/gm)){
  if(input.truncated&&m.index!+m[0].length===input.text.length)continue;
  const p=project(input,m[1],m[1],2025,m[0],m.index);p.department=m[2];p.evaluatedFiscalYear=2024;
  for(const[label,value]of [['コスト方向性',m[6]],['成果方向性',m[7]],['事業方向性',m[8]]])p.ratings.push({kind:'self',label,value,scale:null,evidence:evidence(input,m[0],m.index)});
  p.evidence.push(evidence(input,heading),evidence(input,columns));p.warnings.push('基本事業全体の指標・費用を下位事務事業へ配賦しません。個別事務事業欄の同一行にある名称・担当課・方向性のみ。対象外、折返し、3方向性が揃わない行を除外。');out.push(p);
 }
 return out;
}
