import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractSuwaSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='20206'||input.sourceId!=='15c84080811ea70453dba415'||input.format!=='pdf')return [];
 const title='令和3年度 事務事業評価結果 一覧表';if(!input.text.includes(title))return [];
 const fiscalHeader='理 R3年度\n本\nN 事業名 事業概要 決算額 主管課・係\n施 （千円）';if(!input.text.includes(fiscalHeader))return [];
 const out:ProjectEvaluation[]=[];
 for(const m of input.text.matchAll(/^(?:[^\d\s] )?(\d+) (\S+(?:事業|経費))$/gm)){
  // The money/department row must immediately follow the remaining one-line purpose cell.
  const tail=input.text.slice(m.index!+m[0].length,m.index!+m[0].length+230);
  const a=/^([\d,]+) (\S+課|危機管理室) ([A-F]) (現状継続|見直し継続|終期設定|終了|休止|廃止)([^\n]*)\n/m.exec(tail);
  if(!a||a.index>65)continue;
  const decisions=[...a[0].matchAll(/([A-F]) (現状継続|見直し継続|終期設定|終了|休止|廃止)/g)];
  if(decisions.length!==2)continue;
  const raw=input.text.slice(m.index!,m.index!+m[0].length+a.index+a[0].length);
  const p=project(input,m[1],m[2],2021,raw,m.index!);p.department=a[2];p.evaluatedFiscalYear=2021;p.evidence.push(evidence(input,title));p.evidence.push(evidence(input,fiscalHeader));
  p.amounts.push({kind:'actual',fiscalYear:2021,amountYen:Number(a[1].replaceAll(',',''))*1000,rawValue:a[1],rawUnit:'千円',evidence:evidence(input,raw,m.index!)});
  for(let i=0;i<decisions.length;i++)p.ratings.push({kind:i===0?'self':'external',label:i===0?'今後の方向性（担当課評価結果）':'今後の方向性（外部評価後の最終評価結果）',value:decisions[i][0],scale:null,evidence:evidence(input,raw,m.index!)});
  p.warnings.push('単一行で完結する名称と直後の決算・所属・二段階方向性のみ部分抽出。決算額の人件費包含範囲は不明で直接費とは断定しない。外部評価後の最終評価は外部委員の独自評点ではない。保存本文は途中で切れており、折返し名称、複数行に跨る最終評価、分断された部署、妥当性等の評点は未分離。');out.push(p);
 }
 return out;
}
