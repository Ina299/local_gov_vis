/**
 * 20485 白馬村: 事務事業評価 評価結果報告書の個別調書（事務事業評価調書）。公開済みレコード（平成20〜24年度版は m0-c、平成25年度版は
 * h7-c と同じ調書・同じ事業名）の空欄に、「事業の目的」（【対象・意図】）を目的、「事業の計画」（平成25年度版は「事業の概要」）を
 * 事業内容として補う。平成25年度版の「計画に対する事業成果・進捗状況等とその分析」を成果とする。
 * 平成20〜24年度版の成果の検証欄は当初計画と決算の列が混ざるため対象外。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';

/** 平成20〜24年度版の報告書（m0-c と同じ）。 */
const ERA: Record<string, number> = {
  '061e54ce6b42b384ffdfd1b6': 20, 'c374de191993f88b6d4b8a25': 21, '138e2404c2cb8d0ac161f87a': 22,
  '0887c88fd77f0a5d05016fb1': 23, '02392491d3e32a42fb9ef613': 24,
};
/** 平成25年度版（平成24年度実施分。h7-c と同じ）。 */
const REPORT_25 = '4e311cfe5e7e9ca1bba35cf4';
const toInt = (s: string) => Number(s.normalize('NFKC'));
/** 本文1行は50字前後。 */
const WRAP = 44;
const join = (raw: string) => raw.split('\n').reduce((acc, l, i, ls) => acc + (i === 0 ? '' : ls[i - 1].length >= WRAP && !/。$/.test(ls[i - 1]) ? '' : '\n') + l, '');

interface Field { value: string; raw: string; at: number }
/** 見出し（字間の空白入り）の直後（同じ行の続き、または空行のあと）から、終わりの印の手前までの本文。 */
function field(text: string, from: number, to: number, label: string, end: RegExp): Field | null {
  const seg = text.slice(from, to), m = new RegExp(`\\n${label}(?: |\\n\\n?)`).exec(seg);
  if (!m) return null;
  const at = m.index! + m[0].length, rest = seg.slice(at), e = end.exec(rest);
  if (!e) return null;
  const raw = rest.slice(0, e.index!).replace(/\n+$/, '');
  if (!raw.trim() || raw.includes('\n\n') || /事 ?業 ?の|【|２．事務事業/.test(raw)) return null;
  return { value: join(raw), raw, at: from + at };
}

function sheetOf(input: CachedInput, start: number, end: number, name: string, nameRaw: string, nameAt: number, era: number, fy: number, key: string): ProjectEvaluation | null {
  const text = input.text, costAt = text.indexOf('２．事務事業に要する経費', start);
  if (costAt < 0 || costAt > end) return null;
  const p = project(input, `narrative-${key}`, name, 1988 + era, nameRaw, nameAt);
  p.evaluatedFiscalYear = 1988 + fy;
  const notes: string[] = [];
  if (era < 25) {
    const purpose = field(text, start, costAt, '事 業 の 目 的', /\n【この事業で当初計画したことを具体的に記入】\n/);
    if (purpose && text.slice(start, purpose.at).includes('【対象（何を・誰を）・意図（どうしたいか）】')) {
      p.purpose = purpose.value; p.evidence.push(evidence(input, purpose.raw, purpose.at)); notes.push('「事業の目的」（対象・意図）を目的');
    }
    const plan = field(text, start, costAt, '事 業 の 計 画', /\n\n|\n２．事務事業に要する経費/);
    if (plan) { p.activities = plan.value; p.evidence.push(evidence(input, plan.raw, plan.at)); notes.push('「事業の計画」（当初計画したこと）を事業内容'); }
  } else {
    const summary = field(text, start, costAt, '事 業 の 概 要', /\n\n|\n２．事務事業に要する経費/);
    if (summary) { p.activities = summary.value; p.evidence.push(evidence(input, summary.raw, summary.at)); notes.push('「事業の概要」（当初計画し実施したこと）を事業内容'); }
    const o = text.indexOf('\n３．成果の自己検証\n計画に対する事業成果・進捗状況等とその分析\n', costAt);
    const oEnd = o < 0 ? -1 : text.indexOf('\n４．事務事業の評価', o);
    if (o >= 0 && oEnd >= 0 && oEnd < end) {
      const at = o + '\n３．成果の自己検証\n計画に対する事業成果・進捗状況等とその分析\n'.length, raw = text.slice(at, oEnd).replace(/\n+$/, '');
      if (raw.trim() && !raw.includes('\n\n')) { p.outcomes = raw.split('\n').reduce((acc, l, i, ls) => acc + (i === 0 ? '' : ls[i - 1].length >= 60 && !/。$/.test(ls[i - 1]) ? '' : '\n') + l, ''); p.evidence.push(evidence(input, raw, at)); notes.push('「計画に対する事業成果・進捗状況等とその分析」を成果'); }
    }
  }
  if (!notes.length) return null;
  p.warnings.push(`白馬村 事務事業評価調書（平成${fy}年度）の${notes.join('、')}として収録。PDFの折り返しの改行を除いた。`);
  return p;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '20485' || input.truncated) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const era = ERA[input.sourceId];
  if (era) {
    if (!t.startsWith(`平成${era}年度\n白馬村事務事業評価\n評価結果報告書`)) return [];
    // m0-c と同じ: 調書の各頁の見出し（No と「平成N年度 事務事業評価調書」）で区切り、事業名は冒頭の最初の「名 …」行（担当係名の行を除く）。
    const heads = [...t.matchAll(/No(\d+)\n\n平成([0-9０-９]+)年度 事務事業評価調書\n|平成([0-9０-９]+)年度 事務事業評価調書\n\nNo(\d+)\n/g)]
      .map(m => ({ at: m.index!, no: m[1] ?? m[4], fy: toInt(m[2] ?? m[3]) }));
    const starts = heads.filter((h, i) => i === 0 || heads[i - 1].no !== h.no);
    for (const [i, h] of starts.entries()) {
      if (h.fy !== era - 1) continue;
      const end = starts[i + 1]?.at ?? t.length, costAt = t.indexOf('２．事務事業に要する経費', h.at);
      if (costAt < 0 || costAt > end) continue;
      const nameM = [...t.slice(h.at, costAt).matchAll(/(^|\n)([^\n]*)\n+名 ([^\n]+)\n/g)].find(m => m[2] !== '係');
      if (!nameM || /係$/.test(nameM[3].trim())) continue;
      const nameAt = h.at + nameM.index! + nameM[0].indexOf(`名 ${nameM[3]}`);
      const p = sheetOf(input, h.at, end, nameM[3].trim(), `名 ${nameM[3]}`, nameAt, era, h.fy, `${h.fy}-No${h.no}`);
      if (p) out.push(p);
    }
    return out;
  }
  if (input.sourceId !== REPORT_25 || !t.startsWith('平成２５年度\n白馬村事務事業評価\n評価結果報告書')) return [];
  // h7-c と同じ: 最終方針一覧の事業名を、1頁目（経費欄を含む頁）の冒頭に名前を含む調書がちょうど1つの場合だけ対応づける。
  const listStart = t.indexOf('事務事業別今後の方向性'), listEnd = t.indexOf('平成２６年度の評価作業に向けて', listStart);
  if (listStart < 0 || listEnd < 0) return [];
  const pages = [...t.matchAll(/平成2[45]年度 事務事業評価調書\n/g)].map(m => m.index!);
  const firstPages = pages.filter((p, i) => t.slice(p, pages[i + 1] ?? t.length).includes('２．事務事業に要する経費'));
  const sheets = firstPages.map((p, i) => ({ start: p, end: firstPages[i + 1] ?? t.length }));
  const seen = new Set<string>();
  for (const m of t.slice(listStart, listEnd).matchAll(/^(\d+)\n\n(\S+)\n\n([A-F])$/gm)) {
    const name = m[2];
    if (seen.has(name)) continue;
    seen.add(name);
    const hits = sheets.filter(s => { const v = t.slice(s.start, s.end); return v.slice(0, v.indexOf('３．成果の自己検証')).includes(name); });
    if (hits.length !== 1) continue;
    // 調書の見出しの年度は「平成24年度」「平成25年度」が混在するが、報告書は平成24年度実施分（h7-c と同じく評価対象年度2012）。
    const s = hits[0];
    const nameAt = t.indexOf(name, s.start);
    const p = sheetOf(input, s.start, s.end, name, name, nameAt, 25, 24, `25-${name}`);
    if (p) out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '白馬村 事務事業評価調書（平成19〜24年度実施分）の「事業の目的」（目的）・「事業の計画」「事業の概要」（事業内容）と、平成24年度実施分の「計画に対する事業成果・進捗状況等とその分析」（成果）。',
};
