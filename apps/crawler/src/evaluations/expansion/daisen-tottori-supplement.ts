import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
export function extractDaisenTottoriSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='31386'||input.sourceId!=='cbf1084567037b6e4e4b44a6'||input.truncated||input.format!=='pdf')return[];
 const rows=input.text.split('\n');const result:ProjectEvaluation[]=[];let offset=0;
 const pattern=/^(\d+(?:’\d+)?) (\S+課) (\d+) (?:([0-9]+) )?([^\s]+)(?: ([^\n]+?))? ([0-9,]+) ([Ａ-ＤA-D]) ([Ａ-ＤA-D]) ([Ａ-ＤA-D]) ([Ａ-ＤA-D]) (維持|拡大|縮小|皆減) (維持|拡充|縮小|休廃止) (維 持|拡 大|縮 小|皆 減) (維 持|拡 充|縮 小|休廃止)(?: ●)?$/;
 for(let i=0;i<rows.length;i++){
  const raw=rows[i],start=offset;offset+=raw.length+1;const m=raw.match(pattern);if(!m)continue;
  const prev=rows[i-1]??'',next=rows[i+1]??'';
  // A vertically centred name/description can precede AND follow the numbered row.
  if(!(pattern.test(prev)||prev==='（千円）'||/^\d+$/.test(prev)) || !(pattern.test(next)||/^\d+$/.test(next)||next.startsWith('１次評価')))continue;
  if(!/(事業|費|金|クラブ)(?:[（(][^）)]+[）)])?$/.test(m[5]))continue;
  const name=m[5]+(m[6]?`【説明名称：${m[6]}】`:'');
  const p=project(input,`R3-row-${m[1]}`,name,2021,raw,start);p.department=m[2];p.evaluatedFiscalYear=2020;
  p.evidence.push(evidence(input,rows[0],0));
  p.ratings.push({kind:'self',label:'一次評価（総合）',value:m[11],scale:'Ａ＝計画どおり／Ｂ＝進め方等改善／Ｃ＝統合・規模等見直し／Ｄ＝抜本的見直し等',evidence:evidence(input,raw,start)});
  p.ratings.push({kind:'self',label:'二次評価・コスト投入の方向性',value:m[14].replace(/ /g,''),scale:null,evidence:evidence(input,raw,start)});
  p.ratings.push({kind:'self',label:'二次評価・成果の方向性',value:m[15].replace(/ /g,''),scale:null,evidence:evidence(input,raw,start)});
  p.warnings.push('評価結果一覧の単行完結部分のみ。説明名称別の評価単位を事業名称と併記し区別。金額欄は事業全体と説明名称別経費の範囲を確定せず保留。折返し名称・複数診療所の束は除外。');result.push(p);
 }
 return result;
}
