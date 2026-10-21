import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** 益田市 令和8年度（令和7年度事業分）教育委員会点検・評価報告書。 */
const MASUDA = 'aefd39567e674571f88f970a';
/** 小松島市 令和7年度 主要施策の成果・事務事業評価等に関する説明書（抽出テキストは先頭120,000字で打切り）。 */
const KOMATSUSHIMA_BOOK = '7d1cc95ee4fd0bce701d6dba';
/** 小松島市 議会評価意見書①（まち・ひと・しごと総合戦略事業）。 */
const KOMATSUSHIMA_COUNCIL = 'dd6017426d6a422f91296706';

const MARKS = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭';
const MASUDA_SCALE = 'Ａ 目標どおりの成果があった／Ｂ 目標には届かないが高い成果があった／Ｃ 一定の成果があった／Ｄ 期待した成果が認められなかった／Ｅ 見直しの必要性がある';

function extractMasuda(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '32204' || input.sourceId !== MASUDA) return [];
  const t = input.text;
  const head = t.indexOf('令和８年度\n（令和７年度事業分）\n\n益田市教育委員会\n点検・評価報告書');
  const listStart = t.indexOf('（１) 評価対象事業\n令和７年度においては、次の６つの重点項目に１４の評価対象事業を設けました。');
  const listEnd = t.indexOf('（２）評価の観点', listStart);
  const gradeEnd = t.indexOf('（４）重点項目別評価', listEnd);
  if (head !== 0 || listStart < 0 || listEnd < 0 || gradeEnd < 0) return [];
  const names = new Map<string, { name: string; raw: string; start: number }>();
  const listRe = /^([①-⑭]) (.+)$/gm; listRe.lastIndex = listStart;
  for (let m; (m = listRe.exec(t)) && m.index < listEnd;) names.set(m[1], { name: m[2].trim(), raw: m[0], start: m.index });
  if (names.size !== 14) return [];
  // 評価結果の概要: grade headings with a stated count, followed by one paragraph per numbered project.
  const heads = [...t.slice(0, gradeEnd).matchAll(/([ＡＢＣＤＥ])評価（[^）\n]+）\n・・＞ ?(\d+) 事業/g)].filter(h => h.index! > listEnd);
  const grades = new Map<string, { grade: string; head: string; headStart: number; raw: string; start: number }>();
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i], from = h.index!, to = heads[i + 1]?.index ?? gradeEnd;
    const items = [...t.slice(from, to).matchAll(/^([①-⑭])[^\n]*$/gm)];
    if (items.length !== Number(h[2])) return [];
    for (const it of items) {
      if (grades.has(it[1])) return [];
      grades.set(it[1], { grade: h[1], head: h[0], headStart: from, raw: it[0], start: from + it.index! });
    }
  }
  if (grades.size !== 14) return [];
  const out: ProjectEvaluation[] = [];
  for (const mark of MARKS) {
    const n = names.get(mark)!, g = grades.get(mark)!;
    const p = project(input, `R7-${mark}`, n.name, 2026, n.raw, n.start);
    p.evaluatedFiscalYear = 2025;
    p.evidence.push(evidence(input, g.raw, g.start));
    p.ratings.push({ kind: 'self', label: '自己評価', value: g.grade, scale: MASUDA_SCALE, evidence: evidence(input, g.head, g.headStart) });
    p.warnings.push('令和8年度（令和7年度事業分）教育委員会点検・評価報告書の評価対象事業（14事業）の事業名と、「評価結果の概要」の自己評価区分（A〜D）のみ構造化。資料1の事務事業別点検・評価シートは2段組みが混在し目標・実績・評価点の列対応を確定できないため指標・所管課は未収録。外部評価委員の意見は事業別でないため対象外。事業費の記載なし。');
    out.push(p);
  }
  return out;
}

const DIRECTIONS = new Set(['現状のまま継続', '改善・効率化し継続', '縮小して継続', '拡充', '完了']);
const numLine = /^[\d,]+(?: [\d,]+)*(?: あたりコスト)?$/;

interface Sheet { name: string; raw: string; start: number; direction: string; dirRaw: string; dirStart: number; total: string; totalRaw: string; totalStart: number;
  indicator?: { name: string; unit: string; values: string[]; raw: string; start: number } }

/** Evaluation blocks of the 説明書, each linked to its project heading via the R7決算 that equals the heading's (globally unique) total line. */
function komatsushimaSheets(input: CachedInput): Sheet[] {
  const t = input.text, out: Sheet[] = [];
  // Headings "N 名称" (a short continuation line ending in 事業/費 is joined; continued headings excluded), each tied to the first
  // total line before the next heading, provided no page break or unparsed heading-like line lies between them.
  const heads = [...t.matchAll(/^(\d{1,2}) ([^\s\d・（(][^\n]*)$(?:\n([^\s\d・（(][^\s・]{0,9}(?:事業|費)(?:（続き）)?)$)?/gm)]
    .filter(h => !/^(R\d|あたりコスト)/.test(h[2]));
  const linked: { name: string; raw: string; start: number; total: string; totalRaw: string; totalStart: number }[] = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i], name = h[2] + (h[3] ?? '');
    if (name.endsWith('（続き）')) continue;
    const from = h.index! + h[0].length, to = heads[i + 1]?.index ?? t.length;
    const tm = /^([\d,]+) （(?:事業の目的・内容|施策の成果)）/m.exec(t.slice(from, to));
    if (!tm) continue;
    const gap = t.slice(from, from + tm.index).split('\n').filter(l => l.trim());
    if (gap.some(l => /^[０-９]/.test(l) || /^\d{1,2} /.test(l) || /^-\d+-$/.test(l) || /^(主|要|施|策|等|の|内|容)$/.test(l))) continue;
    linked.push({ name, raw: h[0], start: h.index!, total: tm[1], totalRaw: tm[0], totalStart: from + tm.index });
  }
  const ratings = [...t.matchAll(/事業の方向性の評価\n([^\n]+)\n/g)];
  for (let k = 0; k < ratings.length; k++) {
    const r = ratings[k], floor = k ? ratings[k - 1].index! : 0;
    if (!DIRECTIONS.has(r[1])) continue;
    const budgetAt = t.lastIndexOf('R8予算', r.index!);
    if (budgetAt < floor) continue;
    const costEnd = t.indexOf('あたりコスト', budgetAt);
    if (costEnd < 0 || costEnd > r.index!) continue;
    const tokens = t.slice(budgetAt + 4, costEnd + 6).split('\n').filter(l => numLine.test(l.trim()))
      .flatMap(l => l.replace(' あたりコスト', '').trim().split(' '));
    if (tokens.length !== 3) continue;
    const hits = linked.filter(x => x.total === tokens[1]);
    if (hits.length !== 1 || [...t.matchAll(/^([\d,]+) （(?:事業の目的・内容|施策の成果)）/gm)].filter(m => m[1] === tokens[1]).length !== 1) continue;
    if (r.index! - hits[0].start > 6000 || r.index! < hits[0].start - 3000) continue;
    const sheet: Sheet = { ...hits[0], direction: r[1], dirRaw: r[0].trimEnd(), dirStart: r.index! };
    // Indicator only in the uncluttered layout: name（unit）, explanation, R6〜R9, 4 targets then 2 actuals, directly before R6決算.
    const ws = Math.max(floor, budgetAt - 400);
    const ind = [...t.slice(ws, budgetAt).matchAll(/^([^\n]+)（([^）\n]+)）\n[^\n]+\nR6\nR7\nR8\nR9\n(\d[\d.,]*)\n(\d[\d.,]*)\n(\d[\d.,]*)\n(\d[\d.,]*)\n(\d[\d.,]*)\n(\d[\d.,]*)\nR6決算\n(?=R7決算\n$)/gm)].at(-1);
    if (ind) sheet.indicator = { name: ind[1], unit: ind[2], values: ind.slice(3, 9), raw: ind[0].trimEnd(), start: ws + ind.index! };
    out.push(sheet);
  }
  return out;
}

const COUNCIL_RE = /^議会評価意見書①\n事\n\n業\n\n名\n\n議 会 評 価\n\n(まち・ひと・しごと総合戦略事業)\n\n(改善・効率化し継続)\n\n【評価説明】/;

/** Book sheets usable as records: same-name headings (e.g. in different departments) are dropped rather than merged by guess. */
function uniqueSheets(book: CachedInput): Sheet[] {
  const sheets = komatsushimaSheets(book), counts = new Map<string, number>();
  for (const s of sheets) counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
  return sheets.filter(s => counts.get(s.name) === 1);
}

function sheetRecord(owner: CachedInput, book: CachedInput, s: Sheet): ProjectEvaluation {
  const p = project(owner, `R7:${s.name}`, s.name, 2025, s.raw, s.start);
  if (owner !== book) p.evidence = [evidence(book, s.raw, s.start)];
  p.evaluatedFiscalYear = 2025;
  p.evidence.push(evidence(book, s.totalRaw, s.totalStart));
  p.ratings.push({ kind: 'self', label: '事業の方向性の評価', value: s.direction, scale: null, evidence: evidence(book, s.dirRaw, s.dirStart) });
  if (s.indicator) {
    const [t6, t7, , , a6, a7] = s.indicator.values;
    for (const [fy, target, actual] of [[2024, t6, a6], [2025, t7, a7]] as const)
      p.indicators.push({ name: s.indicator.name, fiscalYear: fy, target, actual, unit: s.indicator.unit, evidence: evidence(book, s.indicator.raw, s.indicator.start) });
  }
  p.warnings.push('主要施策の成果・事務事業評価等に関する説明書のうち、成果指標・評価欄の事業費表のR7決算額が、事業見出しに続く決算額（次の見出しまでの最初の決算額行）と一致して対応が確定した事業のみ。事業の方向性の評価を原文区分のまま収録。'
    + '事業費表に単位の明記がないため金額は未収録（対応確認にのみ使用）。指標は「指標名（単位）・説明・R6〜R9・目標4値・実績2値」が連続する表のみ（R6/R7の目標・実績）。抽出テキストが先頭120,000字で打ち切られているため後半の事業は未収録。');
  return p;
}

function extractKomatsushima(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '36203') return [];
  const book = inputs.find(i => i.sourceId === KOMATSUSHIMA_BOOK && i.text.includes('令和７年度\n主要施策の成果・事務事業評価等に関する説明書'));
  const councilInput = inputs.find(i => i.sourceId === KOMATSUSHIMA_COUNCIL), cm = councilInput && COUNCIL_RE.exec(councilInput.text);
  if (input.sourceId === KOMATSUSHIMA_COUNCIL) {
    if (!cm) return [];
    const sheet = book && uniqueSheets(book).find(s => s.name === cm[1]);
    const p = sheet ? sheetRecord(input, book!, sheet) : project(input, `R7:${cm[1]}`, cm[1], 2025, cm[0], 0);
    p.evaluatedFiscalYear = 2025;
    if (sheet) p.evidence.push(evidence(input, cm[0], 0));
    p.ratings.push({ kind: 'external', label: '議会評価', value: cm[2], scale: null, evidence: evidence(input, cm[0], 0) });
    p.warnings.push('令和7年度事務事業（議会抽出）の議会評価意見書①の議会評価区分を収録（評価説明の記述は対象外）。' + (sheet ? '説明書の同名事業の自己評価・指標と同一事業として1件に統合。' : ''));
    return [p];
  }
  if (!book || input.sourceId !== book.sourceId) return [];
  return uniqueSheets(book).filter(s => !(cm && s.name === cm[1])).map(s => sheetRecord(input, book, s));
}

export const entries: Record<string, Entry> = {
  '32204': { extract: extractMasuda, scope: '令和8年度（令和7年度事業分）教育委員会点検・評価報告書の評価対象14事業の事業名と自己評価区分（A〜E、評価結果の概要の区分別一覧から）。資料1の点検・評価シートの指標・評価点・所管課（2段組みで列対応が確定しない）、外部評価委員意見、案内ページは対象外' },
  '36203': { extract: extractKomatsushima, scope: '令和7年度主要施策の成果・事務事業評価等に関する説明書のうち、事業費表R7決算と事業見出し決算額の一致で対応が確定した事業の事業名・事業の方向性の評価・成果指標（連続した表のみ）と、議会評価意見書①の議会評価。単位不明の事業費・打切り以降の事業・部局の課題目標・案内ページは対象外' },
};
