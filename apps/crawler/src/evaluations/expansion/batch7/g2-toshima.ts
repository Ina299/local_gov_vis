import type {ProjectEvaluation} from '../../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from '../shared';

// 豊島区 令和4年度（令和5年度実施）事務事業評価表（1資料1事業）。batch7 で取得した documents/37123 の PDF のみ。
const ids=new Set('00301f8d08a5de093ff0ab2e 013f01450387d7dd04c0cca1 01ae6b53cb0d30c40328a50b 1d215894efed36d49bb43703 2070935a08e978916521fdfb 244cd6fe9f24f53c6b432a6f 2dedab3ae6d424c130ac439a 2e69e545c4b688abf5a140d8 39ab6ebe4214e4118b5f03a4 3bea86e7561e2bb2c344d81e 480a1e3b1d5f598368df2e84 4e0b2e231594c27c70cae985 4e9e172c9b166a7981a25d72 549dfc1e179e51fa4f28f778 56573128046e898bd853febd 597190f82928c1039cbd783e 5986086462d8bb6b0b7db32f 604a1639aa583c30a9ae797b 66dafd1040cdb604b60ca30d 701358203256fa2062e28102 701aa6561468c8846eb90070 759b64f74509bb0f89f2ad41 7f8ee5e56c48f872bbce581e 817434179753e73c19b35306 8a859761c63836479a7346b9 8ebaf06780efe2609839647a a20ec27efbbd85ce6b8412db a24eb7683fc2d55b9a913761 a80eb368e7ea6dd4afab50e2 ae06f7d4a6cfacb3fbcee750 afaffab76d34025f77b5d76a bbe6ca6622479a09ff4a2273 c5afb6f689955f72ece68a41 ccb3561577152f39acf42f18 d0bf250e24a6b31b1cdbe39d d6ddb03f795055476c047462 d7530c8ca4d5bb853d43df3e e7406a55c199ae2ac28c5fab eb131ae443435f47a4962469 fc553617a388ed9f0a77065e'.split(' '));
const NUM=/^-?\d{1,3}(?:,\d{3})*$/,PEOPLE=/^\(\d+\.\d+\)$/;
const n=(s:string)=>Number(s.replaceAll(',',''));
interface Block{values:string[];raw:string;start:number}

/** 事業費の推移の9行ブロック（事業費A・正規・会計年度・人件費B・C・財源4区分）を物理的に連続した行から拾う。 */
function costBlocks(text:string,from:number,to:number):Block[]{
 const lines:{s:string;start:number}[]=[];let pos=from;
 for(const s of text.slice(from,to).split('\n')){lines.push({s,start:pos});pos+=s.length+1;}
 const out:Block[]=[];
 for(let i=0;i+9<=lines.length;i++){
  const g=lines.slice(i,i+9).map(l=>l.s);
  if(NUM.test(g[0])&&PEOPLE.test(g[1])&&PEOPLE.test(g[2])&&g.slice(3).every(v=>NUM.test(v))&&n(g[0])+n(g[3])===n(g[4]))
   out.push({values:g,raw:g.join('\n'),start:lines[i].start});
 }
 return out;
}

function extract(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='13116'||!ids.has(input.sourceId)||input.truncated)return [];
 const t=input.text;
 const head=t.match(/^令和4年度（令和5年度実施）事務事業評価表\n事業整理番号\n\n([\s\S]*?)\n\n(\d{4})\n\n(?:-\n\n(\d{2})|(政[０-９\d]+))\n\n(?:\d+\n\n)*([^\n\d][^\n]*)\n\n事業特性\n/);
 if(!head)return [];
 const dept=head[1].match(/担当組織 (\S+)/);if(!dept)return [];
 const rest=head[1].replace(dept[0],'').replace('事務事業名','').split('\n').map(s=>s.trim()).filter(Boolean);
 if(rest.length!==1)return [];
 const name=rest[0],headRaw=head[0].slice(0,-'\n\n事業特性\n'.length);
 const p=project(input,head[3]?`${head[2]}-${head[3]}`:name,name,2023,headRaw,0);
 p.projectCode=head[3]?`${head[2]}-${head[3]}`:null;p.department=`${dept[1]} ${head[5]}`;p.evaluatedFiscalYear=2022;
 const warnings=['表題「令和4年度（令和5年度実施）」により評価対象年度2022・評価実施年度2023を区別。'];
 if(!head[3])warnings.push(`事業整理番号欄は「${head[2]}」「${head[4]}」に分かれて抽出され、正式な番号表記を確定できないため projectCode は空。`);
 // 事業費: 段組みが崩れているため、R4決算とR5予算の9行ブロックを「増減（R4決算比）」との差額全項目一致で特定できた場合のみ採用。
 const costFrom=t.indexOf('２．事業費の推移'),costTo=t.indexOf('３．総合評価');
 const delta=t.match(/増減\n（R4決算比）\n\n?(-?[\d,]+)\n―\n―\n(-?[\d,]+)\n(-?[\d,]+)\n(-?[\d,]+)\n(-?[\d,]+)\n(-?[\d,]+)\n(-?[\d,]+)(?=\n)/);
 let costed=false;
 if(costFrom>0&&costTo>costFrom&&delta&&delta.index!>costFrom&&delta.index!<costTo){
  const d=delta.slice(1,8).map(n),blocks=costBlocks(t,costFrom,costTo),cols=[0,3,4,5,6,7,8];
  const pairs:[Block,Block][]=[];
  for(const x of blocks)for(const y of blocks)if(x!==y&&cols.every((c,k)=>n(y.values[c])-n(x.values[c])===d[k]))pairs.push([x,y]);
  if(pairs.length===1){
   const [r4,r5]=pairs[0];
   p.amounts.push({kind:'actual',fiscalYear:2022,amountYen:n(r4.values[0])*1000,rawValue:r4.values[0],rawUnit:'千円',evidence:evidence(input,r4.raw,r4.start)});
   p.amounts.push({kind:'budget',fiscalYear:2023,amountYen:n(r5.values[0])*1000,rawValue:r5.values[0],rawUnit:'千円',evidence:evidence(input,r5.raw,r5.start)});
   p.evidence.push(evidence(input,delta[0],delta.index));costed=true;
  }
 }
 warnings.push(costed
  ?'事業費は段組み崩れのため、R4決算・R5予算の各列（事業費A・人件費B・C・財源）の差が「増減（R4決算比）」欄と全項目一致する組を一意に特定できた事業費Aのみ採用（単位千円）。R3・R4予算、人件費、執行率は列対応を確定できず未登録。'
  :'事業費表は段組み崩れで年度・予算決算の列対応を一意に確定できないため金額は未登録。');
 const total=t.match(/総合評価（d＝a＋b＋c）\n\n(ランク[１-４1-4])\n/);
 if(total)p.ratings.push({kind:'self',label:'総合評価（d＝a＋b＋c）',value:total[1],scale:null,evidence:evidence(input,total[0],total.index)});
 const dirHead=t.indexOf('今後の事業の方向性（d＋e）'),dirs=[...t.matchAll(/^[A-D]：[^\n]+$/gm)];
 if(dirHead>0&&dirs.length===1&&dirs[0].index!>dirHead)p.ratings.push({kind:'self',label:'今後の事業の方向性（d＋e）',value:dirs[0][0],scale:null,evidence:evidence(input,dirs[0][0],dirs[0].index)});
 warnings.push('指標（成果・活動）の表とa・b・c各評価欄は段組み崩れで値と欄の対応が確定できないため未登録。総合評価ランクと方向性は該当見出し直後・文書内唯一の記載のみ。');
 p.warnings.push(...warnings);
 return [p];
}

export const entries:Record<string,{extract:(input:CachedInput,inputs:CachedInput[])=>ProjectEvaluation[];scope:string}>={
 '13116':{extract,scope:'令和4年度（令和5年度実施）事務事業評価表（1事業1PDF）の事業名・整理番号・担当組織と、差額検算で列が確定した事業費A（R4決算・R5予算）、総合評価ランク・今後の方向性。指標表・a〜c評価・人件費は段組み崩れのため構造化しない。'},
};
