import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence } from '../shared';
import { extractWako } from '../batch7/g7-wako';

// ---------------------------------------------------------------- 和光市 事務事業評価表（目標像別PDF）
// 公開済みレコード（年度の記載なし）は同じPDFの事業別の表から作られている（batch7/g7-wako.ts）。同じ抽出で事業名・課室名・根拠を
// 作り直し、その表の「事業の目的」「活動概要」欄を目的・事業内容として付ける。抽出テキストの並びは次の3通り。
//  (a) 「事業の目的」の後に空行、複数行の目的、空行、「活動概要」、空行、事業内容、空行。
//  (b) 「事業の目的 」に続けて1行の目的、空行、「活動概要」、空行、事業内容、空行。
//  (c) 「事業の目的 」に続けて1行の目的、改行だけで事業内容の行が続き、空行、「活動概要」の直後が空欄（補助金の欄が続く）。
//      欄の見出しと同じ行に印字されるのは1行で収まる目的だけで（(b) で確認）、続く行は活動概要の欄の文字が繰り上がったもの。
//      1行目が折り返しの途中（句点で終わらない長い行）のものは採らない。
// どれも直前の行が「事業の対象」の行であること（目的の文字が見出しより前に押し出された表は採らない）。
// 「具体的な成果の説明」欄は縦書きの見出し文字と本文が行単位で交互に混ざり、本文の範囲が確定しないため成果は対象外。
// 年度は表に明示されないため、公開済みレコードと同じく未設定（同じ資料に限って突き合わせる）。

const PRE = /\n事業の対象 [^\n]+\n\n?$/;
const LINES = String.raw`((?:[^\n]+\n)*?[^\n]+)`;
const A = new RegExp(String.raw`\n事業の目的\n\n${LINES}\n\n活動概要\n\n${LINES}\n\n補助金`);
const B = new RegExp(String.raw`\n事業の目的 ([^\n]+)\n\n活動概要\n\n${LINES}\n\n補助金`);
const C = new RegExp(String.raw`\n事業の目的 ([^\n]+)\n${LINES}\n\n活動概要\n\n?補助金`);

/** 折り返しの行（前の行が句点で終わらず十分長い）は改行を除いてつなぐ。 */
function unwrapLines(raw: string): string {
  const lines = raw.split('\n').map(l => l.trim());
  return lines.reduce((s, l, i) => i === 0 ? l : s + (lines[i - 1].length >= 30 && !/[。.]$/.test(lines[i - 1]) ? '' : '\n') + l, '');
}

/** 表の区間 seg（text 上の位置 start）から目的・事業内容の生の文字列と位置を取る。 */
function fields(seg: string, start: number): { p: string; pAt: number; a: string; aAt: number } | null {
  if (seg.split('事業の目的').length !== 2 || seg.split('活動概要').length !== 2) return null;
  for (const [re, label, gap] of [[A, '\n事業の目的\n\n', '\n\n活動概要\n\n'], [B, '\n事業の目的 ', '\n\n活動概要\n\n'], [C, '\n事業の目的 ', '\n']] as const) {
    const m = re.exec(seg);
    if (!m) continue;
    if (!PRE.test(seg.slice(0, m.index))) return null;
    if (re === C && m[1].trim().length >= 45 && !/。$/.test(m[1].trim())) return null;
    const pAt = start + m.index + label.length;
    return { p: m[1], pAt, a: m[2], aAt: pAt + m[1].length + gap.length };
  }
  return null;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  const sheets = extractWako(input);
  if (!sheets.length) return [];
  const heads = [...input.text.matchAll(/(?<=^|\n)事業名\n款\n\n/g)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  for (const p of sheets) {
    const start = Number(/^extracted-text:chars:(\d+)-/.exec(p.evidence[0].cell ?? '')?.[1] ?? -1);
    if (start < 0) continue;
    const end = heads.find(h => h > start) ?? input.text.length;
    const f = fields(input.text.slice(start, end), start);
    if (!f) continue;
    const purpose = unwrapLines(f.p), activities = unwrapLines(f.a);
    if (purpose.length < 5 || activities.length < 5) continue;
    // 公開済みレコードと同じ抽出なので id も同じになる。補強の事業票として別の id にする。
    p.id = `${p.id}-narrative`;
    p.amounts = []; p.indicators = []; p.ratings = [];
    p.purpose = purpose; p.activities = activities;
    p.evidence.push(evidence(input, f.p, f.pAt), evidence(input, f.a, f.aAt));
    p.warnings = [p.warnings[0], '和光市事務事業評価表の「事業の目的」「活動概要」欄（折り返しの改行のみ除去）。年度は表に明示されないため未設定。'];
    out.push(p);
  }
  return out;
}

export const entry = { extract, scope: '和光市 事務事業評価表（目標像別PDF）の「事業の目的」「活動概要」欄。年度の記載がない公開済みレコードを、同じPDFの同じ事業の表に限って補強。' };
