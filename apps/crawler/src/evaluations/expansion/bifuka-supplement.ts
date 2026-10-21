import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
export function extractBifukaSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='01469'||input.sourceId!=='80545387968c1eae1ca1ce8e')return [];
 const out:ProjectEvaluation[]=[];const header=input.text.match(/３ 次 評 価 ２次評価 １ 次 評 価 R７実績額 担当 事業の検証[^]*?結果 状況 状況 果 方法 課題/);if(!header)return [];
 for(const m of input.text.matchAll(/(?:^| )(\d{3}) ([^\s]+) ([\d,]+) ([^\s]+) ([A-D]) ([A-D]) ([A-D]) ([A-D]) ([A-D]) ([A-D]) (現状維持|規模拡大|見直し|事業完了|規模縮小|休止|廃止)(?=\n|$)/gm)){
  const raw=m[0].trimStart(),offset=m.index!+m[0].length-raw.length;
  const p=project(input,m[1],m[2],2026,raw,offset);p.evaluatedFiscalYear=2025;p.department=m[4];p.evidence.push(evidence(input,input.text.slice(0,180),0),evidence(input,header[0],header.index));
  p.amounts.push({kind:'actual',fiscalYear:2025,amountYen:Number(m[3].replaceAll(',',''))*1000,rawValue:m[3],rawUnit:'千円',evidence:evidence(input,raw,offset)});
  p.ratings.push({kind:'self',label:'事業評価',value:m[10],scale:null,evidence:evidence(input,raw,offset)},{kind:'self',label:'今後の方向性',value:m[11],scale:null,evidence:evidence(input,raw,offset)});
  p.warnings.push('下位事務事業番号から始まる完整行のみ。左側の主要施策・政策の評定は付与しない。事業評価のA-D定義は上位施策の尺度を流用しない。');out.push(p);
 }
 const partial=input.text.match(/411 ほっとプラザスマイル運営事業 20,031 保健福祉 現状維持/);
 if(partial){const p=project(input,'411','ほっとプラザスマイル運営事業',2026,partial[0],partial.index);p.evaluatedFiscalYear=2025;p.department='保健福祉';p.evidence.push(evidence(input,input.text.slice(0,180),0),evidence(input,header[0],header.index));p.amounts.push({kind:'actual',fiscalYear:2025,amountYen:20031000,rawValue:'20,031',rawUnit:'千円',evidence:evidence(input,partial[0],partial.index)});p.ratings.push({kind:'self',label:'今後の方向性',value:'現状維持',scale:null,evidence:evidence(input,partial[0],partial.index)});p.warnings.push('事業411のA-D評定は同一行にないため未割当。');out.push(p);}
 return out;
}
