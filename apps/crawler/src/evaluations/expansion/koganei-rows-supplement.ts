import type{ProjectEvaluation}from'../../../../web/src/types/evaluation';
import{type CachedInput,evidence,project}from'./shared';
const departments=[['まちづくり','推進課'],['コミュニ','ティ文化課'],['農業委員会','事務局'],['児童青少年','課'],['子育て支援','課'],['情報システ','ム課'],['選挙管理委','員会事務局'],['監査委員事','務局']];
const sections=[['まちづくり','係'],['男女共同参','画室'],['スポーツ振','興係'],['子育て支援','係'],['児童青少年','係'],['情報システ','ム係'],['高齢者医療','係'],['庁舎建設等','担当']];
const longNames:Record<string,[string,string]>={
 'B10-34087-3':['都の即応型資金融資「つなぎ」','給事業'],
 'C17-49125-24':['地域ｺﾐｭﾆﾃｨｾﾝﾀｰ施設研究講座','業）'],
 'C17-49125-25':['団塊の世代地域デビュー講座','業）'],
 'D24-67169-24':['重度身体障害者等緊急通報シス','全システム事業'],
};
/** Three horizontal text rows form one logical row. Strip only observed split department/section suffixes. */
export function extractKoganeiRowsSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.sourceId!=='344757febe50f67d29329a60'||input.municipalityCode!=='13210'||input.truncated)return[];
 const lines=[...input.text.matchAll(/^.*$/gm)];const out:ProjectEvaluation[]=[];
 for(let i=1;i<lines.length-1;i++){
  const m=lines[i][0].match(/(?:^| )([0-9]+) (.*?) ?(拡大|現状|縮小|要改善|廃止|委託化|協働化|情報化) (拡大|現状|縮小|廃止)$/);if(!m)continue;
  const pre=lines[i-1][0].match(/([A-EZ][0-9]{2}-)(.*)$/),post=lines[i+1][0].match(/(?:^| )([0-9]{4,5})(.*)$/);if(!pre||!post)continue;
  const code=pre[1]+post[1]+'-'+m[1];const lead=pre[2].trim().split(/ +/).filter(Boolean),middle=m[2].trim().split(/ +/).filter(Boolean),tail=post[2].trim().split(/ +/).filter(Boolean);
  const popSplit=(pairs:string[][])=>{for(const[a,b]of pairs)if(lead.at(-1)===a&&tail.at(-1)===b){lead.pop();tail.pop();return a+b;}return null;};
  const section=popSplit(sections)??middle.pop();if(!section)continue;
  const department=popSplit(departments)??middle.pop();if(!department||!/(課|室|館|局)$/.test(department))continue;
  let name=lead.join(' ')+middle.join(' ')+tail.join(' ');let from=i-1,to=i+1;
  const extra=longNames[code];if(extra){if(!lines[i-2]?.[0].endsWith(extra[0])||!lines[i+2]?.[0].endsWith(extra[1]))continue;name=extra[0]+name+extra[1];from=i-2;to=i+2;}
  if(!name)continue;
  const start=lines[from].index!,raw=input.text.slice(start,lines[to].index!+lines[to][0].length);
  const p=project(input,code,name,2012,raw,start);p.evaluatedFiscalYear=2011;p.department=department+' '+section;
  p.ratings=[{kind:'self',label:'第1次評価・活動量の方針',value:m[3],scale:null,evidence:evidence(input,raw,start)},{kind:'self',label:'第1次評価・予算の方針',value:m[4],scale:null,evidence:evidence(input,raw,start)}];
  p.evidence.push(evidence(input,input.text.slice(0,input.text.indexOf('\n')),0));
  p.warnings.push('評価結果一覧の部分レコード。事業番号・名称・課係・活動量と予算の方針を原文列から復元。平成24年度の第2次・第3次評価は未実施であり第1次判断のみ。方針は最終的な市の方針ではない。事業費・実績指標は一覧にないため補完しない。');out.push(p);
 }
 return out;
}
