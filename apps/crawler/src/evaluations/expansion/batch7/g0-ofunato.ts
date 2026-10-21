import type { EvaluationAmount, EvaluationRating, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

/**
 * 大船渡市 事務事業評価シート（1事業2ページ）。
 * - 令和2年度様式: 1資料1事業。表頭が「27年度(実績)～元年度(実績)・2年度(目標)」のものだけ対象。
 * - 令和7年度様式: 1資料に複数事業（「令和 7 年度（令和 6 年度実績）」）。
 * 施策・基本事業評価シート、大綱別の事業一覧は対象外。
 */
type Sheet = { code: string; record: ProjectEvaluation; signature: string };

const num = /^(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?$/;
const toNum = (s: string) => Number(s.replaceAll(',', ''));
const COMMON_WARNING = '抽出テキストは段組みが崩れており、選択印（●）を失った評価欄・指標の行対応は推測していません。';

const R7_START = /事務事業ID\n\n(\d{4})\n\n令和\n\n7 年度\n\n（令和\n\n6\n\n/g;
const PAGE2 = /事務事業ID\n\n(\d{3,4})\n\n事務事業名(?: |\n\n)([^\n]+)\n/g;
const LABEL = /(\S+)年度 ?[（(](実績|目標)[）)]/g;

/** Column label run of 「(2) 総事業費・指標等の推移」; null unless the labels are contiguous. */
function labelRun(text: string, from: number, to: number) {
  const slice = text.slice(from, to), labels: { year: string; kind: string; index: number; end: number }[] = [];
  for (const m of slice.matchAll(LABEL)) labels.push({ year: m[1].normalize('NFKC'), kind: m[2], index: from + m.index!, end: from + m.index! + m[0].length });
  return labels;
}

/** Column blocks that are internally consistent: sources sum to 事業費計(A), and (A)+人件費計(B)=トータルコスト. */
function costBlocks(text: string, from: number, to: number, fixedSources: boolean) {
  const out: { raw: string; start: number; a: string; b: string; t: string }[] = [];
  let pos = from;
  for (const para of text.slice(from, to).split(/\n{2,}/)) {
    const start = text.indexOf(para, pos); pos = start + para.length;
    const lines = para.split('\n');
    // 指標欄の「‐」「―」は値なし（NaN）として残し、行位置は保つ。
    if (!para || !lines.every(l => num.test(l) || /^[‐\-―－]$/.test(l))) continue;
    const v = lines.map(l => num.test(l) ? toNum(l) : NaN), hits: number[] = [];
    for (let i = 0; i + 4 < v.length && i <= 5; i++) {
      if (fixedSources && i !== 5) continue;
      const sources = v.slice(0, i).reduce((s, x) => s + x, 0);
      const whole = [...v.slice(0, i + 1), v[i + 3], v[i + 4]].every(Number.isInteger);
      // 令和2年度様式は空欄の財源が段落の外へ分離することがあるため、財源の一部しか残らない列は 人件費(B)＝延べ業務時間×4千円 で行位置を確かめる。
      const sourcesOk = fixedSources ? sources === v[i] : sources === v[i] || (sources <= v[i] && v[i + 3] === v[i + 2] * 4);
      if (whole && sourcesOk && v[i] + v[i + 3] === v[i + 4]) hits.push(i);
    }
    if (hits.length !== 1) continue;
    const i = hits[0];
    out.push({ raw: para, start, a: lines[i], b: lines[i + 3], t: lines[i + 4] });
  }
  return out;
}

function amountsFor(input: CachedInput, tableStart: number, blocks: NonNullable<ReturnType<typeof costBlocks>>, years: number[]): EvaluationAmount[] {
  const amounts: EvaluationAmount[] = [];
  years.forEach((fy, k) => {
    const blk = blocks[k], raw = input.text.slice(tableStart, blk.start + blk.raw.length);
    for (const [kind, value] of [['actual', blk.a], ['personnel', blk.b], ['fullCost', blk.t]] as const)
      amounts.push({ kind, fiscalYear: fy, amountYen: toNum(value) * 1000, rawValue: value, rawUnit: '千円', evidence: evidence(input, raw, tableStart) });
  });
  return amounts;
}

const R7_CHECKS: [string, string[]][] = [
  ['① 政策体系との整合性', ['見直し余地がある', '結びついている']],
  ['② 公共関与の妥当性', ['見直し余地がある', '妥当である']],
  ['③ 対象・意図の妥当性', ['見直し余地がある', '適切である']],
  ['④ 成果の向上余地', ['向上余地がある', '向上余地がない']],
  ['⑤ 廃止・休止の成果への影響', ['影響がない', '影響がある']],
  ['⑥ 事業費の削減余地', ['削減余地がある', '削減余地がない']],
  ['⑦ 人件費（延べ業務時間）の削減余地', ['削減余地がある', '削減余地がない']],
  ['⑧ 受益機会・費用負担の適正化余地', ['見直し余地がある', '公平・公正である']],
];
const DIRECTION = /(?:^|\n)([１２３] (?:現状維持|改革改善（縮小・統合含む）|終了・廃止・休止))(?=\n)/g;

function r7Ratings(input: CachedInput, from: number, to: number): EvaluationRating[] {
  const t = input.text, ratings: EvaluationRating[] = [];
  const see = t.indexOf('２ 評価の部（SEE）', from), plan = t.indexOf('３ 今後の方向性（次年度計画と予算への反映）', from), boss = t.indexOf('４ 課長等意見', from);
  if (see < 0 || plan < 0 || boss < 0 || !(see < plan && plan < boss && boss < to)) return [];
  const checked = [...t.slice(see, plan).matchAll(/☑ ([^\s☐☑]+)/g)], unchecked = t.slice(see, plan).split('☐').length - 1;
  if (checked.length === 8 && unchecked === 8 && checked.every((m, k) => R7_CHECKS[k][1].includes(m[1])))
    checked.forEach((m, k) => ratings.push({ kind: 'self', label: R7_CHECKS[k][0], value: m[1], scale: R7_CHECKS[k][1].join('／'), evidence: evidence(input, m[0], see + m.index!) }));
  for (const [label, a, b] of [['改革改善の方向性', plan, boss], ['課長等意見 今後の方向性', boss, to]] as const) {
    const found = [...t.slice(a, b).matchAll(DIRECTION)];
    if (found.length !== 1) continue;
    const m = found[0], start = a + m.index! + m[0].indexOf(m[1]);
    ratings.push({ kind: 'self', label, value: m[1], scale: '１ 現状維持／２ 改革改善（縮小・統合含む）／３ 終了・廃止・休止', evidence: evidence(input, m[1], start) });
  }
  return ratings;
}

function parseSheet(input: CachedInput, from: number, to: number, era: 'r2' | 'r7', headerRaw: string | null): Sheet | null {
  const t = input.text, slice = t.slice(from, to);
  const pages = [...slice.matchAll(PAGE2)];
  if (pages.length !== 1) return null;
  const [p2raw, code, name] = pages[0], p2start = from + pages[0].index!;
  const depts = [...slice.matchAll(/^部課名(?: |\n)([^\n]+)$/gm)].filter(m => !/課長名|期間|事務事業区分|根拠法令|^所$/.test(m[1]));
  const dept = depts.length === 1 ? depts[0] : null;
  const table = t.indexOf('(2) 総事業費・指標等の推移', from);
  if (table < 0 || table > p2start) return null;
  const labels = labelRun(t, table, p2start);
  const expected = era === 'r2' ? ['27', '28', '29', '30', '元', '2'] : ['2', '3', '4', '5', '6', '7'];
  const kinds = ['実績', '実績', '実績', '実績', '実績', '目標'];
  if (labels.length !== 6 || labels.map(l => l.year).sort().join() !== [...expected].sort().join()) return null;
  for (const l of labels) if (l.kind !== kinds[expected.indexOf(l.year)]) return null;
  const ordered = labels.every((l, k) => l.year === expected[k]) && labels.every((l, k) => k === 0 || /^\s+$/.test(t.slice(labels[k - 1].end, l.index)));

  const p = project(input, code, name, era === 'r2' ? 2020 : 2025, p2raw, p2start);
  p.evaluatedFiscalYear = era === 'r2' ? 2019 : 2024;
  if (dept) { p.department = dept[1]; p.evidence.push(evidence(input, dept[0], from + dept.index!)); }
  else p.warnings.push('部課名欄の位置が抽出テキストで崩れており、所管課は転記していません。');
  const runRaw = t.slice(labels[0].index, labels[5].end);
  if (era === 'r7') p.evidence.push(evidence(input, headerRaw!, from));
  else p.evidence.push(evidence(input, runRaw, labels[0].index));

  let amountNote = '事業費の表は列（年度）の対応が確定できないため金額を転記していません。';
  if (ordered) {
    const blocks = costBlocks(t, labels[5].end, p2start, era === 'r7');
    if (blocks && blocks.length === 6) {
      const years = era === 'r2' ? [2015, 2016, 2017, 2018, 2019] : [2020, 2021, 2022, 2023, 2024];
      p.amounts.push(...amountsFor(input, labels[0].index, blocks, years));
      amountNote = era === 'r2'
        ? '金額は表頭が平成27～30年度・令和元年度(実績)・令和2年度(目標)の順に並び、列ごとに財源計＝事業費計(A)、(A)＋人件費計(B)＝トータルコストが成立する6列が同順に抽出できた場合のみ、実績5列を転記（2年度目標は除外）。表頭の元号は「元年度」に続く並びから平成27～30年度と判断。'
        : '金額は表頭が令和2～6年度(実績)・7年度(目標)の順に並び、列ごとに5財源の合計＝事業費計(A)、(A)＋人件費計(B)＝トータルコストが成立する6列が同順に抽出できた場合のみ、実績5列を転記（7年度目標は除外）。';
    }
  }
  if (era === 'r7') p.ratings.push(...r7Ratings(input, from, to));
  p.warnings.push(era === 'r2'
    ? '令和2年度様式の事務事業評価シート。評価年度2020・評価対象年度2019は表頭（27年度～元年度が実績、2年度が目標）から判断。評価欄（妥当性・方向性等）は選択印が抽出テキストに残らないため転記していません。'
    : '令和7年度様式（令和6年度実績）の事務事業評価シート。評価欄は☑の付いた選択肢を原文ラベルのまま、各項目ちょうど1つの場合のみ転記。方向性は該当欄に1つだけ記載がある場合のみ転記。',
    amountNote, COMMON_WARNING + '活動・対象・成果指標は空欄行の位置が抽出テキストから確定できないため転記していません。');
  const signature = JSON.stringify([p.projectName, p.department, p.amounts.map(a => [a.kind, a.fiscalYear, a.amountYen]), p.ratings.map(r => [r.label, r.value])]);
  return { code, record: p, signature };
}

function parseDocument(input: CachedInput): Sheet[] {
  const t = input.text;
  if (!t.startsWith('事務事業ID')) return [];
  const starts = [...t.matchAll(R7_START)];
  if (starts.length) {
    const out: Sheet[] = [];
    starts.forEach((m, k) => {
      const from = m.index!, to = k + 1 < starts.length ? starts[k + 1].index! : t.length;
      const close = t.indexOf('年度実績）', from);
      if (close < 0 || close > to || !t.slice(from, close).includes('事務事業評価シート')) return;
      const sheet = parseSheet(input, from, to, 'r7', t.slice(from, close + '年度実績）'.length));
      if (sheet && sheet.code === m[1]) out.push(sheet);
    });
    return out;
  }
  const sheet = parseSheet(input, 0, t.length, 'r2', null);
  return sheet ? [sheet] : [];
}

const cache = new Map<string, Map<string, ProjectEvaluation>>();
/** Group all sheets by 事務事業ID and year across documents; identical reprints merge, conflicts are dropped. */
function resolveAll(inputs: CachedInput[]) {
  const key = inputs.map(i => i.sourceId).join();
  const hit = cache.get(key);
  if (hit) return hit;
  const groups = new Map<string, { owner: string; sheets: Sheet[] }>();
  for (const input of [...inputs].filter(i => !PRIOR_SOURCES.has(i.sourceId)).sort((a, b) => a.sourceId.localeCompare(b.sourceId)))
    for (const s of parseDocument(input)) {
      const k = `${s.code}\n${s.record.evaluationYear}`;
      const g = groups.get(k) ?? { owner: input.sourceId, sheets: [] };
      g.sheets.push(s); groups.set(k, g);
    }
  const byOwner = new Map<string, ProjectEvaluation>();
  for (const [k, g] of groups) {
    if (EXCLUDED.has(k) || !g.sheets.every(s => s.signature === g.sheets[0].signature)) continue;
    const p = g.sheets[0].record;
    for (const s of g.sheets.slice(1)) p.evidence.push(...s.record.evidence);
    if (g.sheets.length > 1) p.warnings.push('同一年度・同一事務事業IDの再掲シートを、名称・所管・金額・評価が一致したため1件に統合。');
    byOwner.set(`${g.owner}\n${k}`, p);
  }
  cache.set(key, byOwner);
  return byOwner;
}
/** Collides with an already structured record of the same business and year; the new side is excluded. */
const EXCLUDED = new Set<string>([]);
/** Documents acquired before batch 7 (already handled by earlier extractors). */
const PRIOR_SOURCES = new Set(['f6f7ac413a1c797626051e56', '8b44126b4b9006a819f443fc', 'edebe6517a8916823284de82']);

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '03203' || PRIOR_SOURCES.has(input.sourceId)) return [];
  const all = resolveAll(inputs.some(i => i.sourceId === input.sourceId) ? inputs : [input]);
  return [...all].filter(([k]) => k.startsWith(input.sourceId + '\n')).map(([, p]) => p);
}

export const ofunatoEntries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '03203': {
    extract,
    scope: '大船渡市の事務事業評価シート（令和2年度様式＝令和元年度実績、令和7年度様式＝令和6年度実績）を1事業1件で構造化。事業名・事務事業ID・部課名、表の列対応を算術で確認できた事業費(A)・人件費(B)・トータルコストの実績、令和7年度様式の☑評価を収録。活動・成果指標、施策・基本事業評価シート、大綱別事業一覧、表頭が標準と異なる年度のシートは対象外。',
  },
};
