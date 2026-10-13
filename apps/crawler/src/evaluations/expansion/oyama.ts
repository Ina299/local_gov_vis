import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

export function extractOyama(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '09208' || input.format !== 'pdf' || input.truncated || !input.text.includes('事業評価 （令和7年度）')) return [];
  const headers = [...input.text.matchAll(/^３ 事業評価 評価結果$/gm)];
  const records: ProjectEvaluation[] = [];
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index!;
    const raw = input.text.slice(start, headers[i + 1]?.index ?? input.text.length);
    const name = raw.match(/^評価事業名 (.+?) 事業所管課 /m)?.[1];
    if (!name || !raw.includes('２－３ 主な課題と今後の対応方針')) continue;
    const record = project(input, name, name, 2025, raw, start);
    record.projectCode = null;
    const rating = raw.match(/成果指標の定量的評価 ([ｓａｂｃｄ])/);
    if (rating) record.ratings.push({ kind: 'self', label: '成果指標の定量的評価', value: rating[1], scale: 's：順調／a：概ね順調／b：やや低調／c：低調／d：著しく低調', evidence: evidence(input, rating[0], start + rating.index!) });
    record.warnings.push('左右の表が混在する抽出本文のため費用・年度列・数値指標を変換せず個票原文を保持。対象年度は明示がなく未設定。');
    if (['災害対策本部システム事業', '防災備蓄物資整備事業'].includes(name)) {
      const note = input.text.match(new RegExp(name === '災害対策本部システム事業' ? '⑤ 災害対策本部[\\s\\S]*?⑥' : '⑥ 防災備蓄物資[\\s\\S]*?整備事業 縮小'));
      if (note) record.evidence.push(evidence(input, note[0], note.index!));
      record.warnings.push('後段の第三者評価委員会で今回の評価対象から除外された事業。自己評価個票を保存しています。');
    }
    records.push(record);
  }
  return records;
}
