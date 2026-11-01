/** 堺市 (27140): 令和8年度 事務事業評価シート（令和7年度事務事業、1事業1PDF）の「7 事業の目的」「8 事業内容」欄。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// 公開済みレコードの多くは局別ページの「事務事業評価シート」一覧の行（事業名・所管部課、評価年度2026のみ）で、目的がない。
// 同じ事業の評価シートPDFから目的・事業内容を補う。事業名・事業番号はシート（2）の見出しから取り、シート（1）の見出しにも同じ文字列があるものに限る
// （batch12/m0-sakai.ts と同じ取り方）。所管部課は一覧と書き方が異なるため照合に使わない（同名の事業が2つあれば補強しない）。
// 「事業の概要」欄は抽出テキストで欄名と本文の並びが票ごとに異なり、本文が欄名より前にまとめて出る票もある。
// 欄名と本文が交互に「6 事業の対象／対象の本文／7 事業の目的／目的の本文／事業内容／事業内容の本文／8」と1段落ずつ並ぶ票だけを採る。
const HEAD = /^令和8年度 事務事業評価シート（1）\n\[ 令和7年度事務事業 \]\n/;
const OVERVIEW = /\n\n6 事業の対象\n\n(?:[^\n]+\n)*?[^\n]+\n\n7 事業の目的\n\n((?:[^\n]+\n)*?[^\n]+)\n\n事業内容\n\n((?:[^\n]+\n)*?[^\n]+)\n\n8\n\n/;
// 欄の本文に別の欄名が混ざっていないこと。
const FOREIGN = /事業の対象|事業の目的|事業内容|対象数|^単位$|事業の実施主体|主な支出先|国・府の基準/m;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '27140' || input.truncated || !HEAD.test(input.text)) return [];
  const t = input.text, s2 = t.indexOf('\n令和8年度 事務事業評価シート（2）\n');
  if (s2 < 0) return [];
  const id = /\n事務事業名\n\n([^\n]+)\n\n事業番号\n\n(\d{3}-\d{3})\n/.exec(t.slice(s2));
  const header = /事務事業名\n\n[\s\S]*?Ⅰ．基本情報/.exec(t);
  if (!id || !header) return [];
  const name = id[1].trim(), code = id[2];
  if (!header[0].includes(`\n${name}\n`) || !header[0].includes(`\n${code}\n`)) return [];
  const o = OVERVIEW.exec(t.slice(0, s2));
  if (!o || FOREIGN.test(o[1]) || FOREIGN.test(o[2])) return [];
  if (t.indexOf('7 事業の目的', o.index + o[0].length) >= 0 && t.indexOf('7 事業の目的', o.index + o[0].length) < s2) return [];
  const p = project(input, `補強:${code}`, name, 2026, header[0], header.index);
  p.projectCode = code;
  p.evaluatedFiscalYear = 2025;
  p.evidence.push(evidence(input, t.slice(0, t.indexOf(']') + 1), 0), evidence(input, id[0].trim(), s2 + id.index + 1));
  p.evidence.push(evidence(input, o[0].trim(), o.index + 2));
  p.purpose = o[1];
  p.activities = o[2];
  p.warnings.push('令和8年度事務事業評価シート（令和7年度事務事業）の「7 事業の目的」「8 事業内容」欄の原文（改行も原文のまま）。欄名と本文が交互に並ぶ票のみ（本文が欄名とずれて出る票は対象外）。');
  return [p];
}

export const entry = {
  extract,
  scope: '堺市 令和8年度 事務事業評価シート（1事業1PDF）から、7 事業の目的・8 事業内容の欄。欄名と本文が1段落ずつ交互に並ぶ票のみ。局別一覧の行として公開済みの事業の補強用。',
};
