import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
/** Only the three audited complete departmental books; no costs or adjacent-column guesses. */
export function extractDescendingKirishima(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='46218'||input.format!=='pdf'||input.truncated||!['409e3e37fd9eaad20fbf9c37','63514575b8ae64e8f55ec420','973c0ab95506056694899e1b'].includes(input.sourceId))return [];
 const headers=[...input.text.matchAll(/^令和(\d+)年度 事務事業評価シート ([0-9]+-[0-9]+)\n/gm)],rows:ProjectEvaluation[]=[];
 for(let n=0;n<headers.length;n++){
  const h=headers[n],start=h.index!,body=input.text.slice(start,headers[n+1]?.index??input.text.length);
  const names=[...body.matchAll(/^事務事業名 (\d+) － ([^\n]+)\n政策名 /gm)];
  const period=`４．令和${h[1]}年度の実績・成果`;
  if(names.length!==1||!body.includes(period)||!body.includes('６．評価結果')||!body.includes('② コスト（予算）の方向性'))continue;
  const name=names[0],p=project(input,name[1],name[2].trim(),null,name[0],start+name.index!);
  p.evaluatedFiscalYear=2018+Number(h[1]);
  // Fiscal identity is the printed results year, not an assumed evaluation/publication year.
  p.id+='-fy'+p.evaluatedFiscalYear;
  p.evidence.push(evidence(input,h[0],start),evidence(input,period,start+body.indexOf(period)));
  p.warnings.push('完結した事務事業評価個票の名称・事業コード・明示実績年度のみ。評価公表年度、列が混在する金額・成果値は補わない。');rows.push(p);
 }
 return rows;
}
