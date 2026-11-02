import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 美作市（令和４年度 教育委員会事務の点検及び評価の報告書（令和３年度事業対象）、事業の目的・内容）
// 公開済みレコードは同じ報告書（R3tenkenhyouka.pdf）の事業ごとの表（番号1〜35、評価年度2022・対象年度2021）。
// 表の見出し（事業名・主管課・開始年度・区分）の行は版ごとに順番が違うため、「番号」から区分（継続・新規など）の行までの見出し部分で、
// 見出し語・年度・主管課の値以外のただ1行を事業名とする。「事業の目的」の本文は区分の行の後から始まり、見出し「事業の目的」が
// 本文の途中の行に出力されるため、見出しの行と空行を除いて、句点で終わる最初の行までを目的とする。途中の行はすべて欄の幅いっぱい
// （本文の最長の行から3字以内）で、最後の行は欄の幅より短いこと（同じ欄に次の文が続かない）を確かめる。
// 「事業の内容」も同じ形で、続く行が事業費の表の見出し・数値だけの版に限る（表の見出しの後に本文が続く版は対象外）。
// 見出し部分に本文（句点を含む行）が出力された版は、本文と欄の対応が並び順でしか決まらないため対象外。
const TITLE = /^令和([０-９]+)年度\n\n美作市教育委員会事務の点検及び評価の報告書\n\n（令和([０-９]+)年度事業対象）\n/m;
const STATUS = /\n(継続|新規|拡充|廃止|終了|完了)\n/;
const HEADER = /^(\d+|番号|事業名|主管課|開始年度|区分|事業の目的|事業の内容|(令和|平成) ?(\d+|元) ?年度)$/;
const TABLE = /^(年度|事業費（千円）|(令和|平成) ?(\d+|元) ?年度|[\d,]+)$/;
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

interface Line { text: string; at: number }
/** at から、空行と見出し「label」の行を除いて、句点で終わる最初の行までの本文の行。欄の幅の条件を満たさなければ null。 */
function paragraph(t: string, at: number, label: string): { lines: Line[]; end: number } | null {
  const lines: Line[] = [];
  let pos = at;
  while (pos < t.length) {
    const nl = t.indexOf('\n', pos), end = nl < 0 ? t.length : nl, line = t.slice(pos, end), text = line.trim();
    const lineAt = pos + line.length - line.trimStart().length;
    pos = end + 1;
    if (!text || text === label) continue;
    if (HEADER.test(text) || TABLE.test(text)) return null;
    lines.push({ text, at: lineAt });
    if (text.endsWith('。')) break;
  }
  if (!lines.length || !lines[lines.length - 1].text.endsWith('。')) return null;
  const width = Math.max(...lines.map(l => l.text.length));
  if (lines.slice(0, -1).some(l => l.text.length < width - 3) || (lines.length > 1 && lines[lines.length - 1].text.length >= width - 1)) return null;
  return { lines, end: pos };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '33215' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/R3tenkenhyouka.pdf') || input.truncated) return [];
  const t = input.text, title = TITLE.exec(t);
  if (!title) return [];
  const year = 2018 + Number(ascii(title[1])), fy = 2018 + Number(ascii(title[2]));
  const starts = [...t.matchAll(/\n番号\n/g)].map(m => m.index!), out: ProjectEvaluation[] = [];
  for (let i = 0; i < starts.length; i++) {
    const seg0 = starts[i], seg = t.slice(seg0, starts[i + 1] ?? t.length), st = STATUS.exec(seg);
    if (!st) continue;
    const head = seg.slice(0, st.index).split('\n').map(l => l.trim()).filter(Boolean);
    if (head.some(l => l.includes('。'))) continue;
    const dept = head[head.indexOf('主管課') + 1];
    const names = head.filter(l => !HEADER.test(l) && l !== dept);
    if (head.indexOf('主管課') < 0 || names.length !== 1) continue;
    const pStart = seg0 + st.index + st[0].length;
    const pur = paragraph(t, pStart, '事業の目的');
    if (!pur) continue;
    const act = paragraph(t, pur.end, '事業の内容');
    // 事業の内容の後は事業費の表の見出し・数値だけが続くこと（表の見出しの後に本文の続きが出力される版は採らない）。
    const after = act ? t.slice(act.end).split('\n').map(l => l.trim()).filter(Boolean).slice(0, 3) : [];
    const activities = act && after.length === 3 && after.every(l => TABLE.test(l)) ? act : null;
    const name = names[0];
    const nameAt = seg.indexOf(`\n${name}\n`);
    const p = project(input, `narrative:${name}`, name, year, name, seg0 + nameAt + 1);
    p.projectCode = null; p.evaluatedFiscalYear = fy; p.department = dept;
    p.purpose = pur.lines.map(l => l.text).join('');
    p.activities = activities ? activities.lines.map(l => l.text).join('') : null;
    const raw = (x: { lines: Line[] }) => t.slice(x.lines[0].at, x.lines[x.lines.length - 1].at + x.lines[x.lines.length - 1].text.length);
    p.evidence.push(evidence(input, title[0].slice(0, -1), title.index), evidence(input, raw(pur), pur.lines[0].at));
    if (activities) p.evidence.push(evidence(input, raw(activities), activities.lines[0].at));
    p.warnings.push('美作市 教育委員会事務の点検及び評価の報告書（令和３年度事業対象）の事業ごとの表の「事業の目的」欄を目的、「事業の内容」欄を事業内容として収録。'
      + '欄見出しが本文の途中の行に出力されるため見出しの行と空行を除き、句点で終わる最初の行まで（途中の行が欄の幅いっぱいで、最後の行が欄の幅より短いもの）に限る。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '美作市 令和４年度 教育委員会事務の点検及び評価の報告書（令和３年度事業対象、R3tenkenhyouka.pdf）: 「事業の目的」・「事業の内容」欄。見出し部分に本文が出力された版は対象外。',
};
