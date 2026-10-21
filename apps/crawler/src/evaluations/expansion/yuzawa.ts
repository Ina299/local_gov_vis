import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput, evidence, project} from './shared';

/** R6 result-list rows only; wrapped names/departments and the differently laid-out R7 list are held. */
export function extractYuzawa(input:CachedInput):ProjectEvaluation[] {
  if(input.municipalityCode!=='15461'||input.format!=='pdf')return [];
  const heading='（令和６年度事務事業評価）結果一覧 （担当課評価） （事務事業評価委員会評価） （町長による見直し）';
  if(!input.text.includes(heading)||!input.text.includes('番号 事業名 担当課 担当係 記号 内容'))return [];
  const rows:ProjectEvaluation[]=[];
  const seen=new Set<string>();
  const labels:Record<string,string>={A:'目標達成',B:'概ね達成',C:'半ば達成',D:'わずかに進展',E:'ほとんど進展なし'};
  for(const m of input.text.matchAll(/^(\d+) ([^\s]+) ([^\s]+課) ([^\s]+係) ([A-E]) (目標達成|概ね達成|半ば達成|わずかに進展|ほとんど進展なし)(?= |$)[^\n]*/gm)){
    if(labels[m[5]]!==m[6]||seen.has(m[1]))continue;
    // A cut-off final line cannot establish a complete table row.
    if(input.truncated&&m.index+m[0].length===input.text.length)continue;
    seen.add(m[1]);
    // Keep only the unambiguous left-hand fields. Free-form right-hand columns flow
    // across multiple rows in extracted PDF text and cannot safely be attributed.
    const raw=`${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]} ${m[6]}`;
    const p=project(input,m[1],m[2],2024,raw,m.index);
    p.department=`${m[3]} ${m[4]}`;
    p.evidence.push(evidence(input,heading));
    p.ratings.push({kind:'self',label:'一次評価（担当課評価）',value:`${m[5]} ${m[6]}`,scale:null,evidence:evidence(input,`${m[5]} ${m[6]}`,m.index+raw.length-m[5].length-m[6].length-1)});
    p.warnings.push('評価結果一覧の単行で確定する事業名・担当課係・一次評価のみを部分構造化。完全な個票ではありません。委員会評価・町長指示・数値成果・費用は列混在または記載不足のため未抽出。評価対象年度は明記がなく未確定。折返し名称・部署の行は除外。');
    rows.push(p);
  }
  return rows;
}
