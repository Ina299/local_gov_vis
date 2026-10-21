import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
export function extractMiyazakiSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='45201'||input.sourceId!=='91ab0e9a58445dbff019516c'||input.format!=='pdf')return [];
 const out:ProjectEvaluation[]=[];
 for(const m of input.text.matchAll(/^(\d+) (\S+) (\S+) (.+?) (一般|特別|住宅) (採択|不採択) (\d+)$/gm)){
  if(+m[1]<93||m[1]!==m[7])continue;
  const p=project(input,'summary-'+m[1],m[4],2025,m[0],m.index);p.department=m[2]+' '+m[3];
  p.ratings.push({kind:'self',label:'新規事業評価の採否',value:m[6],scale:null,evidence:evidence(input,m[0],m.index)});
  p.warnings.push('新規事業評価一覧の採否を部分抽出。将来の令和8年度事業に対する事前評価であり、実績評価ではありません。既存詳細票No.1〜92は重複抽出せず、保存本文が途切れたNo.93以降の確定単行のみ収録。費用・成果実績は未抽出。');out.push(p);
 }
 return out;
}
