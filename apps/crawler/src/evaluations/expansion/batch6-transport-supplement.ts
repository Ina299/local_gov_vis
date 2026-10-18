import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
const inputs:Record<string,{code:string;year:number}>={cdb4cf909c6659d85653b7d7:{code:'01345',year:2025},'45e410a2fa2e347708177000':{code:'38207',year:2022},e1a961c97f5e1d48f7ac2347:{code:'01461',year:2018}};
export function extractBatch6TransportSupplement(input:CachedInput):ProjectEvaluation[]{
 const known=inputs[input.sourceId];if(!known||input.municipalityCode!==known.code||input.format!=='pdf'||input.truncated)return [];
 const name=input.text.match(/^評価対象事業名： ?(.+)$/m),council=input.text.match(/^協議会名： ?(.+)$/m);
 if(!name||!council||!input.text.includes('事業評価結果の反映状況'))return [];
 const p=project(input,'transport-evaluation',name[1],known.year,input.text,0);p.department=council[1];
 p.ratings.push({kind:'self',label:'協議会の事業評価原文（適切性・達成状況・改善点の列混在）',value:input.text,scale:null,evidence:evidence(input,input.text,0)});
 p.warnings.push('補助対象の評価対象事業名単位で1件。路線・事業者を独立事業として数えていません。評価表の原文を保存し、横方向の列混在がある評点・数値・成果文を分離していません。作成日から評価年を記録、対象年度は本文で確定できず未設定。');
 return [p];
}
