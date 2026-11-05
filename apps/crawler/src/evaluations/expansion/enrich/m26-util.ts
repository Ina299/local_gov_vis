/**
 * グループ m26 共通: 公開済みレコードと同じ事業名・年度・所管の補強用レコードを作り、欄の本文（目的・事業内容・成果）を載せる。
 * 欄の本文は保存テキストの部分文字列（根拠）を1つ以上つないだもの。根拠の各片はそれぞれ根拠として記録する。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

export interface Piece { raw: string; at: number }
export interface Field { key: 'purpose' | 'activities' | 'outcomes'; pieces: Piece[]; value: string }

/** 箇条の記号で始まる行の前の改行は残し、それ以外の折り返しの改行は除いてつなぐ。 */
export const joinWrapped = (lines: string[]) =>
  lines.map(l => l.trim()).reduce((acc, l, i) => acc + (i && /^[・※＊*①-⑳○●◎■□◆◇]/.test(l) ? '\n' : '') + l, '');

export function sheetRecord(input: CachedInput, key: string, name: { value: string; raw: string; at: number },
  years: { evaluationYear: number | null; evaluatedFiscalYear: number | null }, department: string | null, fields: Field[], note: string): ProjectEvaluation {
  const p = project(input, `m26:${key}`, name.value, years.evaluationYear, name.raw, name.at);
  p.evaluatedFiscalYear = years.evaluatedFiscalYear;
  p.department = department;
  for (const f of fields) {
    p[f.key] = f.value;
    for (const x of f.pieces) p.evidence.push(evidence(input, x.raw, x.at));
  }
  p.warnings.push(note);
  return p;
}
