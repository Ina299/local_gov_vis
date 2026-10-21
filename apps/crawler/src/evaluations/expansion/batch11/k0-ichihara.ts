import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, type Entry } from '../batch9/i1-util';
import { municipalityRecords } from './k0-util';

// ---------------------------------------------------------------- 市原市（主要な施策の成果・事業シート集 / 事業シート（概要説明書））
const SHEET = '施策番号 実行計画番号 ｱｸｼｮﾝﾌﾟﾗﾝID 指標動向\n';
const COST = /〔単位：千円〕\n+令和(\d)年度\(予算\)\n+令和(\d)年度\(決算\)\n+令和(\d)年度\(決算\)\n+令和(\d)年度\(決算\)\n+合 計\n+([\d,]+)\n+([\d,]+)\n+([\d,]+)\n+([\d,]+)\n/;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function sheetsOf(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '12219') return [];
  const t = input.text, first = t.indexOf(SHEET);
  if (first < 0 || !t.includes('主要な施策の成果・事業シート集')) return [];
  const index = t.slice(0, first);
  const starts: number[] = [];
  for (let i = first; i >= 0; i = t.indexOf(SHEET, i + 1)) starts.push(i);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const body = t.slice(s + SHEET.length, starts[k + 1] ?? t.length), base = s + SHEET.length;
    const h = /^([^\n]*)\n(\d{7})\n+(?:\d{5}\n+)?事業シート（概要説明書）\n/.exec(body);
    if (!h) return;
    const code = h[2];
    // 事業名は索引（掲載事業一覧）の同じ実行計画番号の行から取り、シート1ページ目に同じ文字列の行があるものだけ採用する。
    const row = new RegExp(`${code}(?: |\\n+)([^\\n]+)\\n`).exec(index);
    if (!row) return;
    const name = row[1].trim(), page1 = body.slice(0, 1500), nameAt = page1.indexOf(`\n${name}\n`);
    if (nameAt < 0 || !/事業$|事務$|事業）$|プロジェクト$/.test(name)) return;
    const p = project(input, code, name, null, h[0].slice(0, -1), base);
    p.evidence.push(evidence(input, name, base + nameAt + 1), evidence(input, row[0].slice(0, -1), row.index));
    const dep = /\n担当部 (\S+)\n/.exec(page1);
    if (dep) { p.department = dep[1]; p.evidence.push(evidence(input, dep[0].slice(1, -1), base + dep.index + 1)); }
    const fy = /\n令和(\d)年度 事業内容（手段、手法、金額を含めた予算の執行内容など）/.exec(page1);
    if (fy) p.evaluatedFiscalYear = 2018 + Number(fy[1]);
    const c = COST.exec(body);
    const idxAmount = new RegExp(`${code}(?: |\\n+)${esc(row[1])}\\n+([\\d,]+)\\n`).exec(index);
    const years = c ? [c[1], c[2], c[3], c[4]].map(n => 2018 + Number(n)) : [];
    const consistent = c && idxAmount && idxAmount[1] === c[6] && years[0] === years[1] + 1 && years[1] === years[2] + 1 && years[2] === years[3] + 1
      && (!p.evaluatedFiscalYear || p.evaluatedFiscalYear === years[1]);
    if (c && consistent) {
      const raw = c[0].slice(0, -1), at = base + c.index;
      p.amounts.push(amount(input, 'budget', years[0], c[5], '千円', raw, at));
      for (let j = 1; j < 4; j++) p.amounts.push(amount(input, 'actual', years[j], c[5 + j], '千円', raw, at));
      p.evidence.push(evidence(input, idxAmount[0].slice(0, -1), idxAmount.index));
      p.evaluatedFiscalYear ??= years[1];
      p.warnings.push('金額はコスト内訳の「合 計」行（人件費を除く事業費、千円）。令和N年度(予算)は予算、令和N年度(決算)は実績として収録。索引の決算額と一致した票のみ収録し、人件費・総事業費は列の並びが抽出テキストで崩れているため未収録。');
    } else p.warnings.push('コスト内訳表の列の並びが抽出テキストで確定できない、または索引の決算額と一致しないため金額は未収録。');
    p.warnings.push('主要な施策の成果・事業シート集の事業シート（概要説明書）。評価対象年度は「令和N年度 事業内容」欄・決算列見出しによる。評価年度は本文に明記がないため未設定。活動・成果指標と事業の自己評価は表の列が抽出テキストで分離しているため未収録。');
    out.push(p);
  });
  return out;
}

export const ichiharaEntries: Record<string, Entry> = {
  '12219': {
    extract: (input, inputs) => municipalityRecords(input, inputs, sheetsOf, p => `${p.projectCode}:${p.evaluatedFiscalYear}`),
    scope: '主要な施策の成果・事業シート集（部局別）の事業シート（概要説明書）から、事務事業名・実行計画番号・担当部・評価対象年度と、索引の決算額と一致したコスト内訳の合計（予算・決算、千円）を構造化。指標・自己評価文・人件費は列崩れのため対象外。索引のみの資料と、同名・同番号で別の票と衝突する事業は対象外。',
  },
};
