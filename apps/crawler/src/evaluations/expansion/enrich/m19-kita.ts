import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 北区（令和8年度北区事務事業評価、評価対象年度 令和7年度）
// 公開済みレコードは同じ報告書の事務事業評価シート（中期計画事業）の事業名・主管課・予算額・進捗から作られ、文章の欄は未収録だった。
// 「■事業の概要」は 対象／目的／取組み内容 の3欄が上から順に1段落ずつ並ぶ。「目的」欄を目的に、「取組み内容」欄を事業内容に収録する。
// 「事業の状況」（総括・成果の進捗）は評価対象年度と前年度の2列が同じ行に交互に並ぶため、成果は収録しない。
const HEAD = /事務事業評価\n中期計画番号︓\n\n評価対象年度 令和(\d+)年度\n\n(\d{3})\n\n事業名︓ ([^\n]+)\n主管課︓ ([^\n]+)\n/g;
const BODY = /\n目的\n\n((?:[^\n]+\n)*?[^\n]+)\n\n取組み内容\n\n((?:[^\n]+\n)*?[^\n]+)\n\n(?=\(参考）|■)/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13117' || !input.sourceUrl.endsWith('/001/026/599/r08_jimujigyohyoka.pdf')) return [];
  const text = input.text, heads = [...text.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    if (input.truncated && k === heads.length - 1) return;
    const start = h.index!, seg = text.slice(start, heads[k + 1]?.index ?? text.length);
    const m = BODY.exec(seg);
    if (!m || /^(対象|目的|取組み内容)$/m.test(m[1] + '\n' + m[2])) return;
    const name = h[3].trim();
    const p = project(input, `${h[2]}|narrative`, name, null, h[0], start);
    p.projectCode = h[2];
    p.department = h[4].trim();
    p.evaluatedFiscalYear = 2018 + Number(h[1]);
    const pAt = start + m.index! + '\n目的\n\n'.length, aAt = pAt + m[1].length + '\n\n取組み内容\n\n'.length;
    p.purpose = unwrap(m[1]);
    p.activities = unwrap(m[2]);
    p.evidence.push(evidence(input, m[1], pAt), evidence(input, m[2], aAt));
    p.warnings.push('北区事務事業評価シート（評価対象年度 令和7年度）の「事業の概要」の「目的」欄を目的に、「取組み内容」欄を事業内容に収録（折り返しの改行は除去）。'
      + '事業の状況（総括・成果）は前年度の列と交互に並ぶため未収録。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '北区 令和8年度事務事業評価（評価対象年度 令和7年度）の事務事業評価シート: 「事業の概要」の目的・取組み内容の文章。',
};
