import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 大河原町（大規模事業の自己評価調書）
// 公開済みレコードは各調書（1資料1事業）から年度なしで作られている（年度なしの突き合わせ: 同じ資料の根拠を持つ年度なしの事業票）。
// 「１．事業の概要」の「事業の目的」欄（見出しの後の空行から次の空行までの段落）を目的とする。
// 「事業の内容」欄は表・箇条と別紙参照が混ざり段落の区切りが欄の区切りと一致しないため扱わない。

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '04321' || !input.text.slice(0, 200).replace(/[ \n]/g, '').includes('自己評価調')) return [];
  const t = input.text, name = /\n事業の名称\n\n([^\n]+)\n\n/.exec(t), label = t.indexOf('\n事業の目的\n\n');
  if (!name || label < 0 || t.indexOf('\n事業の目的\n\n', label + 1) >= 0 || t.indexOf('\n事業の名称\n', name.index! + 1) >= 0) return [];
  const at = label + '\n事業の目的\n\n'.length, end = t.indexOf('\n\n', at);
  const raw = end > at ? t.slice(at, end) : '';
  // 段落の最後が句点、または句点の後の括弧書き（別紙参照など）で終わるもの。
  if (!/。(（[^）\n]+）)?$/.test(raw)) return [];
  const p = project(input, `${name[1]}:purpose`, name[1], null, name[1], name.index! + '\n事業の名称\n\n'.length);
  p.projectCode = null;
  p.purpose = unwrap(raw);
  p.evidence.push(evidence(input, raw, at));
  p.warnings.push('大河原町 自己評価調書の「事業の目的」欄（欄の幅での折り返しは改行を除いてつないだ）。');
  return [p];
}

export const entry = {
  extract,
  scope: '大河原町 大規模事業の自己評価調書（学校給食センター・桜保育所・白石川右岸河川敷・大河原中屋内運動場）: 事業の目的欄。',
};
