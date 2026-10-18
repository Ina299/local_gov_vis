import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
// Named lower-level businesses only. The source's 32 policy sections are not records.
const spans: [string,string,string][] = [["朝倉ゆめまるランチ事業", "朝倉ゆめまるランチ事業については、", "「和食給食」"], ["家庭教育事業", "「家庭教育事業」は、", "親学講座開催事業は、"], ["親学講座開催事業", "親学講座開催事業は、", "\n28\n"], ["窓ガラス飛散防止対策事業", "窓ガラス飛散防止対策事業については、", "\n成 果 ・ 課 題"], ["学校体育館大規模改修事業", "学校体育館大規模改修事業は、", "\nプールの改築"], ["学校体育館バリアフリー化事業", "学校体育館バリアフリー化事業においては、", "\n33\n"], ["「はつらつ伝承塾」促進事業", "「はつらつ伝承塾」促進事業では、", "\n高齢者人材活用派遣事業については、"], ["高齢者人材活用派遣事業", "高齢者人材活用派遣事業については、", "\n今後も、伝統文化継承"], ["青年交流事業", "青年交流事業については、", "\n39\n"], ["市立図書館リニューアル事業", "市立図書館リニューアル事業では、", "\nさらに、車椅子"]];
export function extractFukuiSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='18201'||input.sourceId!=='22c4a80f54e271119a010fa7'||input.format!=='pdf')return [];
 const out:ProjectEvaluation[]=[];
 for(const [name,begin,end] of spans){
  const start=input.text.indexOf(begin);if(start<0)continue;
  const finish=input.text.indexOf(end,start);if(finish<0)continue;
  const raw=input.text.slice(start,finish);const p=project(input,name,name,2018,raw,start);
  p.evaluatedFiscalYear=2017;p.outcomes=raw;
  const year=input.text.match(/^平成２９年度[\s\S]*?平成３０年１１月/m);
  if(year)p.evidence.push(evidence(input,year[0],year.index));
  p.warnings.push('教育施策32節の下位に名称と実施結果が明示された事業の成果段落のみを部分構造化。施策自体・施策全体の指標・外部意見は転用していません。部署・費用・目標実績の数値分離は未確定。成果欄内の折返しラベルも原文のまま保持。');out.push(p);
 }
 return out;
}
