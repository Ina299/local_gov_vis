/**
 * 09216 下野市: 令和6年度 事務事業評価シート（部局別PDF）。公開済みレコード（同じシート）の空欄の
 * 目的（「事業目的」欄）と事業内容（「事業概要」欄）を補う。
 * 「２．事業内容」から最初の「令和4年度」（事業計画の表）までの間に、見出し「事業目的」「事業概要」と2つの欄の文が
 * 上から順に出る（見出しの位置はシートごとに前後する）。見出しと空行で区切ると文の塊がちょうど2つになるシートだけを
 * 対象とし、上の塊を目的、下の塊を事業概要とする。塊が3つ以上になる（欄の中に空行がある、事業計画の表が混ざる）シートは採らない。
 * 令和7年度の評価一覧（PDF）は目的・概要の列が行ごとに交互に出力されるため対象外。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';
import { unwrap } from './m1-util';

const SHEETS = new Set(['19b34067c0fcdc0c814c2025', '4a2815c9c32f0d11c3c7a1e3', '971ef799e543cbe6b66bdee8', 'ae9d257b85f94e9802c77b7d', 'e749bc6ca7f43f933c691c7a']);
const HEAD = /令和6年度\n\n事務事業評価シート\n/g;
const OTHER = /事業計画|基準年度|の概要）|事業費|単位：|^令和\d+年度$/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '09216' || !SHEETS.has(input.sourceId)) return [];
  const text = input.text, out: ProjectEvaluation[] = [];
  const starts = [...text.matchAll(HEAD)].map(m => m.index!);
  starts.forEach((s, i) => {
    const t = text.slice(s, starts[i + 1] ?? text.length);
    // 事業名・所管は公開済みレコードと同じ取り方（batch12 m4-nagomi の下野市）。
    const a = /\n目\n\n([^\n]+)\n\d+\n\d+\n\d+\n/.exec(t), b = /\n事業名称\n\n([^\n]+)\n\n２．事業内容/.exec(t);
    const nameM = a && b ? (a[1] === b[1] ? a : null) : (a ?? b);
    if (!nameM || !nameM[1].trim() || /^[\d,]+$/.test(nameM[1].trim())) return;
    const head = '\n２．事業内容\n', from = t.indexOf(head), to = t.indexOf('\n令和4年度\n', from);
    if (from < 0 || to < 0) return;
    const regAt = from + head.length, reg = t.slice(regAt, to + 1);
    if ((reg.match(/^事業目的$/gm) ?? []).length !== 1 || (reg.match(/^事業概要$/gm) ?? []).length !== 1) return;
    // 見出し行と空行で区切った文の塊（行の並びと位置）。
    const blocks: { lines: string[]; at: number }[] = [];
    let cur: { lines: string[]; at: number } | null = null, pos = 0;
    for (const line of reg.split('\n')) {
      if (!line.trim() || line === '事業目的' || line === '事業概要') cur = null;
      else { if (!cur) blocks.push(cur = { lines: [], at: s + regAt + pos }); cur.lines.push(line); }
      pos += line.length + 1;
    }
    if (blocks.length !== 2 || blocks.some(bl => bl.lines.some(l => OTHER.test(l.trim())))) return;
    const [purpose, activities] = blocks;
    const name = nameM[1].trim();
    const p = project(input, `narrative-${s}`, name, 2024, nameM[1], s + nameM.index! + nameM[0].indexOf(nameM[1]));
    p.id = stableId(input, `narrative-${s}`, 2024);
    p.projectCode = null;
    p.evidence.unshift(evidence(input, '令和6年度\n\n事務事業評価シート', s));
    const dept = /\n([^\n]+)\n部名\n(?:ｸﾞﾙｰﾌﾟ名[^\n]*\n)?([^\n]+)\n課名\n/.exec(t);
    if (dept && !/ｸﾞﾙｰﾌﾟ名|担当者名|会計名/.test(dept[1] + dept[2]) && dept[1].length <= 15 && dept[2].length <= 15) {
      p.department = dept[1] === dept[2] ? dept[1] : `${dept[1]} ${dept[2]}`;
    }
    const put = (bl: { lines: string[]; at: number }) => { const raw = bl.lines.join('\n'); p.evidence.push(evidence(input, raw, bl.at)); return unwrap(raw); };
    p.purpose = put(purpose);
    p.activities = put(activities);
    p.warnings.push('下野市 令和6年度事務事業評価シートの「２．事業内容」から、目的（「事業目的」欄）と事業内容（「事業概要」欄）を原文のまま収録。'
      + '見出しと空行で区切った文の塊がちょうど2つのシートだけを対象とし（上が目的、下が事業概要）、欄の幅で折り返した改行だけを除いた。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '下野市 令和6年度 事務事業評価シート（部局別PDF）の事業目的・事業概要（文の塊が2つに定まるシートのみ）。令和7年度の評価一覧は列が交互に出力されるため対象外。',
};
