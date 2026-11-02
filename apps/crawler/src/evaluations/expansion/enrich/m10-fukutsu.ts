import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { joinWrapped } from './m10-util';

// ---------------------------------------------------------------- 福津市（令和7年度 事務事業評価）
// 公開済みレコードは同じ資料の事業ごとの1ページから作られ、目的・内容・成果が空欄。各ページは「-N-」のページ番号、事業名、
// 「単位：円」、「大事業 … 担当 …」の順に始まり、「事業の目的・背景」「事業の内容（…）」「事業実施後の成果等」の見出しの
// 直後に欄の内容が続く（内容と成果の欄の後には「（事業の達成度を測る指標）」が続く）。欄の幅での折り返しだけを除いてつなぐ。
// 令和6年度版は目的の欄がなく（内容は公開済み）、事前・事後の課題と成果が2列で交互に並ぶため対象外。
const PAGE = /\n-\d+-\n([^\n]+)\n単位：円\n大事業 [^\n]* 担当 ([^\n]+)\n/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '40224' || !/\/R7_jimujigyohyoka\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(PAGE)], out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const start = h.index! + 1, end = heads[k + 1]?.index ?? t.length, seg = t.slice(start, end);
    if (input.truncated && k === heads.length - 1) return;
    const purpose = /\n事業の目的・背景\n((?:[^\n]+\n)+?)事業の内容（[^\n]*）\n/.exec(seg);
    if (!purpose) return;
    const act = /\n事業の内容（[^\n]*）\n((?:[^\n]+\n)+?)（事業の達成度を測る指標）\n/.exec(seg);
    const res = /\n事業実施後の成果等\n((?:[^\n]+\n)+?)（事業の達成度を測る指標）\n/.exec(seg);
    const name = h[1].trim();
    const p = project(input, `${name}:narrative`, name, 2025, h[0].slice(1, -1), start);
    p.evaluatedFiscalYear = 2025;
    p.department = h[2].trim();
    const field = (m: RegExpExecArray) => {
      const raw = m[1].slice(0, -1), at = start + m.index! + m[0].indexOf(m[1], 1);
      p.evidence.push(evidence(input, raw, at));
      return joinWrapped(raw, 40);
    };
    p.purpose = field(purpose);
    // 指標の見出しより前に目標値の行（【目標値】…）が入る場合は、欄の内容に含めない。
    if (act && !/\n【目標値/.test('\n' + act[1])) p.activities = field(act);
    if (res && !/\n【実績値/.test('\n' + res[1])) p.outcomes = field(res);
    p.warnings.push('福津市事務事業評価（令和7年度）の「事業の目的・背景」「事業の内容」「事業実施後の成果等」欄。欄の幅での折り返しだけを除いてつないだ。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '福津市 令和7年度 事務事業評価: 事業の目的・背景、事業の内容、事業実施後の成果等（目的・事業内容・成果）。令和6年度版は目的の欄がなく対象外。',
};
