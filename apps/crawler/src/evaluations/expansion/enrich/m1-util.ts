/**
 * 欄の幅で折り返した改行だけを除く。欄の中で最も長い行の長さを欄の幅とみなし、幅いっぱい（3字差まで）の行の後の改行を除く。
 * 幅に満たない行（段落・箇条の終わり）の後と、箇条の記号で始まる行の前の改行は残す。
 */
export function unwrap(s: string): string {
  const lines = s.split('\n'), width = Math.max(...lines.map(l => l.length));
  return lines.reduce((acc, l, i) =>
    acc + (i === 0 ? '' : lines[i - 1].length >= width - 3 && !/^[・※＊*①-⑳○●◎■□◆◇＜<]/.test(l) ? '' : '\n') + l, '');
}
