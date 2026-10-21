import type{ProjectEvaluation}from'../../../../web/src/types/evaluation';import{type CachedInput,evidence,project}from'./shared';
/** The existing 37 individual sheets cover all overview rows except the third named business in joint row 8. */
export function extractIizukaRowsSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.sourceId!=='efbc7fc477d73eb4361e90c0'||input.municipalityCode!=='40205'||input.truncated)return[];
 const start=input.text.indexOf('541-2 青少年体験活動事業 成果の方向性');const end=input.text.indexOf('成果の方向性 ⑦廃止',start);if(start<0||end<0)return[];
 const raw=input.text.slice(start,end);if(!raw.includes('541-14 レクリエーション研究会活動支援事業 ②現状維持 ②現状維持'))return[];
 const p=project(input,'541-14','レクリエーション研究会活動支援事業',2024,raw,start);p.evaluatedFiscalYear=2023;p.department='教育部 生涯学習課';
 p.ratings=[['1次評価・成果の方向性','⑤縮小'],['2次評価・成果の方向性','④現状維持'],['1次評価・コスト投入の方向性','②現状維持'],['2次評価・コスト投入の方向性','②現状維持']].map(([label,value])=>({kind:'self',label,value,scale:null,evidence:evidence(input,raw,start)}));
 p.evidence.push(evidence(input,input.text.slice(0,input.text.indexOf('変更あり')),0));
 p.warnings.push('一覧の第8枠は青少年体験活動・成人教育・本事業の3事業合同評価であり、評点は合同枠の判断。既存個票に収録された前2事業は追加せず本事業のみ部分収録。事業名が分かれる原コード541-14を保持し、共同評価を独立測定とみなさない。費用や個別成果指標は掲載なし。');return[p];
}
