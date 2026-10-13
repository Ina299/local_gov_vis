import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, project } from './shared';

export function extractDaigo(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '08364' || input.format !== 'pdf' || input.truncated || !input.text.startsWith('令和５年度\n大子町行政評価報告書')) return [];
  const headers = [...input.text.matchAll(/^令和 5 年度 事務事業評価調査書$/gm)];
  const records: ProjectEvaluation[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index!;
    const text = input.text.slice(start, headers[i + 1]?.index ?? input.text.length).replace(/\n別記様式（第３条関係）\s*$/, '');
    const name = text.match(/^事務事業名 (.+)$/m)?.[1];
    if (!name || seen.has(name) || !text.includes('Ⅶ 総合計画における数値目標')) continue;
    seen.add(name);
    const record = project(input, `name:${name}`, name, 2023, text, start);
    record.projectCode = null;
    const purpose = text.match(/^目的 (.+)$/m);
    if (purpose) record.purpose = purpose[1];
    const execution = text.indexOf('Ⅳ 執行状況');
    const issues = text.indexOf('Ⅴ 問題点・改善後の概要');
    const opinion = text.indexOf('Ⅵ 担当所属長意見');
    if (execution >= 0 && issues > execution) record.activities = text.slice(execution, issues).trim();
    if (execution >= 0 && opinion > issues) record.activities = text.slice(execution, opinion).trim();
    record.warnings.push('費用表の見出しは「決算･予算」で年度ごとの種類が明示されないため金額を変換していません。対象年度も複数年にわたるため未設定。原文事業番号がないため事業名を安定識別に使用しています。改善により予想される効果は実現済み成果として数値化していません。');
    records.push(record);
  }
  return records;
}
