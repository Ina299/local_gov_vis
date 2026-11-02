/**
 * グループ m21 共通: 公開済みレコードと同じ事業名・年度の補強用レコードを作り、欄の本文（目的・事業内容・成果）を載せる。
 * 欄の本文は保存テキストの部分文字列そのもの（根拠）から、PDFの折り返しの改行だけを除いた値にする。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

/** 和暦の年度（「令和７」「平成２９」「R7」など）を西暦に。全角数字・元年も読む。 */
export function seireki(era: string, n: string): number {
  const v = n === '元' ? 1 : Number(n.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
  return (/^(令和|R)$/.test(era) ? 2018 : 1988) + v;
}

/** 改行を除いてつなぐ（日本語の折り返しは語の途中で切れるため、空白も入れない）。 */
export const joinLines = (raw: string) => raw.split('\n').map(l => l.trim()).join('');

export interface Field { key: 'purpose' | 'activities' | 'outcomes'; raw: string; at: number; value?: string }

/**
 * 補強用レコード。年度は公開済みレコードと同じ持ち方（評価年度・対象年度）で渡す。name の根拠は事業名の位置。
 * fields の値は raw の折り返しを除いたもの（value を渡せばそれ）。
 */
export function sheetRecord(input: CachedInput, key: string, name: { value: string; raw: string; at: number },
  years: { evaluationYear: number | null; evaluatedFiscalYear: number | null }, department: string | null, fields: Field[], note: string): ProjectEvaluation {
  const p = project(input, `m21:${key}`, name.value, years.evaluationYear, name.raw, name.at);
  p.evaluatedFiscalYear = years.evaluatedFiscalYear;
  p.department = department;
  for (const f of fields) {
    p[f.key] = f.value ?? joinLines(f.raw);
    p.evidence.push(evidence(input, f.raw, f.at));
  }
  p.warnings.push(note);
  return p;
}

/**
 * label の行の後（空行1つを挟む）から次の空行までを欄の本文とし、その後に next の見出し行が続く場合だけ返す。
 * 本文が見出し語・数値だけの行を含む場合は採らない（欄の中身が別の列と混ざっているおそれ）。
 */
export function labelled(seg: string, base: number, label: RegExp, next: RegExp): { raw: string; at: number } | null {
  const m = new RegExp(`\\n${label.source}\\n\\n((?:[^\\n]+\\n)*?[^\\n]+)\\n\\n(${next.source})\\n`).exec(seg);
  if (!m) return null;
  const raw = m[1];
  if (raw.split('\n').some(l => /^[\d,.%（）()\s]+$/.test(l.trim()))) return null;
  return { raw, at: base + m.index! + m[0].indexOf('\n\n') + 2 };
}
