import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** R7 Ogano sheets have interleaved left/right columns. Keep only unambiguous labels. */
export function extractOgano(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11365' || !input.text.includes('評価年度 令和 7 年度')) return [];
  const starts = [...input.text.matchAll(/^評価年度 令和 7 年度/gm)].map(m => m.index!);
  const results: ProjectEvaluation[] = [];
  for (let i = 0; i < starts.length; i++) {
    if (i === starts.length - 1 && input.truncated) continue;
    const start = starts[i]; const block = input.text.slice(start, starts[i + 1] ?? input.text.length);
    const nameLine = block.match(/^事業名称 (.+)$/m);
    if (!nameLine || !block.includes('【総合評価】')) continue;
    const nameText = nameLine[1].replace(/^[０-９\d]+\s+/, '');
    let name = nameText.split(/\s+/)[0];
    // A reviewed title wraps at a space inside its parenthetical former name.
    if (name.includes('（') && !name.includes('）')) {
      const end = nameText.indexOf('）');
      if (end < 0) continue;
      name = nameText.slice(0, end + 1);
    }
    if (!name || name.length < 3 || /^[\d０-９]/.test(name)) continue;
    const budget = block.slice(0, block.indexOf('事業期間')).match(/^(\d+) (\d{1,2}) (\d{1,2}) (\d{1,2}) (\d{1,2}) (.+)$/m);
    const code = budget ? budget[1] : `name:${name}`;
    const item = project(input, code, name, 2025, block, start);
    if (!budget) { item.projectCode = null; item.warnings.push('原典事業コード未確定。資料URLと名称から安定識別子を生成。'); }
    item.department = block.match(/^担当課所 ([^\s]+)(?: |$)/m)?.[1] ?? null;
    item.evidence.push(evidence(input,nameLine[0],start+nameLine.index!));
    const rating = block.match(/^外部評価結果\n(?:達成率[^\n]*\n)?(現状維持|事業拡大|事業内容見直し|事業自体見直し|他事業と統合検討|廃止した方がよい)\n/m);
    if (rating) item.ratings.push({kind:'external',label:'外部評価結果',value:rating[1],scale:null,evidence:evidence(input,rating[0],start+rating.index!)});
    const kpiStart=block.indexOf('【評価指標（ＫＰＩ）・実績値】');
    if(kpiStart>=0){
      const kpiEnd=block.indexOf('【定性評価】',kpiStart);
      const kpi=block.slice(kpiStart,kpiEnd>=0?kpiEnd:block.length);
      const label=kpi.match(/^項目 ([^\n]+)$/m);
      if(label)item.indicators.push({name:`【評価指標（ＫＰＩ）】${label[1]}`,fiscalYear:null,target:null,actual:null,unit:null,evidence:evidence(input,kpi,start+kpiStart)});
    }
    item.warnings.push('左右の欄が交互に抽出されているため概要・財源内訳の金額・KPI数値は転記しません。対象年度および活動/成果指標の区別は未確認。名称欄の隣接概要と担当課所欄の隣接説明を除外。名称中の括弧書きは保持。予算科目の列順は再構成せず、確認できた番号のみ事業コードとして保持。');
    results.push(item);
  }
  return results;
}
