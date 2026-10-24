import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EvaluationDataset, EvaluationIndicator, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, nfkc, num, type Entry } from '../batch9/i1-util';
import { municipalityRecords } from '../batch11/k0-util';
import { priorRecords } from '../run-context';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../..');

let round5: Set<string> | null = null;
/** Only documents first acquired in collection round 5 (collected-sources-batch11.json) are structured. */
function isRound5(input: CachedInput): boolean {
  round5 ??= new Set(JSON.parse(readFileSync(join(root, 'data/evaluations/collected-sources-batch11.json'), 'utf8')).sources.map((s: { sourceId: string }) => s.sourceId));
  return round5.has(input.sourceId);
}
// Published before this run (supplied by the runner), so a replay sees the same set.
const publishedSakai = (): ProjectEvaluation[] => priorRecords('27140');
/**
 * The published records are the rows of the same 令和8年度 sheet lists (name + 所管部課, evaluationYear only), so a sheet whose
 * business name already appears for the same evaluation year is the same business; it is excluded whatever the department spelling.
 */
function alreadyPublished(p: ProjectEvaluation): boolean {
  return publishedSakai().some(old => nfkc(old.projectName) === nfkc(p.projectName) && (old.evaluationYear === null || old.evaluationYear === p.evaluationYear));
}

// ---------------------------------------------------------------- 堺市（令和8年度 事務事業評価シート（1）（2）、1事業1PDF）
const HEAD = /^令和8年度 事務事業評価シート（1）\n\[ 令和7年度事務事業 \]\n/;
const COST_HEAD = '令和5年度\n\n令和6年度\n\n決算\n\n決算\n\n（単位：千円）\n\n令和7年度\n当初予算\n\n令和8年度\n決算\n\n当初予算';
const N = String.raw`\d{1,3}(?:,\d{3})*`;
/** Column order of the cost table: 令和5年度決算／令和6年度決算／令和7年度当初予算／令和7年度決算／令和8年度当初予算. */
const COLUMNS: { fy: number; kind: 'budget' | 'actual' }[] = [
  { fy: 2023, kind: 'actual' }, { fy: 2024, kind: 'actual' }, { fy: 2025, kind: 'budget' }, { fy: 2025, kind: 'actual' }, { fy: 2026, kind: 'budget' },
];
const rate = (target: string, actual: string) => Math.round(num(actual) / num(target) * 100);
const isNumber = (s: string) => /^\d+(?:\.\d+)?$/.test(nfkc(s).replace(/,/g, '')) && num(s) > 0;

function row(text: string, label: string, count: number): { values: string[]; start: number; raw: string } | null {
  const m = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}((?:\\n\\n${N}){${count}})`).exec(text);
  if (!m) return null;
  return { values: m[1].split('\n\n').slice(1), start: m.index, raw: m[0] };
}

function extractSakai(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '27140' || !HEAD.test(input.text)) return [];
  const t = input.text;
  const s2 = t.indexOf('\n令和8年度 事務事業評価シート（2）\n');
  if (s2 < 0) return [];
  const id = /\n事務事業名\n\n([^\n]+)\n\n事業番号\n\n(\d{3}-\d{3})\n/.exec(t.slice(s2));
  if (!id) return [];
  const name = id[1].trim(), code = id[2];
  const header = /事務事業名\n\n[\s\S]*?Ⅰ．基本情報/.exec(t);
  if (!header || !header[0].includes(`\n${name}\n`) || !header[0].includes(`\n${code}\n`)) return [];
  const p = project(input, code, name, 2026, header[0], header.index);
  p.evidence.push(evidence(input, t.slice(0, t.indexOf(']') + 1), 0), evidence(input, id[0].trim(), s2 + id.index + 1));
  p.evaluatedFiscalYear = 2025;
  // 担当部署名: 局・部・課の値セルが欄名（局／部／課）と分離して出力される。値が3つで局→部の順に並ぶ場合のみ収録。
  const cellsAfter = header[0].slice(header[0].indexOf('担当部署名')).split(/\n+/).slice(1, -1)
    .filter(s => !['局', '部', '課', '事務事業分類', '事業番号', code].includes(s) && !/^[A-G] /.test(s));
  if (cellsAfter.length === 3 && /局$/.test(cellsAfter[0]) && /部$/.test(cellsAfter[1]) && /(?:課|室|所|センター)$/.test(cellsAfter[2])) p.department = cellsAfter.join(' ');
  else p.warnings.push('担当部署名の局・部・課の値セルの対応が抽出テキストで確定しないため担当課は未収録。');
  const purpose = /\n7 事業の目的\n\n([^\n]+(?:\n[^\n]+)*)\n\n/.exec(t);
  if (purpose && !/対象数|単位/.test(purpose[1])) p.purpose = purpose[1].replace(/\n/g, '');

  // Ⅲ．投入量（千円）: 事業費(a)＋人件費(b)＝年間経費(c) が列ごとに一致する列のみ採用。0 は未計上の可能性があるため収録しない。
  const cost = t.indexOf(COST_HEAD, s2);
  const a = cost < 0 ? null : row(t.slice(cost), '事業費 (a)', 5);
  let b = cost < 0 ? null : row(t.slice(cost), '14 人件費 （ｂ）', 5);
  let c = cost < 0 ? null : row(t.slice(cost), '15 年間経費 (ｃ)=(ａ)+(ｂ)', 5) ?? row(t.slice(cost), '15 年間経費 (ｃ)=(ａ)+(ｂ)', 4);
  if (a && cost >= 0) {
    // 人件費(b)・年間経費(c)の欄名が続けて出力され、その後に b の5列・c の5列が並ぶ配置。
    const bc = row(t.slice(cost), '14 人件費 （ｂ）\n15 年間経費 (ｃ)=(ａ)+(ｂ)', 10);
    // この配置では「15 年間経費」の直後の5値は b の値なので、個別の行読みより優先する。
    if (bc) { b = { ...bc, values: bc.values.slice(0, 5) }; c = { ...bc, values: bc.values.slice(5) }; }
  }
  if (a && b && c) {
    p.evidence.push(evidence(input, COST_HEAD, cost));
    const [ra, rb, rc] = [a, b, c].map(r => ({ ...r, start: cost + r.start }));
    let checked = 0;
    c.values.forEach((cv, i) => {
      if (num(a.values[i]) + num(b.values[i]) !== num(cv)) return;
      checked++;
      const col = COLUMNS[i];
      if (num(a.values[i]) > 0) p.amounts.push(amount(input, col.kind, col.fy, a.values[i], '千円', ra.raw, ra.start));
      if (col.kind !== 'actual') return;
      if (num(b.values[i]) > 0) p.amounts.push(amount(input, 'personnel', col.fy, b.values[i], '千円', rb.raw, rb.start));
      if (num(cv) > 0) p.amounts.push(amount(input, 'fullCost', col.fy, cv, '千円', rc.raw, rc.start));
    });
    if (checked < c.values.length) p.warnings.push('事業費(a)＋人件費(b)＝年間経費(c)の検算が合わない列は金額を未収録。');
    p.warnings.push('金額は「Ⅲ．投入量」事業コスト表（千円）の列順（令和5年度決算／令和6年度決算／令和7年度当初予算／令和7年度決算／令和8年度当初予算）で収録。当初予算は前年度からの繰越分を含む（原文注記）。人件費・年間経費は決算列のみ収録。0 の値は収録していない。');
  } else p.warnings.push('事業コスト表の行が抽出テキストで分断されているため金額は未収録。');

  // 成果指標（11）: 令和12年度目標列をもつ値ブロックが1つだけあり、達成率の検算が合う場合のみ令和6・7年度の目標値/実績値を収録。
  const o = [/\n成果指標\n\n11\n\n([^\n]+)\n\n([^\n]+)\n\n当該指標を選定した理由/, /\n成果指標\n\n11\n\n([^\n]+)\n()当該指標を選定した理由/,
    /\n成果指標\n([^\n]+)\n\n([^\n]+)\n\n11\n\n当該指標を選定した理由/, /\n成果指標\n([^\n]+)\n11\n\n()当該指標を選定した理由/].map(r => r.exec(t)).find(Boolean);
  const out = o && { 0: o[0], 1: o[1], 2: o[2] || null, index: o.index };
  const v1 = new RegExp(String.raw`\n単位\n(?:([^\n]+)\n\n)?目標値\n実績値\n達成率\n\n令和6年度\n(\S+)\n(\S+)\n(\d+)%\n\n令和7年度\n(\S+)\n(\S+)\n(\d+)%\n\n目標\n令和8年度\n\S+\n\n目標\n令和12年度\n\S+\n`, 'g');
  const v2 = new RegExp(String.raw`\n実績\n目標\n目標\n令和6年度\n令和7年度\n令和8年度\n令和12年度\n目標値\n(\S+)\n(\S+)\n\S+\n\S+\n(\S+)\n実績値\n(\S+)\n(\S+)\n達成率\n(\d+)%\n(\d+)%\n`, 'g');
  const m1 = [...t.matchAll(v1)], m2 = [...t.matchAll(v2)];
  if (out && m1.length + m2.length === 1) {
    let vals: { t6: string; a6: string; r6: string; t7: string; a7: string; r7: string; unit: string | null } | null = null;
    const m = m1[0] ?? m2[0];
    if (m1.length && !!out[2] !== !!m[1]) vals = { t6: m[2], a6: m[3], r6: m[4], t7: m[5], a7: m[6], r7: m[7], unit: out[2] ?? m[1] };
    else if (m2.length && !out[2] && !isNumber(m[3])) vals = { t6: m[1], t7: m[2], unit: m[3], a6: m[4], a7: m[5], r6: m[6], r7: m[7] };
    if (vals && [vals.t6, vals.a6, vals.t7, vals.a7].every(isNumber) && rate(vals.t6, vals.a6) === Number(vals.r6) && rate(vals.t7, vals.a7) === Number(vals.r7)) {
      const ev = evidence(input, m[0].slice(1, -1), m.index! + 1);
      const ind = (fiscalYear: number, target: string, actual: string): EvaluationIndicator =>
        ({ name: out[1].trim(), fiscalYear, target, actual, unit: vals!.unit, evidence: ev });
      p.indicators.push(ind(2024, vals.t6, vals.a6), ind(2025, vals.t7, vals.a7));
      p.evidence.push(evidence(input, out[0].slice(1, out[0].lastIndexOf('\n')).trim(), out.index + 1));
      p.warnings.push('成果指標は「Ⅱ．事業目的の達成状況」の成果指標（11）の令和6・7年度の目標値・実績値。達成率（実績値÷目標値）の検算が一致する場合のみ収録。活動指標（12）は指標名が分断されるため未収録。');
    }
  }

  // 20 必要性・有効性（前年度評価で点検対象年度を令和7年度とした事業のみ記載）: ■の付いた選択肢をそのまま収録。
  const nec = /\n20\n\n要\n性\n有\n効\n性\n\n([■□]) 高い\n([■□]) 低い\n([■□]) 高い\n([■□]) 低い\n/.exec(t);
  if (nec) {
    const pick = (hi: string, lo: string) => hi === '■' && lo === '□' ? '高い' : hi === '□' && lo === '■' ? '低い' : null;
    const ev = evidence(input, nec[0].slice(1, -1), nec.index + 1);
    const [n1, n2] = [pick(nec[1], nec[2]), pick(nec[3], nec[4])];
    if (n1) p.ratings.push({ kind: 'self', label: '必要性', value: n1, scale: '高い／低い', evidence: ev });
    if (n2) p.ratings.push({ kind: 'self', label: '有効性', value: n2, scale: '高い／低い', evidence: ev });
  }
  p.warnings.push('令和8年度事務事業評価シート（令和7年度事務事業）。評価年度は表題の令和8年度、評価対象年度は「[ 令和7年度事務事業 ]」による。');
  return [p];
}

const guarded = (i: CachedInput) => (isRound5(i) ? extractSakai(i) : []);
export const sakaiEntries: Record<string, Entry> = {
  '27140': {
    extract: (input, inputs) => isRound5(input)
      ? municipalityRecords(input, inputs, guarded, p => `${nfkc(p.projectName)}|${p.projectCode}`).filter(p => !alreadyPublished(p)) : [],
    scope: '令和8年度 事務事業評価シート（令和7年度事務事業、1事業1PDF）の事業名・事業番号・担当局部課・目的・事業コスト表（事業費・人件費・年間経費の検算が合う列）・成果指標（達成率の検算が合う令和6・7年度値）・必要性/有効性の選択。既に事務事業一覧の行として公開済みの同名・同年度の事業、令和8年度新規事業シート、局別の事業概要一覧表、活動指標、所見の文章は対象外。',
  },
};
