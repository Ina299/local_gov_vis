import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** Prospective new-project evaluations: adoption is not execution, and planned cost is not an actual/budget amount. */
export function extractMiyazaki(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '45201' || input.sourceId !== '00bffc12ac6d77d39d81192c' || input.format !== 'pdf') return [];
  const headers = [...input.text.matchAll(/^令和７年度 新規事業評価表\n/gm)];
  const results: ProjectEvaluation[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < headers.length; i++) {
    if (input.truncated && i === headers.length - 1) continue;
    const start = headers[i].index!;
    const raw = input.text.slice(start, headers[i + 1]?.index ?? input.text.length);
    const identity = raw.match(/^事務事業名 (.+?) 会計区分 (.+)$/m);
    const footer = raw.match(/^(\d+) \/ 113\s*$/m);
    if (!identity || !footer || !raw.includes('③評価（戦略推進会議）') || !raw.includes('②課題解決までのステップ（ロジックモデル）')) continue;
    const officialCode = raw.match(/^予算事業名 [^\n]+ 事業番号 (\d+)$/m)?.[1];
    const key = officialCode ?? `name:${identity[1]}`;
    if (seen.has(key)) throw new Error(`Duplicate Miyazaki project identity: ${key}`);
    seen.add(key);
    const item = project(input, key, identity[1], 2025, raw, start);
    item.department = raw.match(/^所管課 \d+ (.+?) 事業期間 /m)?.[1] ?? null;
    if (!officialCode) item.warnings.push('原典の事業番号は空欄。事務事業名から識別キーを生成。');
    item.warnings.push('新規事業の事前評価。採択は実施済み・決算済みを意味しません。複数将来年度の計画を対象とするため対象事業年度は未設定。総事業費は計画段階の金額で、予算・決算に変換していません。');
    const cost = raw.match(/^.*総事業費（千円）[^\n]*$/m);
    if (cost) item.evidence.push(evidence(input, cost[0], start + cost.index!));
    const rating = raw.match(/評価結果 (採択|不採択)(?=\n|$)/);
    if (rating) item.ratings.push({ kind: 'self', label: '新規事業評価（戦略推進会議）', value: rating[1], scale: null,
      evidence: evidence(input, rating[0], start + rating.index!) });
    // Two columns are unambiguous only when neither name wraps into the next line.
    const pair = raw.match(/^活 (.+?) 目標値 ([^\n]+?) 成 (.+?) 目標値 ([^\n]+)\n動 果\n/m);
    const years = '指標の内容 Ｒ８年度 Ｒ９年度 Ｒ１０年度 Ｒ１１年度 指標の内容 Ｒ８年度 Ｒ９年度 Ｒ１０年度 Ｒ１１年度';
    if (pair && raw.includes(years)) {
      for (const [label, name, values] of [['活動', pair[1], pair[2]], ['成果', pair[3], pair[4]]]) {
        const columns = values.trim().split(/\s+/);
        const complete = columns.length === 4 && columns.every(value => /^[\d,.]+$/.test(value));
        if (complete) {
          columns.forEach((value, column) => item.indicators.push({ name: `【${label}指標】${name}`, fiscalYear: 2026 + column,
            target: value, actual: null, unit: null, evidence: evidence(input, pair[0], start + pair.index!) }));
        } else item.indicators.push({ name: `【${label}指標】${name}`, fiscalYear: null, target: null, actual: null,
          unit: null, evidence: evidence(input, pair[0], start + pair.index!) });
      }
    }
    item.warnings.push('指標は左右の名称が改行せず確定する行のみ。4年度の目標列が全て数値で残る場合以外は数値と年度を未設定。実績欄は空欄であり目標を実績に転記しません。ロジックモデルの文章は列混在のため原文で保持。');
    results.push(item);
  }
  return results;
}
