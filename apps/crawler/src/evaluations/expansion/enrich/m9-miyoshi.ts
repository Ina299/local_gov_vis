import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 三次市「令和 7 年度 Ｔｈｅ行政チェック事務事業チェックシート」
// 公開済みレコード（同じチェックシートから作成。目的なし）の補強用。目的として「■めざす姿（令和10年度までに実現したい
// 具体的な到達点）」の「事務事業」の行（事務事業の到達点＝事業が何のためにあるか）を採る。
// 右の列（改善状況・評価）の文が同じ行に続く・次の行に入り込むことがあるため、その行がそのまま「■事業概要」の行に続き、
// 本文が句点で終わり、句点の後に空白で続く文がない場合だけ採る。事業内容の欄は右の列の文と行が混ざるため対象外。
const HEAD = /令和 7 年度 Ｔｈｅ行政チェック事務事業チェックシート\n/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '34209' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/uploaded/attachment/30029.pdf')) return [];
  const t = input.text, starts = [...t.matchAll(HEAD)].map(m => m.index!), out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    if (input.truncated && i === starts.length - 1) return;
    const seg = t.slice(s, starts[i + 1] ?? t.length);
    const name = /\n番号 事務事業名 [^\n]*\n[^\n]*\n\d+ ([^\n]+)\n/.exec(seg);
    const goal = [...seg.matchAll(/\n事務事業 ([^\n]+)\n■事業概要\n/g)];
    if (!name || goal.length !== 1 || !/■めざす姿（令和10年度までに実現したい具体的な到達点）/.test(seg.slice(0, goal[0].index!))) return;
    const text = goal[0][1].trim();
    if (!text.endsWith('。') || /[。.]\s/.test(text) || text.indexOf('。') !== text.length - 1) return;
    const p = project(input, `${name[1].trim()}:purpose`, name[1].trim(), 2025, name[0].trim(), s + name.index! + 1);
    p.purpose = text;
    p.evidence.push(evidence(input, goal[0][1], s + goal[0].index! + '\n事務事業 '.length));
    p.warnings.push('三次市 事務事業チェックシート（令和7年度）の「めざす姿（令和10年度までに実現したい具体的な到達点）」の事務事業の行を目的として収録。');
    out.push(p);
  });
  return out.filter(p => out.filter(o => o.projectName === p.projectName).length === 1);
}

export const entry = { extract, scope: '三次市 令和7年度 事務事業チェックシートの「めざす姿」（事務事業の到達点）。取得済みテキストは途中までのため、その範囲の事業のみ。' };
