import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 留寿都村（第６次総合計画実施計画 令和３〜７年度事業評価結果）
// 公開済みレコードは同じ「総合計画実施計画事業評価調書」の事業名・担当部署・事業費・チェック項目から作られ、文章の欄は未収録だった。
// 調書の「総合計画上の位置づけ」の表に「事業目的」「事業概要」の2行がある。ラベルが本文の直前に出る調書（labelled）と、ラベルが見出し側に
// 離れて本文だけが1段落で並ぶ調書（unlabelled、欄の幅で段落の境目が決まるものだけ）から採る。事業目的 → purpose、事業概要 → activities。
// 令和４年度版は一部の漢字が康熙部首・互換漢字で出力されるため、その文字だけ1字ずつ通常の漢字に置き換えて照合・収録する（文字位置は不変）。
const REPORTS: Record<string, number> = { '88b5cc1638c71097bc0f5336': 3, '89121cfe10b5622d53809720': 4, e83505c3593c08805e37712b: 5, '93365bc62d124f3f69c6a9c3': 6, '086c705eff9c92d667d51e2f': 7 };
const SHEET = '総合計画実施計画事業評価調書';
const DEPT = /(?:課|消防|教育委員会|診療所|子どもセンター)$/;
const BODY = /\n事業目的\n\n((?:[^\n]+\n)*?[^\n]+)\n\n事業概要\n\n((?:[^\n]+\n)*?[^\n]+)\n\n事業費（千円）\n/;
const NOISE = /事業目的|事業概要|事業費|総合計画上の位置づけ|過疎計画|他の計画|総合戦略|マニフェスト|^○$/m;

type Rows = { purpose: string; purposeAt: number; overview: string; overviewAt: number };
const one = (s: string, label: string) => (s.match(new RegExp(`\\n${label}\\n`, 'g')) ?? []).length === 1;

/** ラベル「事業目的」「事業概要」が本文の直前にある調書。 */
function labelled(sheet: string): Rows | null {
  const b = BODY.exec(sheet);
  if (!b || !one(sheet, '事業目的') || NOISE.test(b[1]) || NOISE.test(b[2])) return null;
  const purposeAt = b.index! + '\n事業目的\n\n'.length;
  return { purpose: b[1], purposeAt, overview: b[2], overviewAt: purposeAt + b[1].length + '\n\n事業概要\n\n'.length };
}

/**
 * ラベルが調書の見出し側に離れて出力され、位置づけの表の本文だけが「マニフェスト」の欄（○印）の後、「事業費（千円）」の直前に
 * 1段落で並ぶ調書。表は「事業目的」「事業概要」の2行で、本文は上の行から順に出る。欄の幅（最長の行）に満たない行で段落が終わるとみなし、
 * ちょうど2段落（「。」で終わる行もその2か所だけ）に分かれる場合だけ、1段落目を事業目的、2段落目を事業概要とする。
 */
function unlabelled(sheet: string): Rows | null {
  const m = /\nマニフェスト\n\n(?:(?:○|過疎計画|他の計画|総合戦略)\n\n)*((?:[^\n]+\n)*?[^\n]+)\n\n?事業費（千円）\n/.exec(sheet);
  if (!m || !one(sheet, '事業目的') || !one(sheet, '事業概要') || sheet.indexOf('\n事業概要\n') > m.index! || NOISE.test(m[1])) return null;
  const lines = m[1].split('\n'), width = Math.max(...lines.map(l => l.length));
  const ends = lines.flatMap((l, i) => (l.length < width - 3 || i === lines.length - 1 ? [i] : []));
  // 「。」で終わる行も同じ2か所だけ（欄の幅いっぱいで文が終わる行や、どの行も折り返さない複数文の欄を誤って分けないため）。
  const stops = lines.flatMap((l, i) => (/。$/.test(l) ? [i] : []));
  if (ends.length !== 2 || stops.length !== 2 || stops[0] !== ends[0] || stops[1] !== ends[1]) return null;
  const purpose = lines.slice(0, ends[0] + 1).join('\n'), overview = lines.slice(ends[0] + 1).join('\n');
  const purposeAt = m.index! + m[0].length - m[1].length - (m[0].endsWith('\n\n事業費（千円）\n') ? 2 : 1) - '事業費（千円）\n'.length;
  return { purpose, purposeAt, overview, overviewAt: purposeAt + purpose.length + 1 };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  const reiwa = REPORTS[input.sourceId];
  if (input.municipalityCode !== '01397' || !reiwa) return [];
  const t = input.text;
  const n = t.replace(/[⼀-⿟豈-﫿]/g, c => { const x = c.normalize('NFKC'); return x.length === 1 ? x : c; });
  const R = '０１２３４５６７８９'[reiwa];
  if (!n.slice(0, 40).includes(`令和${R}年度事業評価結果`)) return [];
  const year = 2018 + reiwa;
  const starts = [...n.matchAll(new RegExp(SHEET, 'g'))].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    if (input.truncated && k === starts.length - 1) return;
    const end = starts[k + 1] ?? t.length, sheet = n.slice(s, end);
    const head = sheet.slice(0, Math.max(0, sheet.indexOf('総合計画上の位置づけ')));
    if (!head || !sheet.includes(`【令和${R}年度事業】`)) return;
    const names = [...head.matchAll(/予算ＩＤ\n\n([^\n]+)\n会計区分/g), ...head.matchAll(/事業名\n\n([^\n]+)\n\n予算科目/g)];
    const depts = [...head.matchAll(/\n([^\n]+)\n\n担当部署\n/g)].filter(m => DEPT.test(m[1]));
    if (names.length !== 1 || depts.length > 1) return;
    const name = names[0][1];
    if (/^\d|予算|担当|会計/.test(name)) return;
    const rows = labelled(sheet) ?? unlabelled(sheet);
    if (!rows) return;
    const pAt = s + rows.purposeAt, aAt = s + rows.overviewAt;
    const p = project(input, `${name}|narrative`, name, null, t.slice(s + names[0].index!, s + names[0].index! + names[0][0].length), s + names[0].index!);
    p.projectCode = null;
    p.department = depts[0]?.[1] ?? null;
    p.evaluatedFiscalYear = year;
    p.purpose = unwrap(rows.purpose);
    p.activities = unwrap(rows.overview);
    p.evidence.push(evidence(input, t.slice(pAt, pAt + rows.purpose.length), pAt), evidence(input, t.slice(aAt, aAt + rows.overview.length), aAt));
    p.warnings.push(`留寿都村 第６次総合計画実施計画 令和${reiwa}年度事業評価結果の事業評価調書の「事業目的」を目的に、「事業概要」を事業内容に収録（折り返しの改行は除去`
      + `${reiwa === 4 ? '。康熙部首・互換漢字は通常の漢字に置換' : ''}）。目的と概要の本文が1段落で並ぶ調書は、欄の幅に満たない行で段落が終わるとみなして、ちょうど2段落に分かれる場合だけ1段落目を目的、2段落目を概要とした。`);
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '留寿都村 第６次総合計画実施計画 令和３〜７年度事業評価結果の事業評価調書の「事業目的」「事業概要」（ラベルの直後に本文が出るもの、または本文がちょうど2段落に分かれるものだけ）。',
};
