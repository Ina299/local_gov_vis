import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractTakahashiSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='33209'||!/^令和５年度 高梁市事務事業評価シート\n作成日：/.test(input.text))return [];
 const h=input.text.match(/事業番号 (\d+) 事 業 名 (.+?) 所 属 名 ([^\n]+)/);
 if(!h||!input.text.includes('Ⅲ 評価・改善'))return [];
 const p=project(input,h[1],h[2],2023,input.text);p.department=h[3];
 const purpose=input.text.match(/目 的 ([\s\S]*?)\n対 象/);if(purpose)p.purpose=purpose[1].trim();
 for(const [label,pattern] of [['目的妥当性',/目 的 妥 当 性 (適切|改善の余地あり)/],['有効性',/有 効 性 (適切|改善の余地あり)/],['費用対効果',/費 用 対 効 果 (適切|改善の余地あり)/]] as const){const r=input.text.match(pattern);if(r)p.ratings.push({kind:'self',label,value:r[1],scale:null,evidence:evidence(input,r[0])});}
 p.warnings.push('R2～R4複数年度の活動を含み単一の評価対象年度は未確定。経費表は予算・決算種別を明示せず人件費も概算のため金額は本文証拠に保持。');return [p];
}
