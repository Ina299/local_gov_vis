import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** Detailed individual sheets, separate from legacy result-list records. */
export function extractShunanSupplement(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '35215' || input.format !== 'pdf' || input.sourceId === 'b0344c66ef6c1f4e47fd39aa') return []; // 2025 two finance projects already exist in the legacy result list.
  const headers = [...input.text.matchAll(/^令和([０-９]+)年度 事務事業評価表 （ 令和([０-９]+)年度実績 ）$/gm)];
  const records: ProjectEvaluation[] = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (input.truncated && i === headers.length - 1) continue;
    const raw = input.text.slice(h.index!, headers[i + 1]?.index ?? input.text.length).trimEnd();
    const title = raw.match(/^事務事業名 (.+?) 担当所属 (.+)$/m);
    if (!title || !raw.includes('改革効果（どのような効果が期待できるか）')) continue;
    const year = 2018 + Number(h[1].normalize('NFKC'));
    const assessed = 2018 + Number(h[2].normalize('NFKC'));
    const r = project(input, `${title[2]}:${title[1]}`, title[1], year, raw, h.index!);
    r.projectCode = null; r.department = title[2]; r.evaluatedFiscalYear = assessed;
    const tableHeader = raw.match(/^（単位：千円） (令和[^\n]+)$/m);
    const cols = tableHeader ? [...tableHeader[1].matchAll(/令和([０-９]+)年度 (決算|予算)/g)] : [];
    const amount = raw.match(/^事業費 ([\d,]+) ([\d,]+) ([\d,]+) ([\d,]+) ([\d,]+)$/m);
    if (cols.length === 5 && amount) for (let col = 0; col < 5; col++) {
      const fiscalYear = 2018 + Number(cols[col][1].normalize('NFKC'));
      if (fiscalYear !== assessed && fiscalYear !== year) continue;
      r.amounts.push({ kind: cols[col][2] === '決算' ? 'actual' : 'budget', fiscalYear, amountYen: Number(amount[col + 1].replaceAll(',', '')) * 1000, rawValue: amount[col + 1], rawUnit: '千円', evidence: evidence(input, amount[0], h.index! + amount.index!) });
    }
    const assessment = raw.indexOf('評価項目 評価 評価の理由');
    if (assessment >= 0) r.activities = '評価の理由・総合評価・今後の方向性（原文欄）\n' + raw.slice(assessment);
    r.warnings.push('詳細個票の部分構造化。旧結果一覧表とは抽出範囲が異なります。縦書き総合評価ラベルや指標列は推測せず原文保持。トータルコストを事業費に置き換えていません。');
    records.push(r);
  }
  return records;
}
