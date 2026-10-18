import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
const YEARS:Record<string,number>={'25a96377ee851debf1af6fa7':2018,'2cb0bca7bc4c3a73e4c296b2':2013,'c5afc0ddbac4657b8eacc8bc':2015};
export function extractFujikawa(input:CachedInput):ProjectEvaluation[]{
 const year=YEARS[input.sourceId];if(input.municipalityCode!=='19368'||!year)return [];
 const heads=[...input.text.matchAll(/^([０-９\d]+)[．.]\s*(.+?) 評価：\s*([A-DＡ-Ｄ] [^\n]+)$/gm)];
 return heads.map((h,i)=>{
  let raw=input.text.slice(h.index!,heads[i+1]?.index??input.text.length);const legend=raw.indexOf('※A：');if(legend>=0)raw=raw.slice(0,legend);raw=raw.trimEnd();
  const r=project(input,h[1].normalize('NFKC'),h[2],year,raw,h.index!);r.projectCode=null;
  r.ratings.push({kind:'external',label:'住民評価委員会評価',value:h[3],scale:null,evidence:evidence(input,h[0],h.index!)});
  r.outcomes=raw.slice(h[0].length).replace(/\n?\d+$/,'').trim()||null;
  r.warnings.push('事業ごとの評価内容欄を収録。評価会開催年を評価年度とし、対象実施年度は明記がないため未設定。第一次総合計画の終了年度を個別事業の対象年度には流用しない。');return r;
 });
}
/** Manual column reconstruction limited to the ten numbered subsidy units. */
export function extractFujikawa2019(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='19368'||input.sourceId!=='e61fc9452debe305b0c0669a')return [];
 const rows:[string,string,string,string][]=[
 ['1','富士川町ふれあい学習事業','継続','富士川町ふれあ\n1 社会教育担当 継続 改善 継続\nい学習事業'],
 ['2','青少年育成富士川町民会議','継続','青少年育成富士\n2 社会教育担当 継続 改善 継続\n川町民会議'],
 ['3','特色ある学校教育推進費補助','継続（一部改善）','特色ある学校教\n増穂小\n育推進費補助\n特色ある学校教\n増穂南小\n育推進費補助\n継続\n3 教育総務課 縮小 縮小\n(一部改善）'],
 ['4','給食検食代補助','縮小','給食検食代補助 増穂小\n給食検食代補助 増穂南小\n4 教育総務課 継続 縮小 縮小'],
 ['5','排水設備工事資金融資あっせん','継続','排水設備工事資\n5 上下水道課 下水道担当 継続 改善 継続\n金融資あっせん'],
 ['6','遊休農地有効活用事業','継続','遊休農地有効活\n6 産業振興課 農林振興担当 継続 改善 継続\n用事業'],
 ['7','ひとり親家庭高等学校入進学祝い金','改善','ひとり親家庭高\n子育て支援\n7 等学校入進学祝 児童支援担当 継続 改善 改善\n課\nい金'],
 ['8','リユース食器導入促進事業補助金','継続','リユース食器導\n8 入促進事業補助 町民生活課 生活環境担当 継続 継続 継続\n金'],
 ['9','チャイルドシート購入補助金','継続','チャイルドシー\n9 防災交通課 交通担当 継続 継続 継続\nト購入補助金'],
 ['10','空き家改修費補助金','継続（一部改善）','空き家改修費補 継続 継続\n10 政策秘書課 企画推進担当 継続\n助金 (一部改善） (一部改善）'],
 ];
 return rows.flatMap(([code,name,value,raw])=>{const start=input.text.indexOf(raw);if(start<0)return [];const r=project(input,code,name,2019,raw,start);r.projectCode=null;r.ratings.push({kind:'external',label:'住民評価委員会（3次評価）',value,scale:null,evidence:evidence(input,raw,start)});r.warnings.push('補助金見直し結果一覧の番号単位。複数学校の同一補助は一つの評価単位として収録。対象実施年度・費用は未確定。名称は列内の改行を接続。');return [r];});
}
export function extractFujikawa2013Subsidies(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='19368'||input.sourceId!=='c2999fc7e5eae048bc311cce')return [];
 const split=input.text.indexOf('事務事業評価 補助金の見直し 評価結果一覧表');if(split<0)return [];
 const groups=[input.text.slice(0,split),input.text.slice(split)];
 const names=[['峡南保健所管内精神障害者家族会助成金（再度）','親子のびのび教室','社会福祉協議会運営事業補助金','福祉活動事業補助金','福祉活動専門員設置補助金','ボランティア推進事業費補助金','地域福祉活動補助金（福祉大会）','ボランティア普及協力校補助金','心配ごと相談事業補助金',null,null,'幼児観劇教室','峡南幼稚園舞台鑑賞補助','各小・中学校演劇鑑賞補助','幼稚園運営費補助','各小・中学校修学旅行引率下見補助','校外活動引率補助','町PTA連合会','PTA各校活動費（ふれあい学習事業）','ｽﾎﾟｰﾂ推進委員研修会（体育指導員）'],['魅力と活力ある商店街創出支援事業補助','かじかの湯管理運営補助金','消火栓設置補助','全国規模学力検査（小学校）補助','不妊治療費支援事業補助金']];
 return groups.flatMap((section,g)=>names[g].flatMap((name,index)=>{
  if(!name)return [];
  const m=section.match(new RegExp(`^${index+1} .+? (継続|縮小|廃止) (継続|縮小|廃止) (継続|縮小|廃止)[^\\n]*$`,'m'));if(!m)return [];
  // Include previous lines where the title is above its numeric row, without assigning those comments as outcomes.
  const lineStart=section.lastIndexOf('\n',Math.max(0,m.index!-2))+1;
  const previousStart=section.lastIndexOf('\n',Math.max(0,lineStart-2))+1;
  const raw=section.slice(previousStart,m.index!+m[0].length);
  const offset=(g===0?0:split)+previousStart;
  const r=project(input,`${g}:${index+1}`,name,2013,raw,offset);r.projectCode=null;
  r.ratings.push({kind:'external',label:'住民評価委員会（外部評価）',value:m[3],scale:null,evidence:evidence(input,m[0],(g===0?0:split)+m.index!)});
  r.warnings.push('7月・10月の補助金評価一覧。事業名の改行を接続し、外部評価列のみ収録。本文位置が交錯する付帯事項は割り当てない。消防分団運営費・ラッパ隊運営費は評価セルの共有境界未確定で除外。');return [r];
 }));
}
