import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as h5 } from '../batch8/h5-e';
import { joinWrapped, refill } from './m23-util';

// ---------------------------------------------------------------- 野辺地町（令和2年度 事務事業外部評価報告書・令和元年度事務事業）
// 公開済みレコードは batch8/h5-e の抽出（外部評価・内部評価・決算額）で、事業シートの「事業概要及び目的」は未収録。
// 事業シート「①事業の概要」では、担当課名の次に「事業概要及び目的」「期待される効果」の本文が続けて出る（見出しは前か間に割り込む）。
//  (1) 見出しと本文が交互に出る票: 「事業概要及び目的\n\n<本文>\n\n期待される効果」の本文。
//  (2) 担当課名の後に2欄の本文が続けて出る票: 見出しの行を除いた本文を、句点で終わる行の後で区切る。
//      区切りがちょうど1か所で、後ろ（期待される効果）が句点で終わるか、すべて①②…の箇条の行である票だけ、前を目的とする。
// 「事業概要及び目的」は目的をあわせた欄のため purpose として収録する。期待される効果は収録しない。
const LABELS = /^(担当課名|事業概要及び目的|事業概要及び目|的|期待される効果)$/;

function fill(p: ProjectEvaluation, input: CachedInput) {
  const t = input.text, head = t.indexOf(`）${p.projectName}\n①事業の概要\n`);
  if (head < 0 || t.indexOf(`）${p.projectName}\n①事業の概要\n`, head + 1) >= 0 || !p.department) return null;
  const from = head + `）${p.projectName}\n①事業の概要\n`.length, to = t.indexOf('\n事務事業の主な内容\n', from);
  if (to < 0 || to - from > 1000) return null;
  const sec = t.slice(from, to);
  const own = /\n事業概要及び目的\n\n([^\n][^]*?)\n\n期待される効果\n/.exec('\n' + sec);
  if (own && !own[1].includes('\n\n') && !own[1].split('\n').includes(p.department) && /。$/.test(own[1].trim())) {
    const at = from + own.index + own[0].indexOf(own[1]) - 1;
    return { purpose: joinWrapped(own[1]), raw: own[1], at };
  }
  // (2) 担当課名の行の後の本文
  const dept = sec.indexOf(`\n${p.department}\n`);
  if (dept < 0) return null;
  let pos = from + dept + p.department.length + 2;
  const lines: { text: string; start: number }[] = [];
  for (const l of t.slice(pos, to).split('\n')) { if (l.trim() && !LABELS.test(l.trim())) lines.push({ text: l, start: pos }); pos += l.length + 1; }
  const cuts = lines.map((l, i) => (i < lines.length - 1 && /。$/.test(l.text.trim()) ? i : -1)).filter(i => i >= 0);
  if (cuts.length !== 1) return null;
  const rest = lines.slice(cuts[0] + 1);
  if (!(/。$/.test(rest[rest.length - 1].text.trim()) || rest.every(l => /^[①-⑳]/.test(l.text.trim())))) return null;
  const used = lines.slice(0, cuts[0] + 1), last = used[used.length - 1];
  const raw = t.slice(used[0].start, last.start + last.text.length);
  if (raw.split('\n').some(l => LABELS.test(l.trim()))) return null;
  return { purpose: joinWrapped(raw), raw, at: used[0].start };
}

export const entry = {
  extract: (input: CachedInput, inputs: CachedInput[]) => input.municipalityCode !== '02401' ? [] : refill(input, inputs, h5['02401'].extract,
    '野辺地町 事務事業外部評価報告書（令和2年度、令和元年度事務事業）の事業シート「事業概要及び目的」欄。「期待される効果」欄との境が見出しの位置か句点の区切り1か所で'
    + '一意に決まる票のみ収録。折り返しの改行は除いた。', fill),
  scope: '野辺地町 事務事業外部評価報告書（令和2年度）: 事業シートの「事業概要及び目的」（期待される効果との境が一意な票のみ）。',
};
