/**
 * 福島県「重点事業等一覧（検索用エクセルファイル）」（令和６年度版・令和７年度版）。
 * 1行1事業の表。セル内改行がそのまま抽出テキストに出るため、欄区切り（タブ）の数で行を復元し、見出し行の欄名を確かめてから値を読む。
 *   令和７年度版: 欄数16の固定。「事業名」「部局名」「事業決算額」（万円表記）。事業番号・課室名は無い。
 *   令和６年度版: 先頭欄「№」の行ごとに区切る（末尾の空欄は省略されている）。「事業番号」が2か所（13・17欄）にあり、一致する行だけ採用。
 *     「部局名」「課室名」「予算額」「事業決算額」（万円表記）。
 * 金額は「1億4629万円」「9,999万円」の形で、億・万の位取りが読み取れる値だけを円に換算する（数字だけの値・「#N/A」・補正注記つき等は未収録）。
 * 「再掲」欄に印がある行、事業名が「（再掲）」で終わる行は他の行の再掲なので収録しない。PDF版の一覧・施策評価調書は対象外。
 */
import type { EvaluationAmount, ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { mergeReprints, nfkc, type Entry } from '../../evaluations/expansion/batch9/i1-util';

type Cell = { text: string; start: number };

const R7_TITLE = '令和７年度重点事業等一覧（検索用）';
const R7_HEADER = '政策\t施策\t取組\t事業名\t部局名\t';
const R6_TITLE = '令和６年度重点事業等一覧';
const R6_HEADER = '№\t政策\t施策\t';

function cells(line: string, start: number): Cell[] {
  const out: Cell[] = []; let pos = 0;
  for (const c of line.split('\t')) { out.push({ text: c, start: start + pos }); pos += c.length + 1; }
  return out;
}

/** 欄区切りの数が `tabs` に達するまで行を連結する（セル内改行の復元）。超えた行があれば null。 */
function fixedRows(text: string, from: number, tabs: number): Cell[][] | null {
  const rows: Cell[][] = []; let start = -1, n = 0, pos = from;
  for (const line of text.slice(from).split('\n')) {
    if (start < 0) { start = pos; n = 0; }
    n += (line.match(/\t/g) ?? []).length;
    pos += line.length + 1;
    if (n === tabs) { rows.push(cells(text.slice(start, pos - 1), start)); start = -1; }
    else if (n > tabs) return null;
  }
  return rows;
}

/** 「1億4629万円」「9,999万円」「999億円」を円に。位取りが確定しない表記は null。 */
function manYen(raw: string): number | null {
  const m = /^(?:(\d+|\d{1,3}(?:,\d{3})+)億)?(?:(\d+|\d{1,3}(?:,\d{3})+)万)?円$/.exec(raw);
  if (!m || (!m[1] && !m[2])) return null;
  const oku = m[1] ? Number(m[1].replace(/,/g, '')) : 0, man = m[2] ? Number(m[2].replace(/,/g, '')) : 0;
  if (m[1] && man >= 10000) return null;
  const yen = oku * 100_000_000 + man * 10_000;
  return Number.isSafeInteger(yen) && yen > 0 ? yen : null;
}

function yenAmount(input: CachedInput, kind: EvaluationAmount['kind'], fiscalYear: number, cell: Cell): EvaluationAmount | null {
  const yen = manYen(cell.text);
  if (yen === null) return null;
  return { kind, fiscalYear, amountYen: yen, rawValue: cell.text, rawUnit: '万円', evidence: evidence(input, cell.text, cell.start) };
}

const nameOf = (c: Cell) => c.text.replace(/\n/g, '').trim();
const isReprintName = (s: string) => /[（(]再掲[）)]$/.test(s);
const UNIT_NOTE = '金額は一覧の万円表記（億・万の位取り）をそのまま円に換算。万円未満は原表で丸められている。';

function r7(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith('【一覧検索用】\n' + R7_TITLE + '\n')) return [];
  const h = t.indexOf(R7_HEADER);
  if (h < 0) return [];
  const rows = fixedRows(t, h, 15);
  if (!rows) return [];
  const head = rows[0].map(c => c.text);
  if (head[3] !== '事業名' || head[4] !== '部局名' || head[13] !== '事業決算額') return [];
  const title = t.indexOf(R7_TITLE);
  const out: ProjectEvaluation[] = [];
  rows.slice(1).forEach((r, i) => {
    const name = nameOf(r[3]), dept = r[4].text.trim();
    if (!name || name === '#N/A' || isReprintName(name)) return;
    const p = project(input, `R7-${i + 1}-${nfkc(name)}`, name, null, r[3].text, r[3].start);
    p.evaluatedFiscalYear = 2025;
    p.evidence.push(evidence(input, R7_TITLE, title));
    if (/^[^\s#\-－]+(?:部|局|庁|本部)$/.test(dept)) { p.department = dept; p.evidence.push(evidence(input, r[4].text, r[4].start)); }
    const a = yenAmount(input, 'actual', 2025, r[13]);
    if (a) { p.amounts.push(a); p.warnings.push(`「事業決算額」欄（令和７年度重点事業等一覧）。${UNIT_NOTE}`); }
    else p.warnings.push(`「事業決算額」欄の値「${r[13].text}」は金額の位取りが確定しないため未収録。`);
    p.warnings.push('令和７年度重点事業等一覧（検索用エクセル）の1行。事業番号・課室名の欄は無い。評価年度は原表に印字されていないため未設定。');
    out.push(p);
  });
  return mergeReprints(out, p => `${nfkc(p.projectName)}|${p.department}`);
}

function r6(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith('【R6事業一覧】\n')) return [];
  const title = t.indexOf(R6_TITLE);
  const h = t.indexOf(R6_HEADER);
  if (title < 0 || h < 0) return [];
  const headEnd = t.indexOf('次年度以降の対応方針', h);
  if (headEnd < 0) return [];
  const head = cells(t.slice(h, headEnd + '次年度以降の対応方針'.length), h).map(c => c.text);
  const want: Record<number, string> = { 11: '再掲', 13: '事業番号', 16: '事業', 17: '事業番号', 18: '部局名', 19: '課室名', 68: '予算額', 69: '事業決算額' };
  if (Object.entries(want).some(([k, v]) => head[Number(k)] !== v)) return [];
  // 行頭が「番号<TAB>」の行で区切る。区切り誤りは事業番号2か所の一致で弾く。
  const body = headEnd;
  const starts = [...t.slice(body).matchAll(/(?<=\n)\d+\t/g)].map(m => body + m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    const e = starts[i + 1] ?? t.length + 1;
    const r = cells(t.slice(s, e - 1), s);
    if (r.length < 70) return;
    const code = r[13].text;
    if (!/^\d+-\d+-\d+$/.test(code) || r[17].text !== code) return;
    const name = nameOf(r[16]);
    if (!name || r[11].text === '再掲' || isReprintName(name)) return;
    const p = project(input, code, name, null, r[16].text, r[16].start);
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, R6_TITLE, title), evidence(input, r[17].text, r[17].start));
    const bu = r[18].text.trim(), ka = r[19].text.trim();
    if (/^[^\s\n]+(?:部|局|庁|本部)$/.test(bu) && /^[^\s\n]+(?:課|室|所|センター|局|部)$/.test(ka)) {
      p.department = `${bu} ${ka}`;
      p.evidence.push(evidence(input, r[18].text, r[18].start), evidence(input, r[19].text, r[19].start));
    }
    const b = yenAmount(input, 'budget', 2024, r[68]), a = yenAmount(input, 'actual', 2024, r[69]);
    if (b) p.amounts.push(b); else p.warnings.push(`「予算額」欄の値「${r[68].text}」は金額の位取りが確定しない（または注記つき）ため未収録。`);
    if (a) p.amounts.push(a); else p.warnings.push(`「事業決算額」欄の値「${r[69].text}」は金額の位取りが確定しないため未収録。`);
    p.warnings.push(`令和６年度重点事業等一覧（検索用エクセル）の1行。予算額・事業決算額は令和６年度の値として収録（一覧の表題による）。予算額が当初か補正後かは原表に明記がない。${UNIT_NOTE}評価年度は原表に印字されていないため未設定。`);
    out.push(p);
  });
  return mergeReprints(out, p => `${p.projectCode}|${nfkc(p.projectName)}`);
}

export const entries: Record<string, Entry> = {
  '07000': {
    scope: '重点事業等一覧（検索用エクセルファイル）令和６年度版・令和７年度版の事業行: 事業名・部局名（令和６年度版は課室名・事業番号も）・事業決算額（令和６年度版は予算額も、万円表記を円換算）。再掲行、PDF版の一覧、政策分野別・地域別の施策評価調書、総合計画進行管理資料は対象外。',
    extract: (input) => input.format === 'xlsx' ? [...r7(input), ...r6(input)] : [],
  },
};
