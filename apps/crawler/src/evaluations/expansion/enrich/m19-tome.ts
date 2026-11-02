import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 登米市（令和７年度事務事業評価結果報告書（令和６年度実施事務事業））
// 公開済みレコードは同じ報告書の事務事業評価表の事業名・指標・評価から作られ、目的は未収録だった。
// 「事務事業 目的・意図」欄は、2段の欄見出し（「事務事業」「目的・意図」）が本文の行頭に1つずつ割り込んだ形で抽出される。
// 見出しがちょうど1つずつ、本文の先頭3行以内にある場合だけ、見出しを除き、句点で終わらない行の改行（折り返し）を除いて目的とする。
// 成果指標の分析・評価の説明は表の列が同じ行に混在するため未収録。保存テキストは途中（120,000字）までで、その範囲の評価表だけが対象。
const SHEET = /事務事業評価表\n【事務事業の基本情報】\n施策 名称 [^\n]+ 担当課 ([^\n]+)\n名称 ([^\n]+)\n((?:[^\n]+\n)+?)【事務事業の指標】/g;

function purposeOf(raw: string): string | null {
  const lines = raw.split('\n');
  const head = lines.findIndex(l => /^事務事業( |$)/.test(l)), label = lines.findIndex(l => /^目的・意図( |$)/.test(l));
  if (lines.filter(l => /^事務事業( |$)/.test(l)).length !== 1 || lines.filter(l => /^目的・意図( |$)/.test(l)).length !== 1) return null;
  if (head > 1 || label !== head + 1 || lines.some(l => /事務事業|目的・意図/.test(l.replace(/^(事務事業|目的・意図) ?/, '')))) return null;
  const body = lines.map(l => l.replace(/^(事務事業|目的・意図) ?/, '')).filter(l => l);
  if (body.length < 1) return null;
  return body.reduce((acc, l, i) => acc + (i === 0 ? '' : /。$/.test(body[i - 1]) ? '\n' : '') + l, '');
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '04212' || !input.sourceUrl.endsWith('/documents/r7jimujigyouhyouka.pdf')) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of input.text.matchAll(SHEET)) {
    const raw = m[3].slice(0, -1), purpose = purposeOf(raw);
    if (!purpose || purpose.length < 10) continue;
    const name = m[2].trim();
    const p = project(input, `${name}|narrative`, name, null, m[0].slice(0, m[0].indexOf('\n名称 ') + 4 + m[2].length), m.index!);
    p.projectCode = null;
    p.department = m[1].trim();
    p.evaluatedFiscalYear = 2024;
    p.purpose = purpose;
    p.evidence.push(evidence(input, raw, m.index! + m[0].length - m[3].length - '【事務事業の指標】'.length));
    p.warnings.push('登米市事務事業評価表（令和６年度実施事務事業）の「事務事業 目的・意図」欄を目的に収録（本文に割り込んだ欄見出しと折り返しの改行は除去）。'
      + '成果指標の分析・評価の説明は表の列が混在するため未収録。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '登米市 令和７年度事務事業評価結果報告書（令和６年度実施事務事業）の事務事業評価表: 「事務事業 目的・意図」の文章（保存テキストの範囲内）。',
};
