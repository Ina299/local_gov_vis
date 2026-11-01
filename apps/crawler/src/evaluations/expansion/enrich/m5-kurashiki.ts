import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, project } from '../shared';

// ---------------------------------------------------------------- 倉敷市（令和7・8年度 行政評価結果報告書）
// 公開済みレコードは「施策を推進する主な事業の評価」表の事業行で、目的が空欄。各行は「(Ⅰ) 目的」「(Ⅱ) 主な実績」「(Ⅲ) 今後の方向性」の
// 3段で、事業名の列は(Ⅱ)の段の行の左に分かれて並ぶ。目的は、前の行の(Ⅲ)（または表の見出し）の直後に始まる場合だけ採る:
// 「(Ⅰ) 目的」の1行か、ラベル「(Ⅰ)」を挟んだ2行（句点で終わるもの）。事業名は(Ⅱ)の段の各行の左端（最初の空白まで）をつないだもので、
// 公開済みレコードの事業名と一致したものだけが補強に使われる（名前の途中に挟まった印★は除く。先頭の★は公開済みの名前にも付いている）。(Ⅱ)の実績は行末に決算額の列が付き、本文の数字と見分けられないため採らない。
const HEADER = '(千円）';

function extract(input: CachedInput): ProjectEvaluation[] {
  const doc = /\/(r[78])kekka(?:gyousei|gousei)\.pdf$/.exec(input.sourceUrl);
  if (input.municipalityCode !== '33202' || !doc) return [];
  const r8 = doc[1] === 'r8';
  const lines = input.text.split('\n'), offsets: number[] = [];
  lines.reduce((at, l) => (offsets.push(at), at + l.length + 1), 0);
  // 行の終わり: 1行の「(Ⅲ) …」、ラベル「(Ⅲ)」の次の句点で終わる行、または表の見出し。
  const rowEnd = (k: number) => k >= 0 && (/^\(Ⅲ\) ./.test(lines[k]) || (lines[k - 1] === '(Ⅲ)' && lines[k].endsWith('。')) || lines[k] === HEADER);
  const out: ProjectEvaluation[] = [];
  for (let i = 0; i < lines.length; i++) {
    let purpose: string | null = null, from = i, next = i + 1;
    const one = /^\(Ⅰ\) (.+)$/.exec(lines[i]);
    if (one && rowEnd(i - 1)) purpose = one[1];
    else if (lines[i] === '(Ⅰ)' && rowEnd(i - 2) && i + 1 < lines.length && !/[。)）]$/.test(lines[i - 1]) && !lines[i - 1].startsWith('(')
      && lines[i + 1].endsWith('。') && !lines[i + 1].startsWith('(')) {
      purpose = lines[i - 1] + lines[i + 1]; from = i - 1; next = i + 2;
    }
    if (!purpose) continue;
    // (Ⅱ)の段: 次の「(Ⅲ)」で始まる行の前まで。途中に次の(Ⅰ)があれば崩れているので採らない。
    let end = next;
    while (end < lines.length && !lines[end].startsWith('(Ⅲ)') && !lines[end].startsWith('(Ⅰ)') && end - next < 30) end++;
    if (end >= lines.length || !lines[end].startsWith('(Ⅲ)')) continue;
    // 事業名の列は全角10字ほどの幅: 空白の前の左端か、句点で終わらない10字以下の単独の行（実績の文は全幅で折り返す）。
    const name = lines.slice(next, end).map(l => l.includes('(Ⅱ)') ? l.slice(0, l.indexOf('(Ⅱ)')).trim()
      : /^(\S+) /.exec(l)?.[1] ?? ([...l].length <= 10 && !l.endsWith('。') ? l : ''))
      .filter(f => f && f !== '★').join('').replace(/(?<=.)★ ?/g, '');
    if (!name) continue;
    const raw = lines.slice(from, end).join('\n');
    const p = project(input, `${name}:${offsets[from]}:narrative`, name, r8 ? 2026 : 2025, raw, offsets[from]);
    p.projectCode = null;
    p.evaluatedFiscalYear = r8 ? null : 2024;
    p.purpose = purpose;
    p.warnings.push('行政評価結果報告書「施策を推進する主な事業の評価」の目的(Ⅰ)。事業名はこの行の(Ⅱ)の段の左端の文字をつないだもの。');
    out.push(p);
    i = end;
  }
  if (input.truncated) out.pop();
  return out;
}

export const entry = {
  extract,
  scope: '倉敷市 令和7・8年度 行政評価結果報告書: 施策を推進する主な事業の評価の目的(Ⅰ)（目的）。',
};
