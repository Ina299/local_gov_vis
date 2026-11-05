import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 多久市（令和7年度 教育に関する事務の点検及び評価等報告書（令和６年度事業分））
// 公開済みレコードは同じ報告書（35560_898719_misc.pdf、評価年度＝令和７年度、対象年度＝令和６年度）の事務事業。
// 「●Plan 事務事業の概要」の「目的・目標」欄は◇で始まる箇条、「内容」欄は○（〇）で始まる箇条で書かれている。
// 欄の見出しは箇条と別の位置に出力されるため、◇の箇条の連なり（折り返しの行を含み、途中に混ざった見出し「目的・目標」の行は除く）を目的、
// その直後の○の箇条の連なりを事業内容として取る。◇の箇条がない版（見出しと表が混ざる版）は取らない。
const PLAN = /^●Plan 事務事業の概要\n事務事業名 ([^\n]+)\n/gm;
const ITEM = /^[◇○〇・]/;

/** lines の i 行目から、mark で始まる箇条の連なり（折り返しの行を含む）を読む。空行・別の記号の箇条・skip の行で終わる。 */
function items(lines: string[], i: number, mark: RegExp, skip: RegExp): { value: string[]; end: number } {
  const value: string[] = [];
  let k = i;
  for (; k < lines.length && lines[k].trim(); k++) {
    const l = lines[k].trim();
    if (skip.test(l)) continue;
    if (mark.test(l)) value.push(l);
    else if (ITEM.test(l) || !value.length) break;
    else value[value.length - 1] += l;
  }
  return { value, end: k };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '41204' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/35560_898719_misc.pdf')) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  if (!/^令和 7 年度\n[\s\S]{0,80}（令和６年度事業分）\n/.test(t)) return [];
  for (const m of t.matchAll(PLAN)) {
    const end = t.indexOf('\n●Do 事務事業の実施\n', m.index!);
    if (end < 0 || end - m.index! > 2500) continue;
    const plan = t.slice(m.index!, end + 1), lines = plan.split('\n');
    if (!plan.includes('\n目的・目標\n') || !plan.includes('\n内容\n')) continue;
    const first = lines.findIndex(l => /^◇/.test(l));
    if (first < 0) continue;
    const purpose = items(lines, first, /^◇/, /^目的・目標$/);
    // ◇の連なりの直後（空行・見出し「内容」を挟んでもよい）に○の連なりがあること。
    let k = purpose.end;
    while (k < lines.length && (!lines[k].trim() || lines[k].trim() === '内容')) k++;
    const activities = /^[○〇]/.test(lines[k] ?? '') ? items(lines, k, /^[○〇・]/, /^$/) : null;
    if (!purpose.value.length) continue;
    const offset = (n: number) => m.index! + lines.slice(0, n).reduce((s, l) => s + l.length + 1, 0);
    const p = project(input, `narrative:${m[1]}`, m[1].trim(), 2025, m[0].slice(0, -1), m.index!);
    p.projectCode = null; p.evaluatedFiscalYear = 2024;
    p.purpose = purpose.value.join('\n');
    p.evidence.push(evidence(input, t.slice(offset(first), offset(purpose.end) - 1), offset(first)));
    if (activities?.value.length) {
      p.activities = activities.value.join('\n');
      p.evidence.push(evidence(input, t.slice(offset(k), offset(activities.end) - 1), offset(k)));
    }
    p.warnings.push('多久市 教育に関する事務の点検及び評価等報告書（令和６年度事業分）の「目的・目標」欄（◇の箇条）を目的、「内容」欄（○の箇条）を事業内容として収録。'
      + '箇条の折り返しの改行は除き、途中に混ざった欄の見出しの行は除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '多久市 令和7年度 教育に関する事務の点検及び評価等報告書（35560_898719_misc.pdf）: 「目的・目標」「内容」欄（◇・○の箇条）。',
};
