import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
export function extractMiyakoExternalSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='03202')return [];
 const years:Record<string,number>={'2deb2c2c7340e4686fd1ee02':2017,'9b288a0193b3cd644925ebe0':2018,'8080670479a7faf84013dccb':2019};const year=years[input.sourceId];if(!year)return [];
 const out:ProjectEvaluation[]=[];
 if(year===2017){
  const rows=[['三陸鉄道経営強化支援事業','三陸鉄道経営強化 ①','三陸鉄道支援事業 ①'],['三陸鉄道支援事業','三陸鉄道支援事業 ①','鉄道利用促進事業 ①'],['鉄道利用促進事業','鉄道利用促進事業 ①','基本事業名称'],['バス停整備事業','バス停整備事業 ①','生活交通(バス)路 ①'],['生活交通(バス)路線運行維持事業','生活交通(バス)路 ①','川井地域バス運行 ①'],['川井地域バス運行管理事業','川井地域バス運行 ①','路線バス利用促進 ①'],['路線バス利用促進事業','路線バス利用促進 ①','基本事業名称'],['タクシー運行実証事業','タクシー運行実証 ①','基本事業名称']];
  for(const[name,start,end]of rows){const a=input.text.indexOf(start),z=input.text.indexOf(end,a+start.length);if(a<0||z<a)continue;const raw=input.text.slice(a,z).trimEnd();const p=project(input,name,name,year,raw,a);p.outcomes=raw;out.push(p);}
 }else{
  for(const m of input.text.matchAll(/事務事業「([^」]+)」/g)){
   if(m[1].includes('・避難'))continue; // Two distinct projects jointly evaluated; no artificial split.
   const rest=input.text.slice(m.index!);const end=rest.slice(m[0].length).search(/\n[①②③④⑤⑥] 基本事業|\n（２）その他|\n事務事業「/);const raw=rest.slice(0,end<0?rest.length:m[0].length+end).trimEnd();
   const names=m[1]==='急傾斜地崩壊対策事業負担金'?['急傾斜地崩壊対策事業負担金','河川維持管理事業','浸水常襲対策事業']:[m[1]];
   for(const name of names){const p=project(input,name,name,year,raw,m.index);p.outcomes=raw;if(names.length>1)p.warnings.push('名指しされた3事業に共通する委員会意見。共通原文を保持し、独立した評点や金額を配分しない。');out.push(p);}
  }
 }
 for(const p of out){p.evidence.push(evidence(input,input.text.slice(0,150),0));p.warnings.push('外部委員会の名指し事務事業意見のみ。上位施策・基本事業に対する評価を配賦しない。評価実施年度のみ確定、対象実績年度は不明。費用や数値指標は未抽出。');}
 // These names also occur in an internal sheet whose fiscal year could be the external review target.
 // The external report does not state the target fiscal year, so neither duplicate it nor invent a merge.
 const held:Record<number,string[]>={2017:['鉄道利用促進事業','川井地域バス運行管理事業','路線バス利用促進事業'],2018:['浸水常襲対策事業','防災資機材等整備事業'],2019:['地域自治組織活動支援事業']};
 return out.filter(p=>!held[year]?.includes(p.projectName));
}
