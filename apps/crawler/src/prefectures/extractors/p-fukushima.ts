/**
 * 福島県「重点事業等一覧（検索用エクセルファイル）」（令和６年度版・令和７年度版）。
 * 1行1事業の表。セル内改行がそのまま抽出テキストに出るため、欄区切り（タブ）の数で行を復元し、見出し行の欄名を確かめてから値を読む。
 *   令和７年度版: 欄数16の固定。「事業名」「部局名」「事業決算額」（万円表記）。事業番号・課室名は無い。
 *   令和６年度版: 先頭欄「№」の行ごとに区切る（末尾の空欄は省略されている）。「事業番号」が2か所（13・17欄）にあり、一致する行だけ採用。
 *     「部局名」「課室名」「予算額」「事業決算額」（万円表記）。
 * 金額は「1億4629万円」「9,999万円」の形で、億・万の位取りが読み取れる値だけを円に換算する（数字だけの値・「#N/A」・補正注記つき等は未収録）。
 * 「再掲」欄に印がある行、事業名が「（再掲）」で終わる行は他の行の再掲なので収録しない。PDF版の一覧・施策評価調書は対象外。
 * 同じ行の文章欄も収録する: 「事業の概要」＝目的、「事業の進捗（活動実績）」＝活動、「事業の成果」（令和６年度版のみ）＝成果、
 * アウトプット・アウトカム指標（指標名・実績値・単位・その年度の指標値）、「達成状況」「次年度の対応方針」「次年度の見通し」
 * （令和７年度版は「次年度以降の対応方針」欄の＜R8年度の状況＞＜今後の方向性＞の見出し直後の1行）を評価として収録。
 * 「ー」「未設定」「該当なし」「#N/A」「同上」等の空欄扱いの値は収録しない。
 */
import type { EvaluationAmount, EvaluationIndicator, ProjectEvaluation } from '../../../../web/src/types/evaluation';
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

/** 空欄扱いの値（ダッシュ・未設定・該当なし・#N/A・同上・0 等）。 */
const BLANK = /^(?:[ー－―\-‐−]|0|#N\/A|該当なし|未設定|同上|なし|検討の結果設定しない)?$/;
const NO_VALUE = /^(?:[ー－―\-‐−]|#N\/A|未設定)?$/;

/** 欄の値（前後の空白を除く）と根拠。空欄扱いなら null。 */
function text(c: Cell, blank = BLANK): { value: string; start: number } | null {
  const v = c.text.trim();
  return blank.test(v) ? null : { value: v, start: c.start + c.text.indexOf(v) };
}

function fill(input: CachedInput, p: ProjectEvaluation, field: 'purpose' | 'activities' | 'outcomes', c: Cell) {
  const v = text(c);
  if (!v) return;
  p[field] = v.value;
  p.evidence.push(evidence(input, v.value, v.start));
}

/** 指標名・実績値・単位・指標値の欄（指標名から指標値までの連続した欄を根拠とする）。 */
function indicator(input: CachedInput, r: Cell[], name: number, actual: number, unit: number, target: number, fiscalYear: number | null): EvaluationIndicator | null {
  const n = text(r[name]);
  if (!n || /^\d+$/.test(n.value)) return null;
  const a = text(r[actual], NO_VALUE), t = text(r[target], NO_VALUE), u = text(r[unit]);
  if (!a && !t) return null;
  const raw = input.text.slice(r[name].start, r[target].start + r[target].text.length);
  return { name: n.value, fiscalYear, target: t?.value ?? null, actual: a?.value ?? null,
    unit: u && u.value.length <= 10 && !/\d/.test(u.value) ? u.value : null, evidence: evidence(input, raw, r[name].start) };
}

function rating(input: CachedInput, p: ProjectEvaluation, label: string, v: { value: string; start: number } | null) {
  if (!v || v.value.length > 40 || /\n/.test(v.value)) return;
  p.ratings.push({ kind: 'self', label, value: v.value, scale: null, evidence: evidence(input, v.value, v.start) });
}

/**
 * 行末の欄（次年度以降の対応方針）のセル内改行の続きは、欄区切りの数で行を復元すると次の行の先頭欄（政策）の前に入る。
 * 次の行の先頭欄の最後の改行までを行末の欄の続きとして連結する（原文で連続した範囲）。
 */
function lastCell(t: string, r: Cell[], next: Cell[] | undefined): Cell {
  const c = r[r.length - 1];
  const end = next ? next[0].start + next[0].text.lastIndexOf('\n') : t.length;
  return end > c.start + c.text.length ? { text: t.slice(c.start, end), start: c.start } : c;
}

/** 令和７年度版の文章欄（欄の位置は見出し行で確認済み）。 */
function texts7(input: CachedInput, p: ProjectEvaluation, r: Cell[], last: Cell) {
  fill(input, p, 'purpose', r[7]);
  fill(input, p, 'activities', r[14]);
  const ind = indicator(input, r, 9, 10, 11, 12, 2025);
  if (ind) { p.indicators.push(ind); p.warnings.push('アウトプット指標の年度は指標値の欄の見出し「(R7)」による（実績値の欄の見出しに年度の記載はない）。単位は実績値の右隣の見出しのない欄。'); }
  rating(input, p, '達成状況', text(r[8]));
  // 「次年度以降の対応方針」欄: ＜R8年度の状況＞・＜今後の方向性＞の見出しの直後の1行だけを評価とする（その後の説明文は収録しない）。
  const plan = /^＜R8年度の状況＞\n[\s　]*([^\n]+)\n＜今後の方向性＞\n[\s　]*([^\n]+)/.exec(last.text);
  if (plan) {
    const at = (i: 1 | 2) => {
      const g = plan[i], off = plan[0].indexOf(g, i === 2 ? plan[0].indexOf('＜今後の方向性＞') : 0);
      // 今後の方向性は「（成果が十分に確保できる見通し）」のように括弧書き。外側の括弧を除いた部分を値とする。
      const v = g.trim(), inner = /^（(.+)）$/.exec(v)?.[1];
      return { value: inner ?? v, start: last.start + off + g.indexOf(v) + (inner ? 1 : 0) };
    };
    rating(input, p, '次年度以降の対応方針（R8年度の状況）', at(1));
    rating(input, p, '次年度以降の対応方針（今後の方向性）', at(2));
  }
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
  const textHead: Record<number, string> = { 7: '事業の概要', 8: '達成状況', 9: 'アウトプット指標名', 10: 'アプトプット実績値', 11: '', 12: 'アウトプット指標値(R7)', 14: '事業の進捗（活動実績）', 15: '次年度以降の対応方針' };
  const textOk = Object.entries(textHead).every(([k, v]) => head[Number(k)] === v);
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
    if (textOk) texts7(input, p, r, lastCell(t, r, rows[i + 2]));
    p.warnings.push('令和７年度重点事業等一覧（検索用エクセル）の1行。事業番号・課室名の欄は無い。評価年度は原表に印字されていないため未設定。');
    out.push(p);
  });
  return mergeReprints(out, p => `${nfkc(p.projectName)}|${p.department}`);
}

const R6_TEXT_HEAD: Record<number, string> = { 29: '事業の概要', 31: '達成\n状況', 32: 'アウトプット指標名', 33: 'アウトプット\n実績値(R6)', 34: '', 36: 'アウトプット\n目標値（R6）',
  41: 'アウトプット指標名②', 42: 'アウトプット実績値②', 43: 'アウトプット単位②', 45: 'アウトプット指標値（R6）', 50: 'アウトカム指標名①', 51: 'アウトカム実績値①', 52: '',
  54: 'アウトカム指標値（R6）', 59: 'アウトカム指標名②', 60: 'アウトカム実績値②', 61: 'アウトカム単位②', 63: 'アウトカム指標値（R6）',
  70: '事業の進捗（活動実績）', 71: '事業の成果', 74: '次年度の対応方針', 75: '次年度の見通し' };

/** 令和６年度版の文章欄（欄の位置は見出し行で確認済み）。 */
function texts6(input: CachedInput, p: ProjectEvaluation, r: Cell[]) {
  fill(input, p, 'purpose', r[29]);
  fill(input, p, 'activities', r[70]);
  fill(input, p, 'outcomes', r[71]);
  // アウトプット①は実績値・目標値とも見出しに（R6）。②とアウトカムは実績値の見出しに年度がなく「時点」欄が別にあるため年度は未設定、指標値は（R6）の欄。
  const inds = [indicator(input, r, 32, 33, 34, 36, 2024), indicator(input, r, 41, 42, 43, 45, null), indicator(input, r, 50, 51, 52, 54, null), indicator(input, r, 59, 60, 61, 63, null)];
  for (const ind of inds) if (ind) p.indicators.push(ind);
  if (inds.slice(1).some(Boolean)) p.warnings.push('アウトプット指標②・アウトカム指標の目標は「指標値（R6）」の欄、実績値は「実績値」の欄（その時点は原表の「時点」欄、見出しに年度の記載がないため年度は未設定）。');
  rating(input, p, '達成状況', text(r[31]));
  rating(input, p, '次年度の対応方針', text(r[74]));
  rating(input, p, '次年度の見通し', text(r[75]));
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
  const textOk = Object.entries(R6_TEXT_HEAD).every(([k, v]) => head[Number(k)] === v);
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
    if (textOk && r.length > 76) texts6(input, p, r);
    p.warnings.push(`令和６年度重点事業等一覧（検索用エクセル）の1行。予算額・事業決算額は令和６年度の値として収録（一覧の表題による）。予算額が当初か補正後かは原表に明記がない。${UNIT_NOTE}評価年度は原表に印字されていないため未設定。`);
    out.push(p);
  });
  return mergeReprints(out, p => `${p.projectCode}|${nfkc(p.projectName)}`);
}

export const entries: Record<string, Entry> = {
  '07000': {
    scope: '重点事業等一覧（検索用エクセルファイル）令和６年度版・令和７年度版の事業行: 事業名・部局名（令和６年度版は課室名・事業番号も）・事業決算額（令和６年度版は予算額も、万円表記を円換算）、事業の概要（目的）・事業の進捗（活動実績）・事業の成果（令和６年度版）・アウトプット／アウトカム指標・達成状況・次年度の対応方針と見通し。再掲行、PDF版の一覧、政策分野別・地域別の施策評価調書、総合計画進行管理資料は対象外。',
    extract: (input) => input.format === 'xlsx' ? [...r7(input), ...r6(input)] : [],
  },
};
