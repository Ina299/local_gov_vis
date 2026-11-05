/**
 * グループ m24 共通: 公開済みレコードと同じ事業名・年度の補強用レコードを作り、欄の本文（目的・事業内容・成果）を載せる。
 * 欄の本文は保存テキストの部分文字列そのもの（根拠）から、欄の幅で折り返した改行だけを除いた値にする。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

export interface Field { key: 'purpose' | 'activities' | 'outcomes'; raw: string; at: number }

/** 補強用レコード。年度は公開済みレコードと同じ持ち方（評価年度・対象年度）で渡す。name の根拠は事業名の位置。 */
export function sheetRecord(input: CachedInput, key: string, name: { value: string; raw: string; at: number },
  years: { evaluationYear: number | null; evaluatedFiscalYear: number | null }, fields: Field[], note: string): ProjectEvaluation {
  const p = project(input, `m24:${key}`, name.value, years.evaluationYear, name.raw, name.at);
  p.evaluatedFiscalYear = years.evaluatedFiscalYear;
  for (const f of fields) {
    p[f.key] = unwrap(f.raw.trim());
    p.evidence.push(evidence(input, f.raw, f.at));
  }
  p.warnings.push(note);
  return p;
}

/** 数値だけの行（金額・件数のセル）。 */
export const isNumLine = (l: string) => /^[\d,.\s%％△-]+$/.test(l.trim());
