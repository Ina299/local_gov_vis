import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 輪島市（高度無線環境整備推進事業（令和8年度）における中間評価結果）
// 公開済みレコードは同じページ（docs/2026060900010/、評価年度＝令和８年度）の事業。「1．事業概要」の「(1)」の項を事業内容として取る
// （「(2) 工事完了日」「(3) サービス開始日」は日付の項目なので含めない）。
const BLOCK = /\n1．事業概要\n\(1\) ([^\n]+)\n\(2\) 工事完了日/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '17204' || input.format !== 'html' || !input.sourceUrl.endsWith('/docs/2026060900010/')) return [];
  const t = input.text, m = BLOCK.exec(t);
  if (!m || !t.startsWith('高度無線環境整備推進事業（令和8年度）における中間評価結果について')) return [];
  const p = project(input, 'narrative:高度無線環境整備推進事業', '高度無線環境整備推進事業', 2026, '高度無線環境整備推進事業（令和8年度）における中間評価結果について', 0);
  p.projectCode = null;
  p.activities = m[1];
  p.evidence.push(evidence(input, m[1], m.index + m[0].indexOf(m[1])));
  p.warnings.push('輪島市 高度無線環境整備推進事業 中間評価結果の「1．事業概要」(1)を事業内容として収録。');
  return [p];
}

export const entry = {
  extract,
  scope: '輪島市 高度無線環境整備推進事業（令和8年度）中間評価結果のページ: 「1．事業概要」(1)（事業内容）。',
};
