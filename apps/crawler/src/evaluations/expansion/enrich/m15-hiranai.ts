import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 平内町（教育委員会の事務の点検及び評価に関する報告書、概要・成果）
// 公開済みレコードは令和６〜８年度の報告書（R6hyokahoukokusyo.pdf ほか、各年度の前年度の実績）の事業ごとの評価
// （①〜の番号付きの事業名、概要・実績・成果・課題等）。目的の欄はないため、「概要」欄を事業内容、「成果」欄を成果とする。
// 欄見出しは1字ずつの行（概／要、成／果）で、見出しが本文の行の間に出力される版は本文と欄の境界が決まらないため、
// 見出しの後が空行で本文が続き、空行の後に次の欄見出し（実／績、課／題／等）が来る版に限る。
// 有識者の意見の章にも同じ番号付きの事業名があるが、概要の欄を持たないので対象にならない。
const TITLE = /^令和([０-９]+)年度\n+平内町教育委員会の事務の\n+点検及び評価に関する報告書\n+―令和([０-９]+)年度の実績―\n/m;
const SHEET = /^[①-⑳]([^\n]+)\n\n概\n要\n\n((?:[^\n]+\n)+)\n実\n績\n/gm;
const OUTCOME = /\n成\n果\n\n((?:[^\n]+\n)+)\n課\n題\n等\n/;
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
/** 句点で終わらない行の後の改行（欄の幅での折り返し）を除く。 */
const join = (raw: string) => raw.replace(/\n$/, '').split('\n').map(l => l.trim()).reduce((acc, l, i, a) => acc + (i === 0 ? '' : a[i - 1].endsWith('。') ? '\n' : '') + l, '');

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '02301' || input.format !== 'pdf' || !/\/R\dhyou?kahoukokusyo\.pdf$/.test(input.sourceUrl) || input.truncated) return [];
  const t = input.text, title = TITLE.exec(t);
  if (!title) return [];
  const year = 2018 + Number(ascii(title[1])), fy = 2018 + Number(ascii(title[2]));
  const out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(SHEET)) {
    const start = m.index!, name = m[1].trim();
    // 成果の欄はこの事業の欄の中（次の番号付きの事業名の手前）にあること。
    const rest = t.slice(start + m[0].length), next = rest.search(/\n[①-⑳][^\n]+\n/), scope = next < 0 ? rest : rest.slice(0, next + 1);
    const o = OUTCOME.exec(scope);
    if (/[\d,]+ ?(千円|円)\n?$/.test(m[2])) continue;
    const p = project(input, `narrative:${name}`, name, year, m[0].slice(0, m[0].indexOf('\n')), start);
    p.projectCode = null; p.evaluatedFiscalYear = fy;
    p.activities = join(m[2]);
    p.outcomes = o ? join(o[1]) : null;
    p.evidence.push(evidence(input, title[0].slice(0, -1), title.index), evidence(input, m[2].slice(0, -1), start + m[0].indexOf(m[2])));
    if (o) p.evidence.push(evidence(input, o[1].slice(0, -1), start + m[0].length + o.index + o[0].indexOf(o[1])));
    p.warnings.push('平内町 教育委員会の事務の点検及び評価に関する報告書の事業ごとの評価のうち、「概要」欄を事業内容、「成果」欄を成果として収録（目的の欄はない）。'
      + '欄見出しが本文の行の間に出力されていない版のみ。句点で終わらない行の後の改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '平内町 教育委員会の事務の点検及び評価に関する報告書（令和６〜８年度）: 事業ごとの「概要」（事業内容）・「成果」欄。目的の欄はない。',
};
