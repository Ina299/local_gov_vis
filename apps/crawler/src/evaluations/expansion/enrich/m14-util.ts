/** グループ m14 共通: 欄の文の折り返しをつなぐ。 */
import { width } from './m10-util';

/** 箇条・小見出しの始まり（この記号で始まる行は前の行の続きとみなさない）。「研修部会：」のような見出し付きの行も含む。 */
const MARK = /^([・･●○■□◆◇◎▶※＊*①-⑳⑴-⒇【〔［<＜《(（]|[０-９\d]+[.．)）、]|[^\s、。：]{2,10}：)/;

/**
 * 前の行が欄の幅に近く（最も長い行との差が slack 字以内。半角の数字・英字を含む行は字数が短く数えられるため既定5字）、
 * 句点で終わらず、次の行が箇条の記号で始まらないときだけ改行を除く。句読点だけの行（「。」）は前の行につなぐ。
 * それ以外の改行（段落・箇条の区切り）は残す。
 */
export function unwrap(raw: string, slack = 5): string {
  const lines = raw.split('\n'), full = Math.max(...lines.map(width));
  return lines.reduce((acc, l, i) => {
    if (i === 0) return l;
    const prev = lines[i - 1];
    const wrap = /^[。、）」』]+$/.test(l) || width(prev) >= full - slack && !/[。.]$/.test(prev) && !MARK.test(l);
    return acc + (wrap ? '' : '\n') + l;
  }, '');
}
