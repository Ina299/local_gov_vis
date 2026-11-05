import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 新富町（地方創生推進交付金 事業実施報告（様式１））
// 公開済みレコードは事業ごとの実施報告（年度ごとに1ファイル、対象年度は「令和N年度 実績額」等の見出し）の事業名・実績額。
// 様式に目的の欄はない。「３．本事業の効果について」の「事業効果の内容・詳細」欄（選択した効果の段階の後に書かれた、実際に感じた効果）を
// 成果として取る。欄のない旧様式（平成29〜令和元年度）は対象外。
const NAME = 'こゆ地域づくり推進機構２．０ 関係・交流人口拡大プロジェクト';
const SPECS: { file: string; fiscalYear: number; year: string }[] = [
  { file: '87212799.pdf', fiscalYear: 2020, year: '令和2年度 実績額［単位：円］' },
  { file: '13161644.pdf', fiscalYear: 2021, year: 'ア.令和3年度交\n付対象事業費' },
  { file: '34882074.pdf', fiscalYear: 2022, year: 'ア.令和4年度国費実\n績額' },
];
const FIELD = /\n事業効果の内容・詳細\n(?:\n?[①-④][^\n]+\n\n)?([^\n]+(?:\n[^\n]+)*)\n\n/;

function extract(input: CachedInput): ProjectEvaluation[] {
  const spec = SPECS.find(s => input.municipalityCode === '45402' && input.format === 'pdf' && input.sourceUrl.endsWith(`/${s.file}`));
  if (!spec) return [];
  const t = input.text;
  // 事業名は表の列と混ざって出力されることがあるため、前半・後半がそれぞれ現れることだけを確かめる（報告は1ファイル1事業）。
  if (t.split(spec.year).length !== 2 || t.split('こゆ地域づくり推進機構２．０ 関').length !== 2 || !/\n(係・交|)流人口拡大プロジェクト\n/.test(t)) return [];
  const m = FIELD.exec(t);
  if (!m || /^(例：|＜凡例)/.test(m[1]) || t.split('\n事業効果の内容・詳細\n').length !== 2) return [];
  const at = m.index + m[0].indexOf(m[1], '\n事業効果の内容・詳細\n'.length);
  const p = project(input, `narrative:${spec.fiscalYear}`, NAME, null, spec.year);
  p.projectCode = null; p.evaluatedFiscalYear = spec.fiscalYear;
  p.outcomes = m[1].split('\n').join('');
  p.evidence.push(evidence(input, m[1], at));
  p.warnings.push('新富町 地方創生推進交付金 事業実施報告の「事業効果の内容・詳細」欄を成果として収録。');
  return [p];
}

export const entry = {
  extract,
  scope: '新富町 地方創生推進交付金 事業実施報告（令和2〜4年度）: 「事業効果の内容・詳細」欄（成果）。',
};
