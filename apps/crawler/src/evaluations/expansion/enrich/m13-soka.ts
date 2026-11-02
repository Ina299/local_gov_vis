import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 草加市（令和４年度ダイジェストシート、事業目的・事業内容）
// 公開済みレコードは同じダイジェストシート（R4digest.pdf）の事務事業（事業名・所管課、評価年度・対象年度とも2022）。
// 「① 事業目的・内容」の「事業目的」欄（施策の意図）と「事業内容」欄を取る。事業目的は見出しの同じ行か、空行を挟んだ次の1行に
// 本文があり、その後に「（施策の意図）」が続く版だけを採る（見出しの後が空で本文の位置が並び順でしか決まらない版は採らない）。
// 事業内容は「（施策の意図）」から「② 事業費の推移」までの行。見出し「事業内容」が本文の行頭や前後の行に出力されるため、
// 見出しを1つだけ除き、空行も折り返しの途中に入ることがあるため除いてから、欄の幅での折り返しをつなぐ。
const SHEET_HEAD = /^令和４年度ダイジェストシート\n/gm;
const NAME = /\n施策名\n施策の柱\n事務事業名\n\n([^\n]+)\n\n所管課\n施策番号\n\d+\n\n[^\n]+\n[^\n]+\n([^\n]+)\n\n施策の柱番号\n/;
const PURPOSE = /\n① 事業目的・内容\n(?:事業目的 ([^\n]+)\n|事業目的\n\n([^\n]+)\n\n)(?:\n)?（施策の意図）\n/;
/** 欄の幅いっぱいの行の後の改行だけを除く。句点で終わる行の後と、番号・記号で始まる行（箇条）の前の改行は残す。 */
function join(lines: string[]): string {
  const width = Math.max(...lines.map(l => l.length));
  return lines.reduce((acc, l, i) => acc + (i === 0 ? '' : lines[i - 1].length >= width - 3 && !lines[i - 1].endsWith('。')
    && !/^([０-９\d]+[ .．、）)]|[・①-⑳※])/.test(l) ? '' : '\n') + l, '');
}
const COSTS = '\n② 事業費の推移（過去5年間の予算額・執行額）\n';

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11221' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/R4digest.pdf')) return [];
  const t = input.text, starts = [...t.matchAll(SHEET_HEAD)].map(m => m.index!), out: ProjectEvaluation[] = [];
  for (let i = 0; i < starts.length; i++) {
    if (input.truncated && i === starts.length - 1) continue;
    const start = starts[i], seg = t.slice(start, starts[i + 1] ?? t.length);
    const n = NAME.exec(seg), m = PURPOSE.exec(seg);
    if (!n || !m || /事業内容|施策/.test(m[1] ?? m[2])) continue;
    const purpose = (m[1] ?? m[2]).trim();
    const from = m.index + m[0].length, to = seg.indexOf(COSTS, from);
    if (to < 0 || seg.indexOf(COSTS, to + 1) >= 0) continue;
    const raw = seg.slice(from, to).replace(/^\n+/, '');
    // 見出し「事業内容」は1つだけ（単独の行か、本文の行頭）。
    const labels = [...raw.matchAll(/^事業内容(?: |$)/gm)];
    if (labels.length !== 1 || raw.split('事業内容').length !== 2) continue;
    const lines = raw.replace(/^事業内容 ?/m, '').split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length || lines.some(l => /^[\d,.\s-]+$|^（単位|^平成|^令和/.test(l))) continue;
    const p = project(input, `narrative:${n[2]}`, n[2].trim(), 2022, n[0].slice(1, -1), start + n.index + 1);
    p.projectCode = null; p.evaluatedFiscalYear = 2022; p.department = n[1].trim();
    p.purpose = purpose;
    p.activities = join(lines);
    p.evidence.push(evidence(input, m[0].slice(1, -1), start + m.index + 1), evidence(input, raw.replace(/\n+$/, ''), start + from + (seg.slice(from, to).length - raw.length)));
    p.warnings.push('草加市 令和４年度ダイジェストシート「① 事業目的・内容」の「事業目的」（施策の意図）欄を目的、「事業内容」欄を事業内容として収録。'
      + '事業目的の本文が見出しの行か直後の1行にある版のみ。事業内容は見出し・空行を除き、欄の幅での折り返しの改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '草加市 令和４年度ダイジェストシート（R4digest.pdf）: 「事業目的」（施策の意図）・「事業内容」欄。事業目的の本文の位置が並び順でしか決まらない版は対象外。',
};
