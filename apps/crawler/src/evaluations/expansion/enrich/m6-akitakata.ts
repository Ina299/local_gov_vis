import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, stableId } from '../shared';
import { extractAkitakata } from '../akitakata';

// ---------------------------------------------------------------- 安芸高田市（平成25年度 事務事業評価シート）
// 公開済みレコードの元と同じ個票（extractAkitakata）の「目 的（対象をどのような状態にしたいか）」欄。抽出テキストは
// 左の目的欄と中央のチェック項目の列・左のラベルが1行に並ぶ。次の形に限って目的を取り出す。
//   て下さい。 社会環境の変化に対応しているか実施内容の検証をしている [○×]   ← この行に他の文字がない
//   〈目的1行目〉 他の自治体を参考にし、実施内容の検証をしている [○×]
//   目 的[ 〈目的2行目〉]
//   (対象をどのような[ 〈目的3行目〉] （ ）
//   状態にしたいか) …
// 2行目・3行目は空白を含まない場合だけ（右の評価コメントの列が同じ行に並ぶと空白で区切られる）。3行目は句点で終わる場合だけ
// （4行目があると「状態にしたいか)」の行で評価コメントと区別できないため）で、その次の行がチェック項目
// 「規則や要綱等に基づいて、適正に業務の処理ができている」だけの場合に限る（4行目がその行の頭に並ぶ票がある）。
// 内容欄は評価コメントの列と混ざるため採らない。
const PURPOSE = /\nて下さい。 社会環境の変化に対応しているか実施内容の検証をしている(?: [○×－])?\n([^\n]+?) 他の自治体を参考にし、実施内容の検証をしている(?: [○×－])?\n目 的(?: ([^ \n]+))?\n\(対象をどのような(?: ([^ \n]+))? （ ）\n状態にしたいか\)[^\n]*\n([^\n]*)\n/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '34214') return [];
  const out: ProjectEvaluation[] = [];
  for (const sheet of extractAkitakata(input)) {
    const pos = /^extracted-text:chars:(\d+)-(\d+)$/.exec(sheet.evidence[0].cell ?? '');
    if (!pos) continue;
    const start = Number(pos[1]), seg = input.text.slice(start, Number(pos[2]));
    const m = PURPOSE.exec(seg);
    if (!m || (seg.match(/\n目 的[ \n]/g) ?? []).length !== 1) continue;
    const [, first, second, third, below] = m;
    if (third && (!second || !third.endsWith('。') || !/^規則や要綱等に基づいて、適正に業務の処理ができている(?: [○×－])?$/.test(below))) continue;
    const parts = [first.trim(), second, third].filter((s): s is string => !!s);
    // 句点で終わる行の後は改行を残し、途中で折り返した行はそのままつなぐ。
    const purpose = parts.reduce((s, l, i) => s + (i && parts[i - 1].endsWith('。') ? '\n' : '') + l, '');
    if (purpose.length < 4 || /(ている|である)(?: [○×－])?$/.test(purpose)) continue;
    const at = start + m.index + 1;
    // 公開済みレコード（同じ個票）と別の ID にして、補強用のシートとして突き合わせる。
    out.push({ ...sheet, id: stableId(input, `enrich-purpose:${sheet.projectCode}`, sheet.evaluationYear), amounts: [], indicators: [], ratings: [],
      purpose, evidence: [sheet.evidence[0], evidence(input, m[0].slice(1), at)],
      warnings: [sheet.warnings[0], '事務事業評価シートの「目 的（対象をどのような状態にしたいか）」欄。抽出テキストで同じ行に並ぶチェック項目「他の自治体を参考にし、実施内容の検証をしている」・ラベル「目 的」「(対象をどのような」を除き、折り返しの行をつないだ（目的欄の行の区切りが確定する個票のみ）。'] });
  }
  return out;
}

export const entry = {
  extract,
  scope: '安芸高田市 平成25年度 事務事業評価シート: 目的（チェック項目の列・ラベルとの境が確定する個票のみ）。内容欄は評価コメントの列と混ざるため対象外。',
};
