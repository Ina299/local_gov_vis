import type {ProjectEvaluation} from '../../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from '../shared';

// 伊達市 令和５年度伊達市事務事業評価シート（hotnews/files/00000400/00000431/*.pdf、1PDF1事業）。batch7 取得分のみ。
const ids=new Set('0798682e64a6cc9f893c93d5 08ae94b3e5a80587c800c5bc 0ff44788cf621d6df68b5eaf 7b05104f1d2fe76e2c3399df 8a359a966e4db5e38416fc2f ae6fde22db0c7fb272157930 ccf29d4323e0e804657b5a09 ef6674f2f7225aa0f3095b01 f471994289f15a9447759806 f990468421cc79da6e9ffc05'.split(' '));
const TITLE='令和５年度伊達市事務事業評価シート';
const COST_HEAD='（決算額）\n\n（決算額）\n\n（決算額）\n\n（予算額）\n\n（計画値）\n\n（計画値）';
const IND_HEAD='単位\n\nＲ２\n\nＲ３\n\nＲ４\n\nＲ４\n\nＲ５\n\nＲ６\n\nＲ７\n\n実績値\n\n実績値\n\n目標値\n\n実績値\n\n目標値\n\n目標値\n\n目標値\n\n';
const NUM='-?\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?';
const SKIP=/^(?:\d+|[０-９]+|\(予算書上事業名\)|作成日|基 本 目 標)$/;
const n=(s:string)=>Number(s.replaceAll(',','').replace('%',''));

function extract(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='01233'||!ids.has(input.sourceId)||!input.text.startsWith(TITLE))return [];
 const t=input.text;
 // 事業名: 「事務事業名」の後、番号・ラベル行を飛ばした最初の行（括弧書きの予算書上事業名は除く）。
 const head=t.indexOf('\n\n事務事業名\n\n');if(head<0)return [];
 let pos=head+'\n\n事務事業名\n\n'.length,name='',start=-1;
 for(const line of t.slice(pos,pos+300).split('\n')){
  const s=line.trim();
  if(s&&!SKIP.test(s)&&!s.startsWith('(')&&!s.startsWith('（')){name=line;start=pos;break;}
  pos+=line.length+1;
 }
 if(!name||!/(事業|経費)(（[^）]+）)?$/.test(name))return [];
 const p=project(input,name,name,2023,name,start);
 p.evidence.push(evidence(input,TITLE,0));
 p.warnings.push('令和５年度伊達市事務事業評価シート（1PDF1事業）。表題の令和５年度を評価年度とし、評価対象年度は本文の列見出しから一意に定まらないため空欄。所管部署・観点別評価・方向性評価は段組み崩れで欄の対応が確定できないため未収録。');
 // 投入経費: 直接事業費(Ａ)の直後に6値（R2〜R4決算・R5予算・R6〜R7計画）が並ぶときだけ。計画値は入れない。
 const cost=new RegExp(`直接事業費\\(Ａ\\)\\n\\n(${NUM})\\n\\n(${NUM})\\n\\n(${NUM})\\n\\n(${NUM})\\n\\n(${NUM})\\n\\n(${NUM})\\n\\n(?!${NUM}\\n)`).exec(t);
 if(cost&&t.includes(COST_HEAD)){
  const v=cost.slice(1,5);
  // 最終予算額と執行率が同じ並びで出ている場合は、執行率＝直接事業費÷最終予算額 で列対応を確認する。
  const fin=new RegExp(`最終予算額（補正予算を含む）\\n\\n(${NUM})\\n\\n(${NUM})\\n\\n(${NUM})\\n\\n(${NUM})\\n\\n(?:有\\n\\n)?執行率\\n\\n(${NUM}%)\\n\\n(${NUM}%)\\n\\n(${NUM}%)\\n\\n(${NUM}%)`).exec(t);
  const ok=!fin||v.every((x,i)=>Math.abs(Math.round(n(x)/n(fin[i+1])*1000)/10-n(fin[i+5]))<0.051);
  if(ok){
   const raw=cost[0].replace(/\n\n$/,'');
   v.forEach((x,i)=>{
    if(n(x)===0)return;
    p.amounts.push({kind:i<3?'actual':'budget',fiscalYear:2020+i,amountYen:n(x)*1000,rawValue:x,rawUnit:'千円',evidence:evidence(input,raw,cost.index)});
   });
   p.evidence.push(evidence(input,COST_HEAD));
   if(fin)p.evidence.push(evidence(input,fin[0],fin.index));
   p.warnings.push('投入経費は直接事業費(Ａ)のみ（R2〜R4決算額、R5予算額。千円）。参考人件費・投入経費合計とR6・R7計画値は列対応が確定できないため、または計画値のため未収録。値0は未記入と区別できないため入れていません。');
  }
 }
 // 指標: 見出し行（R2実績・R3実績・R4目標・R4実績・R5〜R7目標）の直後に連続して並ぶ行だけ。
 const ih=t.indexOf(IND_HEAD);
 if(ih>=0){
  const row=new RegExp(`[①②③] ([^\\n]+)\\n\\n([^\\n\\d]{1,6})\\n\\n(${NUM})\\n\\n(${NUM})\\n\\n(${NUM})\\n\\n(${NUM})\\n\\n(${NUM})\\n\\n(${NUM})\\n\\n(${NUM})\\n\\n`,'y');
  row.lastIndex=ih+IND_HEAD.length;let m:RegExpExecArray|null;
  while((m=row.exec(t))){
   const raw=m[0].replace(/\n\n$/,''),e=evidence(input,raw,m.index),[name,unit,a2,a3,t4,a4,t5,t6,t7]=m.slice(1);
   p.indicators.push({name,fiscalYear:2020,target:null,actual:a2,unit,evidence:e},{name,fiscalYear:2021,target:null,actual:a3,unit,evidence:e},
    {name,fiscalYear:2022,target:t4,actual:a4,unit,evidence:e},{name,fiscalYear:2023,target:t5,actual:null,unit,evidence:e},
    {name,fiscalYear:2024,target:t6,actual:null,unit,evidence:e},{name,fiscalYear:2025,target:t7,actual:null,unit,evidence:e});
  }
  if(p.indicators.length){p.evidence.push(evidence(input,IND_HEAD.replace(/\n\n$/,''),ih));p.warnings.push('指標は列見出しの直後に連続して並ぶ行だけを原文どおり収録（活動指標か成果指標かの区別は未確定）。');}
 }
 return [p];
}

export const entries:Record<string,{extract:(input:CachedInput,inputs:CachedInput[])=>ProjectEvaluation[];scope:string}>={
 '01233':{extract,scope:'令和５年度伊達市事務事業評価シート（公表10事業）の事業名、直接事業費（R2〜R4決算・R5予算、列対応を確認できたもの）、列見出し直後に並ぶ指標値を構造化。参考人件費・計画値・観点別評価・方向性評価・所管部署は段組み崩れのため構造化しない。'},
};
