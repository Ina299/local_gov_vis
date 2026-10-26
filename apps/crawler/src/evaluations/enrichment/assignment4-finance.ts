import type{Slice}from'./assignment4';
export interface AmountCandidate{kind:'personnel'|'fullCost';fiscalYear:number;rawValue:string;rawUnit:'千円';amountYen:number;quote:string;start:number}
/** Only closed, full-width rows under explicit year/type/unit headers. Future and estimated columns are omitted. */
export function financialFields(code:string,s:Slice):AmountCandidate[]{
 const out:AmountCandidate[]=[];const num='[0-9][0-9,]*';
 const add=(kind:AmountCandidate['kind'],rawValue:string,year:number,quote:string,start:number)=>out.push({kind,fiscalYear:year,rawValue,rawUnit:'千円',amountYen:Number(rawValue.replaceAll(',',''))*1000,quote,start:s.start+start});
 if(code==='08210'){
  const header='事業費（千円） R5決算額 R6決算額 R7予算額 R8予定額 R9予定額';const start=s.text.indexOf(header);if(start<0)return out;
  const end=s.text.indexOf('\n３．',start);if(end<0)return out;const quote=s.text.slice(start,end);
  for(const [label,kind]of[['総事業費','fullCost'],['概算人件費','personnel']]as const){const m=quote.match(new RegExp('^'+label+' ('+num+') ('+num+') ('+num+') ('+num+') ('+num+')$','m'));if(!m)continue;for(let i=0;i<2;i++)add(kind,m[i+1],2023+i,quote,start);}
 }
 if(code==='13203'){
  const header='■コスト 単位：千円\n区 分 令和5年度決算 令和6年度決算 令和7年度決算見込 令和8年度予算';const start=s.text.indexOf(header);if(start<0)return out;
  const tail=s.text.slice(start);const total=tail.match(new RegExp('^支 出 額 計 ('+num+') ('+num+') ('+num+') ('+num+')$','m'));if(!total)return out;const quote=tail.slice(0,total.index!+total[0].length);
  for(let i=0;i<2;i++)add('fullCost',total[i+1],2023+i,quote,start);
  const personnel=quote.match(new RegExp('^歳 出 人件費 再任用職員 [0-9.]+人 ('+num+') [0-9.]+人 ('+num+') [0-9.]+人 ('+num+') [0-9.]+人 ('+num+')$','m'));
  if(personnel)for(let i=0;i<2;i++)add('personnel',personnel[i+1],2023+i,quote,start);
 }
 return out;
}
