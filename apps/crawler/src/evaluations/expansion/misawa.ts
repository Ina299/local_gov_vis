import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
const costSources=new Set(['6466f1c6c8d7f2626137021f','b1259e07068f5376531635ad','b39705de64cf65777b664aec']);
const oldNames=new Set(['乳児訪問指導事業','保育料軽減事業','防音工事助成事業','防災訓練の充実','防災施設の整備','農道整備事業','観光案内所の充実','物産販売促進事業','特産品の開発','道路除雪業務委託','放送番組の充実','電子広報の実施']);
/** Only complete inline identities; do not attach neighbouring, vertically interleaved comments. */
export function extractMisawa(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='02207'||input.format!=='pdf')return [];
 const rows:ProjectEvaluation[]=[];
 if(costSources.has(input.sourceId)){
  const header=input.text.match(/^平成([２-４０-９]+)年度 事務事業評価一覧表(?: 資料１)?\n平成([０-９]+)年度事業費 総合\n/);
  if(!header||!input.text.includes('事業費（フルコスト）＝人件費＋直接経費（国庫支出金、一般財源ほか）'))return [];
  const evaluationYear=1988+Number(header[1].normalize('NFKC')),fy=1988+Number(header[2].normalize('NFKC'));
  const pattern=/^(?:[0-9０-９]+ )?([0-9]{4}[A-Za-z]{2}[0-9]) ([^\s]+) ([^\s]+(?:事業|費|事務|推進|実施|設置|管理|運営|開催|策定|確保)) (?=.*¥[0-9,]+ [A-D] )[^\n]+/gm;
  for(const m of input.text.matchAll(pattern)){
   // These apparent tokens are middle or trailing pieces of wrapped titles.
   if(['のコミュニティ21推進事業','デイセンター運営費','福祉計画・介護保険事業'].includes(m[3]))continue;
   if(input.truncated&&m.index!+m[0].length>=input.text.lastIndexOf('\n'))continue;
   const cost=m[0].match(/¥([0-9,]+) ([A-D]) /);if(!cost)continue;
   const p=project(input,m[1],m[3],evaluationYear,m[0],m.index);p.department=m[2];p.evaluatedFiscalYear=fy;
   p.evidence.push(evidence(input,header[0],0));
   p.evidence.push(evidence(input,'事業費（フルコスト）＝人件費＋直接経費（国庫支出金、一般財源ほか）'));
   p.amounts.push({kind:'fullCost',fiscalYear:fy,amountYen:Number(cost[1].replaceAll(',','')),rawValue:cost[1],rawUnit:'円',evidence:evidence(input,m[0],m.index)});
   p.ratings.push({kind:'self',label:'一覧の総合評価（内部評価）',value:cost[2],scale:null,evidence:evidence(input,m[0],m.index)});
   p.warnings.push('横長一覧のうち事業コード・担当課・事業名・フルコスト・総合評価が同一行で確定する部分レコードのみ。行の前後に混在する取組状況・方向性理由は他事業との境界が未確定のため個別成果へ転用しない。費用は人件費込みで直接費と合算不可。');
   if(p.projectName==='家庭教育学級運営事業費')p.warnings.push('同年度同部署の同名に別事業コードが存在。1330Ca2は障がい児者の家族支援、3212Aa1は学校の家庭教育学級であり、同一事業とは統合しない。');
   rows.push(p);
  }
 }else if(input.sourceId==='e315ddeb274a8daf0768eb6f'&&input.text.startsWith('事務事業評価対象一覧（平成２０年度分）')){
  for(const m of input.text.matchAll(/^(\S+) (\d+) (\d+) (\d+) ([A-Z]) ([a-z]) (\d+) \d+ (\S+) \8 ([^\n]+)/gm)){
   if(!oldNames.has(m[8])||input.truncated&&m.index!+m[0].length>=input.text.lastIndexOf('\n'))continue;
   const grades=[...m[9].matchAll(/(?:^| )([A-DＡ-Ｄ])(?= |$)/g)];if(grades.length!==2)continue;
   const p=project(input,m.slice(2,8).join(''),m[8],null,m[0],m.index);p.department=m[1];p.evaluatedFiscalYear=2008;
   p.evidence.push(evidence(input,'事務事業評価対象一覧（平成２０年度分）',0));
   p.ratings=[{kind:'self',label:'自己評価',value:grades[0][1].normalize('NFKC'),scale:null,evidence:evidence(input,m[0],m.index)},
    {kind:'self',label:'内部評価',value:grades[1][1].normalize('NFKC'),scale:null,evidence:evidence(input,m[0],m.index)}];
   p.warnings.push('平成20年度分の一覧で主要事業名・事務事業名が同一の完全名称として同じ行に現れ、自己・内部の2評点が確定する行だけを部分構造化。評価実施年は推定せず、改行混在の活動・評価意見・費用は転記しない。');rows.push(p);
  }
 }
 return rows;
}
