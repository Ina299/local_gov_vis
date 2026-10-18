import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
export function extractReviewFiveLists(input:CachedInput):ProjectEvaluation[]{
 const out:ProjectEvaluation[]=[];
 if(input.municipalityCode==='04445'&&input.text.startsWith('R1行政評価報告資料')){
  const subsidyStart=input.text.indexOf('団体等補助金一覧');
  for(const m of input.text.matchAll(/^(\d+) (\d\.\d\.\d) (.+?) ([^ \n]+(?:課|室|センター|支所|園|公民館|図書館|会館|館|所)) (.+)$/gm)){
   const subsidy=m.index!>=subsidyStart;const type=subsidy?'補助金':m[5].startsWith('１一般')?'一般':m[5].startsWith('２施設')?'施設':null;if(!type)continue;
   const p=project(input,`${type}:${m[1]}`,m[3],2019,m[0],m.index);p.department=m[4];
   // Grant tables contain last year's rating before the budget columns. Only the final judgement belongs to this year's review.
   if(subsidy){const r=m[5].match(/ ([ＡＢＣＤ]) (\d+)$/);if(!r)continue;p.ratings.push({kind:'self',label:'平成31年評価（一次）判定',value:r[1],scale:null,evidence:evidence(input,m[0],m.index)});}
   else {const r=[...m[5].matchAll(/(?:^| )([１２３４５](?:継続|改善|統合|廃止| 他))(?= |$)/g)];if(r.length===1)p.ratings.push({kind:'self',label:'一次評価の方向性',value:r[0][1],scale:null,evidence:evidence(input,m[0],m.index)});}
   p.warnings.push('一覧の事業名・所管課と同一行で確定する評価のみ。複数年度の予決算額、折り返された評価は数値化していません。');out.push(p);
  }
 }
 if(input.municipalityCode==='11215'&&input.text.startsWith('令和２年度行政評価の実施結果')){
  for(const m of input.text.matchAll(/^(?:[^\n]*? )?(\d{1,3}) ([^\n]+?) (非常に高い|高い|普通|低い|かなり低い) (非常に高い|高い|普通|低い|かなり低い)( [^\n]*)?$/gm)){
   if(+m[1]>189||!m[2].match(/事業$/))continue;
   const p=project(input,m[1],m[2],2020,m[0],m.index);
   const department=m[5]?.match(/ ([^ ]+(?:課|室))$/);if(department)p.department=department[1];
   if(m[1]==='143'&&m[2]==='平和意識高揚事業'){
    const wrapped='る 平和意識の高揚 143 平和意識高揚事業 高い 高い\n改善、効率\n強化戦略 生涯学習部 社会教育課';
    const offset=input.text.indexOf(wrapped);if(offset>=0){p.department='社会教育課';p.evidence.push(evidence(input,wrapped,offset));}
   }
   for(const [label,value]of [['必要性',m[3]],['効率性',m[4]]])p.ratings.push({kind:'self',label,value,scale:null,evidence:evidence(input,m[0],m.index)});
   const r=m[5]?.match(/現行どおり|強化戦略|改善戦略|改良戦略|縮小戦略|完了/);if(r)p.ratings.push({kind:'self',label:'今後の方向性又は改善内容',value:r[0],scale:null,evidence:evidence(input,m[0],m.index)});
   p.warnings.push('表の同一行に事業番号・名称・必要性・効率性が揃う行のみ。折り返された事業名や所管課を結合していません。');out.push(p);
  }
 }
 for(const p of out)p.evidence.push(evidence(input,input.text.slice(0,300),0));return out;
}
