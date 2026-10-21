import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
const docs:Record<string,[number,Record<string,[string,string]>]>={
 '49c4562787f48283d4c44c26':[2020,{'４':['地域防災力強化事業','一部見直しのうえ継続すべき']}],
 '875e536943b6fe7cd2257b56':[2024,{'６':['保育料無償化','一部見直しのうえ継続すべき'],'１３':['浸水対策事業','一部見直しのうえ継続すべき']}],
 '8a8590f3f1cb3b7f314b809e':[2023,{'３':['関係人口創出事業','一部見直しのうえ継続すべき']}],
 'eaf2ecebe1d01ed48320b7a0':[2021,{'３':['地域防災力強化事業','一部見直しのうえ継続すべき'],'４':['ドローン戦略の推進','抜本的な見直しのうえ継続すべき'],'６':['府中版ネウボラ事業','現状のまま継続すべき'],'９':['介護人材確保事業','一部見直しのうえ継続すべき'],'１０':['地域共生モデル事業','一部見直しのうえ継続すべき']}],
};
export function extractFuchuHiroshima(input:CachedInput):ProjectEvaluation[]{
 const config=docs[input.sourceId];if(input.municipalityCode!=='34208'||!config)return [];
 const rows:ProjectEvaluation[]=[];
 for(const [no,[name,rating]] of Object.entries(config[1])){
  const marker=`${no} ${name} `,pos=input.text.indexOf(marker);if(pos<0)continue;
  const start=input.text.lastIndexOf('\n',pos-2)+1,firstEnd=input.text.indexOf('\n',pos),end=input.text.indexOf('\n',firstEnd+1);
  const raw=input.text.slice(start,end<0?input.text.length:end),r=project(input,no,name,null,raw,start);r.projectCode=null;r.evaluatedFiscalYear=config[0];
  // Manual exact-cell review is limited to the named rows above; the raw evidence
  // retains the split direction text on either side of the project-name row.
  const prefix=rating.startsWith('抜本的')?'抜本的な見直しの':rating.startsWith('現状')?'現状のまま継続す':'一部見直しのう';
  if(!raw.includes(prefix)||!raw.includes('べき'))continue;
  r.ratings.push({kind:'external',label:'議会提言：今後の方向性',value:rating,scale:null,evidence:evidence(input,raw,start)});
  r.warnings.push('決算年度を対象年度として保持。提言実施年は本文に明記がなく未確定。名称が一行で確定し方向性の折返しが隣接する行のみ。所管常任委員会を担当行政部署と取り違えない。長文提言と費用は未抽出。');rows.push(r);
 }
 return rows;
}
