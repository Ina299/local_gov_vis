/**
 * 香川県 令和8年度行政評価結果（施策評価調書）の「４ 施策を構成する主な事業」。
 * 各事業は「事業名」欄から始まり、「R7 年度決算額 N 千円」と成果・課題の評価記号（◎○△×）が印字される。担当部局は事業ごとには印字されない。
 * 「事業概要」欄の本文を activities、「成果・課題」欄の本文を outcomes として、欄の範囲が確定する場合だけ収録する（事業実績・県民の声の欄は境界が確定しないため対象外）。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { amount, mergeReprints, nfkc, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const LABELS = new Set(['事業概要', '開始年度', '事業実績', '県民・事業者', 'からの声', '成果・課題']);
const MARKS: Record<string, string> = { '◎': '成果があった', '○': '概ね成果があった', '△': '少し工夫が必要', '×': '見直しが必要' };
const SCALE = '◎成果があった／○概ね成果があった／△少し工夫が必要／×見直しが必要';
const balanced = (s: string) => (s.match(/[（(]/g)?.length ?? 0) === (s.match(/[）)]/g)?.length ?? 0);
const nameLike = (s: string) => s.length <= 80 && !/[。、]$/.test(s) && !/^[◎○△×・]/.test(s) && !/^R\d+ 年度/.test(s);

type Line = { text: string; start: number };

function linesOf(text: string, base: number): Line[] {
  const out: Line[] = []; let pos = 0;
  for (const l of text.split('\n')) { out.push({ text: l, start: base + pos }); pos += l.length + 1; }
  return out;
}

/** The business name: the first non-label line after 事業名 (joined with the next line when its parenthesis is open). */
function findName(lines: Line[], amountLine: number): Line[] | null {
  const first = lines.slice(1, amountLine).find(l => l.text.trim() && !LABELS.has(l.text.trim()));
  if (first && nameLike(first.text.trim())) {
    const i = lines.indexOf(first);
    if (balanced(first.text)) return [first];
    const next = lines[i + 1];
    if (next && next.text.trim() && balanced(first.text + next.text) && /）$/.test(next.text.trim())) return [first, next];
    return null;
  }
  // 前の事業の成果・課題が「事業名」欄の直後に出力される配置: 決算額行より前で、空行の直後にある「…事業」の行のうち最後のもの。
  const cand = lines.slice(1, amountLine).filter((l, k) => /事業$/.test(l.text.trim()) && nameLike(l.text.trim()) && lines[k]?.text.trim() === '');
  return cand.length ? [cand[cand.length - 1]] : null;
}

type Span = { text: string; raw: string; at: number };
const OTHER_LABEL = /^(?:事業名|事業概要|開始年度|事業実績|県民・事業者|からの声|成果・課題)(?: |$)|年度決算額|^- \d+ -$|^５ 総合評価/;
/**
 * 欄の行から欄名（行頭の「事業概要」「成果・課題 ○」等）を除き、折り返しの改行を詰める。
 * 欄の幅いっぱいの行（欄名を除いた表示幅が、欄名のない行の最大幅の90%以上。半角は0.5字）の後の改行は折り返しとして詰め、
 * それより短い行の後の改行は残す。
 */
const displayWidth = (s: string) => [...s].reduce((n, c) => n + (c.charCodeAt(0) < 0x100 ? 0.5 : 1), 0);
function cellText(lines: string[], label: RegExp): string {
  const rows = lines.map(l => ({ text: l.trim().replace(label, ''), labeled: label.test(l.trim()) })).filter(r => r.text);
  const plain = rows.filter(r => !r.labeled);
  const width = Math.max(...(plain.length ? plain : rows).map(r => displayWidth(r.text)));
  return rows.reduce((a, r, i) => i === 0 ? r.text : a + (displayWidth(rows[i - 1].text) >= width * 0.9 ? '' : '\n') + r.text, '');
}

/**
 * 「事業概要」欄: 事業名の行の次から「開始年度」の行の直前まで。欄名「事業概要」は欄の縦中央に印字され、行全体または行頭（後ろに空白）に出る。
 * 欄名がちょうど1つで、他の欄名が混ざらない場合のみ。
 */
function overview(lines: Line[], nameEnd: number, amountIdx: number): Span | null {
  const startIdx = lines.findIndex((l, i) => i > nameEnd && /^開始年度(?: |$)/.test(l.text.trim()));
  if (startIdx < 0 || startIdx >= amountIdx) return null;
  const cell = lines.slice(nameEnd + 1, startIdx);
  const labelAt = cell.filter(l => /^事業概要(?: |$)/.test(l.text.trim()));
  if (labelAt.length !== 1 || cell.some(l => !/^事業概要(?: |$)/.test(l.text.trim()) && OTHER_LABEL.test(l.text.trim()))) return null;
  const first = cell.findIndex(l => l.text.trim());
  const last = cell.length - 1 - [...cell].reverse().findIndex(l => l.text.trim());
  if (first < 0) return null;
  const body = cell.slice(first, last + 1);
  const text = cellText(body.map(l => l.text), /^事業概要(?: |$)/);
  if (!text) return null;
  const raw = body.map(l => l.text).join('\n');
  return { text, raw, at: body[0].start };
}

/**
 * 「成果・課題」欄: 県民・事業者からの声の欄の最後（「からの声」の欄名以降で、最初に「（発言者）」で終わる行）の次の行から、
 * 空行・次の欄名・ページ番号の直前まで。欄名「成果・課題 ◎」は欄の縦中央に印字されるため、欄名の行の前後の行数がそろう（差1以内）
 * 場合だけ欄の範囲が正しいとみなす。欄名と記号が独立した段落（「成果・課題\n\n○\n\n」）の配置は、その直後の段落。
 */
function results(lines: Line[], amountIdx: number): Span | null {
  const labelIdx = lines.findIndex((l, i) => i > amountIdx && /^成果・課題(?: |$)/.test(l.text.trim()));
  if (labelIdx < 0 || lines.some((l, i) => i > labelIdx && /^成果・課題(?: |$)/.test(l.text.trim()))) return null;
  const isStop = (l: Line) => !l.text.trim() || (OTHER_LABEL.test(l.text.trim()) && !/^成果・課題(?: |$)/.test(l.text.trim()));
  const pick = (from: number, to: number) => {
    const body = lines.slice(from, to);
    const text = cellText(body.map(l => l.text), /^成果・課題(?: [◎○△×])?(?: |$)/);
    if (!body.length || !/。$/.test(text)) return null;
    return { text, raw: body.map(l => l.text).join('\n'), at: body[0].start };
  };
  // 欄名と記号が独立した段落の配置
  if (lines[labelIdx].text.trim() === '成果・課題' && !lines[labelIdx + 1]?.text.trim() && /^[◎○△×]$/.test(lines[labelIdx + 2]?.text.trim() ?? '') && !lines[labelIdx + 3]?.text.trim()) {
    let end = labelIdx + 4;
    while (end < lines.length && !isStop(lines[end])) end++;
    return end > labelIdx + 4 ? pick(labelIdx + 4, end) : null;
  }
  if (!/^成果・課題 [◎○△×](?: |$)/.test(lines[labelIdx].text.trim())) return null;
  // 声の欄の終わり
  const voiceIdx = lines.findIndex((l, i) => i > amountIdx && i < labelIdx && /^からの声(?: |$)/.test(l.text.trim()));
  if (voiceIdx < 0) return null;
  const said = (i: number) => /（[^（）]{1,30}）$/.test(lines[i]?.text.trim() ?? '');
  let voiceEnd = voiceIdx;
  while (voiceEnd < labelIdx && !said(voiceEnd)) voiceEnd++;
  // 「からの声」の欄名だけの行の直前で声が終わり、以降に発言者の行がない配置: 欄名の行を声の欄の終わりとする
  if (voiceEnd >= labelIdx && lines[voiceIdx].text.trim() === 'からの声' && said(voiceIdx - 1)) voiceEnd = voiceIdx;
  if (voiceEnd >= labelIdx) return null;
  const from = voiceEnd + 1;
  if (from > labelIdx || /^[・（(]/.test(lines[from].text.trim()) || isStop(lines[from]) && from !== labelIdx) return null;
  let end = labelIdx + 1;
  while (end < lines.length && !isStop(lines[end])) end++;
  // 欄名の行は欄の縦中央: 前の行数と後の行数（欄名の行に本文があればそれを中央とする）の差が1以内
  const before = labelIdx - from, after = end - labelIdx - 1;
  if (Math.abs(before - after) > 1) return null;
  if (lines.slice(from, end).some((l, i) => from + i !== labelIdx && OTHER_LABEL.test(l.text.trim()))) return null;
  return pick(from, end);
}

function extractOne(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '37000') return [];
  const t = input.text;
  const title = '令和８年度行政評価結果';
  const sect = t.indexOf('４ 施策を構成する主な事業');
  if (!t.startsWith(title) || sect < 0) return [];
  const purposeHead = '４ 施策を構成する主な事業\n○施策を構成する事業のうち、令和 7 年度当初予算で重点的に打ち出した事業について、\n事業概要、決算額、事業実績、県民・事業者からの声、成果・課題等を記載した。';
  const fyHead = '令和７年度における施策の実施状況を評価し';
  if (!t.includes(purposeHead) || !t.includes(fyHead)) return [];
  const starts = [...t.matchAll(/^事業名$/gm)].map(m => m.index!).filter(i => i > sect);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    let end = starts[k + 1] ?? t.length;
    const total = t.indexOf('\n５ 総合評価', s);
    if (total >= 0 && total < end) end = total;
    const block = t.slice(s, end);
    const lines = linesOf(block, s);
    const amountRe = /^R(\d+) 年度決算額\s*([\d,]+) 千円/;
    const amountIdx = lines.findIndex(l => /年度決算額/.test(l.text));
    if (amountIdx < 0) return;
    const nameLines = findName(lines, amountIdx);
    if (!nameLines) return;
    const name = nameLines.map(l => l.text.trim()).join('');
    const p = project(input, `事業名:${nfkc(name)}`, name, 2026, nameLines[0].text, nameLines[0].start);
    if (nameLines[1]) p.evidence.push(evidence(input, nameLines[1].text, nameLines[1].start));
    p.evidence.push(evidence(input, title, 0), evidence(input, fyHead));
    p.evaluatedFiscalYear = 2025;
    const decisions = lines.filter(l => /年度決算額/.test(l.text));
    // 決算額は同じ行に「R? 年度決算額 N 千円」と並ぶ場合のみ収録。
    const aLine = lines[amountIdx];
    let m = decisions.length === 1 ? amountRe.exec(aLine.text.slice(aLine.text.indexOf('R'))) : null;
    let rawSpan: { raw: string; off: number } | null = m ? { raw: m[0], off: aLine.start + aLine.text.indexOf('R') } : null;
    // 欄名「R7 年度決算額」だけの行の直後（空行を挟む）に「N 千円」だけの行が続く配置も同じ欄の値として収録。
    if (!m && decisions.length === 1 && /^R\d+ 年度決算額$/.test(aLine.text)) {
      const nx = new RegExp(String.raw`^R(\d+) 年度決算額\n\n?([\d,]+) 千円(?=\n)`).exec(t.slice(aLine.start));
      if (nx) { m = nx; rawSpan = { raw: nx[0], off: aLine.start }; }
    }
    const startYear = /\n開始年度\s+R(\d+) 年度\n/.exec(block);
    if (m && startYear && Number(startYear[1]) > Number(m[1])) {
      p.warnings.push(`「R${m[1]} 年度決算額」が開始年度（R${startYear[1]} 年度）より前の年度で、印字の誤りの可能性があるため金額は未収録。`);
    } else if (m && rawSpan) {
      p.amounts.push(amount(input, 'actual', 2018 + Number(m[1]), m[2], '千円', rawSpan.raw, rawSpan.off));
      if (m[1] !== '7') p.warnings.push(`この事業の決算額は令和7年度ではなく「R${m[1]} 年度決算額」と印字された値（印字どおり収録）。`);
    } else p.warnings.push('「R7 年度決算額」の欄名と金額が抽出テキストで同じ行に並ばず、対応が確定しないため金額は未収録。');
    const r = [...block.matchAll(/成果・課題\s*([◎○△×])(?=\s|$)/g)];
    if (r.length === 1) {
      p.ratings.push({ kind: 'self', label: '事業成果の評価', value: `${r[0][1]}（${MARKS[r[0][1]]}）`, scale: SCALE,
        evidence: evidence(input, r[0][0], s + r[0].index!) });
    }
    // 事業概要・成果・課題（同じ個票の欄。決算額の欄が1つだけの範囲に限る）
    if (decisions.length === 1) {
      const ov = overview(lines, lines.indexOf(nameLines[nameLines.length - 1]), amountIdx);
      if (ov) { p.activities = ov.text; p.evidence.push(evidence(input, ov.raw, ov.at)); }
      const rs = results(lines, amountIdx);
      if (rs) { p.outcomes = rs.text; p.evidence.push(evidence(input, rs.raw, rs.at)); }
      if (ov || rs) p.warnings.push('事業の内容は「事業概要」欄、成果は「成果・課題」欄の本文（欄名・評価記号を除き、折り返しの改行を詰めた）。');
    }
    p.warnings.push('令和8年度行政評価（施策評価調書）の「施策を構成する主な事業」（令和7年度当初予算で重点的に打ち出した事業）のみ。担当部局は事業ごとに印字されないため未収録。');
    out.push(p);
  });
  return mergeReprints(out, p => nfkc(p.projectName));
}

export const entries: Record<string, Entry> = {
  '37000': {
    scope: '令和8年度行政評価結果（施策評価調書）の「施策を構成する主な事業」欄の事業名・決算額（R7年度決算額、千円）・成果・課題の評価記号・事業概要・成果・課題の本文（欄の範囲が確定するもの）。施策の指標、県政世論調査、第２世代交付金等活用事業（事業費の決算・予算の別が印字されないため）は対象外。',
    extract: (input) => extractOne(input),
  },
};
