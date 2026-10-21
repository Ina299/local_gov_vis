/** Batch-9 (i0) extractor for 品川区: 事務事業評価シート (truncated full-ward PDFs) and the 最終評価一覧 in the 評価結果 reports. */
import type { EvaluationAmount, EvaluationRating, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';
import { BASE_WARNING, MERGE_NOTE, norm, toNum, type Entry } from '../batch8/h3-util';

/** Full-ward sheet PDFs (stored text is truncated at 120,000 characters, so only the first sheets are present). */
const SHEET_DOCS = new Set(['9eb90ec1fb385e036522db72', 'f2f5d70c8fda693de8b66d25', 'd4437b658bdd151b330e4187']);
/** 評価結果 reports: R7 (令和6年度実施事業) and R6 (令和5年度実施事業) 最終評価一覧. */
const LIST_R7 = 'b49100cf98cdf4202aac746a';
const LIST_R6 = 'dca1d31e4f3d796015941964';

const SCALE = 'Ａ：拡大する事業／Ｂ：継続する事業／Ｃ：改善・見直しする事業／Ｄ：完了・中止・廃止する事業（品川区の評価基準）';
const DIRECTIONS = '新規の取組み|対象・規模等の拡大|法定受託事務・法定扶助費等|計画・規定どおり|現状維持|手法等の改善|対象・規模等の見直し|取組みの一部廃止|事業の完了|事業の廃止等に向けた検討|事業の廃止|事業移管・統合';
const BUDGET_ROWS = ['需用費', '役務費', '委託料', '使用料及び賃借料', '工事請負費', '備品購入費', '負担金補助及び交付金', 'その他', '計'];
const NOT_NAME = /^(会計|目|款|項|事業|予算科目|担当部署|担当課|担当係|一般会計|.*特別会計|[０-９\d]+|（.*）)$/;
const reiwa = (s: string) => 2018 + Number(s.normalize('NFKC'));

type Sheet = { record: ProjectEvaluation; fy: number; finalLetter: string | null };
type Row = { record: ProjectEvaluation; fy: number; letter: string; key: string };

/** 予算・決算（概要）: every 節 row and 計 must carry the same column count, and the 節 rows must sum to 計 (予算現額 and 決算額). */
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
    if (![2, 3, 5].includes(k) || groups.some(g => g.values.length !== k)) continue;
    if (groups.some(g => g.values.slice(0, Math.min(k, 4)).some(v => v.endsWith('%')))) continue;
    const total = groups.at(-1)!, rows = groups.slice(0, -1);
    const sum = (i: number) => rows.reduce((s, g) => s + toNum(g.values[i]), 0);
    const budget = toNum(total.values[0]), actual = toNum(total.values[1]);
    if (sum(0) !== budget || sum(1) !== actual || actual > budget) continue;
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

function sheets(input: CachedInput): Sheet[] {
  const text = input.text, out: Sheet[] = [];
  const heads = [...text.matchAll(/令和 ?(\d+)年度 (事務事業|行政)評価シート\n小事業名\n/g)];
  heads.forEach((h, i) => {
    const start = h.index!, seg = text.slice(start, i + 1 < heads.length ? heads[i + 1].index! : text.length);
    // A sheet cut off by the stored-text limit (no 最終評価) is not structured.
    if (!seg.includes('(2)最終評価')) return;
    const isNew = h[2] === '事務事業';
    const implemented = [...seg.matchAll(/（令和 ?(\d+)年度実施事業）/g)];
    if (isNew && (!implemented.length || implemented.some(m => m[1] !== implemented[0][1]))) return;
    const fy = isNew ? reiwa(implemented[0][1]) : reiwa(h[1]);
    let nameAt = -1, name = '';
    const first = /^小事業名\n\n([^\n]+)\n/.exec(seg.slice(h[0].length - '小事業名\n'.length));
    if (first && !NOT_NAME.test(first[1].trim())) { name = first[1].trim(); nameAt = start + h[0].length + 1; }
    else if (implemented.length) {
      const m = /（令和 ?\d+年度実施事業）\n\n([^\n]+)\n/.exec(seg);
      if (m && !NOT_NAME.test(m[1].trim())) { name = m[1].trim(); nameAt = start + m.index! + m[0].indexOf('\n\n') + 2; }
    }
    if (!name) return;
    const headRaw = isNew ? `${h[0].trimEnd()}` : h[0].slice(0, h[0].indexOf('\n'));
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
      '保存済みテキストは12万字で打ち切られているため、全庁版シートの冒頭部分の事業のみ構造化。指標表・行政コスト計算書・貸借対照表は列の対応が崩れているため未構造化。',
      '予算・決算は「計」行の予算現額（budget）・決算額（actual）のみ。各節行の合計が計と一致する場合に限り記録。'];
    if (!isNew) p.warnings.push('「令和4年度 行政評価シート」は対象年度（令和4年度。財務情報の4年度(B)と同じ）として evaluatedFiscalYear に記録。評価実施年度は本資料に明記がないため null。');
    if (!depts.length || depts.length > 1) p.warnings.push('担当課は列配置が崩れて確定できないため未設定。');
    out.push({ record: p, fy, finalLetter: fin ? fin.value[0] : null });
  });
  return out;
}

function listRows(input: CachedInput): Row[] {
  const text = input.text, rows: Row[] = [];
  const r7 = input.sourceId === LIST_R7;
  const fyHead = /６５２事業（令和6年度実施事業）|６６９事業（令和５年度実施事業）/.exec(text);
  if (!fyHead) return [];
  const fy = r7 ? 2024 : 2023;
  const yearEvidence = evidence(input, fyHead[0], fyHead.index);
  const evalHead = r7 ? /令和7年度事務事業評価の結果/.exec(text) : null;
  const re = r7
    ? new RegExp(`\\n(\\d{1,3})(?:\\n\\n| )([^\\n◆]+)(?:\\n([^\\n◆]+))?\\n\\n([^\\n◆]+)\\n\\n([ＡＢＣＤ][︓：](?:${DIRECTIONS}))(?=\\n| )`, 'g')
    : new RegExp(`\\n(\\d{1,3})(?: |\\n\\n)([^\\n◆ＡＢＣＤ：]+?)(?:\\n\\n| )([ＡＢＣＤ]：(?:${DIRECTIONS}))(?=\\n| |$)`, 'g');
  const bureaus = r7 ? [] : [...text.matchAll(/部局名：([^\n]+)\n/g)];
  let lastNo = 0, lastBureau = '';
  for (const m of text.matchAll(re)) {
    const no = Number(m[1]);
    let name: string, dept: string | null, value: string;
    if (r7) {
      name = m[4].trim(); dept = (m[3] ?? m[2]).trim(); value = m[5];
      if (no <= lastNo) continue;
    } else {
      name = m[2].trim(); value = m[3];
      const bureau = bureaus.filter(b => b.index! < m.index!).at(-1);
      if (!bureau) continue;
      dept = bureau[1].trim();
      // Names wrapped over several lines leave a fragment on the line before the number or right after the rating.
      const lineStart = text.lastIndexOf('\n', m.index! - 1) + 1, prev = text.slice(lineStart, m.index!);
      const prevBlank = lineStart >= 2 && text.slice(lineStart - 2, lineStart) === '\n\n';
      if (prev && !prev.startsWith('◆') && !prev.endsWith('。') && prev.length <= 15 && prevBlank) continue;
      const lineEnd = text.indexOf('\n', m.index! + m[0].length), next = lineEnd < 0 ? '' : text.slice(lineEnd + 1, text.indexOf('\n', lineEnd + 1));
      if (next && !next.startsWith('◆') && next.length <= 6) continue;
      if (name.startsWith('（') && !name.includes('）')) continue;
      if (dept !== lastBureau) { lastBureau = dept; lastNo = 0; }
      if (no <= lastNo) continue;
    }
    if (NOT_NAME.test(name) || /^(事業名|所属|説明|最終評価)/.test(name) || /[︓：]/.test(name) || (dept && /[︓：]/.test(dept))) continue;
    lastNo = no;
    const raw = m[0].slice(1);
    const p = project(input, `list-${no}-${name}`, name, r7 ? 2025 : null, raw, m.index! + 1);
    p.projectCode = null; p.department = dept; p.evaluatedFiscalYear = fy;
    p.evidence.push(yearEvidence);
    if (evalHead) p.evidence.push(evidence(input, evalHead[0], evalHead.index));
    p.ratings.push({ kind: 'self', label: '最終評価および今後の取組の方向性', value, scale: SCALE, evidence: evidence(input, raw, m.index! + 1) });
    p.warnings = [BASE_WARNING,
      '最終評価一覧（部局別）の行のみ構造化。行が崩れて番号・事業名・評価が隣接しない箇所、事業名が改行で分かれた箇所は除外。説明（抜粋）・削減額は未構造化。',
      r7 ? '担当は一覧の「所属」の課（課のない部局は部局名）。' : '担当は一覧ページ見出し「部局名」の部局（課は一覧に記載なし）。評価実施年度は本資料に明記がないため null。'];
    rows.push({ record: p, fy, letter: value[0], key: `${fy}|${norm(name)}` });
  }
  return rows;
}

let memo: { inputs: CachedInput[]; records: ProjectEvaluation[] } | null = null;

function all(inputs: CachedInput[]): ProjectEvaluation[] {
  const sheetList = inputs.filter(i => SHEET_DOCS.has(i.sourceId)).flatMap(sheets);
  const rows = inputs.filter(i => i.sourceId === LIST_R7 || i.sourceId === LIST_R6).flatMap(listRows);
  // Same name repeated within one year's list (or across sheets) is ambiguous: every copy is dropped.
  const count = <T,>(xs: T[], k: (x: T) => string) => xs.reduce((m, x) => m.set(k(x), (m.get(k(x)) ?? 0) + 1), new Map<string, number>());
  const rowCount = count(rows, r => r.key), sheetCount = count(sheetList, s => `${s.fy}|${norm(s.record.projectName)}`);
  const out: ProjectEvaluation[] = [], usedRows = new Set<Row>();
  for (const s of sheetList) {
    const key = `${s.fy}|${norm(s.record.projectName)}`;
    if (sheetCount.get(key)! > 1) continue;
    const matches = rows.filter(r => r.key === key);
    matches.forEach(r => usedRows.add(r));
    if (matches.length === 1) {
      // Sheet and list are the same business/year: one record, list evidence appended; differing final letters drop both.
      if (s.finalLetter !== matches[0].letter) continue;
      s.record.evidence.push(matches[0].record.evidence[0]);
      s.record.warnings.push(MERGE_NOTE.replace('再掲（値一致）', '評価シートと最終評価一覧の再掲（最終評価の区分一致）'));
    }
    out.push(s.record);
  }
  for (const r of rows) if (!usedRows.has(r) && rowCount.get(r.key) === 1) out.push(r.record);
  return out;
}

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (!SHEET_DOCS.has(input.sourceId) && input.sourceId !== LIST_R7 && input.sourceId !== LIST_R6) return [];
  if (memo?.inputs !== inputs) memo = { inputs, records: all(inputs) };
  return memo.records.filter(p => p.evidence[0].sourceUrl === input.sourceUrl && p.evidence[0].sha256 === input.sourceSha256);
}

export const entries: Record<string, Entry> = {
  '13109': { extract, scope: '事務事業評価シート（全庁版PDFの保存テキスト冒頭部分のみ。事業名・担当課・予算現額/決算額の計・所管評価/最終評価）と、令和7年度・令和6年度評価結果報告の最終評価一覧（事業名・所属・最終評価区分）を構造化。政策評価、指標表、財務諸表、削減額、評価概要は対象外。' },
};
