import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, mergeReprints } from './g1-util';

const DOCS = new Set(['3503e0fc2e52500a05edfc44', '531a9e0ceeb9d3d8842c38ca', '5b6619372515598cc9642bc0']);
const SHEET = /事務事業評価シート\n\n令和7年度\n基\n\n事務事業名\n\n所管部署名\n\n([^\n]+)\n(?:([^\n]+)\n)?\n/g;
const COST_HEAD = '令和4年度\n\n令和5年度\n\n令和6年度\n\n決算(千円)\n\n決算(千円)\n\n決算(千円)\n\n予算(千円)\n\n決算(千円)\n\n増減額(千円)\n\n予算(千円)';
/** Already structured from the FY2025 result report (yoshikawa-supplement); not re-added. */
const SUMMARY_NAMES = new Set(['交通安全施設整備事業', '学校運営事業（小学校）', '学校運営事業（中学校）', '学校給食センター管理事業', '家庭教育推進事業', '給配水施設維持管理事業',
  '農業集落排水事業経営事業', '橋りょう架替事業', '社会教育推進事業（社会教育総務費）', '吉川駅北口駅前広場再整備事業', '越谷総合公園川藤線街路整備事業']);

export function extractYoshikawa(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11243' || !DOCS.has(input.sourceId) || !input.text.startsWith('事務事業評価シート')) return [];
  const t = input.text, heads = [...t.matchAll(SHEET)], out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const seg = t.slice(h.index!, heads[k + 1]?.index ?? t.length);
    const name = h[1] + (h[2] ?? '');
    // A wrapped title is accepted only when the joined name is printed unbroken elsewhere in the same sheet.
    if (h[2] && !seg.slice(h[0].length).includes(name)) return;
    if (SUMMARY_NAMES.has(name)) return;
    const no = seg.match(/\nNo\.\n[\s\S]{0,40}?\n(\d{8})\n/), dept = seg.match(/\n([^\n□☑ ]*(?:局|課|係|担当|委員会|室)[^\n□☑ ]*)\n\n事前評価責任者/);
    if (!no || !dept) return;
    const p = project(input, no[1], name, 2025, h[0].trimEnd(), h.index);
    p.department = dept[1]; p.evaluatedFiscalYear = 2025;
    p.evidence.push(evidence(input, no[1], h.index! + no.index! + no[0].lastIndexOf(no[1])), evidence(input, dept[1], h.index! + dept.index! + 1));
    const c = seg.match(/① 事業費\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n(△?[\d,]+)\n\n([\d,]+)\n/), head = seg.indexOf(COST_HEAD);
    const n = (s: string) => (s.startsWith('△') ? -1 : 1) * Number(s.replace(/[△,]/g, ''));
    if (c && head >= 0 && head < c.index! && n(c[5]) - n(c[3]) === n(c[6])) {
      const raw = seg.slice(head, c.index! + c[0].length - 1), rs = h.index! + head;
      [[1, 'actual', 2022], [2, 'actual', 2023], [3, 'actual', 2024], [4, 'budget', 2025], [5, 'actual', 2025], [7, 'budget', 2026]].forEach(([i, kind, fy]) =>
        p.amounts.push(amount(input, kind as 'actual' | 'budget', fy as number, c[i as number], '千円', raw, rs)));
      p.warnings.push('① 事業費の行を列見出し（令和4〜6年度決算・令和7年度予算・決算・増減額・令和8年度予算）の順で読み、令和7年度決算−令和6年度決算＝増減額の検算が一致した票のみ収録。間接経費・トータルコスト・人員は未収録。');
    } else p.warnings.push('事業費表は段組み崩れで列対応を検算できないため金額を収録していません。');
    p.warnings.push('評価シート表題「令和7年度」に合わせ、既存の吉川市詳細票と同じく評価年度・評価対象年度を2025年度とした。指標・評価点は未構造化。既存の結果報告書から構造化済みの事業名は除外。');
    out.push(p);
  });
  return mergeReprints(out, p => p.projectCode!);
}
