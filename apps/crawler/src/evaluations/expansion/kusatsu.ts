import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
function one(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='25206'||input.format!=='pdf'||!input.text.includes('令和7年度')||!input.text.includes('■施策に含まれる主要事業一覧'))return [];
 const rows:ProjectEvaluation[]=[];
 for(const b of input.text.matchAll(/■施策に含まれる主要事業一覧\n([\s\S]*?)(?=■施策に含まれるその他の事業一覧)/g)){
  for(const m of b[1].matchAll(/^([^\s]+(?:事業|事務|費|補助|推進|管理|整備)(?:[（(][^\s]+[）)])?) (?:(\S+(?:課|所|館|場|センター|室|事務局)) )?([◎○△])(?= |$)[^\n]*/gm)){
   const start=b.index!+b[0].indexOf(b[1])+m.index!,raw=m[0];
   const r=project(input,`${m[1]}:${m[2]??''}`,m[1],2026,raw,start);r.projectCode=null;r.department=m[2]??null;r.evaluatedFiscalYear=2025;
   r.ratings.push({kind:'self',label:'主要事業の成果達成度',value:m[3],scale:'◎期待を超える成果／○期待どおりの成果／△期待未満の成果',evidence:evidence(input,raw,start)});
   r.warnings.push('令和7年度実績の施策評価内「主要事業一覧」から名称・成果達成度の確定行を部分構造化。施策全体の指標・評価を事業に転用しない。その他事業一覧は評点がないため未収録。折返し部署は不明、達成度理由の複数列本文と費用は未抽出。');rows.push(r);
  }
  const wrapped=b[1].match(/弾正公園運営事業 スポーツ推進課\n適正な日常の維持管理・運営を行うことで安全に運\n○[^\n]*/);
  if(wrapped){const start=b.index!+b[0].indexOf(b[1])+wrapped.index!,r=project(input,'弾正公園運営事業:スポーツ推進課','弾正公園運営事業',2026,wrapped[0],start);r.projectCode=null;r.department='スポーツ推進課';r.evaluatedFiscalYear=2025;r.ratings.push({kind:'self',label:'主要事業の成果達成度',value:'○',scale:'期待どおりの成果',evidence:evidence(input,wrapped[0],start)});r.warnings.push('主要事業一覧の名称と評点の間に同一行の評価理由折返しが入る3行を確認し部分抽出。費用と政策全体指標は未抽出。');rows.push(r);}
 }
 return rows;
}
export function extractKusatsu(input:CachedInput,inputs?:CachedInput[]):ProjectEvaluation[]{
 if(input.municipalityCode!=='25206')return [];
 const sourceRows=(inputs??[input]).filter(s=>s.municipalityCode==='25206').sort((a,b)=>Number(a.truncated)-Number(b.truncated)||a.sourceId.localeCompare(b.sourceId)).flatMap(s=>one(s).map(r=>({source:s.sourceId,r})));
 const depts=new Map<string,Set<string>>();for(const {r}of sourceRows){if(!depts.has(r.projectName))depts.set(r.projectName,new Set());if(r.department)depts.get(r.projectName)!.add(r.department);}
 const groups=new Map<string,{source:string,r:ProjectEvaluation}>();
 for(const item of sourceRows){const {r}=item;const known=depts.get(r.projectName)!;const dept=r.department??(known.size===1?[...known][0]:null),key=`${r.projectName}:${dept??''}`;
  const prior=groups.get(key);if(!prior){groups.set(key,item);continue;}
  prior.r.evidence.push(...r.evidence);if(!prior.r.department&&r.department)prior.r.department=r.department;
  if(!prior.r.ratings.some(x=>x.value===r.ratings[0].value)){prior.r.ratings.push(...r.ratings);prior.r.warnings.push('同名・同部署の主要事業が複数施策に再掲され評点が異なる。評点を一つに統合せず両方保持。');}
 }
 const result=[...groups.values()].filter(x=>x.source===input.sourceId).map(x=>x.r);
 const cover=(inputs??[input]).find(s=>s.municipalityCode==='25206'&&s.text.includes('【令和７年度実績】')&&s.text.includes('令和８年８月'));
 if(cover){const quote=cover.text.slice(0,cover.text.indexOf('令和８年８月')+'令和８年８月'.length);for(const r of result)r.evidence.push(evidence(cover,quote,0));}
 return result;
}
