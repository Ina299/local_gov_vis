import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { extractFujieda } from '../batch12/m4-fujieda';
import { joinWrapped, radicals, width } from './m10-util';

// ---------------------------------------------------------------- 藤枝市（行政サービス評価委員会 地方創生交付金事業評価シート）
// 公開済みレコードは同じ資料の事業評価シートから作られ（事業名・年度・担当課は公開時の抽出をそのまま使う）、目的が空欄。
// 欄の位置は年度ごとに崩れ方が違うため、次の2つの形に限る。
//  1) 令和元年度委員会（平成30年度事業）: 「事業目的（５行程度以内）」「事業概要（５行程度以内）」の見出しの直後に欄の内容が続く。
//  2) それ以外の年度: 「うち交付金充当額（円）」の金額の直後に事業目的の文が続き、ラベル「事業目的」が文の途中の行に割り込む形。
//     句点で終わる最初の行までを目的とし、最後の行以外が全幅（写真の説明などの短い行が混じらない）、途中の行が句点で
//     終わらず、文の後が空行か箇条の記号（・を除く）で始まる行（事業概要の始まり）の場合だけ採る。箇条で始まる目的は採らない。割り込んだラベルの行は除いてつなぐ。
const H30 = /\n事業目的\n（５行程度以内）\n\n((?:[^\n]+\n)+)\n事業概要\n（５行程度以内）\n\n((?:[^\n]+\n)+)\n事業経費内訳\n/;
const AMOUNT = /\nうち交付[金⾦]充当額（円）\n\n[\d,]+\n\n/;

function purposeAfterAmount(sheet: string): { text: string; raw: string; at: number } | null {
  const a = AMOUNT.exec(sheet);
  if (!a) return null;
  const at = a.index! + a[0].length, ls: string[] = [];
  let pos = at, label = false, done = false;
  while (pos < sheet.length && ls.length < 8) {
    const nl = sheet.indexOf('\n', pos), end = nl < 0 ? sheet.length : nl, line = sheet.slice(pos, end);
    if (!label && ls.length && (line === '事業目的' || (line === '' && sheet.startsWith('事業目的\n', end + 1)))) {
      const m = /^\n?事業目的\n\n/.exec(sheet.slice(pos));
      if (!m) return null;
      label = true; pos += m[0].length; continue;
    }
    if (!line) return null;
    ls.push(line); pos = end + 1;
    if (line.endsWith('。')) { done = true; break; }
  }
  if (!done) return null;
  const after = sheet.slice(pos);
  // 箇条で始まる目的は箇条がいくつ続くか決まらないため採らない。文の後の箇条は事業概要の始まりとみなす（「・」は目的の箇条の続きのおそれがあるため除く）。
  if (/^[・･●○■◆①-⑳※\-－]/.test(ls[0]) || (after && !/^(\n|[①-⑳●■◆【])/.test(after))) return null;
  // ラベルが文に割り込んでいない場合は、ラベル「事業目的」がシートに1つだけあり、その直後が文でない（ラベルの直後に目的の文が
  // 置かれ、金額の後の文が事業概要になる版がある）ことを確かめる。
  if (!label) {
    const labels = [...sheet.matchAll(/\n事業目的\n/g)];
    const next = labels.length === 1 ? /^\n*([^\n]*)/.exec(sheet.slice(labels[0].index! + labels[0][0].length))![1] : null;
    if (next === null || (width(next) >= 15 && /[、。]/.test(next))) return null;
  }
  const full = Math.max(...ls.map(width));
  if (full < 30 || ls.slice(0, -1).some(l => l.endsWith('。') || width(l) < full - 2)) return null;
  return { text: ls.join(''), raw: sheet.slice(at, pos - 1), at };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '22214') return [];
  const t = input.text, base = extractFujieda(input), out: ProjectEvaluation[] = [];
  // シートの境は「事業名」欄の行（見出しの直後）。公開時に採られなかったシートも境に数える。
  const bounds = [...t.matchAll(/\n事業名\n/g)].map(m => m.index!);
  base.forEach(b => {
    const start = Number(/^extracted-text:chars:(\d+)-/.exec(b.evidence[1].cell!)![1]);
    const own = bounds.find(s => s >= start), end = Math.min(...bounds.filter(s => own !== undefined && s > own), t.length), sheet = t.slice(start, end);
    if (input.truncated && end === t.length) return;
    let purpose: string, activities: string | null = null;
    const ev: { raw: string; at: number }[] = [];
    const h = H30.exec(sheet);
    if (h) {
      const at = start + h.index! + h[0].indexOf(h[1]);
      purpose = radicals(joinWrapped(h[1].slice(0, -1), 40)); ev.push({ raw: h[1].slice(0, -1), at });
      const at2 = start + h.index! + h[0].lastIndexOf(h[2]);
      activities = radicals(joinWrapped(h[2].slice(0, -1), 40)); ev.push({ raw: h[2].slice(0, -1), at: at2 });
    } else {
      const r = purposeAfterAmount(sheet);
      if (!r) return;
      purpose = radicals(r.text); ev.push({ raw: r.raw, at: start + r.at });
    }
    // IDは公開済みレコード（同じ資料・同じ事業）と別にする（同じIDのシートは補強の対象外になるため）。
    const p = project(input, `${b.projectName}|${b.evaluatedFiscalYear}:narrative`, b.projectName, b.evaluationYear, b.evidence[0].rawText, Number(/^extracted-text:chars:(\d+)-/.exec(b.evidence[0].cell!)![1]));
    p.evaluatedFiscalYear = b.evaluatedFiscalYear;
    p.department = b.department;
    p.purpose = purpose;
    p.activities = activities;
    for (const e of ev) p.evidence.push(evidence(input, e.raw, e.at));
    p.warnings.push(h ? '事業評価シート（平成30年度事業）の「事業目的」「事業概要」欄。欄の幅での折り返しだけを除いてつないだ。'
      : '事業評価シートの「うち交付金充当額（円）」の金額の直後にある事業目的の文（句点で終わる最初の行まで）。文の途中に割り込んだラベル「事業目的」の行と折り返しの改行を除いてつないだ。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '藤枝市 行政サービス評価委員会 地方創生交付金事業評価シート: 事業目的（全年度、欄の位置が崩れていないもの）、平成30年度事業は事業概要も。',
};
