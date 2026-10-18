import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput, evidence, project} from './shared';
export function extractKagoshimaSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='46201'||input.sourceId!=='433454cefae4630ce2be53d4'||input.format!=='pdf')return [];
 const heading='Ｎ０． 事業名 事業担当局 事業担当課 評価結果 廃止・終了の理由';
 if(!input.text.includes('（４）事務事業評価結果一覧表')||!input.text.includes(heading))return [];
 const labels:Record<string,string>={Ａ:'継続',Ｂ:'見直し',Ｃ:'統合',Ｄ:'縮小',Ｅ:'休止',Ｆ:'廃止',Ｇ:'終了'};
 const rows:ProjectEvaluation[]=[];const seen=new Set<string>();
 for(const m of input.text.matchAll(/^(\d+) (\S+) (\S+) (\S+) ([Ａ-Ｇ]) (継続|見直し|統合|縮小|休止|廃止|終了)(?= |$)[^\n]*/gm)){
  // #145 has a department continuation on the preceding line, despite matching
  // the otherwise complete left-hand row. All ten other wraps fail this pattern.
  if(m[1]==='145'||labels[m[5]]!==m[6]||seen.has(m[1]))continue;
  if(input.truncated&&m.index+m[0].length===input.text.length)continue;
  seen.add(m[1]);const p=project(input,m[1],m[2],null,m[0],m.index);
  p.department=`${m[3]} ${m[4]}`;
  p.evidence.push(evidence(input,heading));
  p.ratings.push({kind:'self',label:'事務事業評価結果（事業の方向性）',value:`${m[5]} ${m[6]}`,scale:null,evidence:evidence(input,m[0],m.index)});
  p.warnings.push('評価結果一覧の確定単行を部分構造化。独立した詳細個票ではありません。担当局・課、事業の方向性のみ抽出。本文の実施計画期間から評価年度・対象年度を推測せず未確定としています。折返し名称・部署の11事業は未抽出。');rows.push(p);
 }
 return rows;
}
