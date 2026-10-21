import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

export function extractTanabe(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '30206' || input.format !== 'pdf' || input.truncated || !input.text.startsWith('令和７年度（令和６年度対象）')) return [];
  const headers = [...input.text.matchAll(/令和６年度 田辺市教育委員会事務事業評価シート\s*【№([０-９\d]+)】/g)];
  const records: ProjectEvaluation[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index!;
    const section = input.text.slice(start, headers[i + 1]?.index ?? input.text.length);
    // Each individual sheet ends at a printed footer. Following committee minutes are not its evidence.
    const end = section.match(/\n- \d+ -/);
    if (!end) continue;
    const text = section.slice(0, end.index! + end[0].length);
    const code = headers[i][1].normalize('NFKC');
    const name = text.match(/^事 業 名 (.+)$/m)?.[1];
    const rating = text.match(/【 ([ＡＢＣＤ]) 】/);
    if (!name || !rating || seen.has(code)) continue;
    seen.add(code);
    const record = project(input, code, name, 2025, text, start);
    record.evaluatedFiscalYear = 2024;
    record.department = text.match(/^担当課名 (.+)$/m)?.[1] ?? null;
    record.ratings.push({ kind: 'self', label: '評価', value: rating[1],
      scale: 'Ａ：超えて達成した／Ｂ：概ね達成した／Ｃ：下回った／Ｄ：大きく下回った',
      evidence: evidence(input, rating[0], start + rating.index!) });
    const table = text.indexOf('項 目 （単位） Ｒ５年度 Ｒ６年度 前年比 事 業 費（千円）');
    if (table >= 0) {
      const numericText = text.slice(table).split('その他')[0];
      for (const row of numericText.matchAll(/^(?:数値実績 )?([^\n（）()]+?)[（(] *([^\s（）()]+) *[）)] ([\d,.]+) ([\d,.]+) ([\d.]+[%％]) Ｒ[５６]年度 [\d,]+$/gm)) {
        record.indicators.push({ name: `【数値実績】${row[1].trim()}`, fiscalYear: 2024, target: null,
          actual: row[4], unit: row[2], evidence: evidence(input, row[0], start + table + row.index!) });
      }
    }
    const narrativeStart = text.search(/^成(?: |$)/m);
    const narrativeEnd = text.indexOf('区 分 状 況 総 括');
    if (narrativeStart >= 0 && narrativeEnd > narrativeStart) record.outcomes = '事業成果・課題（原文欄）\n' + text.slice(narrativeStart, narrativeEnd).trim();
    record.warnings.push('事業費は予算・決算の別が明示されないため金額欄に変換していません。数値実績は原文の区分を維持し、活動指標・成果指標に分類し直していません。');
    records.push(record);
  }
  return records;
}
