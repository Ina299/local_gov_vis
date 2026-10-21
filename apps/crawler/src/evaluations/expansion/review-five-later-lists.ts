import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
export function extractReviewFiveLaterLists(input:CachedInput,inputs:CachedInput[]=[]):ProjectEvaluation[]{
 const out:ProjectEvaluation[]=[];
 if(input.municipalityCode==='11232'&&input.sourceId==='70581de7069cb530ee1fac2b'){
  for(const m of input.text.matchAll(/^([０-９]+) (.+?) \d+ \d+ [○-] ([^ \n]+) (現状維持|改善|拡大|縮小|廃止・終了)$/gm)){
   const no=Number(m[1].normalize('NFKC'));if(no<=64)continue; // 1–64 are represented by the frozen individual-sheet extractor (63 after merged reprint).
   const p=project(input,`summary:${no}`,m[2],2023,m[0],m.index);p.department=m[3];p.ratings.push({kind:'self',label:'今後の方向性',value:m[4],scale:null,evidence:evidence(input,m[0],m.index)});p.evidence.push(evidence(input,input.text.slice(0,200),0));p.warnings.push('個別シート保存範囲後の一覧65番以降。評価年度2023、対象実績年度は一覧に明記されず未確定。費用・活動・成果の個票項目は未取得。');out.push(p);
  }
 }
 if(input.municipalityCode==='32202'&&input.sourceId==='c8a2d61f5dce19995e435429'){
  for(const m of input.text.matchAll(/^(\d+) (.+?) ([^ \n]+(?:部|支所|事務局|課)) (?:(.+?) )?([ＡＢＣＤＥ]) (H\d+|－)$/gm)){
   const p=project(input,`list:${m.index}`,m[2],2018,m[0],m.index);p.department=m[3]+(m[4]?' '+m[4]:'');p.ratings.push({kind:'self',label:'総合評価（一覧）',value:m[5],scale:'A拡大 / B現状維持 / C縮小 / D手法見直し / E休・廃止',evidence:evidence(input,m[0],m.index)});
   const start=input.text.indexOf('(4) 評価結果一覧');p.evidence.push(evidence(input,input.text.slice(0,70),0),evidence(input,input.text.slice(start,start+95),start));p.warnings.push('一覧の評価と名称・所管のみ。末尾の目標年度H31等を実績年度へ転用しない。文字化けを含む別冊の個票から補完していません。');out.push(p);
  }
 }
 if(input.municipalityCode==='13102'&&input.sourceId==='dad5034c4d31b21aa495146f'&&input.text.includes('令和５年度 主要な施策の成果 行政評価')){
  const header='大事業名 決算額 主な実施内容 （行政評価ページ）';
  for(const m of input.text.matchAll(/^(.+?事業(?:（[^）]+）)?) ([\d,]+) 円([^\n]*)$/gm)){
   const p=project(input,m[1],m[1],null,m[0],m.index);p.evaluatedFiscalYear=2023;
   p.amounts.push({kind:'actual',fiscalYear:2023,amountYen:Number(m[2].replaceAll(',','')),rawValue:m[2],rawUnit:'円',evidence:evidence(input,m[0],m.index)});
   p.evidence.push(evidence(input,'令和５年度 主要な施策の成果 行政評価'),evidence(input,header));p.warnings.push('主要な施策の成果の事業一覧・決算額の部分レコード。実施内容の折返しは結合せず、指標・評価本文はリンク先ページ未保存のため未構造化。');out.push(p);
  }
 }
 if(input.municipalityCode==='34209'&&input.sourceId==='882e284c09423483f05564fd'){
  const header='令和7年度評価対象事業一覧';const end=input.text.indexOf('項目別 評価事務事業数');
  const missing=new Set([12,24,41,48,74,94,97,107,116,145,146]);
  for(const m of input.text.slice(0,end).matchAll(/(?:^| )(\d{1,3}) (.+?) ([^ \n]+課)(?= \d{1,3} |$)/gm)){
   if(!missing.has(+m[1]))continue;const p=project(input,m[1],m[2],2025,m[0],m.index);p.department=m[3];p.evidence.push(evidence(input,header));p.warnings.push('保存済み個票にない事業を評価対象一覧から名称・所管・評価年度のみ部分収録。2次評価本文は横列混在のため親施策評価や近接行の数値を転記しない。');out.push(p);
  }
 }
 if(input.municipalityCode==='34209'){
  const external=inputs.find(s=>s.sourceId==='446b28e05121f4e08ad40530'&&s.municipalityCode==='34209');
  if(external){const headings=[...external.text.matchAll(/^[⑴⑵⑶⑷⑸⑹⑺⑻] ([^\n]+)$/gm)];
   for(let i=0;i<headings.length;i++){const h=headings[i];const p=out.find(p=>p.projectName.normalize('NFKC').replace(/\s/g,'')===h[1].normalize('NFKC').replace(/\s/g,''));if(!p)continue;
    const raw=external.text.slice(h.index!,headings[i+1]?.index??external.text.length).trimEnd();p.evidence.push(evidence(external,raw,h.index),evidence(external,external.text.slice(0,100),0));p.outcomes=raw;p.warnings.push('同じ令和7年度の外部委員会が名指しした事業意見を追加根拠として統合。外部資料を別事業件数として重複計上しない。');
   }
  }
 }
 return out;
}
