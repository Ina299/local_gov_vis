import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { extractTsuruoka } from '../tsuruoka';
import { refill, startOf } from './m23-util';

// ---------------------------------------------------------------- 鶴岡市（行政評価調書 評価対象年度R4・行財政改革の取組）
// 公開済みレコードは ../tsuruoka の抽出で、「取組概要 <本文>」と見出しと本文が同じ行に出た票だけ取組概要が事業内容に入っている（2026-11-05 の訂正までは目的に入っていた）。
// 残りの票は見出し「取組概要」が本文の縦の中央に割り込む（「目 目 目」の行の次から「取組成果」の行の前まで）。
// その範囲で見出しを含む行がちょうど1行で、欄の終わりが下の条件で1つに決まるとき、見出しを除いて行をつなぐ（各行は欄幅いっぱいで折り返している）。
// 「取組概要」は目的と手段をあわせた取組の概要のため、目的ではなく事業内容（activities）として収録する。
// 「取組成果」は見込みの効果（〜を見込む）のため使わない。
function fill(p: ProjectEvaluation, input: CachedInput) {
  const t = input.text, s = startOf(p);
  if (s === null) return null;
  const head = t.indexOf('\n目 目 目\n', s), next = t.indexOf('行 政 評 価 調 書', s + 1);
  const outcome = t.indexOf('\n取組成果', head + 1);
  if (head < 0 || outcome < 0 || (next >= 0 && outcome > next) || t.slice(s, head).includes('\n取組概要')) return null;
  const from = head + '\n目 目 目\n'.length, lines = t.slice(from, outcome).split('\n');
  const at = lines.map((l, i) => (/^取組概要(?: |$)/.test(l) ? i : -1)).filter(i => i >= 0);
  if (at.length !== 1 || lines.some(l => !l.trim()) || lines.join('\n').split('取組概要').length !== 2) return null;
  // 見出し「取組成果」も本文の中央に割り込むため、「取組成果」の行の前には成果の前半が残ることがある。
  // 見出しの行が本文を持たないとき、概要は見出しの前 a 行と後 b 行（b は a−1〜a+1、1以上）で、最後の行が句点で終わり、
  // 残り r 行が成果の前半として成果の後半 q 行（「年度 R…」の行まで）と釣り合う（|r−q|≦1、取組成果が本文と同じ行なら r=0）位置が1つに決まる場合のみ採る。
  const a = at[0], alone = lines[a].trim() === '取組概要';
  const outLine = t.slice(outcome + 1, t.indexOf('\n', outcome + 1)), budget = t.indexOf('\n年度 R', outcome);
  if (budget < 0) return null;
  const q = outLine.trim() === '取組成果' ? t.slice(outcome + 1 + outLine.length + 1, budget).split('\n').length : 0;
  const ks = [a - 1, a, a + 1].filter(b => b >= (alone ? 1 : 0)).filter(b => {
    const last = a + b, r = lines.length - 1 - last;
    if (last >= lines.length || !/。$/.test(lines[last].trim())) return false;
    return q ? r >= 1 && Math.abs(r - q) <= 1 : r === 0;
  });
  if (ks.length !== 1) return null;
  const used = lines.slice(0, a + ks[0] + 1);
  const value = used.map(l => l.replace(/^取組概要 ?/, '').trim()).filter(Boolean).join('');
  return { purpose: null, activities: value, raw: used.join('\n'), at: from };
}

export const entry = {
  extract: (input: CachedInput, inputs: CachedInput[]) => input.municipalityCode !== '06203' ? [] : refill(input, inputs, (i) => extractTsuruoka(i),
    '鶴岡市 行政評価調書（評価対象年度R4）の「取組概要」欄。見出しが本文の中央に割り込む票で、見出しの行を除いて折り返しをつないだもの。'
    + '取組概要は目的と手段をあわせた概要のため事業内容として収録（目的欄は設けない）。', fill),
  scope: '鶴岡市 行政評価調書（評価対象年度R4）: 見出しが本文に割り込んだ票の「取組概要」（事業内容として）。',
};
