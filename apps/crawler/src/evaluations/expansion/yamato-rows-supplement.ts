import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
/** 185 detailed-rating rows plus 616 ordinary direction-only rows; not full sheets. */
export function extractYamatoRowsSupplement(input:CachedInput,inputs:CachedInput[]=[]):ProjectEvaluation[]{
 if(input.municipalityCode!=='14213'||input.sourceId!=='92446c342a781e5ded7aa27f'||input.truncated)return[];
 const cover=inputs.find(x=>x.sourceId==='dd659eb960960f374c12caa1'&&x.text.startsWith('令和８年度\n大和市事務事業評価\n（令和７年度分）'));
 const result:ProjectEvaluation[]=[];
 function add(dept:string,name:string,raw:string,start:number,grades:string|undefined,direction:string){
  const p=project(input,`${dept}/${name}`,name,cover?2026:null,raw,start);p.department=dept;p.evaluatedFiscalYear=2025;
  if(cover)p.evidence.push(evidence(cover,'令和８年度\n大和市事務事業評価\n（令和７年度分）'));
  if(grades)for(const[i,label]of['市の関与の妥当性','事務事業の成果','事業費・人件費','受益・負担の公平性','社会的配慮'].entries())p.ratings.push({kind:'self',label,value:grades.trim().split(' ')[i],scale:null,evidence:evidence(input,raw,start)});
  p.ratings.push({kind:'self',label:'今後の方針等',value:direction,scale:cover?'Ⅰ 現状のまま継続／Ⅱ 見直しのうえで継続／Ⅲ 廃止または終了':null,evidence:evidence(input,raw,start)});
  p.warnings.push('評価結果一覧の事業別行のみを部分構造化。重点評価事業は5項目評価、通常評価事業は方向性のみ。将来都市像は上位目標のため事業の達成済み成果へ転用しない。費用・指標の数値は本一覧に未掲載。');result.push(p);
 }
 for(const m of input.text.matchAll(/^(\S+) (\S+) (.+?) ((?:[ＡＢＣＤＺ] ){5})?([ⅠⅡⅢ]+)$/gm))add(m[1],m[2],m[0],m.index!,m[4],m[5]);
 // Eleven long project names are split above/below an otherwise complete department/goal/direction row.
 const goals=[...new Set([...input.text.matchAll(/^(\S+) (\S+) (.+?) ((?:[ＡＢＣＤＺ] ){5})?([ⅠⅡⅢ]+)$/gm)].map(m=>m[3]))];
 for(const m of input.text.matchAll(/^([^\n ]+)\n(\S+) ([^\n]+) ([ⅠⅡⅢ]+)\n([^\n ]+)$/gm)){
  if(!goals.includes(m[3])||!/(?:課|室|所)$/.test(m[2])||!/(?:業|務|事業|事務|収金管理事業|場施設管理運営事業|（令和6～7年度継続費）)$/.test(m[5]))continue;
  add(m[2],m[1]+m[5],m[0],m.index!,undefined,m[4]);
 }
 return result;
}
