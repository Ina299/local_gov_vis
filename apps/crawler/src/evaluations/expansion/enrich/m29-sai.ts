import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 佐井村（令和６年度 教育委員会の事務の点検及び評価に関する報告書 ―令和５年度の実績―）
// 公開済みレコードは同じ報告書（R6saimurakyouikuiinkai.pdf、評価年度＝令和６年度、対象年度＝令和５年度）の各事業。
// 事業ごとの「概 要」欄（事業名の見出しの次の行から「事業計画 【予算額】」の行の手前まで）を事業内容として取る。
// 欄は1段組みで、折り返しの改行は除いてつなぐ。「事業計画」「事業実績」は2列が混ざるため取らない。
const SECTION = /^(?:（[０-９\d]+）|[①-⑳]) ?([^\n]+)\n概 要\n((?:(?!事業計画 【)[^\n]+\n){1,5})(?=事業計画 【予算額】)/gm;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '02426' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/R6saimurakyouikuiinkai.pdf')) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  if (!t.startsWith('令和６年度\n佐井村教育委員会の事務\n')) return [];
  for (const m of t.matchAll(SECTION)) {
    const name = m[1].trim(), body = m[2].trimEnd();
    const p = project(input, `narrative:${name}`, name, 2024, m[0].trimEnd(), m.index!);
    p.projectCode = null; p.evaluatedFiscalYear = 2023;
    p.activities = body.split('\n').map(l => l.trim()).join('');
    p.evidence.push(evidence(input, body, m.index! + m[0].indexOf('\n概 要\n') + 5));
    p.warnings.push('佐井村 教育委員会の事務の点検及び評価に関する報告書（令和６年度・令和５年度の実績）の事業ごとの「概 要」欄を事業内容として収録（折り返しの改行は除いた）。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '佐井村 令和６年度 教育委員会の事務の点検及び評価に関する報告書（R6saimurakyouikuiinkai.pdf）: 事業ごとの「概 要」欄。',
};
