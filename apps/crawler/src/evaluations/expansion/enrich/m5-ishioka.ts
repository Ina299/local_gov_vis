import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 石岡市（令和7・8年度 事務事業評価シート）
// 公開済みレコードは同じ部別PDFの事務事業評価シートから作られ、目的・事業の概要が空欄。
// 抽出テキストが段落（空行区切り）に分かれている版だけを扱う（段落のない版は顧客・意図・事業の概要の行の境が決まらない）。
// 「目的」欄は顧客(誰を)・意図(どのように)の2行で、「事業の概要」ラベルの直前の段落がちょうど2行（顧客が折り返していない）の
// 場合だけ、2行目を意図（目的）とする。事業の概要は、ラベルの直後の段落（次が「事業全体としての課題」ラベル）。
const HEAD = /(?:^|\n)令和([７８])年度\n\n事務事業評価シート\n/g;
const width = (s: string) => [...s].reduce((w, c) => w + (/[\x20-\x7e｡-ﾟ]/.test(c) ? 0.5 : 1), 0);

function sheet(input: CachedInput, seg: string, start: number, r8: boolean): ProjectEvaluation | null {
  const name = /\n事業名\n\n([^\n]+)\n\n/.exec(seg), dept = /\n担当部\n\n課名\n\n[^\n]+\n\n([^\n]+)\n\n/.exec(seg);
  const m = /\n\n([^\n]+)\n([^\n]+)\n\n事業の概要\n\n([^\n]+(?:\n[^\n]+)*)\n\n事業全体\nとしての課題\n\n/.exec(seg);
  if (!name || !m || seg.indexOf('\n事業の概要\n') !== m.index! + m[1].length + m[2].length + 4) return null;
  // 顧客の行が全幅近くまであるときは、2行目がその折り返しの可能性がある。
  if (width(m[1]) >= 40 || /^(?:顧客|\(誰を\)|意図|\(どのように\)|将来の姿)$/.test(m[1]) || /^(?:顧客|\(誰を\)|意図|\(どのように\)|将来の姿)$/.test(m[2])) return null;
  // IDは公開済みレコード（同じ資料）と別にする（同じIDのシートは補強の対象外になるため）。
  const p = project(input, `${name[1]}:narrative`, name[1].trim(), r8 ? 2026 : 2025, name[0].trim(), start + name.index! + 1);
  p.projectCode = null;
  p.evaluatedFiscalYear = r8 ? 2025 : 2024;
  p.department = dept?.[1].trim() ?? null;
  p.purpose = m[2].trim();
  p.activities = m[3].split('\n').join('');
  p.evidence.push(evidence(input, m[0].slice(2, -2), start + m.index! + 2));
  p.warnings.push('事務事業評価シートの「目的」欄のうち意図（どのように）を目的、「事業の概要」欄を事業内容とした（顧客・意図が1行ずつに分かれている場合のみ）。');
  return p;
}

/**
 * 段落のない版（令和8年度の一部）: 「目的 顧客 (誰を)」の次の1行が顧客、「意図 (どのように)」の次の1行が意図で、
 * 意図が句点で終わる1行の場合だけ採る。事業の概要はラベルの行を中心に上下に分かれて並ぶため、ラベルの前の行数と
 * ラベルの後の句点で終わる行までの行数が釣り合う（同じか1行多い）場合だけ、その行を事業の概要とする。
 */
function compact(input: CachedInput, seg: string, start: number): ProjectEvaluation | null {
  const name = /\n事業名 (\S+) 款 /.exec(seg), dept = /\n担当部 課名\n\S+ (\S+)\n/.exec(seg);
  const m = /\n目的\n顧客\n\(誰を\)\n([^\n]+)\n意図\n\(どのように\)\n([^\n]+。)\n((?:[^\n]+\n){1,3}?)事業の概要\n((?:[^\n]+\n){1,5})/.exec(seg);
  if (!name || !m) return null;
  const before = m[3].split('\n').slice(0, -1), rest = m[4].split('\n').slice(0, -1);
  const end = rest.findIndex(l => l.endsWith('。')), after = rest.slice(0, end + 1);
  if (end < 0 || before.some(l => l.endsWith('。'))) return null;
  if (after.length !== before.length && after.length !== before.length + 1) return null;
  if ([m[1], m[2], ...before, ...after].some(l => /^(?:事業全体|としての課題|事業の概要)/.test(l))) return null;
  const p = project(input, `${name[1]}:narrative`, name[1], 2026, name[0].trim(), start + name.index! + 1);
  p.projectCode = null;
  p.evaluatedFiscalYear = 2025;
  p.department = dept?.[1] ?? null;
  p.purpose = m[2];
  p.activities = [...before, ...after].join('');
  const raw = m[0].slice(1, m[0].length - m[4].length) + after.join('\n');
  p.evidence.push(evidence(input, raw, start + m.index! + 1));
  p.warnings.push('事務事業評価シートの「目的」欄のうち意図（どのように）を目的、「事業の概要」欄を事業内容とした（意図が1行、事業の概要がラベルの上下に釣り合って並ぶ場合のみ）。');
  return p;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '08205' || !/\/data\/doc\/\d+_doc_17_0\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const heads = [...t.matchAll(HEAD)];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const start = heads[i].index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const p = sheet(input, seg, start, heads[i][1] === '８');
    if (p) out.push(p);
  }
  const flat = [...t.matchAll(/(?:^|\n)令和８年度 事務事業評価シート\n担当部 課名\n/g)];
  for (let i = 0; i < flat.length; i++) {
    if (input.truncated && i === flat.length - 1) continue;
    const start = flat[i].index!, seg = t.slice(start, flat[i + 1]?.index ?? t.length);
    const p = compact(input, seg, start);
    if (p) out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '石岡市 令和7・8年度 事務事業評価シート（段落に分かれた抽出テキストの版）: 目的の意図・事業の概要（目的・事業内容）。',
};
