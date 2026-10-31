/**
 * 京都府「京都府総合計画」実施状況報告書。令和元(2019)年度版だけが「４ 令和元年度実施状況及び令和２年度予算措置状況」に
 * 具体方策ごとの事業の表（区分／事業名／概要／部局／予算額（単位：千円）＝令和２年度当初予算措置状況）を持つ
 * （令和2年度版以降は数値目標と取組の文章のみで、事業別の金額表はない）。
 * 抽出テキストでは事業名の列と概要の列が行ごとに入り交じり、複数行の予算額がまとめて出力される箇所もあるため、
 * 空行区切りの段落が次の並びになる行だけを収録する:
 *  - 区分の段落（丸数字だけ）または前の行の予算額の段落 → 事業名の段落（丸数字の区分を除くと空白を含まない短い行が1〜3行で、
 *    「…費」「…金」「…料」で終わる） → 概要の段落（予算額・丸数字・欄名を含まない） → 「予算額 部局略号」の1行の段落;
 *  - その直後の段落が別の予算額・部局略号だけの段落でない（ページ内の他の行の予算額がずれて後ろにまとめて出力される箇所を除く）;
 *  - 事業名に「（再掲）」「次年度以降対応」などの区分欄の語が混ざる行は対象外。
 * 部局は注３）の略号表（知＝知事直轄組織（知事室長）…）で読み替える。同じ事業名・部局が複数の具体方策に同額で再掲される場合は1件に統合し、
 * 金額が異なる場合（事業の一部の計上など）は対応が確定しないため収録しない。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { amount, mergeReprints, nfkc, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const CODE = '26000';
const TITLE = '令和元(2019)年度\n\n「京都府総合計画」\n実施状況報告書';
const FY_HEAD = '○令和２年度当初予算措置状況';
const UNIT = '（単位：千円）';
const N = String.raw`\d{1,3}(?:,\d{3})*`;
const ABBR = '知職危政府文健商農建教警';
const AMT = new RegExp(String.raw`^(${N}) ([${ABBR}])$`);
const CIRC = /^[①-⑳](?:\s*[①-⑳])*$/;
const LEGEND = new RegExp(String.raw`^([${ABBR}]) ([^\s]{3,20})$`, 'gm');

type Para = { s: string; at: number };

/** 事業名の段落: 丸数字の区分を除いた各行が空白・句読点を含まない短い行（事業名の列幅）で、1〜3行。 */
function nameOf(p: Para): string | null {
  const parts: string[] = [];
  for (const line of p.s.split('\n')) {
    const l = line.trim();
    if (CIRC.test(l)) continue;
    const v = l.replace(/^[①-⑳] /, '');
    if (/[\s。、]/.test(v) || v.length > 17 || /^[①-⑳]/.test(v)) return null;
    parts.push(v);
  }
  if (!parts.length || parts.length > 3) return null;
  const name = parts.join('');
  if (name.length < 4 || !/(?:費|金|料)(?:）|\))?$/.test(name) || /再掲|次年度以降対応|事業完了|予算額|単位/.test(name)) return null;
  return name;
}

function extractOne(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== CODE) return [];
  const t = input.text;
  const title = t.indexOf(TITLE), fyAt = t.indexOf(FY_HEAD);
  if (title !== 0 || fyAt < 0) return [];
  const legend = new Map([...t.matchAll(LEGEND)].filter(m => /(?:組織|部|委員会|本部)(?:（[^）]+）)?$/.test(m[2])).map(m => [m[1], { name: m[2], raw: m[0], at: m.index! }]));
  if (legend.size !== ABBR.length) return [];
  const units = [...t.matchAll(/（単位：千円）/g)].map(m => m.index!);
  const paras: Para[] = [...t.matchAll(/[^\n]+(?:\n[^\n]+)*/g)].map(m => ({ s: m[0], at: m.index! }));
  const out: ProjectEvaluation[] = [];
  paras.forEach((p, i) => {
    const m = AMT.exec(p.s);
    if (!m || i < 3 || p.at < fyAt) return;
    const desc = paras[i - 1], nm = paras[i - 2], pre = paras[i - 3];
    if (/[①-⑳]|予算額|単位|部\n局/.test(desc.s) || new RegExp(N + ` [${ABBR}]`).test(desc.s) || nameOf(desc)) return;
    const name = nameOf(nm);
    if (!name) return;
    if (!(CIRC.test(pre.s.trim()) || AMT.test(pre.s) || /^[①-⑳]/.test(nm.s))) return;
    // 直後が別の予算額・部局略号・数値だけの段落なら、前の行の予算額がずれて出力されている（ページ末尾にまとめて出る）箇所
    const next = paras[i + 1]?.s.trim() ?? '';
    if (new RegExp(String.raw`^(?:${N}(?: [${ABBR}])?|[${ABBR}])(?:\n|$)`).test(next)) return;
    const unit = [...units].reverse().find(u => u > fyAt && u < p.at);
    const dept = legend.get(m[2])!;
    if (unit === undefined) return;
    const r = project(input, `${name}|${m[2]}|${p.at}`, name, null, nm.s, nm.at);
    r.evidence.push(evidence(input, desc.s, desc.at), evidence(input, FY_HEAD, fyAt), evidence(input, UNIT, unit), evidence(input, dept.raw, dept.at));
    r.department = dept.name;
    r.amounts.push(amount(input, 'budget', 2020, m[1], '千円', p.s, p.at));
    r.warnings.push('金額は「令和２年度当初予算措置状況」の予算額（単位：千円）＝令和２年度当初予算。決算額の記載はない。部局は注３）の略号表による。'
      + '具体方策の表の事業で、事業名・概要・予算額の段落が抽出テキストで連続する行のみ収録。評価年度は資料に記載がないため未設定（令和元年度実施状況報告書、令和２年10月）。');
    out.push(r);
  });
  return mergeReprints(out, p => `${nfkc(p.projectName)}|${p.department}`);
}

export const entries: Record<string, Entry> = {
  [CODE]: {
    scope: '令和元(2019)年度「京都府総合計画」実施状況報告書の「令和２年度予算措置状況」の事業名・部局・令和２年度当初予算額（千円）。事業名・概要・予算額の段落が抽出テキストで連続しない行、再掲・一部計上で金額が一致しない事業、令和2年度版以降の報告書（事業別の金額表なし）は対象外。',
    extract: (input) => extractOne(input),
  },
};
