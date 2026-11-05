import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as dated } from './m18-awashimaura';

// ---------------------------------------------------------------- 粟島浦村（新型コロナ地方創生臨時交付金 実施状況および効果検証結果）
// 表題に【令和N年度】があるが、公開済みレコードの一部は年度なしで作られている。m18 の抽出（「事業概要および目的」の列が
// 実施内容の列と混ざらない事業だけ）をそのまま使い、年度を外した事業票として、同じ資料から作られた年度なしのレコードに限って照合させる。
// 年度ありの公開済みレコードは m18 の事業票が照合する（年度なしの事業票は年度ありのレコードとは照合しない）。
function extract(input: CachedInput): ProjectEvaluation[] {
  return dated.extract(input).map(p => ({ ...p, id: `${p.id}-yearless`, evaluatedFiscalYear: null, evaluationYear: null }));
}

export const entry = {
  extract,
  scope: '粟島浦村 新型コロナ地方創生臨時交付金 実施状況および効果検証結果: 年度なしの公開済みレコードへの「事業概要および目的」の列（目的。m18 と同じ抽出を年度なしで照合）。',
};
