import type { EvaluationAmount, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 湯河原町（令和７年度事務事業評価シート）
// 公開済みレコードは「令和７年度事務事業評価 対象事業一覧」（16450.pdf）の事業名・一次評価・二次評価。
// 同じ事業の評価シート（課別PDF）から、決算年度（令和５・６年度）の事業費・人件費合計・総事業費、5段階評価、
// 指標（1行だけの表）を取る。令和７年度（見込）列は見込額のため対象外。
const SHEETS = new Set(('05e27f398d0b6c59eb2b13b7 079fc34fb46a0470e5c29ff3 2281e9d295cdc49913aacc33 28626e14349fb9033098d3f5 2c147ceea22a6fe64a3b2c34 '
  + '453883207034875a1372ac77 4a196e194085c941cff00e72 4cc96be792bc4256c7e80b9a 4e53b926535db6d154fcc819 568c1d326a84812ae1f613eb 586fd747e32a1e81e8bae706 '
  + '5ff37b178efa3d298313e35f 627927e9fcab0de261d04764 6cfa11ac32a674db807496dc 6d007b92ff71ce7860ca1294 79103a64054f307488a0e6f5 823b9be22ee9f0a290a7e628 '
  + '8f9fbfe4167ac6b7ecb558f4 99dc58304c2c87f8193bf7e0 9e2fc9b1d832b501f48c2b52 a117a3b3d815e5ec5bbae350 b1de16c30acd1db3cdafc412 b90b97636d251993a2a39c5d '
  + 'bd7c7301cf917e207eaac7d2 c13ab561ae0c4fdd1afa715a c1497d512c98a706331917ff cd65229ce2fc1623d0ca3fec d88234e70824f88f7c9e8259 dd0b4440e54dc3ce05d6172a').split(' '));
const SHEET_HEAD = /^令和７年度事務事業評価シート\n/gm;
const YEAR: Record<string, number> = { '５': 2023, '６': 2024 };
const N = '([\\d,]+)';
const num = (s: string) => Number(s.replaceAll(',', ''));
const SCALE_TEXT = '５：高い ４：やや高い ３：普通 ２：やや低い １：低い';
const OVERALL = /^(継続（[^）\n]+）|廃止・中止|完了|休止|統合)$/;

type Cost = { fy: number; actual: string; personnel: string; total: string };

/** 「２ 実施結果」の費用表。列の読み順が版ごとに違うため、合計が検算できる4つの並びだけを読む。 */
function costs(seg: string): { costs: Cost[]; raw: string; at: number } | null {
  // (1) 行ごと: 区分の後に3列の年度見出し、「事業費」「人件費合計」「総事業費」の各行に3つの数値。
  const header = '令和５年度（決算）\n令和６年度（決算）\n令和７年度（見込）\n';
  const rows = new RegExp(`\\n事業費\\n${N}\\n${N}\\n${N}\\n[\\s\\S]{0,200}?人件費合計\\n${N}\\n${N}\\n${N}\\n総事業費\\n${N}\\n${N}\\n${N}\\n`).exec(seg);
  if (rows && seg.lastIndexOf(header, rows.index) >= 0 && seg.indexOf(header) === seg.lastIndexOf(header)) {
    const v = rows.slice(1);
    if ([0, 1, 2].every(k => num(v[k]) + num(v[3 + k]) === num(v[6 + k])))
      return { costs: [0, 1].map(k => ({ fy: 2023 + k, actual: v[k], personnel: v[3 + k], total: v[6 + k] })), raw: rows[0].slice(1), at: rows.index + 1 };
    return null;
  }
  const unit = seg.indexOf('(単位 円）\n\n');
  if (unit < 0 || seg.indexOf('(単位 円）\n\n', unit + 1) >= 0) return null;
  const body = seg.slice(unit);
  // (2) 3列が縦に並ぶ: 事業費・常勤職員・会計年度任用職員等・人件費合計・総事業費・財源5行・財源合計の各3列。
  const grid = new RegExp(`^\\(単位 円）\\n\\n${header}((?:[\\d,]+\\n){33})`).exec(body);
  if (grid) {
    const v = grid[1].trim().split('\n').map(num), r = (i: number, c: number) => v[3 * i + c];
    const ok = [0, 1, 2].every(c => r(0, c) + r(3, c) === r(4, c) && r(1, c) + r(2, c) === r(3, c)
      && r(5, c) + r(6, c) + r(7, c) + r(8, c) + r(9, c) === r(10, c) && r(10, c) === r(4, c));
    if (!ok) return null;
    const s = grid[1].trim().split('\n');
    return { costs: [0, 1].map(c => ({ fy: 2023 + c, actual: s[c], personnel: s[9 + c], total: s[12 + c] })), raw: grid[0], at: unit };
  }
  // (3) 年度ごとに「事業費（＋常勤職員）」、続いて同じ年度順に「人件費合計・総事業費（＋財源）」の塊。
  const groups = /^\(単位 円）\n\n((?:令和[５６７]年度（(?:決算|見込)）\n(?:[\d,]+\n){1,2}\n)+)/.exec(body);
  if (groups) {
    const years = [...groups[1].matchAll(/令和([５６７])年度（(決算|見込)）\n((?:[\d,]+\n){1,2})\n/g)];
    let at = groups[0].length;
    const tails: string[][] = [];
    for (let k = 0; k < years.length; k++) {
      const m = /^([\d,]+)\n([\d,]+)\n(?:[\d,]+\n)*\n/.exec(body.slice(at));
      if (!m) return null;
      tails.push([m[1], m[2]]); at += m[0].length;
    }
    const out: Cost[] = [];
    for (const [k, y] of years.entries()) {
      const [x, staff] = y[3].trim().split('\n'), [personnel, total] = tails[k];
      if ((staff !== undefined && staff !== personnel) || num(x) + num(personnel) !== num(total)) return null;
      if (y[2] === '決算' && YEAR[y[1]]) out.push({ fy: YEAR[y[1]], actual: x, personnel, total });
    }
    // 見出しの年度は昇順で重複しないこと。
    const order = years.map(y => '５６７'.indexOf(y[1]));
    if (order.some((o, i) => i > 0 && o <= order[i - 1])) return null;
    return out.length ? { costs: out, raw: body.slice(0, at), at: unit } : null;
  }
  // (4) 令和５年度（決算）の列だけが縦に並ぶ: 事業費・常勤職員・会計年度任用職員等・人件費合計・総事業費。
  const col = /^\(単位 円）\n\n令和５年度（決算）\n([\d,]+)\n([\d,]+)\n([\d,]+)\n([\d,]+)\n([\d,]+)\n/.exec(body);
  if (col && num(col[2]) + num(col[3]) === num(col[4]) && num(col[1]) + num(col[4]) === num(col[5]))
    return { costs: [{ fy: 2023, actual: col[1], personnel: col[4], total: col[5] }], raw: col[0], at: unit };
  return null;
}

/** 「３ 令和６年度までの事業分析及び改善点」の5段階評価。項目名から次の項目名までに独立した数字が1つだけある項目のみ。 */
function scores(input: CachedInput, seg: string, base: number): ProjectEvaluation['ratings'] {
  const s = seg.indexOf('３ 令和６年度までの事業分析及び改善点'), e = seg.indexOf('４ 見直し及び改善', s);
  if (s < 0 || e < 0 || !seg.slice(s, e).includes(`（${SCALE_TEXT}）`)) return [];
  const labels = ['必 要 性', '効 率 性', '有 効 性', '公 平 性', '類 似 性'];
  const section = seg.slice(s, e);
  if (labels.some(l => section.split(l).length !== 2)) return [];
  const marks = labels.map(l => ({ l, at: s + section.indexOf(l) }));
  const self = seg.indexOf('令和６年度までの\n', s);
  const stops = [...marks.map(m => m.at), self < 0 ? e : Math.min(self, e), e].sort((a, b) => a - b);
  const out: ProjectEvaluation['ratings'] = [];
  for (const m of marks.slice(0, 4)) {
    const end = stops.find(x => x > m.at)!, part = seg.slice(m.at, end);
    const hits = [...part.matchAll(/(?<=^|\s)([１-５])(?=\s|$)/g)];
    if (hits.length !== 1) continue;
    const raw = part.slice(0, hits[0].index! + 1);
    out.push({ kind: 'self', label: m.l.replaceAll(' ', ''), value: hits[0][1], scale: SCALE_TEXT, evidence: evidence(input, raw, base + m.at) });
  }
  return out;
}

/** 指標表のうち、指標名1行・「理由 単位」1行・3つの値の後に空行（0）が続く、指標が1つだけの表。 */
function indicators(input: CachedInput, seg: string, base: number): ProjectEvaluation['indicators'] {
  const out: ProjectEvaluation['indicators'] = [];
  const re = /(活動指標|成果指標)\n指標設定の理由・考え方\n単位 令和５年度 令和６年度 目標値\n([^\s]+)\n[^\n]* ([^\s\d]{1,6})\n(\d+(?:\.\d+)?)\n(\d+(?:\.\d+)?)\n(\d+(?:\.\d+)?)\n0\n0\n0\n(?=成果指標\n|\n)/g;
  for (const m of seg.matchAll(re)) {
    const ev = evidence(input, m[0], base + m.index!), name = m[2], unit = m[3];
    out.push({ name, fiscalYear: 2023, target: null, actual: m[4], unit, evidence: ev });
    out.push({ name, fiscalYear: 2024, target: null, actual: m[5], unit, evidence: ev });
    out.push({ name, fiscalYear: null, target: m[6], actual: null, unit, evidence: ev });
  }
  return out;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '14384' || !SHEETS.has(input.sourceId)) return [];
  const t = input.text, starts = [...t.matchAll(SHEET_HEAD)].map(m => m.index!), out: ProjectEvaluation[] = [];
  const seen = new Map<string, number>();
  for (let i = 0; i < starts.length; i++) {
    if (input.truncated && i === starts.length - 1) continue;
    const start = starts[i], seg = t.slice(start, starts[i + 1] ?? t.length);
    const names = [...seg.slice(0, 400).matchAll(/\n事 務 事 業 名 ([^\n]+)\n/g)];
    if (names.length !== 1 || !seg.includes('１ 事業概要（令和６年度）')) continue;
    const name = names[0][1].trim(), k = (seen.get(name) ?? 0) + 1;
    seen.set(name, k);
    const p = project(input, `${name}#${k}`, name, 2025, seg.slice(0, names[0].index! + names[0][0].length - 1), start);
    p.projectCode = null; p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, '１ 事業概要（令和６年度）', start + seg.indexOf('１ 事業概要（令和６年度）')));
    const c = costs(seg);
    if (c) {
      const ev = evidence(input, c.raw, start + c.at);
      p.evidence.push(evidence(input, '(単位 円）', start + seg.indexOf('(単位 円）')));
      for (const x of c.costs) for (const [kind, raw] of [['actual', x.actual], ['personnel', x.personnel], ['fullCost', x.total]] as const)
        p.amounts.push({ kind, fiscalYear: x.fy, amountYen: num(raw), rawValue: raw, rawUnit: '円', evidence: ev } satisfies EvaluationAmount);
    }
    p.ratings.push(...scores(input, seg, start));
    for (const [label, re] of [['1次評価', /５ 一次評価（令和８年度以降の方向性に対する評価）\n総合評価\n\n([^\n]+)\n/], ['2次評価', /７ 二次評価（[^\n]*\n総合評価\n\n([^\n]+)\n/]] as const) {
      const m = re.exec(seg);
      if (m && OVERALL.test(m[1])) p.ratings.push({ kind: 'self', label, value: m[1], scale: null, evidence: evidence(input, m[0].trimEnd(), start + m.index) });
    }
    p.indicators.push(...indicators(input, seg, start));
    p.warnings.push('令和７年度事務事業評価シート（事業概要は令和６年度）。事業費（決算）・人件費合計・総事業費は令和５・６年度の決算列のみで、各年度「事業費＋人件費合計＝総事業費」（版によっては人件費・財源の内訳も）が成り立つ表だけを採用。令和７年度（見込）は対象外。'
      + '5段階評価（必要性・効率性・有効性・公平性）は項目名から次の項目名までに数字が1つだけの項目のみ。一次・二次評価の総合評価は一覧と同じ表記の場合のみ。指標は指標が1つだけの表（指標名と「理由 単位」が別行）のみ、目標値は年度の記載がないため年度なし。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '湯河原町 令和７年度事務事業評価シート（課別PDF）: 決算額（令和５・６年度の事業費・人件費合計・総事業費。検算できる表のみ）、5段階評価、一次・二次総合評価、1行だけの指標表。',
};
