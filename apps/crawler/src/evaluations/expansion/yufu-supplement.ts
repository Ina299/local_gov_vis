import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,project,evidence} from './shared';
const names=new Set(['由布市公式ホームページバナー広告','ユーバス時刻表広告','市封筒広告','新環境センターの設立・稼働','消防指令業務の共同運用','職員研修の充実','電子申請※63サービス利用の推進','オンライン会議の常設']);
export function extractYufuSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='44213'||input.sourceId!=='4b4a506b459e8be8251cd379'||input.format!=='pdf'||input.truncated||!input.text.includes('［令和７年度］'))return [];
 const heads=[...input.text.matchAll(/^(?:●\s*)?([^\n［]+) ［([^\n］]+)］\n/gm)];
 return heads.flatMap((h,i)=>{
 const name=h[1].trim();if(!names.has(name))return [];
 const start=h.index!,part=input.text.slice(start,heads[i+1]?.index??input.text.length);const end=/^評価 ([Ａ-ＤA-D])\s*$/m.exec(part);if(!end)return [];
 const raw=part.slice(0,end.index+end[0].trimEnd().length);const p=project(input,`2025:${name}`,name,null,raw,start);p.department=h[2];p.evaluatedFiscalYear=2025;
 p.ratings.push({kind:'self',label:'取組評価',value:end[1],scale:null,evidence:evidence(input,end[0].trimEnd(),start+end.index)});p.evidence.push(evidence(input,'［令和７年度］'));
 p.warnings.push('行財政改革報告のうち具体的なサービス・施設整備・運営業務を特定できる取組票のみ採用。財政運営全般・制度改正・施策群は除外。令和7年度実績と5年間総括が横に混在するため文章は全文根拠で保持し、金額・効果額・収入を事業費に転用しない。評価実施年度は未確定。');return[p];
 });
}
