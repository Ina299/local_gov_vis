import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractAtsugi(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='14212'||input.sourceId!=='071959416cdc00bc79bae728')return [];
 const out:ProjectEvaluation[]=[];
 // The full results appendix is separate from the narrative summary, which repeats selected rows.
 for(const m of input.text.matchAll(/^(\d+) ([^\s]+部|教育委員会|消防本部|市長室|議会事務局|農業委員会事務局) ([^\s]+) ([^\s]+) (\d+) (拡大|継続|縮小|廃止) (\d+) (現行どおり|要改善)(?: ([^\n]+?))? (拡大|継続|縮小|廃止)$/gm)){
  if(!/(課|室|所|局|館|センター)$/.test(m[3]))continue;
  const p=project(input,`${m[1]}:${m[3]}`,m[4],2023,m[0],m.index);p.department=`${m[2]} ${m[3]}`;p.evidence.push(evidence(input,input.text.slice(0,300),0));
  for(const [label,value] of [['一次評価・事業方向性',m[6]],['一次評価・手法',m[8]],['二次評価・事業方向性',m[10]]] as const)p.ratings.push({kind:'self',label,value,scale:null,evidence:evidence(input,m[0],m.index)});
  p.warnings.push('結果一覧で番号・担当課・事業名・評価が同一行のもののみ。折返し名称は未補完。概要表の同じ事業は重複登録せず、当初予算額を決算として転記しません。評価対象年度は本文中で単年度確定せず未設定。');out.push(p);
 }return out;
}
