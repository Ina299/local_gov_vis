/**
 * グループ m17 共通: 欄の幅で折り返した改行だけを除く。欄の中で最も長い行（min 字以上）との差が3字以内の行で、
 * 句点で終わらず、次の行が箇条の記号で始まらないときだけ次の行とつなぐ。それ以外の改行（段落・箇条の区切り）は残す。
 */
export function unwrap(s: string, min = 20): string {
  const lines = s.split('\n'), width = Math.max(min, ...lines.map(l => l.length));
  return lines.reduce((acc, l, i) => {
    if (i === 0) return l;
    const prev = lines[i - 1];
    const wrap = prev.length >= width - 3 && !/[。.]$/.test(prev) && !/^[・･●○〇◎■□◆◇※＊*①-⑳⑴-⒇【〔［<＜(（]|^[０-９\d]+[.．)）、]/.test(l);
    return acc + (wrap ? '' : '\n') + l;
  }, '');
}
