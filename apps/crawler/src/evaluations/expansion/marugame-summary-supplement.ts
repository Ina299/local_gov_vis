import type{ProjectEvaluation}from'../../../../web/src/types/evaluation';import{type CachedInput,evidence,project}from'./shared';
/** H22 overview has thirty internal rows, ten separately structured external rows. */
export function extractMarugameSummary2010(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='37202'||input.sourceId!=='0f0f4436ce74f9992e97a6eb'||input.truncated)return[];
 const begin=input.text.indexOf('№ 事務事業名');const end=input.text.indexOf('総 括',begin);if(begin<0||end<0)return[];const body=input.text.slice(begin,end);const out:ProjectEvaluation[]=[];
 for(const m of body.matchAll(/^([0-9０-９]+) (\S+) (現状継続|改善|統合|廃止) (現状継続|改善|統合|廃止)(?: －)?$/gm)){
  const p=project(input,'internal2010-'+m[1].normalize('NFKC'),m[2],2010,m[0],begin+m.index!);
  for(const[i,value]of[m[3],m[4]].entries())p.ratings.push({kind:'self',label:`${i+1}次評価・事業の方向性`,value,scale:null,evidence:evidence(input,m[0],begin+m.index!)});
  p.warnings.push('平成22年度概要の事務事業別内部評価行。別の詳細一覧に同じ番号の記録がある場合は証拠統合し、外部評価対象10事業は既存レコードを再登録しない。費用・所管課・対象実績年度はこの行では未確定。');out.push(p);
 }
 return out;
}
/** Explicit five changed secondary decisions in H21 overview; no policy scores transferred. */
export function extractMarugameSummary2009(input:CachedInput):ProjectEvaluation[]{
 if(input.sourceId!=='7f153d7a3f82457c40a39f10'||input.municipalityCode!=='37202'||input.truncated)return[];
 const start=input.text.indexOf('特に、「住宅太陽光発電システム導入促進事業」');const end=input.text.indexOf('一方、外部評価において',start);if(start<0||end<0)return[];
 const raw=input.text.slice(start,end);const names=['住宅太陽光発電システム導入促進事業','中心市街地活性化事業','少年育成センター活動事業','美術館管理運営事業','救援物資備蓄推進事業'];
 return names.filter(n=>raw.replaceAll(/\s/g,'').includes(n)).map((name,i)=>{const p=project(input,'overview2009-'+name,name,2009,raw,start);p.ratings=[{kind:'self',label:'1次評価・事業の方向性',value:i===4?'拡大':'現状のまま継続',scale:null,evidence:evidence(input,raw,start)},{kind:'self',label:'2次評価・事業の方向性',value:'改善',scale:null,evidence:evidence(input,raw,start)}];p.warnings.push('概要本文に明示された5事業の一次から二次への判断変更。施策評点は転用せず、同年同名の一覧・外部意見レコードがある場合は統合。事後と事中が混在するため評価対象年度を推定しない。');return p;});
}
