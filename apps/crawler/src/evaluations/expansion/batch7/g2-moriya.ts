import type {ProjectEvaluation} from '../../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from '../shared';

// 守谷市 令和6年度 事務事業マネジメントシート（_page_/001/011/333/01v2.pdf〜14.pdf、1PDFに複数事業）。batch7 取得分のみ。
const ids=new Set('0966107ce2a47a335963766a 0c38120e1ecf17ab4d9324a6 17a1a6571e0e57a7e65ddf3f 401ff90b59ef72c1452dc0c0 6a8c6b2b405628e2d9fbd536 758e2d81531063e10e383f63 7ba293d2fe1f86b1019bd6f8 7f927b3be839d5ca50f9df17 8409f67594b6e6fc58032c18 86ce64ae8852a5731fc32543 95b3f1cd0c634029e3bdaf0f bf7470d39d80bfe44ab9f45a cb58d00f8bc61f9dbdc51c3f ec1d21983bbcad85e32e42f6'.split(' '));
const TITLE='\n\n令和 6年度 事務事業マネジメントシート\n事業の基本情報\n事務事業名\n\n';
const NUM=/^-?\d{1,3}(?:,\d{3})*$/,IND=/^\d{1,3}(?:,\d{3})*\.\d{2}$/;
const n=(s:string)=>Number(s.replaceAll(',',''));
const IND_HEADERS=new Set(['指標名','基準値（R02）','R03年度','R04年度','R05年度','R06年度','R07年度','目標値（R08）']);

function lines(text:string,from:number,to:number){
 const out:{s:string;start:number}[]=[];let pos=from;
 for(const s of text.slice(from,to).split('\n')){out.push({s,start:pos});pos+=s.length+1;}
 return out;
}
/** 区間内で ■ が付いた選択肢（候補に限る）。 */
function checked(text:string,from:number,to:number,options:string[]){
 return lines(text,from,to).filter(l=>l.s.startsWith('■')&&options.includes(l.s.slice(1).trim())).map(l=>({value:l.s.slice(1).trim(),raw:l.s,start:l.start}));
}

function sheet(input:CachedInput,start:number,end:number,titleLine:string):ProjectEvaluation|null{
 const t=input.text,afterTitle=start+titleLine.length+TITLE.length;
 let cursor=afterTitle,dept:RegExpMatchArray|null=null;
 const pre=t.slice(cursor).match(/^担当課 (\S+)\n\n/);
 if(pre){dept=pre;cursor+=pre[0].length;}
 const name=t.slice(cursor,t.indexOf('\n',cursor));
 if(!name.startsWith(titleLine))return null;
 const page2=t.indexOf(`${titleLine}\nR05年度の評価を受けて、R06年度の取組等\n`,cursor);
 if(page2<0||page2>end)return null;
 const headRaw=t.slice(start,cursor+name.length);
 const p=project(input,name,name,2024,headRaw,start);p.projectCode=null;
 if(!dept){const m=t.slice(start,page2).match(/\n担当課 (\S+)\n/);if(m){dept=m;p.evidence.push(evidence(input,m[0].trim(),start+m.index!+1));}}
 else p.evidence.push(evidence(input,dept[0].trim(),afterTitle));
 p.department=dept?.[1]??null;
 const warnings=['表題「令和 6年度 事務事業マネジメントシート」を評価年度2024として記録。評価対象年度は本文に明示がないため空（コスト表は R04〜R06年度決算・R07年度予算・R08年度見込）。'];

 // コスト: 事業費計・国県・地方債・その他・一般財源の5行×5列が、各列で「事業費計＝財源合計」となる場合のみ列対応を確定。
 const costAt=t.indexOf('コストの推移\n',page2),persAt0=t.indexOf('\n正職員人工数（時間数）\n',page2);
 const persAt=persAt0>costAt&&persAt0<end?persAt0:-1,costEnd=persAt>0?persAt:end;
 let costed=false;
 if(costAt>0&&costAt<end){
  const toks=lines(t,costAt,costEnd).filter(l=>NUM.test(l.s));
  const v=toks.map(l=>n(l.s));
  if(toks.length===25&&[0,1,2,3,4].every(k=>v[k]===v[5+k]+v[10+k]+v[15+k]+v[20+k])){
   const raw=t.slice(costAt,toks[24].start+toks[24].s.length);
   const pt=persAt>0?t.slice(persAt,end).match(/^\n正職員人工数（時間数）\n\n(?:[\d,]+\.\d{2}\n\n){5}正職員人件費\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n[\d,]+\n\n[\d,]+\n\nトータルコスト\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)(?=\n)/):null;
   const totalOk=!!pt&&[0,1,2].every(k=>v[k]+n(pt[1+k])===n(pt[4+k]));
   // 人件費・トータルコスト行があるシートでは、決算3列の「事業費計＋人件費＝トータルコスト」一致も列順の確認条件にする。
   if(persAt<0||totalOk){
    for(const[k,kind,fiscalYear]of[[0,'actual',2022],[1,'actual',2023],[2,'actual',2024],[3,'budget',2025]]as const)
     p.amounts.push({kind,fiscalYear,amountYen:v[k]*1000,rawValue:toks[k].s,rawUnit:'千円',evidence:evidence(input,raw,costAt)});
    costed=true;
   }
   if(pt&&totalOk){
    const praw=pt[0].slice(1);
    for(const k of[0,1,2]){
     p.amounts.push({kind:'personnel',fiscalYear:2022+k,amountYen:n(pt[1+k])*1000,rawValue:pt[1+k],rawUnit:'千円',evidence:evidence(input,praw,persAt+1)});
     p.amounts.push({kind:'fullCost',fiscalYear:2022+k,amountYen:n(pt[4+k])*1000,rawValue:pt[4+k],rawUnit:'千円',evidence:evidence(input,praw,persAt+1)});
    }
   }
  }
 }
 warnings.push(costed
  ?'金額は千円単位。事業費計の5列が各列で財源4区分の合計と一致した場合のみ R04〜R06年度決算を actual、R07年度予算を budget として登録。R08年度見込は登録しない。正職員人件費・トータルコストは R04〜R06年度決算列で事業費計＋人件費＝トータルコストが一致した場合のみ登録（R07・R08の人件費0は未記入のため除外）。'
  :'コスト表は抽出テキストで列対応を検算できなかったため金額は未登録。');

 // 指標: 値の並び（基準値R02・R03〜R07・目標値R08の7列）が1行分で、指標名が1つだけの場合に限り登録。0.00 は空欄と区別できないため登録しない。
 const indAt=t.indexOf('評価（指標の推移、今後の方向性）\n',page2),trendAt=t.indexOf('指標値の動向（→その理由）',page2);
 if(indAt>0&&trendAt>indAt&&trendAt<end){
  const ls=lines(t,indAt+'評価（指標の推移、今後の方向性）\n'.length,trendAt);
  const vals=ls.filter(l=>IND.test(l.s));
  const groups:string[][]=[];let cur:string[]=[];
  for(const l of ls){const s=l.s.trim();if(!s||IND.test(s)||IND_HEADERS.has(s)){if(cur.length){groups.push(cur);cur=[];}continue;}cur.push(s);}
  if(cur.length)groups.push(cur);
  const rows:string[][]=[];for(let i=0;i+7<=vals.length;i+=7)rows.push(vals.slice(i,i+7).map(l=>l.s));
  const live=rows.filter(r=>r.some(x=>x!=='0.00'));
  if(vals.length%7===0&&groups.length===1&&live.length===1){
   const name=groups[0].join(''),unit=name.match(/（([^（）]+)）$/)?.[1]??null,r=live[0];
   const raw=t.slice(indAt,vals[vals.length-1].start+vals[vals.length-1].s.length);
   for(const[i,fy]of[[1,2021],[2,2022],[3,2023],[4,2024]]as const)if(r[i]!=='0.00')p.indicators.push({name,fiscalYear:fy,target:null,actual:r[i],unit,evidence:evidence(input,raw,indAt)});
   if(r[0]!=='0.00')p.indicators.push({name:`${name}［基準値（R02）］`,fiscalYear:2020,target:null,actual:r[0],unit,evidence:evidence(input,raw,indAt)});
   if(r[6]!=='0.00')p.indicators.push({name,fiscalYear:2026,target:r[6],actual:null,unit,evidence:evidence(input,raw,indAt)});
   warnings.push('指標は1指標のみのシートに限り登録。値0.00は未記入と区別できないため除外し、R07年度欄は未登録。');
  } else warnings.push('指標表は複数指標または指標名と値の対応を確定できないため未登録。');
 }

 // 自己評価の選択肢（■）。区間ごとに候補を限定。
 const dirAt=t.indexOf('今後の事業の方向性（→その理由）',page2);
 const rate=(label:string,from:number,to:number,options:string[],single:boolean)=>{
  if(from<0||to<=from||to>end)return;
  const c=checked(t,from,to,options);if(!c.length||(single&&c.length!==1))return;
  const raw=t.slice(c[0].start,c[c.length-1].start+c[c.length-1].raw.length);
  p.ratings.push({kind:'self',label,value:c.map(x=>x.value).join('・'),scale:options.join('／'),evidence:evidence(input,raw,c[0].start)});
 };
 rate('指標値の動向',trendAt,dirAt,['向上','横ばい','低下'],true);
 rate('今後の事業の方向性',dirAt,costAt,['拡大','改善・効率化','縮小','維持','統合','廃止・終了'],false);
 const costDirAt=t.indexOf('次年度のコストの方向性（→その理由）',start);
 if(costDirAt>=start&&costDirAt<page2)rate('次年度のコストの方向性',costDirAt,page2,['増加','維持','削減'],true);
 p.warnings.push(...warnings);
 return p;
}

function extract(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='08224'||!ids.has(input.sourceId)||input.truncated)return [];
 const t=input.text,starts:{start:number;title:string}[]=[];
 let i=t.indexOf(TITLE);
 while(i>=0){const ls=t.lastIndexOf('\n',i-1)+1;starts.push({start:ls,title:t.slice(ls,i)});i=t.indexOf(TITLE,i+1);}
 const out=new Map<string,ProjectEvaluation>(),bad=new Set<string>();
 starts.forEach((s,k)=>{
  const p=sheet(input,s.start,k+1<starts.length?starts[k+1].start:t.length,s.title);
  if(!p)return;
  if(out.has(p.projectName))bad.add(p.projectName);else out.set(p.projectName,p);
 });
 return [...out.values()].filter(p=>!bad.has(p.projectName));
}

export const entries:Record<string,{extract:(input:CachedInput,inputs:CachedInput[])=>ProjectEvaluation[];scope:string}>={
 '08224':{extract,scope:'令和6年度 事務事業マネジメントシート（分野別PDF、1PDFに複数事業）の事業名・担当課、財源合計で検算できたコスト（R04〜R06決算・R07予算・人件費・トータルコスト）、単一指標の実績・目標、■の付いた動向・方向性。基本事業評価シート・事務事業一覧・重点政策は構造化しない。'},
};
