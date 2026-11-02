import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 花巻市「令和6年度 事務事業評価シート【事後評価】」
// 公開済みレコード（同じ評価シートから作成。目的・事業概要なし）の補強用。事業名はシート末尾の「<事業名> 事務事業評価シート」。
// 目的・対象・意図の欄は見出しと本文の順序が段組みで入れ替わるため、目的は次のどちらかの形に限る。
//  (a) 「目的」の行・空行の後に本文、空行の後に「対象」の行（見出しが本文の前）。
//  (b) 空行の後に本文、続けて「目的」の行・対象の本文1行・「対象」の行（見出しが目的と対象の本文の間）。
//      「目的」の後の1行が句点で終わる場合は目的の続きの可能性があるため採らない。
// どちらも本文は1段落（途中の行は欄の幅いっぱいの45字以上、最後の行は句点で終わる）であること。
// 事業概要は「事業\n概要」の後・空行の前の行が「○」で始まる項目の並びで、次の空行の後に評価欄の見出しが続き、
// シートのほかの場所に「○」の項目・千円の金額がない場合だけ採る（意図の本文や続きの項目が混ざる形を避ける）。
const HEAD = /令和6年度\n事務事業評価シート\n/g;
const NEXT = /^(目 公共関与の妥当性|事業費・人件費の削減余地|○ どちらも削減余地がない|成果指標の達成度の要因分析.*|市民協働の形態|実行委員会・協議会|市民参画の(?: 対象外)?)$/;
const LABEL = /^(.|目 公共関与の妥当性|的 ○.*|有 ○.*|事業名|政策|対象|意図|目的|事業費・人件費の削減余地|成果の向上余地|妥当でない|見直し余地がある|向上余地がない|市民協働の形態|活動指標|成果指標)$/;

interface Field { value: string; raw: string; at: number }

function paragraph(raw: string, at: number): Field | null {
  const lines = raw.split('\n');
  if (lines.some(l => !l.trim() || LABEL.test(l.trim()))) return null;
  if (lines.slice(0, -1).some(l => l.length < 45 || l.endsWith('。')) || !lines[lines.length - 1].endsWith('。')) return null;
  return { value: lines.join(''), raw, at };
}

function purpose(seg: string, at: number): Field | null {
  const found: Field[] = [];
  for (const m of seg.matchAll(/\n目的\n\n((?:[^\n]+\n)+)\n対象\n/g)) {
    const f = paragraph(m[1].slice(0, -1), at + m.index! + '\n目的\n\n'.length);
    if (f) found.push(f); else return null;
  }
  for (const m of seg.matchAll(/\n\n((?:[^\n]+\n)+)目的\n([^\n]+)\n対象\n/g)) {
    if (m[2].endsWith('。')) return null;
    const f = paragraph(m[1].slice(0, -1), at + m.index! + 2);
    if (f) found.push(f); else return null;
  }
  return found.length === 1 ? found[0] : null;
}

function activities(seg: string, at: number): Field | null {
  const ms = [...seg.matchAll(/\n事業\n概要\n\n((?:[^\n]+\n)+)\n([^\n]+)\n/g)];
  if (ms.length !== 1 || !NEXT.test(ms[0][2])) return null;
  const m = ms[0], raw = m[1].slice(0, -1), lines = raw.split('\n');
  if (!/^[○〇]/.test(lines[0]) || lines.some(l => LABEL.test(l.trim()))) return null;
  const rest = seg.slice(0, m.index!) + seg.slice(m.index! + m[0].length);
  if (/\n[○〇◯●](?! )[^\n]*/.test(rest) || /\d千円/.test(rest)) return null;
  // 項目名（金額）の行と説明の行が同じ幅になることがあり、折り返しと区別できないため改行はそのまま残す。
  return { value: raw, raw, at: at + m.index! + '\n事業\n概要\n\n'.length };
}

function sheet(input: CachedInput, at: number, seg: string): ProjectEvaluation | null {
  const foot = /\n([^\n]+?) 事務事業評価シート\s*$/.exec(seg);
  if (!foot) return null;
  const name = foot[1].trim();
  if (!name || !seg.slice(0, foot.index).includes(`\n${name}\n`)) return null;
  const pur = purpose(seg, at), act = activities(seg, at);
  if (!pur && !act) return null;
  const head = /^令和6年度\n事務事業評価シート\n/.exec(seg)!;
  const p = project(input, `${name}:narrative`, name, null, head[0].trimEnd(), at);
  p.evaluatedFiscalYear = 2024;
  p.evidence.push(evidence(input, foot[0].trim(), at + foot.index! + foot[0].indexOf(foot[0].trim())));
  if (pur) { p.purpose = pur.value; p.evidence.push(evidence(input, pur.raw, pur.at)); }
  if (act) { p.activities = act.value; p.evidence.push(evidence(input, act.raw, act.at)); }
  p.warnings.push('花巻市 事務事業評価シート（令和6年度【事後評価】）の「目的」欄と「事業概要」欄。目的は折り返しの改行を除いてつないだ。見出しと本文の対応が段組みで確定しない形は採らない。');
  return p;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '03205' || input.format !== 'pdf' || !/hyouka\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, starts = [...t.matchAll(HEAD)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    if (input.truncated && i === starts.length - 1) return;
    const p = sheet(input, s, t.slice(s, starts[i + 1] ?? t.length));
    if (p) out.push(p);
  });
  return out.filter(p => out.filter(o => o.projectName === p.projectName).length === 1);
}

export const entry = { extract, scope: '花巻市 令和6年度 事務事業評価シート【事後評価】の目的欄・事業概要欄（見出しとの対応が確定する形のみ）。公開済みの評価シート由来レコードの補強用。' };
