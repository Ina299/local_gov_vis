import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
export function extractKawagoe2024Selected(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='11201'||input.sourceId!=='e43ce860f28953ada6cb6ecb')return [];
 const statement='令和6年度事務事業評価では、一次評価を実施した事業の内、事業の抜本的見直しが必要となる総合評価「D」の事業（8事業）を対象として、二次評価を実施しました。';
 if(!input.text.includes(statement))return [];
 return [...input.text.matchAll(/^([1-8])\.(.+?)\((.+?)\) （PDF [^\n]+$/gm)].map(m=>{
  const r=project(input,m[1],m[2],2024,m[0],m.index!);r.projectCode=null;r.evaluatedFiscalYear=2023;r.department=m[3];r.evidence.push(evidence(input,statement));
  r.ratings.push({kind:'self',label:'一次評価総合評価（二次評価対象の選定条件）',value:'D',scale:'事業の抜本的見直し、休・廃止の検討',evidence:evidence(input,statement)});
  r.warnings.push('HTMLの二次評価対象8事業名と全8件に共通する一次評価Dの明示を組み合わせた部分レコード。リンク先二次評価の結果・最終方向性は未取得でありDを最終結果とみなさない。');return r;
 });
}
