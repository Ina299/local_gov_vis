/**
 * 伊勢崎市 行政改革推進及び行政評価市民委員会の資料（令和2・3・4年度）に綴じられた事務事業《事後》評価 評価シート（各3〜4事業）から、
 * 公開済みの対象事業一覧・改善事業一覧のレコードを補強する事業費計（決算・予算、千円）と指標（実績・目標）を構造化する。
 * 事業費計は3列すべてに値があり、財源内訳（国庫支出金・県支出金・地方債・その他・一般財源）の各行が空欄か3列そろっていて、
 * 列ごとの和が事業費計と一致する場合のみ記録する。
 */
import type { EvaluationAmount, EvaluationIndicator, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { BASE_WARNING, digits } from '../batch8/h3-util';
import type { Entry } from '../batch9/i1-util';

/** 令和2年度（shiminiinkaisiryou_r3.pdf）・令和3年度（R3hyoukakekka.pdf）・令和4年度（r4kekka.pdf）の市民委員会資料。 */
const DOCS = new Set(['76da78bc567a1894843a112b', 'a40d837810a151478b0c458d', '02832626ac653185c1ce408e']);
const HEAD = /令和 (\d) 年度事務事業《事後》評価 評価シート ※令和(\d|元)年度に実施した事務事業の評価\n/g;
const V = '(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?)';
const NUM = '\\d{1,3}(?:,\\d{3})*';
const toNum = (s: string) => Number(s.replace(/,/g, ''));
const era = (e: string, y: string) => (e === 'H' ? 1988 : 2018) + digits(y.normalize('NFKC'));
const FUNDS = ['国庫支出金', '県支出金', '地方債', 'その他', '一般財源'];

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '10204' || !DOCS.has(input.sourceId)) return [];
  const text = input.text, heads = [...text.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    const start = h.index!, seg = text.slice(start, heads[i + 1]?.index ?? text.length);
    const year = 2018 + Number(h[1]), fy = h[2] === '元' ? 2019 : 2018 + Number(h[2]);
    const name = /\n評価 R(?:\d|元)年度 事業名 (\S+)(?: 担当部(?: \S+)?)?\n/.exec(seg);
    if (!name || year !== fy + 1) return;
    const p = project(input, `sheet-${start}`, name[1], year, h[0].trimEnd(), start);
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, name[0].slice(1, -1), start + name.index! + 1));
    const dept = /\n担当部課名 (\S+) (\S+) 連絡先/.exec(seg);
    if (dept) { p.department = `${dept[1]}${dept[2]}`; p.evidence.push(evidence(input, dept[0].slice(1), start + dept.index! + 1)); }
    p.warnings = [BASE_WARNING, '市民委員会資料に綴じられた評価シートから、事業名・担当部課・事業費計・指標のみ構造化。評価・コメント欄は列の並びが崩れているため対象外。'];

    // 事業費計: (H|R)年度決算 ×2, 予算 ×1 on the line above; funding rows below must add up to it in every column.
    const cost = new RegExp(`\\n([HR])(\\d+|元)年度決算 ([HR])(\\d+|元)年度決算 R(\\d+)年度予算 [^\\n]*\\n事業費計（千円） ${V} ${V} ${V}\\n`).exec(seg);
    if (cost) {
      const years = [era(cost[1], cost[2]), era(cost[3], cost[4]), era('R', cost[5])];
      const totals = [cost[6], cost[7], cost[8]].map(toNum);
      const end = seg.indexOf('\n項目 評価', cost.index);
      const block = seg.slice(cost.index + cost[0].length, end < 0 ? undefined : end);
      const rows = FUNDS.map(label => [...block.matchAll(new RegExp(`(?:^| )${label}((?: ${NUM})*)(?= |$)`, 'gm'))]);
      const values = rows.map(ms => (ms.length === 1 ? ms[0][1].trim().split(' ').filter(Boolean).map(toNum) : null));
      const ok = years[0] + 1 === years[1] && years[1] + 1 === years[2] && years[1] === fy && rows.every(ms => ms.length <= 1)
        && values[4] !== null && values.every(v => v === null || v.length === 0 || v.length === 3)
        && totals.every((t, c) => values.reduce((s, v) => s + (v?.[c] ?? 0), 0) === t);
      if (ok) {
        const raw = cost[0].slice(1, -1), at = start + cost.index! + 1;
        years.forEach((fiscalYear, c) => p.amounts.push({ kind: c < 2 ? 'actual' : 'budget', fiscalYear, amountYen: totals[c] * 1000,
          rawValue: cost[6 + c], rawUnit: '千円', evidence: evidence(input, raw, at) } satisfies EvaluationAmount));
      }
    }

    // 指標: name (no spaces), 活動指標/成果指標, unit, two 実績 years then two 目標(見込) years.
    const ih = /\n(?:\S )?指標名 指標の種類 単位 ([HR])(\S+?)年度実績 ([HR])(\S+?)年度実績 R(\S+?)年度目標\(見込\) R(\S+?)年度目標\(見込\)\n/.exec(seg);
    if (ih) {
      const iy = [era(ih[1], ih[2]), era(ih[3], ih[4]), era('R', ih[5]), era('R', ih[6])];
      if (iy.every((y, k) => k === 0 || y === iy[k - 1] + 1) && iy[1] === fy) {
        let pos = ih.index! + ih[0].length;
        const lines = seg.slice(pos).split('\n');
        for (let k = 0; k < lines.length && !/年度決算 /.test(lines[k]); k++) {
          const line = lines[k], lineAt = start + pos;
          pos += line.length + 1;
          const m = new RegExp(`^(?:[及び目標等指績実] )?(\\S+) (活動指標|成果指標) (\\S+) ${V} ${V} ${V} ${V}$`).exec(line);
          // A name wrapped onto the next line （…） is incomplete and skipped.
          if (!m || lines[k + 1]?.startsWith('（')) continue;
          const ev = evidence(input, line, lineAt);
          const ind = (fiscalYear: number, target: string | null, actual: string | null): EvaluationIndicator => ({ name: m[1], fiscalYear, target, actual, unit: m[3], evidence: ev });
          p.indicators.push(ind(iy[0], null, m[4]), ind(iy[1], null, m[5]), ind(iy[2], m[6], null), ind(iy[3], m[7], null));
        }
      }
    }
    if (p.amounts.length) p.warnings.push('事業費計は決算2年度（actual）と当年度予算（budget）。財源内訳の各行が空欄か3列そろい、列ごとの和が事業費計と一致する場合のみ記録（千円）。');
    if (p.indicators.length) p.warnings.push('指標は各行の実績2年度（actual）と目標(見込)2年度（target）を年度別に記録。指標の種類（活動指標・成果指標）は原文の行に残る。名称が折り返している行は対象外。');
    if (p.amounts.length || p.indicators.length) out.push(p);
  });
  return out;
}

export const isesakiEntry: Entry = {
  extract,
  scope: '伊勢崎市 行政改革推進及び行政評価市民委員会資料（令和2〜4年度）の事務事業《事後》評価 評価シートから、事業名・担当部課と、財源内訳で検算できる事業費計（決算・予算、千円）、指標の実績・目標を構造化（公開済みレコードの補強用）。評価・コメント欄は対象外。',
};
