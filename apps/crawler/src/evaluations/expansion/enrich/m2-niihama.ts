/** 新居浜市 (38205): 令和6年度事務事業評価表（事後評価 2024、施策別PDF）の「目的（どんな状態にしたいのか）」欄。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// 公開済みレコードは同じ評価表の細事業名・担当課・実施年度（2024）から作られ、目的が空欄。
// 「Ⅱ 事務事業の実施概要」の最後の欄が目的で、「Ⅲ 投入費用」の見出しの手前で終わる。手段の欄の後に縦書きの
// 「事」「業」「内」「容」が1文字ずつの行で続き、その直後が「目 的 …」の行、次が見出しの残り「（どんな状態にしたいのか）」
// （2行目の本文が同じ行に続くことがある）で欄が終わる並びだけを採る。見出しの文字を除いた本文を改行のまま採る。
// 縦書きの文字が本文の行頭に付く並び（「容 …」）や、目的の行の前後に別の行がある並びは採らない。
// 手段の欄は縦書きの見出しの文字（「務」「（どうやって）」）が本文の行と混ざるため対象外。
const HEAD = /令和(\d+)年度事務事業評価表\nI 基礎情報 事後評価 (\d{4}) (\d{5}_\d{2})\n事業名（行目名称） [^\n]*? ?細事業名 ([^\n]+)\n/g;
const BLOCK = /\n事\n業\n内\n容\n目 的 ([^\n]+)\n（どんな状態にしたいのか）(?: ([^\n]+))?\nⅢ 投入費用\n/;
const DEPT = /\n基本計画 [^\n]* 担当課 (\S+)\n/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '38205' || input.format !== 'pdf' || input.truncated) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const done = Number(h[2]);
    if (2018 + Number(h[1]) !== done) return;
    const start = h.index, seg = t.slice(start, heads[k + 1]?.index ?? t.length);
    const b = BLOCK.exec(seg), sections = seg.split('\nⅢ 投入費用\n').length - 1;
    if (!b || sections !== 1) return;
    const purpose = b[2] ? `${b[1]}\n${b[2]}` : b[1];
    const name = h[4].trim(), dept = DEPT.exec(seg);
    const p = project(input, `${h[3]}:purpose`, name, null, h[0].trimEnd(), start);
    p.projectCode = null; p.evaluatedFiscalYear = done;
    if (dept) p.department = dept[1];
    p.purpose = purpose;
    const raw = b[0].slice('\n事\n業\n内\n容\n'.length, -'\nⅢ 投入費用\n'.length);
    p.evidence.push(evidence(input, raw, start + b.index + '\n事\n業\n内\n容\n'.length));
    p.warnings.push('事務事業評価表の「目的（どんな状態にしたいのか）」欄の原文（見出しの文字だけを除き、本文は改行も原文のまま）。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '新居浜市 令和6年度事務事業評価表（事後評価 2024）の目的（どんな状態にしたいのか）の欄（見出しの文字と本文の行の並びが確定するもののみ）。手段の欄は見出しの文字が本文と混ざるため対象外。',
};
