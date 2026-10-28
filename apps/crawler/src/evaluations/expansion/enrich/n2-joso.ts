import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 常総市「令和２年度 事務事業評価（令和元度実施事業事後評価）シート」
// 1資料1事業の個票。公開済みレコード（令和２年度事務事業評価結果一覧）と同じ事業の補強用。
// 評価年度は表題の「令和２ 年度 事務事業評価」（evaluationYear 2020）。事後評価の対象年度は一覧側と揃えず空欄のまま。
// 金額: 「事務事業の実績 Ⓓ」の決算額（円）を平成29年度・平成30年度・令和元年度の見出し直後の数値から取り、
//   同じ個票内の別の2つの数値（特定財源・一般財源の内訳）の和と一致するものだけ採用（段組みで内訳の位置は一定しない）。
//   実施計画 Ⓟ の予算額（千円）は3か年の列が段組みで交錯し年度を確定できないため対象外。
// 評価: 担当課評価（達成度）、担当部長評価・最終評価（方向性の■印が1つだけのもの）。成果指標は列が交錯するため対象外。

const HEAD = '令和２ 年度 事務事業評価（令和元度実施事業事後評価）シート';
const YEN = /(?<![\d,])(?:\d{1,3}(?:,\d{3})+|0)(?![\d,])/g;
const YEARS: [string, number][] = [['平成29年度', 2017], ['平成30年度', 2018], ['令和元年度', 2019]];
const ACHIEVEMENT = ['目標以上', '目標どおり', 'ほぼ目標どおり', '目標未達成', '目標は設定していない'];
const DIRECTION = ['拡充', '現行どおり', '縮小', '休止・廃止'];

function direction(t: string, from: string, to: string): { value: string; at: number; raw: string } | null {
  const s = t.indexOf(from), e = t.indexOf(to, s + 1);
  if (s < 0 || e < 0 || t.indexOf(from, s + 1) >= 0) return null;
  const hits = [...t.slice(s, e).matchAll(/^■ (\S+)$/gm)];
  if (hits.length !== 1 || !DIRECTION.includes(hits[0][1])) return null;
  return { value: hits[0][1], at: s + hits[0].index!, raw: hits[0][0] };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '08211' || input.format !== 'pdf' || input.truncated) return [];
  const t = input.text;
  if (!t.startsWith(HEAD) || t.indexOf(HEAD, 1) >= 0) return [];
  const name = /^事務事業名 (\S+)$/m.exec(t);
  const code = /^整理番号\n\n(\d{3})$/m.exec(t);
  if (!name) return [];
  const p = project(input, code?.[1] ?? name[1], name[1], 2020, HEAD, 0);
  p.evidence.push(evidence(input, name[0], name.index));
  const dept = /^担当課\n\n(\S+課)$/m.exec(t);
  if (dept) p.department = dept[1];

  // 決算額: 見出し直後の最初の数値。内訳（他の2数値の和）で検算。
  const tokens = [...t.matchAll(YEN)].map(m => ({ v: Number(m[0].replace(/,/g, '')), at: m.index! }));
  for (const [label, fy] of YEARS) {
    const re = new RegExp(String.raw`^${label}\n(?:決算額\n)?\n?(\d{1,3}(?:,\d{3})+)\n`, 'gm');
    const all = [...t.matchAll(re)];
    if (all.length !== 1) continue;
    const m = all[0], at = m.index! + m[0].indexOf(m[1]), total = Number(m[1].replace(/,/g, ''));
    const others = tokens.filter(x => x.at !== at);
    const checked = others.some((a, i) => others.some((b, j) => i !== j && a.v + b.v === total));
    if (!checked) continue;
    p.amounts.push({ kind: 'actual', fiscalYear: fy, amountYen: total, rawValue: m[1], rawUnit: '円', evidence: evidence(input, m[0].trimEnd(), m.index) });
  }

  const ach = /☞ 実施したことによる成果や課題を記入してください。\n\n([^\n]+)\n/.exec(t);
  if (ach && ACHIEVEMENT.includes(ach[1]))
    p.ratings.push({ kind: 'self', label: '担当課評価', value: ach[1], scale: null, evidence: evidence(input, ach[0].trimEnd(), ach.index) });
  const head = direction(t, '6 担当部長評価 Ⓒ', '8 行政改革懇談会');
  if (head) p.ratings.push({ kind: 'self', label: '担当部長評価', value: head.value, scale: DIRECTION.join('／'), evidence: evidence(input, head.raw, head.at) });
  const last = direction(t, '9 最終評価（行政改革推進本部） Ⓒ', '10 事務事業の改善点と理由');
  if (last) p.ratings.push({ kind: 'self', label: '行改推進本部（最終評価）', value: last.value, scale: DIRECTION.join('／'), evidence: evidence(input, last.raw, last.at) });

  p.warnings.push('評価シート（個票）から補強用に構造化。決算額は特定財源・一般財源の内訳の和と一致するものだけ採用。実施計画の予算額・成果指標は列が交錯するため転記していません。');
  return [p];
}

export const entry = {
  extract,
  scope: '常総市「令和２年度 事務事業評価（令和元度実施事業事後評価）シート」（事業ごとの個票）。決算額（平成29〜令和元年度）・担当課評価・方向性評価を、公開済みの評価結果一覧レコードへの補強として抽出。',
};
