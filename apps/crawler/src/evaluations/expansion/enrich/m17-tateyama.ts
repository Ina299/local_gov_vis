import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m17-util';

// ---------------------------------------------------------------- 立山町（教育委員会の事務の点検及び評価 令和6年度 主要施策事業）
// 公開済みレコードは同じ資料の主要施策事業のシートから作られ、点検・評価（成果）はあるが目的・事業内容が空。
// 「２ 目的と内容」の「内容（どのような手段で行うか）」欄は「３ 活動指標の実績」の見出しまで1列で出力されるため事業内容とする。
// 目的の「意図」欄は、対象・受益者の欄の文と同じ行に続けて出力され、欄の境が空白の位置でしか決まらないため採らない。
const TITLE = /^令和 6 年度\n教育委員会の事務の点検及び評価\n（令和 6 年度分）$/m;
const NAME = /^事務事業名 ([^\n]+)$/gm;
const FIELD = /\n内容（どのような手段で行うか）\n((?:(?!３ 活動指標の実績)[^\n]+\n)+?)３ 活動指標の実績\n/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '16323' || !/\/group\/10\/R6jimunotenken2\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, title = TITLE.exec(t);
  if (!title) return [];
  const names = [...t.matchAll(NAME)], out: ProjectEvaluation[] = [];
  names.forEach((n, i) => {
    if (input.truncated && i === names.length - 1) return;
    const start = n.index!, seg = t.slice(start, names[i + 1]?.index ?? t.length), f = FIELD.exec(seg);
    if (!f) return;
    const p = project(input, `R6:${n[1]}:narrative`, n[1].trim(), 2024, n[0], start);
    p.evaluatedFiscalYear = 2024;
    const raw = f[1].slice(0, -1);
    p.activities = unwrap(raw);
    p.evidence.push(evidence(input, title[0], title.index!), evidence(input, raw, start + f.index! + f[0].indexOf(f[1])));
    p.warnings.push('立山町 主要施策事業シートの「内容（どのような手段で行うか）」欄を事業内容として収録。欄の幅での折り返しだけをつないだ。目的（意図）欄は対象・受益者の欄と行が混ざるため未収録。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '立山町 教育委員会の事務の点検及び評価（令和6年度 主要施策事業）: 内容（事業内容）。目的の意図欄は対象・受益者の欄と同じ行に出力されるため対象外。',
};
