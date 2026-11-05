import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 飯豊町（第1期 まち・ひと・しごと創生総合戦略 事業別レビューシート）
// 公開済みレコードは「第1期 …総合戦略（評価シート一覧）」（dai1ki_hyouka.pdf、年度の記載なし）の事業。
// 同じページ（001/chihosousei.html）の見出し「第1期 …検証結果を公開します。」の下に並ぶ「第1期 …（事業別レビューシート）」
// （dai1ki_review.pdf、平成27年度〜令和2年度分）の【項目別評価】「（１）事業対象、目的」の「意図」の欄を目的として取る。
// 掲載ページの記録は data/evaluations/source-pages.json（収集時の記録にないため、保存したページの本文で確かめて追記）。
// 欄の見出しが本文の縦の中央に出て1行目が「意図」より前に離れる票・「結果」の後に続きの行がある票があるため、
// 対象・意図・結果がそれぞれ1行で、結果の次がすぐ「（２）目標達成度」の票だけ取る。シートが1冊に2つ続けて出る票（見出しの欠落）は取らない。
const HEAD = /\nベクトル\n\n(\d+)\n\n([^\n]+)\n/g;
const FIELD = /\n（１）事業対象、目的\n対象\n\n[^\n]+\n\n意図\n\n([^\n]+)\n\n結果\n\n[^\n]+\n\n（２）目標達成度\n/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '06403' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/001/dai1ki_review.pdf')
    || !input.text.startsWith('まち・ひと・しごと創生 総合戦略\n平成 27 年度～令和 2 年度分\n')) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  heads.forEach((m, i) => {
    if (input.truncated && i === heads.length - 1) return;
    const start = m.index! + 1, seg = t.slice(m.index!, heads[i + 1]?.index ?? t.length);
    const f = FIELD.exec(seg);
    if (!f || seg.split('（１）事業対象、目的').length !== 2) return;
    const at = m.index! + f.index + f[0].indexOf('\n意図\n\n') + '\n意図\n\n'.length;
    const p = project(input, `review:${m[1]}`, m[2].trim(), null, m[0].slice(1).trimEnd(), start);
    p.projectCode = null;
    p.purpose = f[1].trim();
    p.evidence.push(evidence(input, f[1], at));
    p.warnings.push('飯豊町 第1期総合戦略 事業別レビューシートの「（１）事業対象、目的」の意図の欄を目的として収録。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '飯豊町 第1期 まち・ひと・しごと創生総合戦略 事業別レビューシート（平成27年度〜令和2年度分）: 「（１）事業対象、目的」の意図の欄（対象・意図・結果が各1行の票だけ）。',
};
