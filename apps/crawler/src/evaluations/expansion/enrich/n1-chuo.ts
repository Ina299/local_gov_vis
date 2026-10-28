/**
 * 中央区 令和5年度（令和4年度分）主要な施策の成果・行政評価の基本政策別冊子から、公開済みの「主要な施策の成果」一覧（63事業）の
 * レコードを補強する事業別行政評価シートの部課名と、行政コスト計算書の人件費（令和3年度A・令和4年度B、差額B-Aで検算）を構造化する。
 * シートの特定は batch7（g1-chuo）と同じく目次の事業番号・事業名・掲載頁で行い、一覧にない事業（g1 で公開済み）は対象外。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, nfkc, sheets } from '../batch7/g1-util';
import type { Entry } from '../batch9/i1-util';

const SHEET = '令和５年度（令和４年度分） 事業別行政評価シート';
/** Per-policy volumes of the FY2023 report (the combined volume is a reprint and is not used). */
const VOLUMES = new Set(['cce8f4525d530f4f791ba73f', 'f9560252cff493e89098020f', '97b70ea1402670322396109a', '015b9b8aba12634ce3318960', 'f94de717291d51c6ce6f2b08',
  '85d83b8bd4012bfeab354f05', 'a6ac9793dceda26e3553c9f0', '76857a97e4d32427a01a0cf9', '27c9658276acf4dc2e59a1af', 'aa765b169fba1a1c56f77297']);
const SUMMARY_ID = 'dad5034c4d31b21aa495146f';

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '13102' || !VOLUMES.has(input.sourceId) || !/^(?:基本政策[１-９]|区政運営)\n/.test(input.text)) return [];
  const summary = inputs.find(i => i.sourceId === SUMMARY_ID && i.text.includes('令和５年度 主要な施策の成果 行政評価'));
  if (!summary) return [];
  // Only the businesses of the summary table: their published records come from the table and lack the sheet.
  const listed = new Set([...summary.text.matchAll(/^(.+?事業(?:（[^）]+）)?) ([\d,]+) 円([^\n]*)$/gm)].map(m => nfkc(m[1])));
  const t = input.text, pages = sheets(t, SHEET), out: ProjectEvaluation[] = [];
  for (const toc of t.matchAll(/^【(\d+)】(.+?)\n?・{2,}[・ ]*(\d+)$/gm)) {
    const name = toc[2].replace(/（新規）$/, '');
    if (!listed.has(nfkc(name))) continue;
    const found = pages.filter(s => s.text.includes(`－ ${toc[3]} －`));
    if (found.length !== 1) continue;
    const sheet = found[0], head = sheet.text.slice(0, sheet.text.indexOf('１ 事業の目的'));
    const dept = sheet.text.match(/^.+\n\n部課名\n\n([^\n]+)\n/);
    if (!dept || !nfkc(head).includes(nfkc(name))) continue;
    const pc = sheet.text.match(/人件費\n\n(?:（単位：円）\n)?令和３年度\nA\n(△?[\d,]+)\n\n(?:物件費\n\n)?令和４年度\nB\n(△?[\d,]+)\n\n差額\nB-A\n(△?[\d,]+)\n/);
    const signed = (s: string) => (s.startsWith('△') ? -1 : 1) * Number(s.replace(/[△,]/g, ''));
    const p = project(input, `【${toc[1]}】`, name, 2023, toc[0], toc.index);
    p.department = dept[1]; p.evaluatedFiscalYear = 2022;
    p.evidence.push(evidence(input, sheet.text.slice(0, dept[0].length), sheet.start));
    if (pc && signed(pc[2]) - signed(pc[1]) === signed(pc[3]) && !pc[1].startsWith('△') && !pc[2].startsWith('△')) {
      p.amounts.push(amount(input, 'personnel', 2021, pc[1], '円', pc[0], sheet.start + pc.index!), amount(input, 'personnel', 2022, pc[2], '円', pc[0], sheet.start + pc.index!));
    }
    p.warnings.push('目次の事業番号・事業名・掲載頁で事業別行政評価シートを特定し、シート冒頭に同じ名称があることを確認。人件費は行政コスト計算書（発生主義）の令和3年度A・令和4年度Bで、差額B-Aの検算が一致した場合のみ収録。');
    out.push(p);
  }
  return out;
}

export const chuoEntry: Entry = {
  extract,
  scope: '中央区 令和5年度（令和4年度分）主要な施策の成果・行政評価の基本政策別冊子の事業別行政評価シートのうち、主要な施策の成果一覧にある事業について、部課名と検算が一致した行政コスト計算書の人件費（令和3・4年度、円）を構造化（公開済みレコードの補強用）。合本PDF、関連データ・総括本文は対象外。',
};
