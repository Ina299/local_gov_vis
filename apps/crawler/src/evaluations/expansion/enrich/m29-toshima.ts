import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 十島村（地方創生応援税制（企業版ふるさと納税）対象事業 評価検証シート）
// 公開済みレコードは年度ごとの評価検証シート（対象年度＝「参考：令和N年度実施事業」）の対象事業。
// 「事業概要」欄（見出し「事業始期」「事業終期」の後の段落）を事業内容として取る。欄の見出しは「事業概要」なので目的には入れない。
const SHEET = /^令和([４５])年度 地方創生応援税制（企業版ふるさと納税）対象事業 評価検証シート\n\n参考：令和\1年度実施事業（[^\n]*\n\n対象事業名 ([^\n]+)\n事業概要\n\n事業始期\n\n事業終期\n\n((?:[^\n]+\n)+?)\n/;
const YEAR: Record<string, number> = { '４': 2022, '５': 2023 };

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '46304' || input.format !== 'pdf' || !input.sourceUrl.startsWith('https://www.tokara.jp/wp/wp-content/uploads/')) return [];
  const t = input.text, m = SHEET.exec(t);
  if (!m || !/。$/.test(m[3].trim())) return [];
  const p = project(input, `narrative:${m[2]}`, m[2].trim(), null, m[0].slice(0, m[0].indexOf('\n事業概要\n')), 0);
  p.projectCode = null; p.evaluatedFiscalYear = YEAR[m[1]];
  const lines = m[3].trimEnd().split('\n');
  p.activities = lines.reduce((acc, l, i) => i === 0 ? l : acc + (/。$/.test(lines[i - 1]) ? '\n' : '') + l, '');
  p.evidence.push(evidence(input, m[3].trimEnd(), m[0].length - m[3].length - 1));
  p.warnings.push('十島村 企業版ふるさと納税 対象事業 評価検証シートの「事業概要」欄を事業内容として収録（折り返しの改行は除いた）。');
  return [p];
}

export const entry = {
  extract,
  scope: '十島村 地方創生応援税制（企業版ふるさと納税）対象事業 評価検証シート（令和４・５年度）: 「事業概要」欄（事業内容）。',
};
