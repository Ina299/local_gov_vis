import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** R3 executed projects: consume complete individual sheets, never the 151-row summary. */
export function extractUonuma(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '15225' || input.format !== 'pdf' || !input.text.startsWith('令和３年度実施事業')) return [];
  const headers = [...input.text.matchAll(/【様式１】 第二次総合計画後期基本計画実施計画事業シート\n兼 事務事業評価シート/g)];
  const results: ProjectEvaluation[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < headers.length; i++) {
    if (input.truncated && i === headers.length - 1) continue;
    const start = headers[i].index!;
    const text = input.text.slice(start, headers[i + 1]?.index ?? input.text.length);
    if (!text.includes('9.事後評価（担当課評価）') || !/今後の方向性[^]*\n\d+\s*$/.test(text)) continue;
    const standard = text.match(/^事業№ (\d+(?:-\d+)?) 事業名 ([^\n]+)$/m);
    const alternate = text.match(/^(\d+) ([^\n]+)\n評価担当\n事業№ 事業名/m);
    const wrapped = text.match(/^([^\n]+) 部 [^\n]+\n事業№ (\d+(?:-\d+)?) 事業名\n評価担当\n([^\n]+) 課 /m);
    const code = standard?.[1] ?? alternate?.[1] ?? wrapped?.[2];
    const name = standard?.[2] ?? alternate?.[2] ?? (wrapped ? wrapped[1] + wrapped[3] : null);
    // Parent 116 has its own full sheet including the total. Do not count its two child sheets again.
    if (!code || !name || code.includes('-') || seen.has(code)) continue;
    seen.add(code);
    const record = project(input, code, name, null, text, start);
    record.evaluatedFiscalYear = 2021;
    record.department = text.match(/(?:^|\n)(?:[^\n]+ )?課 ([^\n]+)\n開始年度/)?.[1] ?? null;
    const purpose = text.match(/2\.事業目的（目指すすがた）、事業概要\n([^]*?)\n3\.総事業費/);
    if (purpose) record.purpose = purpose[1];
    const outcomes = text.match(/8\.事務事業の成果と課題\n([^]*?)\n9\.事後評価/);
    if (outcomes) record.outcomes = '成果と課題（原文欄）\n' + outcomes[1];
    const costs = text.match(/3\.総事業費 （単位：千円）\n年 度 Ｒ３ Ｒ４ Ｒ５ Ｒ６ Ｒ７ 合計 備考\n[^]*?(?=4\.指標の設定)/);
    const actual = costs?.[0].match(/^決 算 額 ([\d,]+)\n/m);
    if (costs && actual) {
      const amountYen = Number(actual[1].replaceAll(',', '')) * 1000;
      if (Number.isSafeInteger(amountYen)) record.amounts.push({ kind: 'actual', fiscalYear: 2021,
        amountYen, rawValue: actual[1], rawUnit: '千円', evidence: evidence(input, costs[0], start + costs.index!) });
    }
    record.warnings.push('予算表は複数年度の空欄位置が抽出本文から復元できないため予算額を変換しません。令和3年度実施の決算額のみ採用。指標の設定欄は活動・成果の区分未明示のため成果指標とは扱いません。');
    if (code === '116') record.warnings.push('枝番116-1（相談）・116-2（その他の事業）は親事業116の内訳。親の全件評価票と合計額のみ採用し枝番を独立事業として重複計上しません。');
    const rating = text.match(/総合評価\n([ＳＡＢＣＤ])\n事業評価 評 価 理 由/);
    if (rating) record.ratings.push({ kind: 'self', label: '総合評価', value: rating[1],
      scale: 'Ｓ：目標超過達成／Ａ：目標達成／Ｂ：相当程度進展あり／Ｃ：進展が大きくない／Ｄ：目標に向かっていない',
      evidence: evidence(input, rating[0], start + rating.index!) });
    results.push(record);
  }
  return results;
}
