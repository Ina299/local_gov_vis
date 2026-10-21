import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
export function extractHachiojiListSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='13201'||input.sourceId!=='70d1fbf45b00aab28e0b97e3'||input.truncated||input.format!=='pdf')return[];
 const records:ProjectEvaluation[]=[];
 for(const m of input.text.matchAll(/^(\d+) (\S+) (\S+) (.+?) 事務事業 .*? (達成|概ね達成|未達成|一部達成) (継続|拡充|改善|縮小|廃止)$/gm)){
  if([...m[4]].filter(c=>c==='（').length!==[...m[4]].filter(c=>c==='）').length)continue;
  const p=project(input,`list-2025-${m[1]}`,m[4],2025,m[0],m.index!);p.department=m[2]+' '+m[3];p.evaluatedFiscalYear=2024;
  p.evidence.push(evidence(input,input.text.split('\n')[0],0));
  for(const [label,value]of [['評価',m[5]],['方向性',m[6]]])p.ratings.push({kind:'self',label,value,scale:null,evidence:evidence(input,m[0],m.index!)});
  p.warnings.push('事務事業点検結果一覧の単行で識別できる事業名・評価・方向性のみを部分構造化。事業個票ではありません。目的や概要の列混線、名称改行を推測せず、人員体制の数値を金額や成果実績へ変換していません。');records.push(p);
 }
 return records;
}
