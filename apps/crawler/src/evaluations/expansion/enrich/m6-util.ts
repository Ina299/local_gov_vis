/** 全角1字・半角0.5字で数えた行の幅。 */
export const width = (s: string) => [...s].reduce((w, c) => w + (/[\x20-\x7e｡-ﾟ]/.test(c) ? 0.5 : 1), 0);
/** 箇条・見出しの始まり（この記号で始まる行の前の改行は残す）。 */
const MARK = /^([・※＊*①-⑳○〇●◎■□◆◇＜<（(《【〔▶]|[0-9０-９]+[.．、)）]|[ア-ン][.．、)）])/;
/**
 * グループ m6 共通: 欄の幅（最も長い行。min 字に満たなければ min）いっぱい（slack 字差まで）で、句点・コロンで終わらない行の
 * 後の改行だけを除く。幅に満たない行の後と、箇条・見出しの記号で始まる行の前の改行は残す。
 */
export function unwrap(s: string, min = 0, slack = 3): string {
  const lines = s.split('\n'), full = Math.max(min, ...lines.map(width));
  return lines.reduce((acc, l, i) => {
    const prev = lines[i - 1];
    return acc + (i === 0 ? '' : width(prev) >= full - slack && !/[。：:]$/.test(prev) && !MARK.test(l) ? '' : '\n') + l;
  }, '');
}
