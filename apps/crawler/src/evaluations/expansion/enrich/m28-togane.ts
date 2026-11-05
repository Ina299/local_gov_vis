import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m28-util';

// ---------------------------------------------------------------- 東金市（総合戦略事業に係る令和６年度の実績・資料２の参考資料②）
// 公開済みレコードは同じPDFの各票の事業名から作られ、対象年度2024（評価年度なし）。票に目的の欄はない
// （「期待される効果」は見込みのため取らない）。「事 業 名」の直後の「事業内容」欄を、「期待される効果」の見出しまで事業内容として取る。
// 「実績」欄は決算額のセルが行の間に割り込む票があるため取らない。同じ事業名の票が複数ある事業は対応が決まらないため採らない
// （【再掲】の付いた票は事業名が異なるため公開済みレコードとは突き合わない）。
const FILE = 'https://www.city.togane.chiba.jp/cmsfiles/contents/0000013/13940/4.shiryou22.pdf';
const SHEET = /\n事 業 名\n\n([^\n]+)\n\n事業内容\n\n((?:[^\n]+\n)+)\n期待される\n効果\n/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '12213' || input.sourceUrl !== FILE) return [];
  const t = input.text, all: ProjectEvaluation[] = [];
  for (const m of t.matchAll(SHEET)) {
    const name = m[1].trim(), raw = m[2].replace(/\n$/, '');
    if (raw.split('\n').some(l => /^[\d,]+ ?(円|千円|件|人)?$/.test(l.trim()))) continue;
    const p = project(input, `narrative:${name}`, name, null, m[0].slice(1, m[0].indexOf('\n事業内容')), m.index! + 1);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2024;
    p.activities = unwrap(raw);
    p.evidence.push(evidence(input, raw, m.index! + m[0].indexOf('\n事業内容\n\n') + '\n事業内容\n\n'.length));
    p.warnings.push('東金市 総合戦略事業に係る令和６年度の実績の各票の「事業内容」欄を事業内容として収録。欄の幅での折り返しの改行を除いた。目的の欄はない。');
    all.push(p);
  }
  return all.filter(p => all.filter(q => q.projectName === p.projectName).length === 1);
}

export const entry = {
  extract,
  scope: '東金市 総合戦略事業に係る令和６年度の実績（実施計画の実績報告からの引用）: 各票の「事業内容」（事業内容）。目的の欄はなく、実績欄は決算額のセルが混ざるため取らない。同名の票が複数ある事業は除く。',
};
