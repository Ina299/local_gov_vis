import{extractMarugameSummary2010,extractMarugameSummary2009}from'./marugame-summary-supplement';
import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import{type CachedInput,evidence,project}from'./shared';
import{extractMarugameSupplement}from'./marugame-supplement';
import{extractMarugameInternalSupplement}from'./marugame-internal-supplement';
import{extractMarugame2011Supplement}from'./marugame-2011-supplement';
import{extractMarugameEarlyExternalSupplement}from'./marugame-early-external-supplement';
import{extractMarugameDirectionRowsSupplement}from'./marugame-direction-rows-supplement';
const years:Record<string,number>={'851768a66c2848e57cfac770':2013,'a26aeb6532acf509aee26595':2014,'c645c2a4fb05106192ec3f99':2015,'3375a144385f7b8ca954601e':2016};
export function extractMarugameLegacySupplement(input:CachedInput):ProjectEvaluation[]{
 const year=years[input.sourceId];if(!year||input.municipalityCode!=='37202'||input.format!=='pdf')return[];
 const text=input.text;let active=false;let labels:string[]=[];let heading='';let start=0;const out=new Map<string,ProjectEvaluation>();
 for(const m of text.matchAll(/^.*$/gm)){
  const line=m[0];if(/^【事務事業評価/.test(line)){active=true;continue;}if(/^政策の柱/.test(line)){active=false;continue;}
  if(!active)continue;
  const h=line.match(/^№ 事業名 (?:担当|所管課) 必要性 効率性 (妥当性|有効性) 事業の方向性$/);
  if(h){labels=['必要性','効率性',h[1],'事業の方向性'];heading=line;start=m.index!;continue;}
  if(labels.length!==4)continue;
  const row=line.match(/^(\d+) (.+?) ([^ ]+(?:課|局|センター|図書館|室)) (妥当|改善) (妥当|改善) (妥当|改善) (維持|拡充|改善|縮小|廃止|完了)$/);
  if(!row||input.truncated&&m.index!+line.length>=text.trimEnd().length)continue;
  const key=row[2]+'\n'+row[3];const e=evidence(input,line,m.index);
  const ratings=labels.map((label,i)=>({kind:'self' as const,label,value:row[i+4],scale:null,evidence:e}));
  const prior=out.get(key);if(prior){prior.evidence.push(e);for(const rating of ratings)if(!prior.ratings.some(r=>r.label===rating.label&&r.value===rating.value))prior.ratings.push(rating);continue;}
  const p=project(input,'legacy-'+key,row[2],year,line,m.index);p.department=row[3];p.ratings=ratings;p.evidence.push(evidence(input,heading,start),evidence(input,text.slice(0,text.indexOf('\n丸亀市')+1),0));
  p.warnings.push('内部評価の事務事業別一覧行を部分収録。費用や個別成果説明を備えた完了個票とは区別。表頭の必要性・効率性・妥当性/有効性・方向性を保持し施策評点は転用しない。同一年度・部署・事業名の再掲は証拠統合。対象実績年度を評価年度から推定しない。');out.set(key,p);
 }
 return [...out.values()];
}
/** Cross-source join is limited to unique same-year exact project/department matches. */
export function extractMarugameCombinedSupplement(input:CachedInput,inputs:CachedInput[]=[]):ProjectEvaluation[]{
 const all=inputs.length?inputs:[input];const legacy=all.flatMap(extractMarugameLegacySupplement);const external=all.flatMap(extractMarugameSupplement);
 const normalize=(s:string)=>s.normalize('NFKC').replaceAll(/\s/g,'');
 const matches=(p:ProjectEvaluation,q:ProjectEvaluation)=>p.evaluationYear===q.evaluationYear&&q.projectName.split('／').some(n=>normalize(n)===normalize(p.projectName))&&normalize(q.department??'').endsWith(normalize(p.department??''));
 const early=all.flatMap(extractMarugameEarlyExternalSupplement);const directionRows=all.flatMap(extractMarugameDirectionRowsSupplement);
 const earlyMatch=(p:ProjectEvaluation,q:ProjectEvaluation)=>p.evaluationYear===q.evaluationYear&&normalize(p.projectName)===normalize(q.projectName);
 const earlyOwner=early.filter(p=>p.evidence[0].sourceUrl===input.sourceUrl);
 for(const ext of earlyOwner)for(const row of directionRows.filter(p=>earlyMatch(p,ext))){if(early.filter(q=>earlyMatch(row,q)).length!==1)continue;ext.evidence.push(...row.evidence);ext.ratings.push(...row.ratings);ext.warnings.push('同年度同名の事務事業方向性一覧行を個別外部意見へ統合し重複計上しない。');}
 const oldRows=all.flatMap(extractMarugame2010Rows);const summaryRows=all.flatMap(extractMarugameSummary2010);
 const oldOwner=oldRows.filter(p=>p.evidence[0].sourceUrl===input.sourceUrl);
 for(const p of oldOwner)for(const q of summaryRows.filter(q=>q.projectCode===p.projectCode)){p.evidence.push(...q.evidence);p.warnings.push('平成22年度概要表の同一事業番号行を証拠統合。番号19は概要表で埋蔵文化財事業、詳細表で埋蔵文化財調査の表記差を保持。');}
 const owner=external.filter(p=>p.evidence[0].sourceUrl===input.sourceUrl);
 for(const ext of owner)for(const row of legacy.filter(p=>matches(p,ext))){if(external.filter(q=>matches(row,q)).length!==1)continue;ext.evidence.push(...row.evidence);ext.ratings.push(...row.ratings);ext.warnings.push('同年度・同名・同主管課の内部評価行を外部評価票へ証拠統合し、独立レコードとして二重計上しない。');}
 const result=[...owner,...earlyOwner,...extractMarugameDirectionRowsSupplement(input).filter(p=>early.filter(q=>earlyMatch(p,q)).length!==1),...extractMarugame2011Supplement(input),...oldOwner,...extractMarugameSummary2010(input).filter(p=>!oldRows.some(q=>q.projectCode===p.projectCode)),...extractMarugameInternalSupplement(input),...extractMarugameLegacySupplement(input).filter(p=>external.filter(q=>matches(p,q)).length!==1)];
 const summary2009=all.flatMap(extractMarugameSummary2009);const existing2009=[...early,...directionRows].filter(p=>p.evaluationYear===2009);
 for(const p of result)for(const q of summary2009.filter(q=>earlyMatch(p,q))){p.evidence.push(...q.evidence);p.ratings.push(...q.ratings);p.warnings.push('平成21年度概要の明示二次評価変更を原文証拠とともに統合。一次一覧の継続と二次の改善を区別する。');}
 return [...result,...extractMarugameSummary2009(input).filter(p=>!existing2009.some(q=>earlyMatch(p,q)))];
}

/** H22 rows with a complete title, both direction cells and department on one line. */
export function extractMarugame2010Rows(input:CachedInput):ProjectEvaluation[]{
 if(input.sourceId!=='cca86e5a021b31a62b2d81d3'||input.municipalityCode!=='37202')return[];
 const text=input.text;const out:ProjectEvaluation[]=[];const header=text.slice(0,text.indexOf('編集、'));
 for(const m of text.matchAll(/^(\d+) (\S+) ([\d,]+) (.+?) ([^\s]+部) ([^\s]+課)$/gm)){
  if(m[4].includes('外部評価対象事業'))continue;
  const values=[...(' '+m[4]+' ').matchAll(/ (現状継続|改善|統合|廃止|協働・民活)(?= )/g)].map(r=>r[1]);if(values.length!==2)continue;
  const p=project(input,'internal2010-'+m[1],m[2],2010,m[0],m.index);p.department=m[5]+' '+m[6];p.evidence.push(evidence(input,header,0));
  p.ratings=values.map((value,i)=>({kind:'self',label:`${i+1}次評価・事業の方向性`,value,scale:null,evidence:evidence(input,m[0],m.index)}));
  p.warnings.push('横長一覧の一行に事業名・1次/2次方向性・部署が揃う行のみ部分抽出。外部評価対象の既存個票は再登録しない。折返し本文は列混線のため概要・所見へ分配しない。予算列は単位見出しが保存本文で確認できず金額化しない。名称又は部署が複数行に分断する行は保留。');out.push(p);
 }
 return out;
}
