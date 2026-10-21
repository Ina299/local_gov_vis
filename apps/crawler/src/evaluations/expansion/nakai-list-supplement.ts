import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import{type CachedInput,evidence,project}from'./shared';
export function extractNakaiListSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='14361'||input.sourceId!=='ec35ffa4eb3119fdca46f11d'||input.format!=='pdf'||input.truncated)return[];
 const heads=[...input.text.matchAll(/^(?:[一-龠ぁ-ん・] )?(\d{3}) (\S+) .+$/gm)],out:ProjectEvaluation[]=[];
 for(let i=0;i<heads.length;i++){
  const h=heads[i],start=h.index!,raw=input.text.slice(start,heads[i+1]?.index??input.text.length);
  const ratings=[...raw.matchAll(/(?:^| )(現状維持|改善効率化|拡大・拡充|抜本的見直し|休・廃止)$/gm)];if(ratings.length!==1)continue;
  const name=h[2];if((name.match(/（/g)||[]).length!==(name.match(/）/g)||[]).length)continue;
  const p=project(input,h[1],name,2023,raw,start);p.evaluatedFiscalYear=2022;
  p.evidence.push(evidence(input,'令和5年度事務事業調査 事務事業一覧（対象：令和4年度）'));
  p.ratings.push({kind:'self',label:'短期方針',value:ratings[0][1],scale:null,evidence:evidence(input,ratings[0][0],start+ratings[0].index!)});
  p.warnings.push('事務事業調査一覧の事業番号・名称・短期方針を部分構造化。縦書き所属の適用範囲、予算事業名との対応、目的・経費・成果数値は推測しない。');out.push(p);
 }
 const paired=out.filter(p=>p.projectCode==='099'||p.projectCode==='455');
 if(paired.length!==2||paired.some(p=>p.projectName!=='決算事務'))throw new Error('Nakai reviewed duplicate name changed');
 const first=paired[0],second=paired[1];first.projectCode='099 / 455';first.evidence.push(...second.evidence);
 for(const rating of second.ratings)if(!first.ratings.some(r=>r.label===rating.label&&r.value===rating.value))first.ratings.push(rating);
 first.warnings.push('原典番号099と455の同名「決算事務」を1名称の評価へ統合し、両掲載行の根拠を保持。縦書き所属の適用境界と独立予算事業かは確認できないため別事業数に計上していません。');
 return out.filter(p=>p!==second);
}
