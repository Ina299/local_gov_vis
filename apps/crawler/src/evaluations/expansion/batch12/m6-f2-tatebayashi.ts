/** Batch-12 (m6) extractor for 10207 館林市: 事業評価一覧（令和３〜６年度）の事務事業行と、基本目的Ⅴ（行政経営）の事業評価調書。 */
import type { EvaluationRating, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';
import { amount, nfkc, num } from '../batch9/i1-util';

/** 令和N年度事業評価一覧 (all policy areas) and the 基本目的Ⅴ 実施計画書・事業評価調書 of the same year. */
const LISTS: Record<string, number> = { '3d822af8b867fab6e887f53d': 3, de5da259c0719908b98f7d2c: 4, '3ea8920131c6aeb93ee86f24': 5, '5ff371c74b62809244024c4b': 6 };
const SHEETS: Record<string, number> = { '447e17f8616528a2a39d2763': 3, '958ada449838310366ae4c17': 4, c9415672051eb8b47ca16795: 5, '68ff6ef2db523eae6134115e': 6 };

const SCALE_INDICATOR = '指標評価（一覧・調書の表記のまま。Ａ〜Ｄ、―は指標なし等）';
const SCALE_NEED = '高（政策の推進において不可欠な事業である）／中（政策の推進に寄与している事業である）／低（目的をある程度達成し、実施の有無について検討の余地がある）';
const SCALE_EFFECT = '高（成果が高水準にある）／中（適切な成果が得られている）／低（成果が低水準にある）';
const SCALE_EFFICIENCY = '高（費用対効果が高水準にある）／中（適切な費用対効果が得られている）／低（費用対効果が低水準にある）';
const SCALE_DIRECTION = '継続／拡大／改善／代替／統合／縮小／休止／廃止（一部廃止）';

const DEPT = '[^\\n]*?(?:課|室|局|館|所|センター)';
const GENERAL_ROW = new RegExp(`(?<=\\n)(\\d{1,3})\\n\\n(\\d･\\d･\\d{1,2})\\n\\n((?:[^\\n]+\\n)?[^\\n]+?)\\n\\n(${DEPT})(?=\\n)`, 'g');
const ACCOUNT_ROW = new RegExp(`(?<=\\n)(\\d{1,3})\\n\\n([^\\n]{2,8})\\n([^\\n]+)\\n(事業会計|特別会計)\\n\\n(${DEPT})(?=\\n)`, 'g');
const GROUP = /^\n\n([Ａ-ＤA-D]|―|-)\n\n(継続|拡大|改善|代替|統合|縮小(?:\n一部廃止)?|休止|廃止)\n\n(高|中|低)\n\n(高|中|低)\n\n(高|中|低)(?=\n|$)/;
const ANY_GROUP = /\n\n(?:[Ａ-ＤA-D]|―|-)\n\n(?:継続|拡大|改善|代替|統合|縮小|休止|廃止)/g;
const BREAK = /\n(?:\d\d [^\n]*：|[ⅠⅡⅢⅣⅤ] |※各事業|令和.年度事業評価一覧)/g;

interface Row { no: string; account: string; name: string; dept: string; raw: string; start: number; group: { m: RegExpMatchArray; start: number } | null }

function listRows(input: CachedInput): Row[] {
  const t = input.text;
  const rows: Row[] = [];
  for (const m of t.matchAll(GENERAL_ROW)) {
    if (/課|室|局/.test(m[3].split('\n')[0]) && m[3].includes('\n')) continue;
    rows.push({ no: m[1], account: m[2], name: m[3].replace(/\n/g, ''), dept: m[4], raw: m[0], start: m.index!, group: null });
  }
  for (const m of t.matchAll(ACCOUNT_ROW)) rows.push({ no: m[1], account: `${m[2]}${m[4]}`, name: m[3], dept: m[5], raw: m[0], start: m.index!, group: null });
  rows.sort((a, b) => a.start - b.start);
  const breaks = [...t.matchAll(BREAK)].map(m => m.index!);
  rows.forEach((r, i) => {
    const from = r.start + r.raw.length;
    const to = Math.min(rows[i + 1]?.start ?? t.length, breaks.find(b => b >= from) ?? t.length);
    const tail = t.slice(from, to);
    // Only a single rating run printed right after the department belongs to the row; runs detached from their rows are skipped.
    const g = tail.match(GROUP);
    if (g && [...tail.matchAll(ANY_GROUP)].length === 1) r.group = { m: g, start: from };
  });
  return rows;
}

function listRatings(input: CachedInput, g: { m: RegExpMatchArray; start: number }): EvaluationRating[] {
  const e = evidence(input, g.m[0].slice(2), g.start + 2);
  return [
    { kind: 'self', label: '指標評価', value: g.m[1], scale: SCALE_INDICATOR, evidence: e },
    { kind: 'self', label: '今後の方向性', value: g.m[2].replace('\n', '・'), scale: SCALE_DIRECTION, evidence: e },
    { kind: 'self', label: '事業の必要性', value: g.m[3], scale: SCALE_NEED, evidence: e },
    { kind: 'self', label: '事業の有効性', value: g.m[4], scale: SCALE_EFFECT, evidence: e },
    { kind: 'self', label: '事業の効率性', value: g.m[5], scale: SCALE_EFFICIENCY, evidence: e },
  ];
}

const sig = (rs: EvaluationRating[]) => JSON.stringify(rs.map(r => [r.label, r.value]).sort());

/** 実施計画書＋事業評価調書 pairs of one 基本目的Ⅴ document, keyed by 整理番号. */
function sheetRecords(input: CachedInput, reiwa: number, rows: Row[]): Map<string, ProjectEvaluation> {
  const t = input.text, out = new Map<string, ProjectEvaluation>();
  const plan = `【令和${'０１２３４５６７８９'[reiwa]}年度事業】実施計画書`, check = `【令和${'０１２３４５６７８９'[reiwa]}年度事業】事業評価調書`;
  const starts = [...t.matchAll(new RegExp(plan, 'g'))].map(m => m.index!);
  const year = 2018 + reiwa;
  const bad = new Set<string>();
  starts.forEach((s, k) => {
    const sheet = t.slice(s, starts[k + 1] ?? t.length);
    const no = sheet.match(/^【[^】]+】実施計画書\n整理番号\n\n(\d{1,3})\n/)?.[1];
    const ci = sheet.indexOf(check);
    if (!no || ci < 0) return;
    if (out.has(no)) { bad.add(no); return; }
    const header = sheet.slice(0, sheet.indexOf('【総合計画との関連】') < 0 ? 600 : sheet.indexOf('【総合計画との関連】'));
    const row = rows.find(r => r.no === no);
    let name: string, dept: string | null, ni: number;
    if (row) {
      ni = header.indexOf(`\n${row.name}\n`);
      if (ni < 0 || !header.includes(row.dept)) return;
      name = row.name; dept = row.dept; ni += 1;
    } else {
      // The list row was not recovered: take the name printed right after the 款・項・目 code, unless the list has that name elsewhere.
      const names = [...header.matchAll(/\n\n([０-９\d]{1,2}・[０-９\d]{1,2}・[０-９\d]{1,2})\n\n([^\n]+)\n\n/g)];
      if (names.length !== 1 || /千円|予算|担当|事業名|総合戦略|重要事業/.test(names[0][2])) return;
      const found = names[0][2];
      if (rows.some(r => nfkc(r.name) === nfkc(found))) return;
      name = found;
      ni = names[0].index! + names[0][0].indexOf(`\n${name}\n`) + 1;
      const depts = [...header.matchAll(/担当部署\n\n([^\n]+?(?:課|室|事務局))(?=[ \n]|監査係)/g)];
      dept = depts.length === 1 ? depts[0][1] : null;
    }
    const p = project(input, no, name, null, name, s + ni);
    p.department = dept;
    p.warnings.push(row
      ? '事業名・担当課は同年度の事業評価一覧の同じ整理番号の行と一致を確認。'
      : `同年度の事業評価一覧の行が抽出テキストで崩れているため、事業名は調書の款・項・目の直後の値、担当課は${dept ? '担当部署欄の直後の値' : '担当部署欄の並びが崩れているため未設定'}。`);
    p.evaluatedFiscalYear = year;
    p.evidence.push(evidence(input, sheet.match(/^【[^】]+】実施計画書\n整理番号\n\n\d{1,3}/)![0], s));
    p.evidence.push(evidence(input, check, s + ci));
    const ev = sheet.slice(ci), evStart = s + ci;
    const r = `令和${'０１２３４５６７８９'[reiwa]}`;
    const budget = ev.match(new RegExp(`${r}年度予算額\\n\\n([\\d,]+) ?千円`));
    if (budget) p.amounts.push(amount(input, 'budget', year, budget[1], '千円', budget[0], evStart + budget.index!));
    const actual = ev.match(new RegExp(`${r}年度決算額\\n\\n([\\d,]+) ?千円`));
    // A 決算額 more than twice the 予算額 (e.g. 78,486,726 千円, apparently printed in yen) is treated as a misprint and left out.
    if (actual && !(budget && num(actual[1]) > 2 * num(budget[1]))) p.amounts.push(amount(input, 'actual', year, actual[1], '千円', actual[0], evStart + actual.index!));
    else if (actual) p.warnings.push(`決算額「${actual[1]} 千円」は予算額の2倍を超え単位等の誤記の可能性があるため未収録。`);
    const ind = ev.match(/指標評価\n\n([Ａ-ＤA-D]|―|-)\n/);
    if (ind) p.ratings.push({ kind: 'self', label: '指標評価', value: ind[1], scale: SCALE_INDICATOR, evidence: evidence(input, ind[0].trimEnd(), evStart + ind.index!) });
    const seg = (from: RegExp, to: RegExp, label: string, scale: string) => {
      const a = ev.search(from); if (a < 0) return;
      const rest = ev.slice(a), b = rest.slice(1).search(to); if (b < 0) return;
      const part = rest.slice(0, b + 1), marks = [...part.matchAll(/■ ?(高|中|低)/g)];
      if (marks.length !== 1 || [...part.matchAll(/□ ?(高|中|低)/g)].length !== 2) return;
      p.ratings.push({ kind: 'self', label, value: marks[0][1], scale, evidence: evidence(input, marks[0][0], evStart + a + marks[0].index!) });
    };
    seg(/事業の\n必要性/, /事業の\n有効性/, '事業の必要性', SCALE_NEED);
    seg(/事業の\n有効性/, /事業の\n効率性/, '事業の有効性', SCALE_EFFECT);
    seg(/事業の\n効率性/, /評価根拠|課題\n/, '事業の効率性', SCALE_EFFICIENCY);
    const dir = ev.match(/([■□]) 継続\n\n([■□]) 拡大\n\n([■□]) 改善\n\n([■□]) 代替\n\n([■□]) 統合\n\n([■□]) 縮小\n\n([■□]) 休止\n\n([■□]) 廃止 （([■□]) 一部廃止）/);
    if (dir) {
      const labels = ['継続', '拡大', '改善', '代替', '統合', '縮小', '休止', '廃止'];
      const on = labels.filter((_, i) => dir[i + 1] === '■');
      if (on.length === 1) p.ratings.push({ kind: 'self', label: '今後の方向性', value: dir[9] === '■' ? `${on[0]}・一部廃止` : on[0], scale: SCALE_DIRECTION, evidence: evidence(input, dir[0], evStart + dir.index!) });
    }
    p.warnings.push(`館林市 令和${reiwa}年度 基本目的Ⅴ（行政経営）の実施計画書・事業評価調書。評価対象年度は調書見出し【令和${reiwa}年度事業】による。評価年度（実施年）は資料に明示がないため未設定。`);
    p.warnings.push('金額は事業評価調書【事業の実績】の当該年度予算額・決算額（千円）のうち、ラベル直後に値が出力されているものだけ採用。実施計画書の当初予算額・財源内訳・関連する指標（目標値・実績値）の表は列の対応を確定できないため未収録。必要性・有効性・効率性・今後の方向性はチェック（■）が1つだけの場合のみ採用。');
    out.set(no, p);
  });
  for (const no of bad) out.delete(no);
  return out;
}

function tatebayashi(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '10207') return [];
  const reiwa = LISTS[input.sourceId] ?? SHEETS[input.sourceId];
  if (!reiwa) return [];
  const listId = Object.keys(LISTS).find(k => LISTS[k] === reiwa)!, sheetId = Object.keys(SHEETS).find(k => SHEETS[k] === reiwa)!;
  const list = inputs.find(i => i.sourceId === listId), sheetDoc = inputs.find(i => i.sourceId === sheetId);
  if (!list) return [];
  const t = list.text;
  if (!t.startsWith(`令和${'０１２３４５６７８９'[reiwa]}年度事業評価一覧`)) return [];
  const rows = listRows(list);
  const sheets = sheetDoc ? sheetRecords(sheetDoc, reiwa, rows) : new Map<string, ProjectEvaluation>();
  const year = 2018 + reiwa;
  // Group list rows of the same business (再掲 rows and the same name/department printed twice).
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${nfkc(r.name)}|${r.dept}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const out: ProjectEvaluation[] = [];
  for (const group of groups.values()) {
    const rated = group.filter(r => r.group);
    const sigs = new Set(rated.map(r => sig(listRatings(list, r.group!))));
    if (sigs.size > 1) continue;
    const sheet = group.map(r => sheets.get(r.no)).find(Boolean);
    if (sheet) {
      if (group.some(r => sheets.get(r.no) && sheets.get(r.no) !== sheet)) continue;
      // The list and the sheet must agree on every rating both print.
      const listR = rated.length ? listRatings(list, rated[0].group!) : [];
      if (listR.some(l => sheet.ratings.some(s => s.label === l.label && nfkc(s.value) !== nfkc(l.value)))) continue;
      if (input.sourceId !== sheetId) continue;
      for (const r of group) sheet.evidence.push(evidence(list, r.raw, r.start));
      sheet.warnings.push(`同年度の事業評価一覧（${list.sourceUrl}）の行を根拠に併用。一覧に評価欄が行に接して出力されている場合は値の一致を確認済み。`);
      out.push(sheet);
      continue;
    }
    if (input.sourceId !== listId) continue;
    const [first, ...rest] = group;
    const p = project(list, first.no, first.name, null, first.raw, first.start);
    p.department = first.dept;
    p.evaluatedFiscalYear = year;
    p.evidence.push(evidence(list, t.slice(0, `令和${reiwa}年度事業評価一覧`.length), 0));
    for (const r of rest) p.evidence.push(evidence(list, r.raw, r.start));
    if (rated.length) p.ratings.push(...listRatings(list, rated[0].group!));
    p.warnings.push(`館林市 令和${reiwa}年度事業評価一覧の行（整理番号・款項目・事業名・担当課）。評価対象年度は一覧の表題「令和${reiwa}年度事業評価一覧」と同年度の事業評価調書の見出し【令和${reiwa}年度事業】による。評価年度（実施年）は資料に明示がないため未設定。`);
    p.warnings.push(rated.length ? '指標評価・今後の方向性・必要性・有効性・効率性は、行の担当課の直後に1組だけ出力されている評価欄を採用。' : '評価欄（指標評価・今後の方向性・必要性・有効性・効率性）は抽出テキストで行から離れて出力され対応を確定できないため未収録。');
    if (rest.length) p.warnings.push(`一覧内の再掲（整理番号 ${group.map(r => r.no).join('・')}）を1件に統合。projectCode は最初の整理番号。`);
    out.push(p);
  }
  if (input.sourceId === sheetId) {
    const listed = new Set(rows.map(r => r.no));
    for (const [no, p] of sheets) if (!listed.has(no) && !out.some(q => nfkc(q.projectName) === nfkc(p.projectName))) out.push(p);
  }
  return out;
}

export const tatebayashiEntries = {
  '10207': {
    extract: tatebayashi,
    scope: '令和３〜６年度 事業評価一覧の事務事業行（整理番号・款項目・事業名・担当課、行に接して出力された指標評価・今後の方向性・必要性・有効性・効率性）と、基本目的Ⅴ（行政経営）の実施計画書・事業評価調書（当該年度予算額・決算額、指標評価、必要性・有効性・効率性、今後の方向性）。基本目的Ⅰ〜Ⅳの調書（未取得）、総合戦略関連事業評価一覧表（一覧の再掲）、実施計画書【重要事業】、総合計画指標・総合戦略KPI実績報告、企業版ふるさと納税資料、指標の目標値・実績値は対象外。',
  },
};
