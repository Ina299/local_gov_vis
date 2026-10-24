/**
 * Batch-12 (m3) extractor for 品川区: department-split 事務事業評価シート / 行政評価シート PDFs acquired in collection round 5
 * (令和7年度評価=令和6年度実施事業, 令和6年度評価=令和5年度実施事業, 令和4年度 行政評価シート).
 * The ward-wide 最終評価一覧 (already published) lists almost every business of these years, so every sheet whose business name and
 * period match a published record is excluded (regardless of department, because the 令和6年度 list carries only 部局名).
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EvaluationAmount, EvaluationDataset, EvaluationRating, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';
import { priorRecords } from '../run-context';
import { BASE_WARNING, toNum } from '../batch8/h3-util';
import type { Entry } from '../batch9/i1-util';
import { municipalityRecords } from '../batch11/k0-util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../..');
const norm = (s: string | null) => s?.normalize('NFKC').replace(/\s/g, '') ?? '';

/** Round-5 department sheet PDFs of 品川区 (collected-sources-batch11.json). */
const DOCS = new Set([
  '0423d11f4c963cc28ddaff40', '1458e3c1131529e6af2b8368', '20f287d5507c44d34b272a20', '241f886aeca3465141b3f4a1', '2a420c233f27823138b6abe4',
  '2cd486e26a9b4c908ffc5c7f', '2f13a2a3ddb5b2617098f610', '31d1b8fd5d5ca754a529274e', '4347503889b0afd7d6b671cc', '4691eca159b52b52bc7b0ef7',
  '50508363f442961f9c80208e', '51f650c7588ec494e2f92f69', '612954e066d876bf5e33a539', '6880572fc05d82ec64496578', '68f1eb0830a2b4c86f06599d',
  '6ea96bf1cefaa46d4c5db8de', '703243fdcc1cfcd226728b9e', '766513d87ddd24c928b50e6c', '7804d04245f51a8b720663a2', '81d81922def77145aecdeeb9',
  '8824bca8043ed1d7025c6207', '9df155f6ce044c77fe37b10a', 'a229f50a9ffd30d729833c58', 'be5b8de3040e96eb334605f8', 'bf2aaced8f349ecf5a07194f',
  'c1434b7208601e10d3755abf', 'c7015e662c59f355fcb6f16a', 'd7ce1eedadea660d1719704d', 'de7b01ce826ce61691656cb3', 'e36ca5bf4244caad6fcc444c',
  'ed2f979ecee853864a4e8c58', 'f16b2364c33d5cba6bfddb46', 'f2bae8c6335781d506ff8988', 'fbe93ceb8bf928f745e06df0',
]);

const SCALE = 'Ａ：拡大する事業／Ｂ：継続する事業／Ｃ：改善・見直しする事業／Ｄ：完了・中止・廃止する事業（品川区の評価基準）';
const BUDGET_ROWS = ['需用費', '役務費', '委託料', '使用料及び賃借料', '工事請負費', '備品購入費', '負担金補助及び交付金', 'その他', '計'];
const NOT_NAME = /^(会計|目|款|項|事業|予算科目|担当部署|担当課|担当係|一般会計|.*特別会計|[０-９\d]+|（.*）)$/;
const reiwa = (s: string) => 2018 + Number(s.normalize('NFKC'));

/** 予算・決算（概要）: every 節 row and 計 carry the same column count and the 節 rows sum to 計 (予算現額 and 決算額). */
function budgetTotals(seg: string, segStart: number): { budget: number; actual: number; raw: string; at: number } | null {
  const found: { budget: number; actual: number; raw: string; at: number }[] = [];
  for (const m of seg.matchAll(/予算科目（節）名\n予算現額\n決算額\n/g)) {
    const from = m.index! + m[0].length, end = seg.indexOf('決算額の主な内訳', from);
    if (end < 0) continue;
    const groups: { label: string; values: string[]; at: number; len: number }[] = [];
    let pos = from, ok = true;
    for (const line of seg.slice(from, end).split('\n')) {
      const t = line.trim();
      if (BUDGET_ROWS.includes(t)) groups.push({ label: t, values: [], at: pos, len: line.length });
      else if (/^-?[\d,]+$/.test(t) || /^[\d.]+%$/.test(t)) {
        const g = groups.at(-1);
        if (!g) { ok = false; break; }
        g.values.push(t); g.len = pos + line.length - g.at;
      } else if (t && !['翌年度繰越額', '不用額', '執行率', '（千円）'].includes(t)) { ok = false; break; }
      pos += line.length + 1;
    }
    if (!ok || groups.map(g => g.label).join() !== BUDGET_ROWS.join()) continue;
    const k = groups[0].values.length;
    if (![2, 3, 4, 5].includes(k) || groups.some(g => g.values.length !== k)) continue;
    if (groups.some(g => g.values.slice(0, Math.min(k, 4)).some(v => v.endsWith('%')))) continue;
    const total = groups.at(-1)!, rows = groups.slice(0, -1);
    const sum = (i: number) => rows.reduce((s, g) => s + toNum(g.values[i]), 0);
    const budget = toNum(total.values[0]), actual = toNum(total.values[1]);
    if (sum(0) !== budget || sum(1) !== actual || actual > budget) continue;
    // 4 columns: 予算現額・決算額・翌年度繰越額・不用額 (執行率 printed separately); 予算現額 must equal 決算額+繰越額+不用額.
    if (k === 4 && (total.values.some(v => v.endsWith('%')) || budget !== actual + toNum(total.values[2]) + toNum(total.values[3]))) continue;
    if (k === 5 && (!total.values[4].endsWith('%') || budget !== actual + toNum(total.values[2]) + toNum(total.values[3]))) continue;
    found.push({ budget, actual, raw: seg.slice(total.at, total.at + total.len), at: segStart + total.at });
  }
  if (!found.length || found.some(f => f.budget !== found[0].budget || f.actual !== found[0].actual)) return null;
  return found[0];
}

function rating(input: CachedInput, seg: string, segStart: number, head: '(1)所管評価' | '(2)最終評価', label: string): EvaluationRating | null {
  const re = new RegExp(`${head.replace(/[()]/g, '\\$&')}\\n【評価結果[^】\\n]*】\\n((?:◆[^\\n]*\\n)+)`, 'g');
  const ms = [...seg.matchAll(re)];
  if (!ms.length) return null;
  const value = ms[0][1].trim().split('\n').map(l => l.replace(/^◆/, '').trim()).join('／');
  if (ms.some(m => m[1] !== ms[0][1]) || !/^[ＡＢＣＤ] /.test(value)) return null;
  const raw = ms[0][0].replace(/\n$/, '');
  return { kind: 'self', label, value, scale: SCALE, evidence: evidence(input, raw, segStart + ms[0].index!) };
}

function one(input: CachedInput): ProjectEvaluation[] {
  if (!DOCS.has(input.sourceId)) return [];
  const text = input.text, out: ProjectEvaluation[] = [];
  const heads = [...text.matchAll(/令和 ?(\d+)年度 (事務事業|行政)評価シート\n小事業名\n/g)];
  heads.forEach((h, i) => {
    const start = h.index!, seg = text.slice(start, i + 1 < heads.length ? heads[i + 1].index! : text.length);
    if (!seg.includes('(2)最終評価')) return;
    const isNew = h[2] === '事務事業';
    const implemented = [...seg.matchAll(/（令和 ?(\d+)年度実施事業）/g)];
    if (isNew && (implemented.length !== 1)) return;
    if (!isNew && (implemented.length || !seg.includes('（小事業評価）'))) return;
    const fy = isNew ? reiwa(implemented[0][1]) : reiwa(h[1]);
    let nameAt = -1, name = '';
    const first = /^小事業名\n\n([^\n]+)\n/.exec(seg.slice(h[0].length - '小事業名\n'.length));
    if (first && !NOT_NAME.test(first[1].trim())) { name = first[1].trim(); nameAt = start + h[0].length + 1; }
    else if (implemented.length) {
      const m = /（令和 ?\d+年度実施事業）\n\n([^\n]+)\n/.exec(seg);
      if (m && !NOT_NAME.test(m[1].trim())) { name = m[1].trim(); nameAt = start + m.index! + m[0].indexOf('\n\n') + 2; }
    }
    if (!name) return;
    const headRaw = isNew ? h[0].trimEnd() : h[0].slice(0, h[0].indexOf('\n'));
    const p = project(input, `sheet-${start}`, name, isNew ? reiwa(h[1]) : null, headRaw, start);
    p.id = stableId(input, `sheet-${start}`, p.evaluationYear);
    p.projectCode = null;
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, name, nameAt));
    if (isNew) p.evidence.push(evidence(input, implemented[0][0], start + implemented[0].index!));
    const depts = [...new Set([...seg.matchAll(/担当課\n\n([^\n]+課)\n/g)].map(m => m[1]))];
    if (depts.length === 1) p.department = depts[0];
    const totals = budgetTotals(seg, start);
    if (totals) {
      const ev = evidence(input, totals.raw, totals.at);
      const amt = (kind: EvaluationAmount['kind'], v: number): EvaluationAmount => ({ kind, fiscalYear: fy, amountYen: v * 1000, rawValue: v.toLocaleString('en-US'), rawUnit: '千円', evidence: ev });
      p.amounts.push(amt('budget', totals.budget), amt('actual', totals.actual));
    }
    const own = rating(input, seg, start, '(1)所管評価', '所管評価'), fin = rating(input, seg, start, '(2)最終評価', '最終評価');
    if (own) p.ratings.push(own);
    if (fin) p.ratings.push(fin);
    p.warnings = [BASE_WARNING,
      '部局別の評価シートPDFから、事業名・担当課・予算現額/決算額の「計」・所管評価/最終評価のみ構造化。指標表・行政コスト計算書・貸借対照表は列の対応が崩れているため未構造化。',
      '予算・決算は「計」行の予算現額（budget）・決算額（actual）のみ（千円）。各節行の合計が計と一致する場合に限り記録。',
      '公表済みの最終評価一覧に同名・同年度の事業がある評価シートは重複を避けるため除外しており、本レコードは一覧に同名の行がない事業。'];
    if (!isNew) p.warnings.push('「令和4年度 行政評価シート（小事業評価）」は対象年度（令和4年度）として evaluatedFiscalYear に記録。評価実施年度は本資料に明記がないため null。');
    if (depts.length !== 1) p.warnings.push('担当課は列配置が崩れているか課名でないため未設定。');
    out.push(p);
  });
  return out;
}

// Published before this run (supplied by the runner), so a replay sees the same set.
const publishedRecords = (): ProjectEvaluation[] => priorRecords('13109');
/** Stricter than the import identity rule: same name and not-different period is excluded whatever the department. */
function overlapsPublished(p: ProjectEvaluation): boolean {
  return publishedRecords().some(old => {
    if (norm(old.projectName) !== norm(p.projectName)) return false;
    if (old.evaluatedFiscalYear !== null && p.evaluatedFiscalYear !== null) return old.evaluatedFiscalYear === p.evaluatedFiscalYear;
    if (old.evaluationYear !== null && p.evaluationYear !== null) return old.evaluationYear === p.evaluationYear;
    return true;
  });
}

const key = (p: ProjectEvaluation) => `${p.evaluatedFiscalYear}|${norm(p.projectName)}|${norm(p.department)}`;
const nameKey = (p: ProjectEvaluation) => `${p.evaluatedFiscalYear}|${norm(p.projectName)}`;
const ambiguousCache = new WeakMap<CachedInput[], Set<string>>();
/** The same business name printed on several sheets of one year (e.g. 審査支払手数料 in several 特別会計) cannot be told apart: all copies are dropped. */
function ambiguous(inputs: CachedInput[]): Set<string> {
  let found = ambiguousCache.get(inputs);
  if (found) return found;
  const counts = new Map<string, number>();
  for (const p of inputs.flatMap(one)) counts.set(nameKey(p), (counts.get(nameKey(p)) ?? 0) + 1);
  found = new Set([...counts].filter(([, c]) => c > 1).map(([k]) => k));
  ambiguousCache.set(inputs, found);
  return found;
}
function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (!DOCS.has(input.sourceId)) return [];
  const skip = ambiguous(inputs);
  return municipalityRecords(input, inputs, one, key).filter(p => !skip.has(nameKey(p)) && !overlapsPublished(p));
}

export const shinagawaEntries: Record<string, Entry> = {
  '13109': { extract, scope: '第5回取得の部局別 事務事業評価シート（令和7・6年度）と令和4年度 行政評価シート（小事業評価）から、事業名・担当課・予算現額/決算額の計・所管評価/最終評価を構造化。公表済みの最終評価一覧と同名・同年度の事業は除外。指標表・財務諸表・説明文は対象外。' },
};
