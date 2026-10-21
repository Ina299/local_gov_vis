import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, ascii, eraYear, joinLines, municipality, rating } from './h4-util';

/** Tawaramoto 教育委員会活動点検評価報告書 R4–R6 (R7 is an image PDF). */
const IDS = ['f758cb1b2ba1533d4f205a99', '5565fdf67e9240940b21cb4e', '8e5ee4a0176e870408091d62'];
const CELL = String.raw`[A-C]:[^\n]+(?:\n(?![A-C]:)[^\n]+)*`;
const ROW = new RegExp(String.raw`\n([^\n]+事業(?:（[^）\n]+）)?)\n\n([^\n]+課)\n\n([\d,]+)\n\n(${CELL})\n\n(${CELL})\n\n(${CELL})(?=\n)`, 'g');
const LABELS = ['必要性の点検', '目標達成状況の点検', '実施内容方法の点検'];

/** 施策評価シートの「施策を構成する主な事務事業の評価結果」の行（事業名・担当課・決算額・3つの点検）。 */
function rows(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  const title = t.match(/^(令和)(\S)年度\n田原本町教育委員会活動点検評価報告書\n（(令和)(\S)年度実施事業分）\n/);
  if (!title) return [];
  const year = eraYear(title[1], ascii(title[2])), fy = eraYear(title[3], ascii(title[4]));
  const out: ProjectEvaluation[] = [];
  for (const head of t.matchAll(/施策を構成する主な事務事業の評価結果(?:（|\n[\s\S]{0,80}?（)評価対象年度R ?(\d) ?年度）\n/g)) {
    if (eraYear('令和', head[1]) !== fy) continue;
    const from = head.index!, stop = t.indexOf('\n計\n', from), to = stop < 0 ? from : stop;
    const seg = t.slice(from, to);
    if (!['必要性の点検', '目標達成状況', '実施内容方法の'].every(l => seg.includes(l))) continue;
    for (const m of seg.matchAll(ROW)) {
      // Two columns pdftotext interleaved into one cell cannot be split reliably.
      if ([m[4], m[5], m[6]].some(c => (c.match(/[A-C]:/g) ?? []).length !== 1)) continue;
      const at = from + m.index! + 1, raw = m[0].slice(1);
      const p = project(input, m[1], m[1], year, raw, at);
      p.projectCode = null; p.department = m[2]; p.evaluatedFiscalYear = fy;
      p.evidence.push(evidence(input, head[0].trim(), from));
      p.amounts.push(amount(input, 'actual', fy, m[3], '千円', m[3], at + raw.indexOf(`\n\n${m[3]}\n\n`) + 2));
      let cursor = m[1].length + m[2].length + m[3].length;
      [m[4], m[5], m[6]].forEach((cell, i) => {
        cursor = raw.indexOf(`\n\n${cell}`, cursor) + 2;
        p.ratings.push(rating(input, 'self', LABELS[i], joinLines(cell), null, cell, at + cursor));
      });
      p.warnings.push('施策評価シート内「施策を構成する主な事務事業の評価結果」の行のみ収録（決算額は表見出しの評価対象年度の事業費・千円）。評価は原文の選択肢ラベルのまま（改行を連結）。施策単位の評価・指標・次年度予算表は対象外。');
      out.push(p);
    }
  }
  return out;
}

export const tawaramoto = municipality('29363', IDS, rows);
