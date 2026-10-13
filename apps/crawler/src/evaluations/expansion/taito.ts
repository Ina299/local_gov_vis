import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

export function extractTaito(input: CachedInput): ProjectEvaluation[] {
  if(input.municipalityCode!=='13106'||input.sourceId!=='d267cafeefb79fc2fed20372'||input.truncated)return [];
  const raw=input.text;
  if(!raw.startsWith('令和元年度 事務事業評価シート')||!raw.trim().endsWith('て、必要な見直しを図っていく。'))return [];
  const h=raw.match(/所 ([^\n]+)\n事務事業名 (.+?) 管 ([^\n]+)/);if(!h)return [];
  // 267 identifies the related RPA plan, not this parent administrative business.
  const p=project(input,'name:'+h[2],h[2],2019,raw,0);p.projectCode=null;p.department=h[1]+' '+h[3];p.evaluatedFiscalYear=2018;
  p.purpose=raw.match(/業 事業目的\n([\s\S]*?)\n概/)?.[1].replace('\nの ','').trim()??null;
  p.activities=raw.match(/要 ・行政評価の実施\n([\s\S]*?)\n委託の有無/)?.[0].replace(/\n委託の有無$/,'').replace(/^要 /,'').trim()??null;
  const finance=raw.match(/事 H28年度 H29年度 H30年度\n([\s\S]*?)\n課題及び/);
  if(finance)for(const [label,kind] of [['人にかかるコスト（人件費など）','personnel'],['総経費','fullCost']] as const){
    const row=finance[0].split('\n').find(s=>s.includes(label));const m=row?.match(/([\d,]+) ([\d,]+) ([\d,]+)$/);if(!m)continue;
    for(let y=0;y<3;y++)p.amounts.push({kind,fiscalYear:2016+y,amountYen:Number(m[y+1].replaceAll(',',''))*1000,rawValue:m[y+1],rawUnit:'千円',evidence:evidence(input,finance[0],finance.index)});
  }
  const indicators=raw.match(/R２年度 H28年度 H29年度 H30年度\n([\s\S]*?)\n務\n事 H28年度/);
  if(indicators){
    const patterns:[string,string,RegExp][]=[
      ['【活動指標】行政評価対象事業数','事業',/行政評価対象事業数 事業 - ([\d.]+) ([\d.]+) ([\d.]+) - -/],
      ['【活動指標】指定管理者施設管理評価委員会による評価の実施回数','回',/指定管理者施設管理評価委員会による\n回 1 ([\d.]+) ([\d.]+) ([\d.]+) - -\n評価の実施回数/],
      ['【成果指標】行政評価改善事業率（改善事業数／評価対象事業数）','％',/行政評価改善事業率（改善事業数／評\n％ 15\.0 ([\d.]+) ([\d.]+) ([\d.]+) - -\n価対象事業数）/],
      ['【成果指標】指定管理者施設管理評価(総合評価「適正」以上の合計数\/指定管理施設数)','％',/事 指定管理者施設管理評価\(総合評価「適\n％ 100 (\([\d.]+\)) ([\d.]+) ([\d.]+) - -\n正」以上の合計数\/指定管理施設数\)/],
    ];
    for(const [name,unit,pattern]of patterns){const m=indicators[0].match(pattern);if(!m)continue;for(let y=0;y<3;y++){
      // Parenthesized values may denote a special scope; retain in evidence only.
      if(m[y+1].startsWith('('))continue;
      p.indicators.push({name,unit,fiscalYear:2016+y,target:null,actual:m[y+1],evidence:evidence(input,indicators[0],indicators.index)});
    }}
  }
  for(const label of ['必要性','効率性','手段の適切性','目的達成度']){const m=raw.match(new RegExp(label+' ([1-5]) ([^\\n]+)'));if(m)p.ratings.push({kind:'self',label,value:m[1],scale:null,evidence:evidence(input,m[0],m.index)});}
  p.warnings.push('行政計画事業NO.267は関連計画「RPAの導入推進」の番号であるため事務事業番号へ転用しない。人件費・総経費を各原文区分で保持し、内訳合算や差引による直接費の推計は未実施。将来目標値・達成率、括弧付き実績(90.2)、今後の方向性の選択位置は未確定のため未登録。');
  return[p];
}
