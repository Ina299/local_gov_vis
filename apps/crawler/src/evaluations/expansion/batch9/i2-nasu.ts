import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, mergeReprints } from '../batch7/g1-util';

/** 那須町 事務事業評価一覧表。R4・R5版は一覧表（決算額3か年）、R6・R7版は1事業ごとの票（予算・支出済額）。 */
const TABLES: Record<string, { evalYear: number; latest: string; latestYear: number; title: string }> = {
  f92ed87161417aab1fc37c6f: { evalYear: 2022, latest: 'Ｒ３', latestYear: 2021, title: '令和４年度\n事務事業評価一覧表' },
  '12ebed266867c91c17ac7561': { evalYear: 2023, latest: 'Ｒ４', latestYear: 2022, title: '令和５年度\n事務事業評価一覧表' },
};
const SHEETS: Record<string, { evalYear: number; fy: number; label: string; prev?: string; title: string }> = {
  f817054187ebfecb8890aaa9: { evalYear: 2024, fy: 2023, label: 'R6(R5決算)', prev: '12ebed266867c91c17ac7561', title: '令和６年度\n事務事業評価一覧表' },
  '4aed26516e19b265b4a477f1': { evalYear: 2025, fy: 2024, label: '_R7(R6決算)', prev: 'f817054187ebfecb8890aaa9', title: '令和７年度\n事務事業評価一覧表' },
};
const DIRECTION = /^(維持|縮小|拡充|拡大|廃止|休止|統合|完了)(\(\S+\))?$/;
const num = (s: string) => Number(s.replaceAll(',', ''));
const flat = (s: string) => s.replace(/\n/g, '');

interface Span { text: string; at: number }
function split(text: string, at: number, sep: string): Span[] {
  const out: Span[] = []; let pos = 0;
  for (const part of text.split(sep)) { out.push({ text: part, at: at + pos }); pos += part.length + sep.length; }
  return out;
}

interface TableRow { dept: Span; name: Span; value: Span | null; entry: Span; dir: Span; latest: Span }
/** 一覧表の各ページ: 課名・大事業名・事業概要（最新年度の決算額を含む）・翌年度の方向性の件数が一致するページだけ行を対応づける。 */
function tableRows(input: CachedInput, latest: string): TableRow[] {
  const rows: TableRow[] = [];
  for (const pg of split(input.text, 0, '\n\n\n')) {
    const k = pg.text.indexOf('事業概要と評価等');
    if (k < 0) continue;
    const head = pg.text.slice(0, k), body = pg.text.slice(k);
    const latestAt = pg.text.search(new RegExp(`(?<=\\n|^)${latest}(?=\\n)`));
    if (!head.includes('大事業名') || latestAt < 0) continue;
    const depts: Span[] = [], names: Span[] = [];
    let bad = false;
    for (const ch of split(head, pg.at, '\n\n')) {
      const t = ch.text;
      if (!t.trim() || /^[・○◎]$/.test(t) || /^[\d,]+$/.test(t) || t.startsWith('決算額') || t.includes('事務事業評価一覧表')) continue;
      if (/^(?:Ｒ[０-９]|（単位：円）|大事業名|課名|-\s?\d+\s?-?課名|-\d+-|\d+)$/.test(t)) continue;
      if (/^(?:\d+ )?\S+?(?:課|局)$/.test(flat(t)) && flat(t).length <= 16) { depts.push(ch); continue; }
      if (/[\d,]{4,}|Ｒ[０-９]|（単位|\(事業概要/.test(t)) { bad = true; break; }
      const m = t.match(/^[・○◎] /);
      names.push(m ? { text: t.slice(m[0].length), at: ch.at + m[0].length } : ch);
    }
    if (bad) continue;
    const entries = [...body.matchAll(/\(事業概要）/g)].map((m, i, all) => {
      const end = all[i + 1]?.index ?? body.length, raw = body.slice(m.index!, end).split('\n\n')[0];
      return { text: raw, at: pg.at + k + m.index! };
    });
    const d = body.match(/翌年度\s*の\s*方向性\n\n([\s\S]+)$/);
    if (!d) continue;
    const dirs: Span[] = [];
    for (const m of d[1].matchAll(/\S+/g)) {
      const at = pg.at + k + d.index! + d[0].length - d[1].length + m.index!;
      if (/^\(\S+\)$/.test(m[0]) && dirs.length) {
        const last = dirs[dirs.length - 1];
        dirs[dirs.length - 1] = { text: input.text.slice(last.at, at + m[0].length), at: last.at };
      } else dirs.push({ text: m[0], at });
    }
    if (!(depts.length === names.length && names.length === entries.length && entries.length === dirs.length && names.length)) continue;
    if (!dirs.every(x => DIRECTION.test(x.text.replace(/\s+/g, '')))) continue;
    names.forEach((name, i) => {
      const vals = [...entries[i].text.matchAll(/(?<=^|\n)(\d{1,3}(?:,\d{3})*)(?= |\n|$)/g)];
      const value = vals.length === 1 ? { text: vals[0][1], at: entries[i].at + vals[0].index! } : null;
      rows.push({ dept: depts[i], name, value, entry: entries[i], dir: dirs[i], latest: { text: latest, at: pg.at + latestAt } });
    });
  }
  return rows;
}

interface SheetBlock { name: Span; dept: Span; header: Span; prevSpent: number | null; cur: { budget: string; spent: string; raw: Span } | null; dirs: Span[]; count: number }
/** 票形式の各ページ: 事業名の件数と款項目事業ブロックの件数が一致するページだけ順序で対応づける（金額は別資料と照合して採否を決める）。 */
function sheetBlocks(input: CachedInput, label: string): SheetBlock[] {
  const out: SheetBlock[] = [];
  const headRe = new RegExp(`\\d{4}\\(([^)\\n]+)\\)${label.replace(/[()]/g, '\\$&')}事務事業評価`);
  for (const pg of split(input.text, 0, '\n\n\n')) {
    const h = pg.text.match(headRe);
    if (!h) continue;
    const names = [...pg.text.matchAll(/年度\n\n令和\d年度\n事業名\n\n?((?:(?!事業概要)[^\n]+\n){1,2})事業概要/g)];
    const blocks = [...pg.text.matchAll(/款項目事業/g)];
    if (!names.length || names.length !== blocks.length) continue;
    if (names.some(n => /年度|事業名|款項目|会計/.test(n[1]))) continue;
    const dirs = [...pg.text.matchAll(/(?<=\n)(維持|縮小|拡充|拡大|廃止|休止|統合|完了)(?=\n|$)/g)].map(m => ({ text: m[1], at: pg.at + m.index! }));
    const header = { text: h[0], at: pg.at + h.index! }, dept = { text: h[1], at: pg.at + h.index! + h[0].indexOf('(') + 1 };
    names.forEach((n, i) => {
      const bt = pg.text.slice(blocks[i].index!, blocks[i + 1]?.index ?? pg.text.length), bAt = pg.at + blocks[i].index!;
      const nameText = n[1].replace(/\n$/, '');
      let cur: SheetBlock['cur'] = null, prevSpent: number | null = null;
      const a = bt.match(/予算現額\n支出済額\n([\d,]+)[ \n]([\d,]+)\n([\d,]+)[ \n]([\d,]+)\n/);
      const r = bt.match(/(?:予算残額|不用額)\n([\d,]+)\n([\d,]+)\n/);
      if (a && r) {
        const [pb, ps, cb, cs] = a.slice(1).map(num);
        if (pb - ps === num(r[1]) && cb - cs === num(r[2])) { prevSpent = ps; cur = { budget: a[3], spent: a[4], raw: { text: a[0].slice(0, -1), at: bAt + a.index! } }; }
      }
      out.push({ name: { text: nameText, at: pg.at + n.index! + n[0].indexOf(n[1]) }, dept, header, prevSpent, cur, dirs, count: names.length });
    });
  }
  return out;
}

export function extractNasu(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '09407') return [];
  const table = TABLES[input.sourceId], sheet = SHEETS[input.sourceId];
  const out: ProjectEvaluation[] = [];
  if (table) {
    const titleAt = input.text.indexOf(table.title);
    if (titleAt < 0 || titleAt > 20) return [];
    for (const row of tableRows(input, table.latest)) {
      const name = flat(row.name.text);
      const p = project(input, `${flat(row.dept.text).replace(/^\d+ /, '')}:${name}`, name, table.evalYear, row.name.text, row.name.at);
      p.department = flat(row.dept.text).replace(/^\d+ /, '');
      p.evidence.push(evidence(input, table.title, titleAt), evidence(input, row.dept.text, row.dept.at));
      if (row.value) {
        p.amounts.push(amount(input, 'actual', table.latestYear, row.value.text, '円', row.value.text, row.value.at));
        p.evidence.push(evidence(input, row.entry.text, row.entry.at), evidence(input, row.latest.text, row.latest.at));
      }
      p.ratings.push({ kind: 'self', label: '翌年度の方向性', value: row.dir.text.replace(/\s+/g, ''), scale: null, evidence: evidence(input, row.dir.text, row.dir.at) });
      p.warnings.push(`一覧表のページ単位で、課名・大事業名・事業概要・翌年度の方向性の件数が一致したページのみ行順で対応づけて収録（件数が合わないページは除外）。金額は決算額のうち事業概要欄に含まれる最新年度（${table.latest}）の値（単位：円）のみ。それ以前の年度列は行との対応が崩れるページがあるため未収録。評価対象年度は表に明記がないため未設定。`);
      out.push(p);
    }
    return mergeReprints(out, p => p.projectCode!);
  }
  if (!sheet || !input.text.startsWith(sheet.title)) return [];
  // 前年度の支出済額が前年版の資料と一致した場合のみ、事業名とブロックの対応が確認できたとみなして金額を収録する。
  const prevInput = inputs.find(i => i.sourceId === sheet.prev);
  const prevValues = new Map<string, number[]>();
  if (prevInput && TABLES[prevInput.sourceId]) {
    for (const row of tableRows(prevInput, TABLES[prevInput.sourceId].latest)) if (row.value) prevValues.set(flat(row.name.text), [...(prevValues.get(flat(row.name.text)) ?? []), num(row.value.text)]);
  } else if (prevInput && SHEETS[prevInput.sourceId]) {
    for (const b of sheetBlocks(prevInput, SHEETS[prevInput.sourceId].label)) if (b.cur) prevValues.set(flat(b.name.text), [...(prevValues.get(flat(b.name.text)) ?? []), num(b.cur.spent)]);
  }
  for (const b of sheetBlocks(input, sheet.label)) {
    const name = flat(b.name.text);
    if (!name) continue;
    const p = project(input, `${b.dept.text}:${name}`, name, sheet.evalYear, b.name.text, b.name.at);
    p.department = b.dept.text; p.evaluatedFiscalYear = sheet.fy;
    p.evidence.push(evidence(input, sheet.title, 0), evidence(input, b.header.text, b.header.at));
    const prev = prevValues.get(name);
    if (b.cur && b.prevSpent !== null && prev?.length === 1 && prev[0] === b.prevSpent) {
      p.amounts.push(amount(input, 'actual', sheet.fy, b.cur.spent, '円', b.cur.raw.text, b.cur.raw.at));
      p.warnings.push('金額は当該年度の支出済額（円）。予算現額−支出済額＝予算残額の検算が前年度・当該年度とも一致し、かつ前年度の支出済額が前年版の資料の同名事業の値と一致した場合のみ収録。');
    }
    if (b.dirs.length === b.count && new Set(b.dirs.map(d => d.text)).size === 1)
      p.ratings.push({ kind: 'self', label: '翌年度の方向性', value: b.dirs[0].text, scale: null, evidence: evidence(input, b.dirs[0].text, b.dirs[0].at) });
    p.warnings.push('票の段組みが崩れているため、事業名と款項目事業ブロックの件数が一致するページのみ順序で対応づけ。担当課はページ見出しの所属表記。翌年度の方向性はページ内の全事業で同じ値の場合のみ収録（値が分かれるページは位置の対応が確定できないため未収録）。評価・改善点等の本文は未構造化。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}
