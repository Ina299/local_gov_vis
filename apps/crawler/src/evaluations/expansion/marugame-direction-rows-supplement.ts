import type{ProjectEvaluation}from'../../../../web/src/types/evaluation';import{type CachedInput,evidence,project}from'./shared';
export function extractMarugameDirectionRowsSupplement(input:CachedInput):ProjectEvaluation[]{
 const year:Record<string,number>={'3a0dc54966d14c1bd0d7965e':2007,'431f50ce232c359b29cdf28d':2008,'ff7856313476d2f597e212c4':2009};const y=year[input.sourceId];if(!y||input.municipalityCode!=='37202'||input.format!=='pdf')return[];
 const pattern=y===2007?/(?:^| )([0-9]+) (\S+) (継続|拡大|縮小|改善|変更|廃止|完了|コスト削減)$/gm:/(?<![0-9.])([0-9]+)\.(\S+?)（(継続|拡大|縮小|改善|変更|廃止|完了|コスト削減)）/g;
 const out:ProjectEvaluation[]=[];for(const m of input.text.matchAll(pattern)){
  if(input.truncated&&m.index!+m[0].length>=input.text.trimEnd().length)continue;
  const p=project(input,'direction-'+m[1],m[2],y,m[0],m.index);p.ratings.push({kind:'self',label:'事業の方向性（一覧）',value:m[3],scale:null,evidence:evidence(input,m[0],m.index)});p.evidence.push(evidence(input,input.text.slice(0,y===2007?350:85),0));
  p.warnings.push('施策評価資料内の明示「事務事業（方向性）」欄の完全な事業名と方向性の対のみ部分収録。周囲の施策評価・成果指標・担当部を個別事業に転用しない。原文の事業番号と名称は保持。行またぎ名称は推測して結合しない。');out.push(p);
 }
 return out;
}
