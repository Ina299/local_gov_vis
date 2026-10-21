import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

/** 大井町 施策評価シート【2024年度】の＜個別評価＞欄（事業CD単位）。2段組が崩れていない行だけを採る。 */
const sheetIds = new Set(['01f80049ecd6936f84ee71c2', '1b001b1b03efc4cff0004e2a', '3bf48690b55ccae41b17cb2c', '3f0e1e82ece875921443e333', '6887ccb7805272dc8925c5db',
  '7a27e62522f39b1ea0085065', '952f5bfd1f1573460768493f', 'ad9bb909a83df9e6f9c79fd7', 'b07bc9404f41b2c2e9c8051b', 'cab6dd30e54839f641ceae8b',
  'cd39a05b0545eccf4b7b196b', 'e69f74866aa6423d6418f80e', 'ed87cf43494e33a4692e8f95']);
const RATING = '優良|良好|適正|改善の必要あり|抜本的な見直し', PROGRESS = '順調に進んでいる|おおむね順調に進んでいる|やや遅れている|遅れている';
// Only the layout where 事業CD, 担当課, 予算額, 決算額, 事業評価, 事業名, 進捗状況 are consecutive; interleaved rows are skipped.
const ROW = new RegExp(`事業CD\\s*\\n*(\\S+)\\n\\n(\\S+)\\n\\n事業評価\\n\\n予算額\\n\\n([\\d,]+)\\n\\n決算額\\n\\n([\\d,]+)\\n\\n(${RATING})\\n([^\\n]+)\\n[AB]\\n進捗状況\\n(${PROGRESS})\\n`, 'g');

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '14362' || input.format !== 'pdf' || input.truncated || !sheetIds.has(input.sourceId)) return [];
  const text = input.text, heading = '大井町施策評価シート';
  const starts: number[] = [];
  for (let i = text.indexOf(heading); i >= 0; i = text.indexOf(heading, i + 1)) starts.push(i);
  const out = new Map<string, ProjectEvaluation>(), conflicts = new Set<string>();
  starts.forEach((s, k) => {
    const e = starts[k + 1] ?? text.length, sheet = text.slice(s, e);
    if (!/^大井町施策評価シート\n\n【 2024 年度】\n/.test(sheet)) return;
    for (const m of sheet.matchAll(ROW)) {
      const [raw, cd, department, , , value, name, progress] = m;
      if (!/^[0-9０-９]+[-－][0-9０-９]+$/.test(cd) || !/(課|室|局|館|所|センター)$/.test(department)) continue;
      // The name line must reappear in the sheet's 二次評価 section, otherwise it may be a stray wrapped line.
      if (sheet.split(name).length < 3 || /^(事業名|事業評価|施策貢献度|\d)$/.test(name)) continue;
      const start = s + m.index!;
      const policy = sheet.match(/(\d+-\d+-\d+)/)?.[1];
      const p = project(input, `${policy ?? ''}/${cd.normalize('NFKC')}`, name, null, raw, start);
      p.department = department;
      p.evaluatedFiscalYear = 2024;
      p.ratings.push({ kind: 'self', label: '事業評価', value, scale: null, evidence: evidence(input, raw, start) },
        { kind: 'self', label: '進捗状況', value: progress, scale: '順調に進んでいる／おおむね順調に進んでいる／やや遅れている／遅れている', evidence: evidence(input, raw, start) });
      p.warnings.push('施策評価シート内の＜個別評価＞欄の事業行。2段組が崩れていない行（事業CD・担当課・予算額・決算額・事業評価・事業名・進捗状況が連続）だけを収録し、他の行は除外。予算額・決算額は単位が本文に明記されていないため金額未構造化。施策貢献度・事業評価本文・二次評価の今後の方向性は列対応が確定しないため未構造化。年度は表題【2024年度】を評価対象年度とし、評価実施年度は未設定。');
      const key = p.projectCode!, old = out.get(key);
      if (old) { if (old.projectName !== name || old.ratings[0].value !== value) conflicts.add(key); else old.evidence.push(evidence(input, raw, start)); }
      else out.set(key, p);
    }
  });
  return [...out].filter(([k]) => !conflicts.has(k)).map(([, p]) => p);
}

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '14362': { extract, scope: '施策評価シート（2024年度）の＜個別評価＞欄のうち列が崩れていない事業行の事業名・担当課・事業評価・進捗状況のみ。金額（単位不明）・施策評価本体・外部評価シート・施策評価結果一覧は対象外。' },
};
