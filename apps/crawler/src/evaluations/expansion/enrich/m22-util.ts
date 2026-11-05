/**
 * グループ m22 共通: 欄の見出しが欄の縦の中央に置かれる様式（見出しが欄の途中の行頭に入るか単独の行になる）で、
 * 欄の内容を取り出す。lines[0] が欄の内容の先頭行、lines[label] が見出しの行（見出しの後に内容が続くこともある）。
 * 欄の終わりは、句点で終わる行のうち見出しの前後の行数の差が1以内のもの。stop に一致する行（次の欄の始まり）より前に限る。
 * 前後の行数がちょうど揃う候補が1つならそれを、なければ候補が1つならそれを、複数あっても最後の候補の次の行が stop なら
 * 最後の候補を採る。それ以外は null。
 */
export function centeredEnd(lines: string[], label: number, inline: string, stop: RegExp): number | null {
  const ends: number[] = [];
  if (inline && /。$/.test(inline) && label <= 1) ends.push(label);
  let k = label + 1;
  for (; k < lines.length && lines[k].trim() && !stop.test(lines[k]); k++)
    if (/。$/.test(lines[k]) && Math.abs(label - (k - label)) <= 1) ends.push(k);
  const exact = ends.filter(e => e - label === label);
  if (exact.length === 1) return exact[0];
  if (!ends.length) return null;
  const last = ends[ends.length - 1];
  if (ends.length === 1 || (last + 1 === k && k < lines.length && stop.test(lines[k]))) return last;
  return null;
}

/** 欄の行（見出しの語を除いた内容）を、句点で終わる行の後だけ改行を残してつなぐ。 */
export const joinWrapped = (parts: string[]) => parts.reduce((acc, l, j) => acc + (j > 0 && /。$/.test(parts[j - 1]) ? '\n' : '') + l, '');
