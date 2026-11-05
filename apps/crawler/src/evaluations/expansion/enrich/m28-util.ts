/**
 * グループ m28 共通: 欄の幅で折り返した改行だけを除く。全角2・半角1で数えた行の幅が欄の中で最も広い行（min 以上）との差 6 以内で、
 * 句点で終わらず、次の行が箇条の記号で始まらないときだけ次の行とつなぐ（半角の数字・英字が混ざる行も幅で判定する）。
 */
const width = (s: string) => [...s].reduce((w, c) => w + (/[\u0000-ÿ｡-ﾟ]/.test(c) ? 1 : 2), 0);

export function unwrap(s: string, min = 40): string {
  const lines = s.split('\n'), max = Math.max(min, ...lines.map(width));
  return lines.reduce((acc, l, i) => {
    if (i === 0) return l;
    const prev = lines[i - 1];
    const wrap = width(prev) >= max - 6 && !/[。.]$/.test(prev) && !/^[・･●○〇◎■□◆◇※＊*①-⑳⑴-⒇【〔［<＜(（⇒]|^[０-９\d]+[.．)）、]/.test(l);
    return acc + (wrap ? '' : '\n') + l;
  }, '');
}
