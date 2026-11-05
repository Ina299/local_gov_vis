import {olderEducationRows} from './descending-minamikyushu-map';
import type {LayoutReview} from './descending-layouts-r2';
import {type CachedInput,evidence,project} from './shared';
const ids=['a20bc801199872cc2b18a907','05a5a4230cf677190712d5cd','ac80ee2e6661b0deb0ea74b9','f959db091a449099741458b3','a90655a22e8e672d4eb3dd53','e65d142aebd081bcac1a4063','94795a178dc3602a49f820d7','2c54ffbbd7afd779b7015a0c','a2c48d2137a52061e477ee60'];
export function reviewMinamikyushu(i:CachedInput):LayoutReview|null{
 if(i.municipalityCode!=='46223'||!ids.includes(i.sourceId)&&!olderEducationRows.some(r=>r.sourceId===i.sourceId)||i.format!=='pdf')return null;
 const r:LayoutReview={projects:[],units:[],status:'reviewed_education_business_table',reason:'Explicit business-name column in annual evaluation table; policy headings excluded; no score/amount alignment inferred',proofs:[]};
 const cover=i.text.slice(0,110),fy=/（(令和|平成)\s*([元０-９0-9]+)\s*年度事務事業対象）/.exec(cover),ey=/^(令和|平成)\s*([元０-９0-9]+)\s*年度/.exec(cover),start=i.text.lastIndexOf('２ 観点別評価（上段：一次評価，下段：二次評価）');
 const end=/３\s*評価の結果/.exec(i.text.slice(start)),stop=end?start+end.index:-1;
 if(i.truncated||!fy||!ey||start<0||stop<=start||!i.text.includes('南九州市教育委員会')){r.status='identity_hold';r.reason='Complete cover, explicit fiscal target, municipal identity or evaluation-table boundaries absent';return r;}
 const year=(m:RegExpExecArray)=>(m[1]==='令和'?2018:1988)+(m[2]==='元'?1:Number(m[2].normalize('NFKC')));
 if(olderEducationRows.some(q=>q.sourceId===i.sourceId)){
  for(const row of olderEducationRows.filter(q=>q.sourceId===i.sourceId)){
   const u={start:row.start,name:row.name,status:'held',reason:'Exact principal-project cell differs'};r.units.push(u);
   if(i.text.slice(row.start,row.start+row.raw.length)!==row.raw||year(fy)!==row.year)continue;
   const p=project(i,'principal-'+row.start,row.name,year(ey),row.raw,row.start);p.projectCode=null;p.evaluatedFiscalYear=row.year;p.evidence.push(evidence(i,fy[0],fy.index),evidence(i,ey[0],ey.index));p.warnings.push('「主要事業」欄の名称を個別照合。施策別の集計見出しは事業名にせず、列の乱れた金額や評価点は未採用。');r.projects.push(p);u.status='supported';u.reason='Reviewed principal-project literal and explicit target fiscal year';
  }r.proofs=[fy[0],ey[0]];return r;
 }
 const t=i.text.slice(start,stop),heads=[...t.matchAll(/【([^】\n]+)】|^(教育総務課|学校教育課|社会教育課|図書館|中央公民館|保健体育課|学校給食センター|文化財課)[①-⑧]/gm)];
 for(let n=0;n<heads.length;n++){
  const h=heads[n],off=start+h.index!,body=t.slice(h.index!+h[0].length,heads[n+1]?.index??t.length),u={start:off,name:undefined as string|undefined,status:'held',reason:''};r.units.push(u);
  const plain=i.sourceId==='a2c48d2137a52061e477ee60'?plain2015[n]:undefined;const m=plain?new RegExp(plain).exec(body):(h[2]?/（/:/\n（/).exec(body);if(!m){u.reason='Business-name parenthesis not present after department/policy heading';continue;}
  const a=m.index+(plain||h[2]?0:1);let depth=0,b=plain?a+plain.length:-1;
  for(let j=a;!plain&&j<body.length;j++){if(body[j]==='（')depth++;if(body[j]==='）'&&--depth===0){b=j+1;break;}}
  if(b<0){u.reason='Business-name parentheses incomplete';continue;}
  const raw=body.slice(a,b),name=(plain?raw:raw.slice(1,-1)).replace(/\s+/g,'');u.name=name;
  if(!name||name.length>180){u.reason='Business-title length/boundary uncertain';continue;}
  const rawStart=off+h[0].length+a,p=project(i,'education-'+rawStart,name,year(ey),raw,rawStart);p.projectCode=null;p.department=h[1]??h[2];p.evaluatedFiscalYear=year(fy);p.evidence.push(evidence(i,fy[0],fy.index),evidence(i,ey[0],ey.index),evidence(i,h[0],off));p.warnings.push('教育点検評価表の「事務事業名」欄から抽出。上位施策名は除外。複数事業を併記した同一評価単位は原表どおり一項目として保持し、評価点・費用・実績数値は対応を推測しない。');r.projects.push(p);u.status='supported';u.reason='Bounded business-name column and explicit cover years';
 }
 r.proofs=[fy[0],ey[0]];return r;
}

const plain2015=['学校主事研修の実施','学習指導の充実','自主文化事業の充実','校区・地区公民館長会，書記研修会の充実','南九州市読書活動推進会議の充実','えい新茶・大野岳マラソン大会の円滑な運営','安心・安全な給食の提供','文化財指定に向けての調査'];
