import type {ProjectEvaluation} from '../../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from '../shared';

// 石岡市 令和８年度 事務事業評価シート（部局別PDF。batch7 で新規取得した部局分のみ）。
const SOURCES=new Set(['362881a6c0d560ea77552c5a','7a5107169257843af8a38403','7f7635df87e847d829314076','a3dd4eb516a636ee88bca81b','a737c10d802d07c05524aebc','bb6689e44e8bc5bd460f66e9','cc7aa3e9e85b1d74fcb0a389']);
// 教育委員会事務局PDFは2分割で取得（後半 bb66… は目次なし。目次は前半 7f76… の P番号で対応）。
const TOC_SOURCE:Record<string,string>={'bb6689e44e8bc5bd460f66e9':'7f7635df87e847d829314076'};
const SHEET=/(?:^|\n\n)令和８年度\n\n(?:事業名\n\n)?事務事業評価シート\n(?!【)/g;
const NUM='-?[\\d,]+';
const INPUT=new RegExp('2\\.投入量（インプット）\\n年度\\n\\n（単位：千円）\\n令和5年度\\n（過年度）\\n\\n令和6年度\\n（過年度）\\n\\n令和7年度\\n（過年度）\\n\\n令和8年度\\n（現年度）\\n\\n'+
 `((?:${NUM}\\n){6}\\n(?:${NUM}\\n){6}\\n(?:${NUM}\\n){6}\\n)`+
 '義務的経費\\n一般行政経費\\n政策的経費\\n公共施設経費\\n補 正 等\\n前年度から繰越\\n次年度へ繰越\\n予算額計\\(B\\)\\n\\n'+
 `((?:(?:${NUM}\\n){8}\\n){4})`+'執行率\\(A/B\\)\\n\\n((?:[\\d.]+%\\n\\n){4})'+
 '職員数\\(人\\)\\n人件費\\(C\\)\\n会計年度任用職員\\(人\\)\\nフルコスト\\(A\\+C\\)\\n\\n'+`((?:(?:[\\d.,]+\\n){4}\\n){3})`);
const OPTIONS=['継続実施（変更なし）','見直し検討','事業終了'];
const norm=(s:string)=>s.normalize('NFKC').replace(/\s/g,'');
const num=(s:string)=>Number(s.replaceAll(',',''));
const groups=(block:string,size:number)=>{const v=block.split('\n').filter(Boolean);const out:string[][]=[];for(let i=0;i<v.length;i+=size)out.push(v.slice(i,i+size));return out;};

interface Toc{input:CachedInput;entries:{name:string;dept:string;page:number;raw:string;start:number}[]}
function toc(input:CachedInput):Toc{
 const first=input.text.search(SHEET),head=first<0?input.text:input.text.slice(0,first);
 const entries=[...head.matchAll(/(?<=\n)(\d+)\n\n([^\n]+)\n\n([^\n]+)\n\nP(\d+)\n/g)].map(m=>({name:m[3],dept:m[2],page:Number(m[4]),raw:m[0],start:m.index!}));
 return {input,entries};
}

function amounts(input:CachedInput,p:ProjectEvaluation,seg:string,offset:number):boolean{
 const m=INPUT.exec(seg);if(!m)return false;
 const fin=groups(m[1],6),bud=groups(m[2],8),rate=m[3].split('\n').filter(Boolean),per=groups(m[4],4);
 if(fin.length!==3||bud.length!==4||rate.length!==4||per.length!==3)return false;
 // 財源計＝決算額計(A)、予算額計(B)＝各経費＋補正＋前年度繰越−次年度繰越、執行率＝A/B、フルコスト＝A＋人件費(C) が全列で成り立つ場合のみ採用。
 for(const f of fin)if(f.slice(0,5).reduce((s,x)=>s+num(x),0)!==num(f[5]))return false;
 for(const b of bud)if(b.slice(0,6).reduce((s,x)=>s+num(x),0)-num(b[6])!==num(b[7]))return false;
 for(let i=0;i<3;i++){
  const a=num(fin[i][5]),b=num(bud[i][7]);if(!b||Math.abs(a/b*100-Number(rate[i].replace('%','')))>0.006)return false;
  if(a+num(per[i][1])!==num(per[i][3]))return false;
 }
 const ev=evidence(input,m[0],offset+m.index);
 const add=(kind:'actual'|'budget'|'personnel'|'fullCost',fy:number,raw:string)=>p.amounts.push({kind,fiscalYear:fy,amountYen:num(raw)*1000,rawValue:raw,rawUnit:'千円',evidence:ev});
 for(let i=0;i<3;i++)add('actual',2023+i,fin[i][5]);
 for(let i=0;i<4;i++)add('budget',2023+i,bud[i][7]);
 for(let i=0;i<3;i++){add('personnel',2023+i,per[i][1]);add('fullCost',2023+i,per[i][3]);}
 return true;
}

function direction(input:CachedInput,p:ProjectEvaluation,seg:string,offset:number){
 const s=seg.indexOf('事業の方向性 ');if(s<0||seg.indexOf('事業の方向性 ',s+1)>=0)return;
 const e=seg.indexOf('事業終了',s);if(e<0)return;
 const raw=seg.slice(s,e+4),marks=[...raw.matchAll(/[●○]/g)].map(m=>m[0]);
 if(marks.length!==3||marks.filter(x=>x==='●').length!==1)return;
 let last=-1;for(const o of OPTIONS){const i=raw.indexOf(o);if(i<=last||raw.indexOf(o,i+1)>=0)return;last=i;}
 p.ratings.push({kind:'self',label:'事業の方向性',value:OPTIONS[marks.indexOf('●')],scale:OPTIONS.join('／'),evidence:evidence(input,raw,offset+s)});
}

function extract(input:CachedInput,inputs:CachedInput[]):ProjectEvaluation[]{
 if(input.municipalityCode!=='08205'||!SOURCES.has(input.sourceId))return [];
 const tocInput=TOC_SOURCE[input.sourceId]?inputs.find(i=>i.sourceId===TOC_SOURCE[input.sourceId]):input;
 const t=tocInput?toc(tocInput):null;
 const starts=[...input.text.matchAll(SHEET)].map(m=>m.index!+(m[0].startsWith('\n')?2:0));
 const out=new Map<string,ProjectEvaluation>(),conflicts=new Set<string>();
 starts.forEach((start,k)=>{
  const end=k+1<starts.length?starts[k+1]:input.text.length,seg=input.text.slice(start,end);
  // 取得テキストが120,000字で切れているため、最後のシートが末尾で途切れている場合は採らない。
  if(input.truncated&&k===starts.length-1)return;
  const nm=seg.match(/\n\n([^\n]+)\n\n根拠法令\n/),dm=seg.match(/課名\n\n([^\n]+)\n\n([^\n]+)\n\n会計\n/),pg=seg.match(/\n(\d+)\/(\d+)\n/);
  if(!nm||!dm||!pg||nm[1]==='事業名')return;
  let name=nm[1];const titleRaw=seg.slice(0,seg.indexOf('\n',seg.indexOf('事務事業評価シート')));
  const hits=t?t.entries.filter(x=>x.page===Number(pg[1])):[];
  const tocHit=hits.length===1&&norm(hits[0].name).startsWith(norm(name))?hits[0]:null;
  if(tocHit)name=tocHit.name;
  const p=project(input,`${dm[2]}:${name}`,name,2026,titleRaw,start);
  p.department=dm[2];
  p.evidence.push(evidence(input,nm[0],start+nm.index!),evidence(input,dm[0],start+dm.index!));
  if(tocHit)p.evidence.push(evidence(t!.input,tocHit.raw,tocHit.start));
  const hasAmounts=amounts(input,p,seg,start);direction(input,p,seg,start);
  p.warnings.push('令和８年度事務事業評価シート。評価年度は表題の令和８年度。評価対象年度は様式に明記がないため空欄。');
  if(hasAmounts)p.warnings.push('投入量表の列は本文の並び（令和5〜7年度=過年度、令和8年度=現年度）で対応づけ、財源計＝決算額計(A)、予算額計(B)の内訳合計、執行率A/B、フルコスト＝A＋人件費(C) の一致を全列で確認したもののみ採用。予算額計(B)は補正・繰越を含む額。');
  else p.warnings.push('投入量表の段組みが崩れているか検算が一致しないため金額は未採用。');
  p.warnings.push('活動指標・成果指標は抽出テキストで指標名と値の対応が確定できないため未採用。事業の方向性は●が1つだけで選択肢3つが順に並ぶ場合のみ採用。');
  if(tocHit)p.warnings.push('事業名は目次の表記（シート開始ページと目次のP番号が一致し、シートの事業名で始まるもの）を採用。');
  const key=norm(p.department+'\n'+name),old=out.get(key);
  if(old){conflicts.add(key);return;}
  out.set(key,p);
 });
 return [...out].filter(([k])=>!conflicts.has(k)).map(([,p])=>p);
}

export const entries:Record<string,{extract:(input:CachedInput,inputs:CachedInput[])=>ProjectEvaluation[];scope:string}>={
 '08205':{extract,scope:'令和８年度事務事業評価シート（議会事務局・消防本部・教育委員会事務局・農業委員会事務局・監査委員事務局・八郷総合支所）の事業名・担当課・投入量（検算一致時の決算額・予算額・人件費・フルコスト）・事業の方向性。活動指標・成果指標・点検項目・総括評価文は構造化しない。'},
};
