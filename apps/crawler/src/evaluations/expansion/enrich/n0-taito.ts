import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project, stableId } from '../shared';
import { amount, nfkc, num } from '../batch9/i1-util';

// ------------------------------------------------------------------ 台東区（令和元年度 事務事業評価シート PDFdata/NNN.pdf）
// 抽出テキストは様式の欄順が崩れているため、欄の位置ではなく原文に印字された値どうしの検算で対応を確定する。
const LIST_SOURCE = 'f6042ad2f86315f4e34339a4'; // 令和元年度 事務事業評価結果（HTML一覧）。事業名の特定にだけ使い、値は取らない。
const MONEY = /^(\d{1,3}(?:,\d{3})*|0)$/;
const VALUE = /^(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?|[-－―])$/;
const RATE = /^(\d+(?:\.\d+)?%|[-－―])$/;
const NONE = /^[-－―]$/;
const BOUNDARY = /^(達成率|単位|目標値|実績|別|指標の名称|活動指標|成果指標|事\n務\n事\n業\nの\n実\n績)$/;

/** 一覧表の行（No.・所管部・所管課・事務事業名）。シート上の事業名行の特定に使う。 */
function listRows(inputs: CachedInput[]): { no: string; bu: string; ka: string; name: string }[] {
  const list = inputs.find(i => i.sourceId === LIST_SOURCE && i.municipalityCode === '13106');
  if (!list || !list.text.startsWith('令和元年度 事務事業評価結果')) return [];
  return [...list.text.matchAll(/^(\d+)\n([^\n]*(?:部|委員会|事務局))\n([^\n]+)\n([^\n]+)\n/gm)].map(m => ({ no: m[1], bu: m[2], ka: m[3], name: m[4] }));
}

/** 空行で区切られたブロック（折り返しのある欄は1ブロック内の改行）と絶対位置。 */
function blocks(text: string, base: number): { start: number; s: string }[] {
  return [...text.matchAll(/[^\n]+(?:\n[^\n]+)*/g)].map(m => ({ start: base + m.index!, s: m[0] }));
}

export function extractTaitoSheet(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '13106' || input.format !== 'pdf' || !/\/jimujigyo01\/PDFdata\/\d+\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text;
  const title = '令和元年度 事務事業評価シート';
  if (!t.startsWith(title) || !/事業内容\n\[H30年度\]/.test(t)) return [];
  const lineSet = new Map<string, { start: number; s: string }>();
  for (const m of t.matchAll(/^[^\n]+$/gm)) { const k = nfkc(m[0]); if (!lineSet.has(k)) lineSet.set(k, { start: m.index!, s: m[0] }); }
  // 事業名: 一覧表の行のうち、事業名・所管部・所管課の3つがすべてシートの1行として現れるものがちょうど1つのとき、そのシートの行。
  const hits = listRows(inputs).filter(r => lineSet.has(nfkc(r.name)) && lineSet.has(nfkc(r.bu)) && lineSet.has(nfkc(r.ka)));
  if (hits.length !== 1) return [];
  const name = lineSet.get(nfkc(hits[0].name))!, bu = lineSet.get(nfkc(hits[0].bu))!, ka = lineSet.get(nfkc(hits[0].ka))!;
  const p = project(input, `sheet:${nfkc(name.s)}`, name.s.trim(), 2019, name.s, name.start);
  p.projectCode = null; p.id = stableId(input, `enrich-sheet:${nfkc(name.s)}`, 2019);
  p.evaluatedFiscalYear = 2018; p.department = `${bu.s.trim()} ${ka.s.trim()}`;
  p.evidence.push(evidence(input, title, 0), evidence(input, bu.s, bu.start), evidence(input, ka.s, ka.start));
  const fy = t.indexOf('事業内容\n[H30年度]'); p.evidence.push(evidence(input, '事業内容\n[H30年度]', fy));

  // 事務事業コスト（千円、H28〜H30年度決算額）: 「決算額」から評価欄までの金額行を順に並べ、
  // 人件費・物件費・その他（各3年度）の和＝総経費、受益者負担・その他特定財源・一般財源の和＝総経費 がすべての年度で一致する並びが1つだけのとき採用。
  const costAt = t.indexOf('H28年度\n決算額'), end = t.search(/\n評価\n\n評価の理由|\n必要性\n/);
  if (costAt >= 0 && end > costAt && /H29年度/.test(t) && /H30年度/.test(t) && t.indexOf('人にかかるコスト（人件費など）') >= 0) {
    const toks = [...t.slice(costAt, end).matchAll(/^[^\n]+$/gm)].filter(m => MONEY.test(m[0])).map(m => ({ start: costAt + m.index!, s: m[0], v: num(m[0]) }));
    const tri = (i: number) => [0, 1, 2].map(k => toks[i + k]);
    const sum = (...xs: number[]) => [0, 1, 2].map(k => xs.reduce((s, i) => s + toks[i + k].v, 0));
    const found = [];
    for (let i = 9; i + 11 < toks.length; i++) {
      const T = tri(i).map(x => x.v);
      if (sum(i - 9, i - 6, i - 3).every((v, k) => v === T[k]) && sum(i + 3, i + 6, i + 9).every((v, k) => v === T[k])) found.push(i);
    }
    if (found.length === 1) {
      const i = found[0], to = toks[i + 11].start + toks[i + 11].s.length;
      const raw = t.slice(costAt, to);
      for (const [o, kind] of [[-9, 'personnel'], [0, 'fullCost']] as const)
        tri(i + o).forEach((x, k) => p.amounts.push(amount(input, kind, 2016 + k, x.s, '千円', raw, costAt)));
    }
  }

  // 指標: 「指標の名称・単位・R2年度目標値・H28実績・H29実績・H30実績・H30目標値・達成率」の8ブロックが連続する行。
  // H30の実績/目標値（または減少目標の目標値/実績）が達成率と一致しない行が1つでもあれば、そのシートの指標は採用しない。
  const ind = t.indexOf('指標の名称');
  if (ind >= 0 && /R２年度/.test(t) && /達成率/.test(t) && costAt > 0) {
    const bs = blocks(t.slice(0, costAt), 0);
    const rows: ProjectEvaluation['indicators'] = [];
    let bad = false, last = -1;
    for (let j = 1; j + 7 < bs.length; j++) {
      const [nm, unit, ...vs] = bs.slice(j, j + 8);
      const vals = vs.slice(0, 5).map(b => b.s), rate = vs[5].s;
      if (!vals.every(v => VALUE.test(v)) || !RATE.test(rate) || vals.every(v => NONE.test(v))) continue;
      if (/^[\d,.%()（）\-－―]+$/.test(nm.s) || /^(達成率|単位|目標値|実績|別|指標の名称|活動指標|成果指標|委託内容)$/.test(nm.s) || nm.s.length > 60) continue;
      // 名称の直前は表頭の欄名・縦書きの区分名・直前の行の達成率のいずれか（名称が別ブロックに割れた行を取らない）。
      if (j - 1 !== last && !BOUNDARY.test(bs[j - 1].s)) continue;
      if (!/^[^\d\n]{1,6}$/.test(unit.s) || NONE.test(unit.s)) continue;
      const [r2, h28, h29, h30, t30] = vals.map(v => NONE.test(v) ? null : v);
      if (h30 && t30 && !NONE.test(rate)) {
        const r = Number(rate.replace('%', '')), a = num(h30), g = num(t30);
        const ok = (x: number) => Number.isFinite(x) && Math.abs(Math.round(x * 1000) / 10 - r) <= 0.11;
        if (!(g && ok(a / g)) && !(a && ok(g / a))) { bad = true; break; }
      }
      const raw = t.slice(nm.start, vs[5].start + rate.length);
      const name = nm.s.replace(/\n/g, ''), u = unit.s;
      const ev = () => evidence(input, raw, nm.start);
      if (h28) rows.push({ name, fiscalYear: 2016, target: null, actual: h28, unit: u, evidence: ev() });
      if (h29) rows.push({ name, fiscalYear: 2017, target: null, actual: h29, unit: u, evidence: ev() });
      if (h30 || t30) rows.push({ name, fiscalYear: 2018, target: t30, actual: h30, unit: u, evidence: ev() });
      if (r2) rows.push({ name, fiscalYear: 2020, target: r2, actual: null, unit: u, evidence: ev() });
      j += 7; last = j;
    }
    const keys = rows.map(r => `${nfkc(r.name)}|${r.fiscalYear}`);
    if (!bad && new Set(keys).size === keys.length) p.indicators.push(...rows);
  }

  // 評価の視点（1〜5）: 「必要性」「効率性」「手段の適切性」の直後のブロックが1桁の数字のとき。目的達成度は欄の位置が崩れるため対象外。
  for (const label of ['必要性', '効率性', '手段の適切性']) {
    const ms = [...t.matchAll(new RegExp(`\\n${label}\\n\\n([1-5])\\n\\n`, 'g'))];
    if (ms.length !== 1) continue;
    const m = ms[0];
    p.ratings.push({ kind: 'self', label, value: m[1], scale: null, evidence: evidence(input, m[0].trim(), m.index! + 1) });
  }
  if (!p.amounts.length && !p.indicators.length && !p.ratings.length) return [];
  p.warnings.push('令和元年度 事務事業評価シート（評価対象はH30年度）。事業名は区の事務事業評価一覧表の行（事業名・所管部・所管課）がシートの行としてそろって現れるものに限り特定。' +
    '事務事業コストは抽出テキストの欄順が崩れているため、H28〜H30年度決算額の人件費＋物件費＋その他＝総経費、受益者負担＋その他特定財源＋一般財源＝総経費の検算が全年度で一致する並びが1つに定まる場合のみ、人件費と総経費を収録。' +
    '指標は名称・単位・R2年度目標値・H28〜H30実績・H30目標値・達成率が連続し、達成率が実績と目標値から再計算できる場合のみ収録（活動・成果の区分は欄の位置が崩れるため未収録）。');
  return [p];
}
