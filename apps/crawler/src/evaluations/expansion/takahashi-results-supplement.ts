import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
export function extractTakahashiResultsSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='33209'||input.sourceId!=='3964cf0e3dafcaf911183018')return [];
 const out:ProjectEvaluation[]=[];
 for(const m of input.text.matchAll(/^(\d+) ([^\s]+事業) ([^\n]+)$/gm)){
  if(m[1]==='38')continue; // Identical umbrella name with a different detailed activity: reviewed separately before integration.
  const p=project(input,`2022:${m[1]}`,m[2],2022,m[0],m.index);
  const rating=m[3].match(/(?:^| )([\d,]+) (現行どおり|改善|廃止・休止)(?= |$)/);
  if(!rating)continue;
  p.ratings.push({kind:'self',label:'行財政改革本部による評価',value:rating[2],scale:null,evidence:evidence(input,m[0],m.index)});
  p.evidence.push(evidence(input,input.text.slice(0,150),0));
  p.warnings.push('同一行で事業名と本部評価が確定する行のみ。実績年度の異なる例外を含むため対象年度・決算額は未数値化。折返し名称と同名別活動は保留。');out.push(p);
 }
 return out;
}
