import type {ProjectEvaluation} from '../../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from '../shared';

// 東大和市 リアルタイム事務事業評価調書①（会議資料）・②（実績報告・取組予定）（_page_/001/012/262/*.pdf、1PDF1事業）。batch7 取得分のみ。
// 行政評価の案内HTML（6f18bdc56a296d6ac5fb22b9）は事業一覧のみで評価内容がないため対象外。
const ids=new Set('009001e114b4e971a3c8a944 07c7f1a20cdcdb6b22588cbb 21a34aec5f67064b12cbf510 37236d680ba1d8d9948bf997 47d2b23555974622c5c32c31 77cc2703a3967f6fb10ad434 9107fdf275e3808e00515b9e 9a85daad4b2cb5eaec317549 aa4212d954ec20c03faddb40 d9a2b02c17ded1dac7ca59e4 ec448243d935995b5e0a306c f41cf9260b12a0ac6ede4300 f522032eafb5234af1315fa7'.split(' '));
const SHEET='リアルタイム事務事業評価調書①【会議資料】';
const TITLE7='令和7年度リアルタイム評価調書①';
const FY7='B）R７年度の実績（事業の実績を示す数値又は事業の目標としたものの結果）';
const COST='Bｰ２）事業コスト（単位：千円）\n\n事業にかかった総経費\n\n令和４年度決算額\n\n令和５年度決算額\n\n令和６年度決算額\n\n令和７年度予算額\n\n';
const OLD_INDS=['単位 令和4実績 令和5実績 令和6実績\n\n','単位\n\n令和4実績 令和5実績 令和6実績\n\n'];
const NEW_IND='単位\n\n令和5\n\n令和6\n\n令和7\n\n';
const NUM='\\d{1,3}(?:,\\d{3})*|\\d+';
const VAL=`(?:${NUM}|[―ー-])`;
const n=(s:string)=>Number(s.replaceAll(',',''));
const isNum=(s:string)=>new RegExp(`^(?:${NUM})$`).test(s);

function names(t:string){
 const found:{name:string;raw:string;start:number;dept:string|null}[]=[];
 // 調書②の見出し: 作成日の後の最後の段落が事業名、続いて担当部署（部・課）。
 const r2=/調書②【実績報告・取組予定】\n事業名\n\n令和\n\n\d+\n\n年\n\n\d+\n\n月\n\n\d+\n\n日 作成\n([\s\S]{0,300}?)\n担当部署\n\n部\n\n([^\n]+部)\n\n課\n\n([^\n]+課)\n\n係\n\n/.exec(t);
 if(r2){const name=r2[1].split('\n\n').pop()!.trim();if(name)found.push({name,raw:r2[0],start:r2.index,dept:r2[2]+r2[3]});}
 // 調書①（令和7年度様式）: 事業名の直後に担当部署。
 const r1=/\n事業名\n\n([^\n]+)\n\n担当部署\n\n部\n\n/.exec(t.slice(0,t.indexOf('リアルタイム事務事業評価調書①ー')>0?t.indexOf('リアルタイム事務事業評価調書①ー'):3000));
 if(r1)found.push({name:r1[1],raw:r1[0].slice(1),start:r1.index+1,dept:null});
 // 調書①（旧様式）: 「C）当該事業をどうしたいか」の直後に事業名、続いて「部」。
 const r0=/C）当該事業をどうしたいか（主管課の案・望む意向や方向性など）\n\n([^\n]+(?:\n[^\n]+)?)\n部\n\n([^\n]+部)\n\n/.exec(t);
 if(r0&&r0.index<3000)found.push({name:r0[1].trim(),raw:r0[0],start:r0.index,dept:null});
 return found;
}

function extract(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='13220'||!ids.has(input.sourceId))return [];
 const t=input.text;if(!t.includes(SHEET))return [];
 const found=names(t);
 if(!found.length||found.some(f=>f.name!==found[0].name))return [];
 const name=found[0].name;
 const title=t.startsWith(TITLE7);
 const p=project(input,name,name,title?2025:null,found[0].raw,found[0].start);
 for(const f of found.slice(1))p.evidence.push(evidence(input,f.raw,f.start));
 // 調書①で複数課（「／」区切り）の共管とされている場合は、調書②の単一課を採らない。
 p.department=/\n課\n\n[^\n]*／/.test(t)?null:found.find(f=>f.dept)?.dept??null;
 if(title)p.evidence.push(evidence(input,TITLE7,0));
 if(t.includes(FY7)){p.evaluatedFiscalYear=2025;p.evidence.push(evidence(input,FY7));}
 p.warnings.push('リアルタイム事務事業評価調書（年度途中の事業検証・評価の会議資料と実績報告）。評価年度は表題「令和7年度リアルタイム評価調書①」がある資料のみ2025、評価対象年度は調書②の「R７年度の実績」欄がある資料のみ2025。主管課案の方向性（拡大・変更・見直し・廃止）は選択肢が全て印字され選択が判別できないため未収録。調書②の予算額比較（円）・R7実績表は段組み崩れのため未収録。');
 // 事業コスト（旧様式のみ）: 見出しの直後に4値（R4〜R6決算額、R7予算額）が並ぶときだけ。
 const ci=t.indexOf(COST);
 if(ci>=0){
  const m=new RegExp(`(${VAL})\\n\\n(${VAL})\\n\\n(${VAL})\\n\\n(${VAL})\\n`,'y');m.lastIndex=ci+COST.length;const r=m.exec(t);
  if(r){
   const raw=COST+r[0].replace(/\n$/,'');
   r.slice(1).forEach((x,i)=>{
    if(!isNum(x)||n(x)===0)return;
    p.amounts.push({kind:i<3?'actual':'budget',fiscalYear:2022+i,amountYen:n(x)*1000,rawValue:x,rawUnit:'千円',evidence:evidence(input,raw,ci)});
   });
   if(p.amounts.length)p.warnings.push('事業コストは「事業にかかった総経費」（R4〜R6決算額、R7予算額。千円）。職員人件費を含むかは様式上不明。値0・「―」は入れていません。');
  }
 }
 // 実績指標: 見出し直後の区間で「番号 指標名／単位／3値」が連続するものだけ。
 const ind=(head:string,end:RegExp,years:number[],useCols:number)=>{
  const hi=t.indexOf(head);if(hi<0)return;
  const from=hi+head.length,stop=t.slice(from).search(end),seg=t.slice(from,stop<0?undefined:from+stop);
  for(const m of seg.matchAll(new RegExp(`(?:^|\\n\\n)([①-⑥] ([^\\n]+))\\n\\n([^\\n\\d０-９]{1,3})\\n\\n(${VAL})\\n\\n(${VAL})\\n\\n([^\\n]+)(?=\\n|$)`,'g'))){
   const lead=m[0].startsWith('\n\n')?2:0,start=from+m.index!+lead,raw=m[0].slice(lead);
   const vals=[m[4],m[5],m[6]].slice(0,useCols);
   if(!vals.some(isNum))continue;
   if(useCols===3&&!new RegExp(`^${VAL}$`).test(m[6]))continue;
   vals.forEach((v,i)=>{if(isNum(v))p.indicators.push({name:m[2],fiscalYear:years[i],target:null,actual:v,unit:m[3],evidence:evidence(input,raw,start)});});
  }
 };
 for(const h of OLD_INDS)ind(h,/Bｰ２）/,[2022,2023,2024],3);
 ind(NEW_IND,/※|[A-HＡ-Ｈ]）/,[2023,2024,2025],2);
 if(p.indicators.length)p.warnings.push('実績指標は過去の実績欄から番号・指標名・単位・各年度値が連続して読めた行だけ。令和7年度様式の令和7列は年度途中の値のため未収録。');
 return [p];
}

export const entries:Record<string,{extract:(input:CachedInput,inputs:CachedInput[])=>ProjectEvaluation[];scope:string}>={
 '13220':{extract,scope:'東大和市リアルタイム事務事業評価調書（令和7年度実施、公表12事業）の事業名・担当部課、旧様式の事業コスト（R4〜R6決算・R7予算）、過去の実績指標を構造化。主管課案の方向性選択、調書②の予算額比較・R7実績、会議意見の文章は構造化しない。施策評価資料・案内ページは対象外。'},
};
