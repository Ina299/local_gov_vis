import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
export function extractToda2024(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='11224'||input.sourceId!=='d199a2fbcbbd61adeea87fa7')return [];
 const rows=new Map<string,ProjectEvaluation>();
 for(const m of input.text.matchAll(/^([^\s]+事業) [\d,]+[^\n]*(?:\n[^\n]*){0,2}\n(\d{2} ?\d{2}(?: \d{2}){5}) ([任義法]) ([^\n]+)/gm)){
  if(['生活用具給付事業','ター事業','金支給事業'].includes(m[1]))continue;
  const rating=m[4].match(/[ＡＢＣＤ](?: [ＡＢＣＤ義法終]){4}/);if(!rating)continue;
  const code=m[2].replace(/ /g,'');
  if(rows.has(code)){const r=rows.get(code)!;r.evidence.push(evidence(input,m[0],m.index!));r.warnings.push('こども医療費支給事業は同一掲載コード・名称が旧区分別に2行あるため1評価単位へ統合。終了/統合の方向性や費用は合算・単一化しない。');continue;}
  const r=project(input,code,m[1],2024,m[0],m.index!);r.evaluatedFiscalYear=2023;r.projectCode=null;
  r.ratings.push({kind:'self',label:'事務事業評価・担当部局評価欄（原文記号列）',value:rating[0],scale:null,evidence:evidence(input,rating[0],m.index!+m[0].indexOf(rating[0]))});
  r.warnings.push('施策評価シート末尾の事務事業検討表から名称一行・掲載コード・評価記号が確定する行のみ部分抽出。符号を掲載順で保持し評価ラベルへ個別対応させない。決算/予算の空欄詰めと施策総額の転記は行わない。');rows.set(code,r);
 }
 return [...rows.values()];
}
