import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

export function extractTakahashi(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '33209' || input.sourceId !== '799773e755687516961ef9a5') return [];
  const starts = [...input.text.matchAll(/^令和６年度 ⾼梁市事務事業評価シート/gm)];
  const result: ProjectEvaluation[] = [];
  for (let i = 0; i < starts.length; i++) {
    if (input.truncated && i === starts.length - 1) continue;
    const start = starts[i].index!;
    const raw = input.text.slice(start, starts[i + 1]?.index ?? input.text.length);
    const heading = raw.match(/事業番号 (\d+) 事 業 名 (.+?) 所 属 名 ([^\n]+)/);
    if (!heading || !raw.includes('Ⅲ 担当課の評価・改善')) continue;
    const record = project(input, heading[1], heading[2].normalize('NFKC'), 2024, raw, start);
    record.department = heading[3].normalize('NFKC');
    const purpose = raw.match(/事 業 の 目 的 ([\s\S]*?)\n事 業 の 対 象 者/);
    if (purpose) record.purpose = purpose[1].trim();
    const analysis = raw.match(/成果目標の実現に向けた活動実績の分析（効果・課題等）\n([\s\S]*?)\nⅢ 担当課の評価・改善/);
    if (analysis) record.outcomes = analysis[1].trim();
    const target = raw.match(/目標\(数値\) ([^\n]+)\n成果目標/);
    if (target && target[1].trim() !== '―' && target[1].trim() !== '－') record.indicators.push({
      name: `【成果指標】${target[1].normalize('NFKC')}`, fiscalYear: null, target: null, actual: null, unit: null,
      evidence: evidence(input, target[0], start + target.index!),
    });
    for (const [label, pattern] of [
      ['目的妥当性', /目 的 妥 当 性 (適切|改善の余地あり)/],
      ['有効性', /有 効 性 (適切|改善の余地あり)/],
      ['費用対効果', /費 用 対 効 果 (適切|改善の余地あり)/],
    ] as const) {
      const rating = raw.match(pattern);
      if (rating) record.ratings.push({ kind: 'self', label, value: rating[1], scale: null,
        evidence: evidence(input, rating[0], start + rating.index!) });
    }
    record.warnings.push('経費表は予算・決算の種別が明示されず人件費も概算のため、費用数値は本文証拠に保持しamountsへ未登録。');
    record.warnings.push('成果目標は複数年度・単位を含む原文の記述として保持し、単一年度の数値に変換していません。対象実績年度は複数年のため未確定。');
    result.push(record);
  }
  return result;
}
