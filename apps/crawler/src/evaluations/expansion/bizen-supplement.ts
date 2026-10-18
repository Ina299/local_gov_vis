import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
const SPECS:Record<string,{fiscalYear:number;names:string[]}>= {
 b8fb59a2b3d0df5359a588da:{fiscalYear:2023,names:['吉永美術館管理運営事業','障がい者給付事業']},
 d52a90ef5a57869f1622c3f4:{fiscalYear:2024,names:['男女共同参画事業']},
};
export function extractBizenSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='33211'||!SPECS[input.sourceId])return [];
 const spec=SPECS[input.sourceId],out:ProjectEvaluation[]=[];
 for(const name of spec.names){
  const raw=input.text.split('\n').find(x=>x.startsWith('○'+name));if(!raw)continue;
  const p=project(input,name,name,null,raw);p.evaluatedFiscalYear=spec.fiscalYear;p.outcomes=raw;p.evidence.push(evidence(input,input.text.slice(0,120),0));
  p.warnings.push('施策評価報告書中で事業名を明記する外部委員の意見。施策全体の評点・予算は付与せず、意見を事業の成果と断定しない。評価実施は複数暦年にまたがるため評価年は未設定。');out.push(p);
 }
 return out;
}
