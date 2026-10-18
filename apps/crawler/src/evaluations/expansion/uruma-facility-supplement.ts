import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
/** A municipal management assessment is not a business-project evaluation sheet. */
export function extractUrumaFacilitySupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='47213'||input.format!=='pdf'||input.truncated||!input.text.includes('指定管理者の管理運営に対する評価シート'))return[];
 const name=input.text.match(/^名 称 ([^\n]+)\n所在地 /m),dept=input.text.match(/^担当課 (.+)$/m);
 const period=input.text.match(/^評価対象期間 (?:R6\.4\.1\s*～\s*R7\.3\.31|令和6年4月1日～令和7年3月31日)$/m);
 const block=input.text.match(/【総合評価】[^]*?(?=【指定管理者評価部会の意見】|$)/);
 if(!name||!dept||!period||!block||/、|①|②|等$/.test(name[1]))return[];
 const rating=block[0].match(/合計得点[^\n]*?評価ランク（S～D） ([SABCD])(?:\n|$)/);
 if(!rating)return[];
 const p=project(input,'facility-operation-2024',name[1]+'の指定管理運営評価',null,input.text,0);
 p.projectCode=null;p.department=dept[1];p.evaluatedFiscalYear=2024;
 p.ratings.push({kind:'self',label:'施設所管課・総合評価ランク',value:rating[1],scale:'S～D',evidence:evidence(input,block[0],block.index!)});
 p.warnings.push('指定管理施設運営評価（事務事業評価個票ではない）。単一施設の令和6年度管理運営に対する所管課評価のみ。評価実施年度は本文で未確定。参考収支・施設属性・空欄の評価部会評点は抽出していません。');
 return[p];
}
