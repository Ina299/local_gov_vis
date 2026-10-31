/**
 * 大分県 令和８年度 政策・施策評価調書、事務事業評価調書（別冊２「主要な施策の成果（事務事業評価）令和7年度実績」）。
 * 1ページに数事業の個票が並び、抽出テキストでは欄が入り交じる。次の条件をすべて満たす事業だけを収録する:
 *  - ページ（「主要な施策の成果（事務事業評価）令和７年度実績【施策コード：…】」）内で、担当課の行（行頭の「…課／室／局」）と
 *    「予算額 (うち翌年度繰越額)」欄が 課→予算額→課→予算額… と交互に並ぶ（k番目の課の行とk番目の予算額欄が同じ個票）;
 *  - 事業名: 前の個票の予算額欄からその課の行までに「…事業」で終わる行がちょうど1つ;
 *  - 金額: 予算額欄の直後に「予算額 (翌年度繰越額)」の値、続いて「決算額 (うち国庫支出金)」の欄名と値が並ぶ形、
 *    または予算額・決算額の値が欄名の後にまとめて並ぶ形で 予算額−翌年度繰越額＝決算額 の検算が合う場合。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { amount, mergeReprints, nfkc, num, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const TITLE = '主要な施策の成果（事務事業評価）\n令和7年度実績';
const PAGE = /主要な施策の成果（事務事業評価）令和７年度実績【施策コード：([^】]+)】/g;
const DEPT = /^(\S{2,14}?(?:課|室|局|センター|事務所))(?: |$)/gm;
const NOT_DEPT = new Set(['主な担当部局', '関係部局', '所管部局']);
const BUDGET = '予算額\n(うち翌年度繰越額)';
/** 金額の単位。抽出テキストに単位の印字はないが千円とみなす（利用者の判断。2026-11）。null にすると金額は未収録。 */
const UNIT: '千円' | null = '千円';
const N = String.raw`\d{1,3}(?:,\d{3})*`;
// 形1: 予算額欄 → 予算額(繰越額) → [No.] [番号] → 決算額欄 → [1字の欄名断片] → 決算額(国庫支出金)
const SHAPE1 = new RegExp(String.raw`^予算額\n\(うち翌年度繰越額\)\n\n(${N})\n\((${N})\)\n(?:No\.\n)?(?:\n\d{1,2}\n)?\n決算額\n\(うち国庫支出金\)\n\n(?:[^\n\d(]\n\n)*(${N})(?: [①-⑳])?\n\((${N})\)`);
// 形2: 予算額欄・決算額欄の後に 値X・値Y・(繰越額) が並ぶ。X−繰越額＝Y のときだけ X=予算額, Y=決算額。
const SHAPE2 = new RegExp(String.raw`^予算額\n\(うち翌年度繰越額\)\n\n決算額\n\n(${N})\n(${N})\n\((${N})\)\n`);

function extractOne(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '44000') return [];
  const t = input.text;
  if (!t.includes(TITLE)) return [];
  const pages = [...t.matchAll(PAGE)];
  const out: ProjectEvaluation[] = [];
  pages.forEach((pm, pi) => {
    const ps = pm.index!, pe = pages[pi + 1]?.index ?? t.length;
    const pg = t.slice(ps, pe);
    const depts = [...pg.matchAll(DEPT)].filter(m => !NOT_DEPT.has(m[1]));
    const budgets = [...pg.matchAll(/予算額\n\(うち翌年度繰越額\)/g)].map(m => m.index!);
    const seq = [...depts.map(m => ({ at: m.index!, k: 'D' })), ...budgets.map(at => ({ at, k: 'B' }))].sort((a, b) => a.at - b.at).map(x => x.k).join('');
    if (!/^(DB)+$/.test(seq)) return;
    depts.forEach((d, i) => {
      const from = i ? budgets[i - 1] : 0;
      const region = pg.slice(from, d.index!);
      const cands: { text: string; off: number }[] = [];
      let pos = 0;
      for (const line of region.split('\n')) {
        const s = line.trim();
        if (/事業$/.test(s) && !/^[①-⑳・○※]/.test(s) && !/[ 。、]/.test(s) && s.length <= 30) cands.push({ text: s, off: ps + from + pos + line.indexOf(s) });
        pos += line.length + 1;
      }
      if (cands.length !== 1) return;
      const name = cands[0].text;
      const p = project(input, `${pm[1]}-p${pi + 1}-${i + 1}`, name, 2026, name, cands[0].off);
      p.evidence.push(evidence(input, pm[0], ps), evidence(input, TITLE));
      p.department = d[1];
      p.evidence.push(evidence(input, d[1], ps + d.index!));
      p.evaluatedFiscalYear = 2025;
      const b = pg.slice(budgets[i]);
      const m1 = SHAPE1.exec(b), m2 = m1 ? null : SHAPE2.exec(b);
      const at = ps + budgets[i];
      const aligned = m1 && num(m1[3]) <= num(m1[1]) ? { budget: m1[1], actual: m1[3] } : m2 && num(m2[1]) - num(m2[3]) === num(m2[2]) ? { budget: m2[1], actual: m2[2] } : null;
      if (UNIT && aligned) {
        const raw = (m1 ?? m2)![0].trimEnd();
        p.amounts.push(amount(input, 'budget', 2025, aligned.budget, UNIT, raw, at), amount(input, 'actual', 2025, aligned.actual, UNIT, raw, at));
        p.warnings.push('予算額・決算額は個票の欄の値。単位は抽出テキストに印字されていないため千円とみなした。');
      } else if (aligned) p.warnings.push(`予算額・決算額欄の値（予算額 ${aligned.budget}、決算額 ${aligned.actual}）は欄名との対応を確認できたが、金額の単位が抽出テキストに印字されていないため金額は未収録。`);
      else p.warnings.push('予算額・決算額の欄名と値の並びが抽出テキストで確定しないため金額は未収録。');
      p.warnings.push('別冊２「主要な施策の成果（事務事業評価）令和7年度実績」の個票。担当課は個票の担当課欄。');
      out.push(p);
    });
  });
  return mergeReprints(out, p => `${p.department}|${nfkc(p.projectName)}`);
}

export const entries: Record<string, Entry> = {
  '44000': {
    scope: '令和８年度 事務事業評価調書（別冊２「主要な施策の成果（事務事業評価）令和7年度実績」）の個票のうち、担当課・予算額欄の並びと事業名の行が抽出テキストで一意に対応づく事業の事業名・担当課・令和7年度予算額/決算額（千円）。政策・施策評価調書、成果指標、並びが入り交じったページの事業は対象外。',
    extract: (input) => extractOne(input),
  },
};
