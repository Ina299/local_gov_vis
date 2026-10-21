import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

/** 本宮市「平成２１年度実績事務事業評価シート」（1 PDF = 1 事業）。batch7 取得分のみ。 */
const TITLE = '平成２１年度実績事務事業評価シート';
const LABELS = new Set(['基本事業', '前期基本計画主要事業', '基本計画・構想・新規事業']);
const AVG = { 2008: '8,608', 2009: '8,375' } as const;
const num = (s: string) => Number(s.replaceAll(',', ''));
// 事業費計・人数・平均人件費・人件費・総事業費の5値列（ラベルが行末に混入する版も許容）
const COST = /([\d,]+)(?: ①事業費計)?\n(\d+(?:\.\d+)?)(?: ②人数（年）)?\n([\d,]+)(?: ③平均人件費)?\n([\d,]+)(?: ④＝②×③)?\n([\d,]+)/g;
const ROW = /^([①②③④⑤]) ([^\n]+)\n\n([^\n\d]{1,8})\n\n(\S+)\n\n(\S+)\n\n(\S+)\n\n(\S+)$/gm;
const TABLE_HEAD = /平成20年度\n\n平成21年度\n\n（実績）\n\n（実績）\n\n平成22年度\n\n平成25年度\n（目標年度）\n\n/;
const VALUE = /^(?:[\d,]+(?:\.\d+)?[^\s\d,.]{0,4}|[‑-])$/;

function findName(input: CachedInput, head: string): { name: string; raw: string; start: number } | null {
  const sub = input.text.match(/細々目\n\n\d+\n\n([^\n]+)/)?.[1];
  const lines = [...head.matchAll(/^[^\n]*$/gm)];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i][0];
    if (/^[^\s（(]\S*(?:事業|事務)$/.test(line) && !LABELS.has(line)) return { name: line, raw: line, start: lines[i].index! };
    const next = lines[i + 1]?.[0];
    if (sub && next && line && !/(?:事業|事務)$/.test(line) && /(?:事業|事務)$/.test(next) && line + next === sub)
      return { name: sub, raw: `${line}\n${next}`, start: lines[i].index! };
  }
  return null;
}

function build(input: CachedInput): ProjectEvaluation | null {
  const text = input.text, titleAt = text.indexOf(TITLE), headEnd = text.indexOf('作成日');
  if (titleAt < 0 || titleAt > 40 || headEnd < 0 || !text.includes('本宮市行政評価システム')) return null;
  // 予算科目（会計・款・細目…）の名称と取り違えないよう、事業名は予算科目欄より前にあるものだけ
  const budgetAt = Math.min(...['\n会計\n', '細目', '款'].map(k => text.indexOf(k)).filter(i => i >= 0), headEnd);
  const found = findName(input, text.slice(0, budgetAt));
  if (!found) return null;
  const codes = [...new Set(text.match(/\b\d{2}‑\d{9}‑\d{2}\b|\b\d{2}‑\d{11}\b/g) ?? [])];
  const p = project(input, codes.length === 1 ? codes[0] : found.name, found.name, null, found.raw, found.start);
  p.evaluatedFiscalYear = 2009;
  p.evidence.push(evidence(input, TITLE, titleAt));
  if (codes.length === 1) p.evidence.push(evidence(input, codes[0]));
  const dept = text.match(/担当部課等\n\n(\S+部)\n\n(\S+課)\n\n担当係/);
  if (dept) { p.department = `${dept[1]} ${dept[2]}`; p.evidence.push(evidence(input, dept[0], dept.index)); }

  // 費用: 内部整合（人数×平均人件費≒人件費、事業費計＋人件費＝総事業費）が取れる列だけ。
  // 年度列は「平成20年度（決算）→平成21年度（決算）」の出現順と、各年度共通の平均人件費の両方が一致する場合のみ確定扱い。
  const blocks = [...text.matchAll(COST)].filter(m => {
    const [, a, n, avg, l, t] = m;
    return (avg === AVG[2008] || avg === AVG[2009]) && Math.abs(Number(n) * num(avg) - num(l)) <= 1 && num(a) + num(l) === num(t);
  });
  const h20 = text.indexOf('平成20年度（決算）'), h21 = text.indexOf('平成21年度（決算）');
  if (blocks.length === 2 && blocks[0][3] === AVG[2008] && blocks[1][3] === AVG[2009] && h20 >= 0 && h21 > h20 && text.includes('（千円）')) {
    for (const [i, year] of [[0, 2008], [1, 2009]] as const) {
      const m = blocks[i], ev = () => evidence(input, m[0], m.index);
      p.amounts.push({ kind: 'actual', fiscalYear: year, amountYen: num(m[1]) * 1000, rawValue: m[1], rawUnit: '千円', evidence: ev() });
      p.amounts.push({ kind: 'personnel', fiscalYear: year, amountYen: num(m[4]) * 1000, rawValue: m[4], rawUnit: '千円', evidence: ev() });
      p.amounts.push({ kind: 'fullCost', fiscalYear: year, amountYen: num(m[5]) * 1000, rawValue: m[5], rawUnit: '千円', evidence: ev() });
    }
    p.warnings.push('費用は「事業費計（直接事業費）」を決算、「④＝②×③」を人件費、「総事業費 ①+④」を総コストとして千円→円換算。列の年度は出現順（平成20年度→21年度）と平均人件費（8,608／8,375千円）が一致し、人数×平均人件費・事業費計＋人件費＝総事業費が成り立つ場合のみ採用。財源内訳は未構造化。');
  } else p.warnings.push('費用表は段組み崩れで年度列との対応が確定できないため金額を構造化していません。');

  // 指標: 見出し行が正順に並ぶ表で、1行に4値が並ぶものだけ。平成22年度列（見込・計画の別が不明）は採用しない。
  for (const [section, label] of [['○事務事業の実績', '活動指標'], ['○事務事業の成果', '成果指標']] as const) {
    const s = text.indexOf(section);
    if (s < 0) continue;
    const nextSection = text.indexOf('○', s + 1), e = nextSection < 0 ? text.length : nextSection;
    const block = text.slice(s, e), head = block.match(TABLE_HEAD);
    if (!head) continue;
    for (const r of block.slice(head.index! + head[0].length).matchAll(ROW)) {
      const [raw, , name, unit, v20, v21, , v25] = r;
      if (![r[4], r[5], r[6], r[7]].every(v => VALUE.test(v))) continue;
      const at = s + head.index! + head[0].length + r.index!, ev = () => evidence(input, raw, at);
      const dash = (v: string) => /^[‑-]$/.test(v) ? null : v;
      const indicatorName = `${label}：${name}`;
      if (dash(v20)) p.indicators.push({ name: indicatorName, fiscalYear: 2008, target: null, actual: v20, unit, evidence: ev() });
      if (dash(v21)) p.indicators.push({ name: indicatorName, fiscalYear: 2009, target: null, actual: v21, unit, evidence: ev() });
      if (dash(v25)) p.indicators.push({ name: indicatorName, fiscalYear: 2013, target: v25, actual: null, unit, evidence: ev() });
    }
  }
  p.warnings.push('評価シートの1次・2次評価、今後の方向性はチェック欄の選択状態がテキストに残らないため構造化していません。指標は平成20・21年度実績と平成25年度（目標年度）の値のみ。評価実施年度は本文に明示がないためnull（作成日は平成22年）。');
  return p;
}

let cache: { inputs: CachedInput[]; bySource: Map<string, ProjectEvaluation> } | null = null;
function all(inputs: CachedInput[]): Map<string, ProjectEvaluation> {
  if (cache?.inputs === inputs) return cache.bySource;
  const built = inputs.map(i => [i.sourceId, build(i)] as const).filter((x): x is readonly [string, ProjectEvaluation] => !!x[1]);
  // 同名事業が複数シートにある場合は対応が確定できないため両方除外
  const count = new Map<string, number>();
  for (const [, p] of built) count.set(p.projectName, (count.get(p.projectName) ?? 0) + 1);
  const bySource = new Map(built.filter(([, p]) => count.get(p.projectName) === 1));
  // 整理番号が別事業のシートと重複する場合（例: 自立支援事業と生活保護事業）は識別子として使わない
  const codeCount = new Map<string, number>();
  for (const p of bySource.values()) if (p.projectCode !== p.projectName) codeCount.set(p.projectCode!, (codeCount.get(p.projectCode!) ?? 0) + 1);
  for (const p of bySource.values()) {
    if (p.projectCode === p.projectName) p.projectCode = null;
    else if (codeCount.get(p.projectCode!)! > 1) { p.warnings.push(`整理番号${p.projectCode}が別事業のシートと重複するためprojectCodeには採用していません。`); p.projectCode = null; }
  }
  cache = { inputs, bySource };
  return bySource;
}

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '07214': {
    scope: '平成21年度実績の事務事業評価シート（1PDF1事業）から事業名・整理番号・平成20/21年度の事業費・人件費・総事業費（列対応が検算で確定するもののみ）と活動/成果指標の実績・目標を構造化。1次・2次評価や方向性（チェック欄）、財源内訳、事業概要は対象外。',
    extract: (input, inputs) => {
      if (input.municipalityCode !== '07214') return [];
      const p = all(inputs.length ? inputs : [input]).get(input.sourceId);
      return p ? [p] : [];
    },
  },
};
