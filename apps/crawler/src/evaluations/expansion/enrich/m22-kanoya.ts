import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { centeredEnd, joinWrapped } from './m22-util';

// ---------------------------------------------------------------- 鹿屋市（教育委員会 点検・評価報告書の重点事業ごとの総括・検証シート）
// 公開済みレコードは令和６年度（r6_tenkenhyouka.pdf）・令和７年度（r7tenkenhyoukahoukoku.pdf）の同じ報告書から作られ、
// 年度は報告書の年度（評価年度・対象年度とも同じ）。「目的・目標」欄は見出しが欄の縦の中央にあり、続く「事業概要」欄との
// 区切りがテキストにないため、見出しの前後の行数で欄の終わりを決める（m22-util の centeredEnd）。
const FILES: Record<string, number> = { 'r6_tenkenhyouka.pdf': 2024, 'r7tenkenhyoukahoukoku.pdf': 2025 };
const HEAD = /\n事 業 名 等 ([^\n]+)\n[☑□■]ソフト事業\n担 当 課 ([^\n]+?) 事業の種類\n[☑□■]ハード事業\n/g;
const LABEL = '目的・目標';
/** 事業概要欄の始まり（欄名・箇条の記号）。 */
const STOP = /^(事 業 概 要|事業概要)( |$)|^[○〇◎]/;

function extract(input: CachedInput): ProjectEvaluation[] {
  const year = FILES[input.sourceUrl.split('/').pop()!];
  if (input.municipalityCode !== '46203' || !year) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  for (const h of t.matchAll(HEAD)) {
    const at = h.index! + h[0].length, lines = t.slice(at, at + 3000).split('\n');
    const li = lines.findIndex(l => l === LABEL || l.startsWith(`${LABEL} `));
    if (li < 0 || li > 6 || lines.slice(0, li).some(l => !l.trim() || STOP.test(l))) continue;
    const inline = lines[li].slice(LABEL.length).trim();
    const end = centeredEnd(lines, li, inline, STOP);
    if (end === null) continue;
    const parts = [...lines.slice(0, li), ...(inline ? [inline] : []), ...lines.slice(li + 1, end + 1)];
    const name = h[1].trim();
    const p = project(input, `${name}:purpose`, name, year, h[0].slice(1, -1), h.index! + 1);
    p.projectCode = `${year}:${name}`;
    p.evaluatedFiscalYear = year;
    p.department = h[2].trim();
    p.purpose = joinWrapped(parts);
    p.evidence.push(evidence(input, lines.slice(0, end + 1).join('\n'), at));
    p.warnings.push('鹿屋市 重点事業ごとの総括・検証シートの「目的・目標」欄。欄の見出しを除き、欄の幅での折り返しは改行を除いてつないだ。'
      + '事業概要欄との区切りは、見出しが欄の縦の中央にあることから前後の行数で判定（1つに決まる場合のみ）。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '鹿屋市 教育委員会点検・評価報告書（令和６・７年度）の重点事業ごとの総括・検証シート: 目的・目標欄（事業概要欄との区切りが1つに決まるもの）。',
};
