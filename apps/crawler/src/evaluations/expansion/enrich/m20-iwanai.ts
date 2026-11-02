import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 岩内町（電源立地地域対策交付金 事業評価個表、令和２・３年度）
// 公開済みレコードは同じ資料の事業評価個表（対象年度＝個表の見出しの「（令和N年度）」）。目的の欄はなく、「交付金事業の概要」を
// 事業内容、「交付金事業の定性的な成果及び評価等」を成果として取る。
// 概要は事業名の行の次の段落の、最初に句点で終わる行まで（4行まで）。その後に続く主要政策・施策の欄の行は含めない。
// 成果は評価年度の見出しの次の段落で、空行の後に「評価に係る第三者機関等の活用の有無」が続く版だけ。
const SHEET = /Ⅱ．事業評価個表（令和([0-9０-９])年度）\n/g;
const SUMMARY = /\n交付金事業の概要\n\n交付金事業の名称\n([^\n]+)\n\n((?:[^\n]+\n){1,4})/;
const OUTCOME = /\n交付金事業の定性的な成果及び評価等\n(?:[^\n]+\n){0,3}\n令和[0-9０-９]年度\n\n((?:[^\n]+\n)+)\n評価に係る第三者機関等の活用の有無\n/;
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
/** 句点で終わる行の後だけ改行を残し、欄の幅での折り返しの改行は除く。 */
const join = (lines: string[]) => lines.reduce((acc, l, i) => acc + (i === 0 ? '' : lines[i - 1].endsWith('。') ? '\n' : '') + l, '');

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01402' || input.format !== 'pdf') return [];
  const t = input.text, heads = [...t.matchAll(SHEET)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const h = heads[i], start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const s = SUMMARY.exec(seg);
    if (!s) continue;
    const name = s[1].trim(), year = 2018 + Number(ascii(h[1]));
    const p = project(input, `narrative:${name}:${year}`, name, null, h[0].trimEnd(), start);
    p.projectCode = null; p.evaluatedFiscalYear = year;
    const lines = s[2].split('\n'), end = lines.findIndex(l => l.trim().endsWith('。'));
    if (end >= 0) {
      const raw = lines.slice(0, end + 1).join('\n');
      p.activities = join(lines.slice(0, end + 1).map(l => l.trim()));
      p.evidence.push(evidence(input, raw, start + s.index + s[0].indexOf(s[2])));
    }
    const o = OUTCOME.exec(seg);
    if (o && !/^(無|有)$/m.test(o[1])) {
      const raw = o[1].trimEnd();
      p.outcomes = join(raw.split('\n').map(l => l.trim()));
      p.evidence.push(evidence(input, raw, start + o.index + o[0].indexOf(o[1])));
    }
    if (!p.activities && !p.outcomes) continue;
    p.warnings.push('岩内町 電源立地地域対策交付金 事業評価個表の「交付金事業の概要」（最初に句点で終わる行まで）を事業内容、'
      + '「交付金事業の定性的な成果及び評価等」を成果として収録。目的の欄はない。欄の幅での折り返しの改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '岩内町 電源立地地域対策交付金 事業評価個表（令和２・３年度）: 「交付金事業の概要」（事業内容）・「交付金事業の定性的な成果及び評価等」（成果）。目的欄はない。',
};
