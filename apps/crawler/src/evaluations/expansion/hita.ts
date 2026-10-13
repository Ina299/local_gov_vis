import { createHash } from 'node:crypto';
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
const SOURCES: Record<string, number> = {
  '427920ae34d69e1446017e56': 2024, '54e3de601bb653819e7675b4': 2023,
  ea9ebb6e7d11bed0052b77ef: 2024, '2ef3b8da58b31cc65db3f293': 2023,
};
/** Individual business boxes inside policy reports; mixed finance columns stay verbatim. */
export function extractHita(input: CachedInput, inputs: CachedInput[] = [input]): ProjectEvaluation[] {
  if (input.municipalityCode !== '44204' || !SOURCES[input.sourceId]) return [];
  const merged = new Map<string, { owner: string; record: ProjectEvaluation }>();
  for (const source of [...inputs].sort((a,b) => a.sourceId.localeCompare(b.sourceId))) {
    const fiscalYear = SOURCES[source.sourceId];
    if (source.municipalityCode !== '44204' || !fiscalYear || source.format !== 'pdf') continue;
    const text = source.text;
    // The report's introductory example precedes the first real policy sheet.
    const front = source.sourceId === 'ea9ebb6e7d11bed0052b77ef' || source.sourceId === '2ef3b8da58b31cc65db3f293';
    const begin = front ? text.search(/^令和[56]年度 行政評価調書\n総合 大綱名 1 きずなを強める 担当部課・評価責任者\n/m) : 0;
    if (begin < 0) continue;
    const headers = [...text.matchAll(/^No\. 事業名・事業内容 (?:令和([56])年度)?活動実績 決算・予算 評価\n/gm)];
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i]; const start = h.index!;
      if (start < begin || Number(h[1]) + 2018 !== fiscalYear) continue;
      // An explicit subsequent box/sheet is required; never accept a cache-cut tail.
      let end = headers[i+1]?.index ?? (source.truncated ? -1 : text.length);
      const nextSheet = text.indexOf(`\n令和${h[1]}年度 行政評価調書\n`, start + h[0].length);
      if (nextSheet >= 0 && (end < 0 || nextSheet < end)) end = nextSheet;
      if (end < 0) continue;
      const raw = text.slice(start, end);
      const firstLine = raw.slice(h[0].length).split('\n')[0];
      const name = firstLine.match(/^([^\s]+(?:事業|費|負担金|補助金|繰出金|事務)(?:[（(][^\s()（）]+[）)])?) (?=\S)/)?.[1];
      // Names that wrapped, activity-first rows and numbered activity subitems are not reconstructed.
      if (!name || /^[【・0-9０-９]/.test(name)) continue;
      const direction = raw.indexOf('事業の方向性 ');
      if (direction < 0 || !raw.includes('事業開始年度')) continue;
      const departments = [...raw.slice(direction).matchAll(/^([^\s]+(?:部|局)[^\s]*(?:課|室|局|センター))$/gm)];
      if (departments.length !== 1) continue;
      const department = departments[0][1];
      // A repeated name in a different department is not sufficient evidence of identity.
      const key = `${fiscalYear}\n${department}\n${name}`;
      const found = merged.get(key);
      if (found) {
        found.record.evidence.push(evidence(source, raw, start));
        continue;
      }
      const code = `business-${fiscalYear}-${createHash('sha256').update(key).digest('hex').slice(0,16)}`;
      const record = project(source, code, name, null, raw, start);
      record.evaluatedFiscalYear = fiscalYear;
      record.department = department;
      record.warnings.push('施策調書内の個別事業枠を部分収録。評価実施年度は未設定。同年度・同担当課・同一名称の重複掲載は原文証拠を統合。費用・評価記号・活動本文は列が混在するため独立項目へ推定変換していません。空欄、名称改行、記入例、末尾未完結の枠は除外。');
      merged.set(key, { owner: source.sourceId, record });
    }
  }
  return [...merged.values()].filter(v => v.owner === input.sourceId).map(v => v.record);
}
