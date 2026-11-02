/** グループ m10 共通: 欄の文の折り返しをつなぐ。 */
const MARK = /^[・･●○■□◆◇▶※＊*①-⑳⑴-⒇【〔［<＜(（]|^[０-９\d]+[.．)）、]/;
/** 全角1・半角0.5で数えた行の幅。 */
export const width = (s: string) => [...s].reduce((w, c) => w + (/[\x20-\x7e｡-ﾟ]/.test(c) ? 0.5 : 1), 0);

/**
 * 欄の幅で折り返した改行だけを除く。前の行が欄の幅いっぱい（欄の中で最も長い行との差が2.5字以内で、かつ min 字以上）で
 * 句点で終わらず、次の行が箇条の記号で始まらないときだけつなぐ。それ以外の改行（段落・箇条の区切り）は残す。
 */
export function joinWrapped(raw: string, min: number): string {
  const lines = raw.split('\n'), full = Math.max(...lines.map(width));
  return lines.reduce((acc, l, i) => {
    if (i === 0) return l;
    const prev = lines[i - 1];
    const wrap = width(prev) >= Math.max(min, full - 2.5) && !/[。.]$/.test(prev) && !MARK.test(l);
    return acc + (wrap ? '' : '\n') + l;
  }, '');
}

/** 康熙部首・CJK部首補助の字形を通常の漢字に直す（NFKCで直らない部首補助は個別に対応）。 */
const EXTRA: Record<string, string> = { '⺠': '民', '⻑': '長', '⻘': '青', '⻄': '西', '⻝': '食', '⻩': '黄', '⻭': '歯' };
export const radicals = (s: string) => s.replace(/[⺀-⿟]/g, c => EXTRA[c] ?? c.normalize('NFKC'));
