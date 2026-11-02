/**
 * 05206 男鹿市: 令和5年度 男鹿市行政評価報告書のうち、外部評価の対象になった事業の「（事務事業）評価シート」（4年度実施事業）。
 * 公開済みレコード（同じ報告書の行政評価結果一覧の行）の空欄の目的（「事業目的」欄）と事業内容（「事業内容」欄）を補う。
 * 抽出テキストでは「２．事業概要」の後に 目的の文 →「事業目的」→ 内容の文 →「事業内容」の順に出るシートだけを採る
 * （見出しがまとめて先に出るシートは2つの欄の境目が本文で決まらないため採らない）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';
import { unwrap } from './m1-util';

const HEAD = /令和５年度（４年度実施事業）男鹿市(?:事務事業|行政)評価シート\n/g;
const LABEL = /事業目的|事業内容|事業概要|成果指標/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '05206' || input.truncated) return [];
  const text = input.text, out: ProjectEvaluation[] = [];
  const heads = [...text.matchAll(HEAD)];
  heads.forEach((h, i) => {
    const s = h.index!, t = text.slice(s, heads[i + 1]?.index ?? text.length);
    const nm = /\n事業名\n総\n合\n計\n画\n(?:総\n合\n戦\n略\n)?\n([^\n]+)\n\n基本目標\n/.exec(t);
    const m = /\n２．事業概要\n((?:[^\n]+\n)+)\n事業目的\n\n((?:[^\n]+\n)+)\n事業内容\n/.exec(t);
    if (!nm || !m) return;
    const pl = m[1].slice(0, -1), al = m[2].slice(0, -1);
    if ([pl, al].some(b => b.split('\n').some(l => LABEL.test(l)))) return;
    const name = nm[1].trim();
    const p = project(input, `narrative-${s}`, name, 2023, h[0].slice(0, -1), s);
    p.id = stableId(input, `narrative-${s}`, 2023);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2022;
    p.evidence.push(evidence(input, nm[1], s + nm.index! + nm[0].indexOf(nm[1])));
    const pAt = s + m.index! + '\n２．事業概要\n'.length, aAt = pAt + m[1].length + '\n事業目的\n\n'.length;
    p.evidence.push(evidence(input, pl, pAt), evidence(input, al, aAt));
    p.purpose = unwrap(pl);
    p.activities = unwrap(al);
    p.warnings.push('男鹿市 令和5年度（4年度実施事業）評価シートの「２．事業概要」から、目的（「事業目的」欄）と事業内容（「事業内容」欄）を原文のまま収録。'
      + '評価年度は表題の令和5年度、評価対象年度は「4年度実施事業」。欄の幅で折り返した改行だけを除いた。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '男鹿市 令和5年度 行政評価報告書の評価シート（外部評価対象事業、4年度実施事業）の事業目的・事業内容。見出しがまとめて出るシートは対象外。行政評価結果一覧（一次評価）は目的の列がない。',
};
