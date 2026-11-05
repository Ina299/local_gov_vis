import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 串本町（第１次実施計画 平成29〜31年度 成果目標達成状況）
// 公開済みレコードは同じ資料の事業別シートから作られ、年度欄がないため評価年度は未設定。シートに目的の欄はなく、
// 「●事業の内容」の枠に「成果目標」「達成状況」の2行がある。抽出テキストでは各行の文がラベルの前に出る（ラベルが行の
// 縦の中央にあるため）。文の塊が2つだけで、並びが次のいずれかに当てはまるシートに限り、前を成果目標、後を達成状況とする。
//   ●事業の内容\n<成果目標>\n\n成果目標\n\n<達成状況>\n\n達成状況\n\n達成度\n
//   ●事業の内容\n\n成果目標\n\n<成果目標>\n\n<達成状況>\n\n達成状況\n\n達成度\n
//   ●事業の内容\n<成果目標>\n\n成果目標\n\n達成状況\n\n達成度\n\n<達成状況>\n\n<達成度>%\n
// 達成状況だけを成果に入れる。成果目標は目標であって事業内容ではないため入れない（達成状況の位置を確かめるためにだけ使う）。目的も入れない。
const URL = /\/sougou-keikaku\/files\/H29-31_jissi_plan_tasseizyokyou\.pdf$/;
const SHAPES = [
  /●事業の内容\n((?:[^\n]+\n)*?[^\n]+)\n\n成果目標\n\n((?:[^\n]+\n)*?[^\n]+)\n\n達成状況\n\n達成度\n/,
  /●事業の内容\n\n成果目標\n\n((?:[^\n]+\n)*?[^\n]+)\n\n((?:[^\n]+\n)*?[^\n]+)\n\n達成状況\n\n達成度\n/,
  /●事業の内容\n((?:[^\n]+\n)*?[^\n]+)\n\n成果目標\n\n達成状況\n\n達成度\n\n((?:[^\n]+\n)*?[^\n]+)\n\n\d+%\n/,
];
/** 欄の文でないもの（ラベル・達成度の値・凡例）。 */
const LABEL = /^(成果目標|達成状況|達成度|\d+%|0％・+.*|●.*)$/m;
/** 欄の幅で折り返した改行だけを除く。短い行だけの欄（箇条・年度別の件数）はそのまま。 */
const join = (s: string) => Math.max(...s.split('\n').map(l => l.length)) >= 30 ? unwrap(s) : s;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '30428' || !URL.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(/事 業 名(?: |\n\n)([^\n]+)\n/g)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const h = heads[i], start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const end = seg.indexOf('●事業費');
    if (end < 0) continue;
    const body = seg.slice(0, end);
    const found = SHAPES.map(re => re.exec(body)).filter(m => m !== null);
    if (found.length !== 1) continue;
    const m = found[0], [target, status] = [m[1], m[2]];
    if (LABEL.test(target) || LABEL.test(status)) continue;
    const p = project(input, `${h[1]}:narrative`, h[1].trim(), null, h[0].trimEnd(), start);
    p.projectCode = null;
    p.outcomes = join(status);
    p.evidence.push(evidence(input, m[0].trimEnd(), start + m.index));
    p.warnings.push('第１次実施計画（平成29〜31年度）成果目標達成状況の事業別シート。目的の欄はなく、「●事業の内容」の枠の'
      + '「達成状況」の文（平成31年度の終了見込み）を成果とした。文がラベルの前後に分かれて出力されるため、文の塊が2つだけで並びが定型のシートに限る。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '串本町 第１次実施計画（平成29〜31年度）成果目標達成状況の事業別シート: 「事業の内容」の達成状況（成果）。年度の記載がない公開済みレコードと同じ資料。',
};
