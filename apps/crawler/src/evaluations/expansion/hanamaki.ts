import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractHanamaki(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='03205'||input.format!=='pdf'||input.truncated)return [];
 const t=input.text;if(!t.startsWith('令和6年度\n事務事業評価シート 【事後評価】')||!t.includes('成果指標の達成度'))return [];
 const id=t.match(/^\d{2} \d{2} \d{2} \d{2} (\d{6}) (\S+)/m);if(!id)return [];
 const item=project(input,id[1],id[2],null,t,0);item.evaluatedFiscalYear=2024;
 const start=t.indexOf('成果指標 単位 区分 R05 R06 R07');const end=t.indexOf('成果指標の達成度',start);const b=t.slice(start,end);
 const rows=b.match(/広報など市から提供される情報がタイムリーでわかりやすい 目標 ([\d.]+) ([\d.]+)[\s\S]*?1 と思う市民の割合\[まちづくり市民アンケート結果\] ％[\s\S]*?実績 ([\d.]+) ([\d.]+)/);
 if(rows)for(let i=1;i<=2;i++)item.indicators.push({name:'【成果指標】広報など市から提供される情報がタイムリーでわかりやすいと思う市民の割合[まちづくり市民アンケート結果]',unit:'％',fiscalYear:2022+i,target:rows[i],actual:rows[i+2],evidence:evidence(input,b,start)});
 item.warnings.push('表題年度は事後評価の対象年度として保持。段組が交錯するため原文全体を出典として残し、費用の予算・決算区分は推測しません。成果指標は原表の前年度・本年度のみ転記。');return [item];
}
