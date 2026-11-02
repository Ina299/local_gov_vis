import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 四万十町「事務事業内部評価シート（事後評価）」「R6行政評価シート（事後評価用）」
// 公開済みレコード（令和3・4・6年度の行政評価資料の評価シートから作成。成果ありで目的・事業内容なし）の補強用。
// 「事 業 目 的」「事 業 内 容」の見出しは欄の縦の中央に印字され、抽出テキストでは本文の行の間に単独の行として、
// または本文の行の先頭に付いて現れる。見出しが中央にあることから欄の行数が決まる（k 行目の先頭に付けば 2k+1 行、
// k 行の後に単独で出れば 2k 行）。目的・事業内容の行数の和が「施策目標」の行から「実施年度／実施期間」の行までの
// 本文の行数と一致し、目的の最後の行が句点で終わる場合だけ採る。見出しだけを除き、折り返しの改行を除いてつなぐ。
// 年度は資料ごとの「※…年度版総合振興計画（実施計画）に掲げ…事務事業の…年度の実績に対する評価」（対象年度）。
const YEAR = /※(?:R|令和)([0-9０-９]+)年度版総合振興計画（実施計画）に掲げ(?:る|た)事務事業の(?:R|令和)([0-9０-９]+)年度の実績に対する評価/g;
const ascii = (s: string) => Number(s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
const NAME = /^事業名 (.+?)(?: 所管 [^\n]+)?$/gm;
const BLOCK = /\n施策 ?目標 [^\n]+\n((?:[^\n]+\n)+?)実 施 (?:年 度|期 間) /;

interface Field { value: string; raw: string; at: number }

/** 見出し label の位置から欄の行数を求め、[行数, 見出しを除いた行] を返す。 */
function span(lines: string[], from: number, label: string): [number, string[]] | null {
  for (let i = from; i < lines.length; i++) {
    const k = i - from;
    if (lines[i] === label) {
      const n = 2 * k;
      if (n === 0) return null;
      return [n + 1, lines.slice(from, from + n + 1).filter((_, j) => j !== k)];
    }
    if (lines[i].startsWith(label + ' ')) {
      const n = 2 * k + 1;
      return [n, lines.slice(from, from + n).map((l, j) => (j === k ? l.slice(label.length + 1) : l))];
    }
  }
  return null;
}

const join = (lines: string[]) => lines.reduce((acc, l, i) => acc + (i === 0 || !lines[i - 1].endsWith('。') ? '' : '\n') + l, '');

function fields(seg: string, at: number): { purpose: Field; activities: Field } | null {
  const m = BLOCK.exec(seg);
  if (!m) return null;
  const raw = m[1].slice(0, -1), lines = raw.split('\n');
  const p = span(lines, 0, '事 業 目 的');
  if (!p) return null;
  const a = span(lines, p[0], '事 業 内 容');
  if (!a || p[0] + a[0] !== lines.length) return null;
  const pl = p[1], al = a[1];
  if (!pl.length || !al.length || ![...pl, ...al].every(l => l.trim()) || !pl[pl.length - 1].endsWith('。')) return null;
  if ([...pl, ...al].some(l => /事 業 (目 的|内 容)/.test(l))) return null;
  const s = at + m.index! + m[0].indexOf(m[1]);
  const pRaw = lines.slice(0, p[0]).join('\n'), aRaw = lines.slice(p[0]).join('\n');
  return { purpose: { value: join(pl), raw: pRaw, at: s }, activities: { value: join(al), raw: aRaw, at: s + pRaw.length + 1 } };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '39412' || input.format !== 'pdf' || !/\/download\/\?t=LD&id=\d+&fid=\d+$/.test(input.sourceUrl)) return [];
  const t = input.text, years = [...t.matchAll(YEAR)];
  const fy = new Set(years.flatMap(y => [ascii(y[1]), ascii(y[2])]));
  if (!years.length || fy.size !== 1) return [];
  const year = 2018 + [...fy][0];
  const heads = [...t.matchAll(NAME)], out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    if (input.truncated && i === heads.length - 1) return;
    const at = h.index!, seg = t.slice(at, heads[i + 1]?.index ?? t.length);
    const f = fields(seg, at);
    if (!f) return;
    const name = h[1].trim();
    const p = project(input, `${name}:narrative`, name, null, h[0], at);
    p.evaluatedFiscalYear = year;
    p.purpose = f.purpose.value; p.activities = f.activities.value;
    p.evidence.push(evidence(input, years[0][0], years[0].index!), evidence(input, f.purpose.raw, f.purpose.at), evidence(input, f.activities.raw, f.activities.at));
    p.warnings.push('四万十町 行政評価シート（事後評価）の「事業目的」「事業内容」欄。欄の中央に印字された見出しの位置から各欄の行数を求め、行数の合計が一致する場合のみ収録。見出しと折り返しの改行だけを除いた。');
    out.push(p);
  });
  return out.filter(p => out.filter(o => o.projectName === p.projectName).length === 1);
}

export const entry = { extract, scope: '四万十町 行政評価シート（事後評価、令和3・4・6年度）の事業目的・事業内容。公開済みの評価シート由来レコードの補強用。' };
