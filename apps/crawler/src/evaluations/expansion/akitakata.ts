import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** H25 individual sheets. The text has interleaved columns; only unambiguous cells are used. */
export function extractAkitakata(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '34214' || input.format !== 'pdf' || input.truncated) return [];
  const headers = [...input.text.matchAll(/事\s*務\s*事\s*業\s*[ＣC]\s*[ＤD]\s*(\d+) 安芸高田市 事務事業評価シート 平成２５年度事務事業/g)];
  const results: ProjectEvaluation[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index!;
    const text = input.text.slice(start, headers[i + 1]?.index ?? input.text.length);
    const code = headers[i][1];
    if (seen.has(code) || !text.includes('事務事業実施にかかるコストと業績（Do）') || !new RegExp(`^0*${code}[^0-9].+\\.xlsx?\\s*$`, 'm').test(text)) continue;
    let name = text.match(/^事務事業名 ([^\s]+)(?: 電話| [（(]?\d)/m)?.[1];
    if (name === '電話') name = undefined;
    // Four long names wrap around the department/author columns. Both fragments have explicit boundaries.
    if (!name) {
      const wrapped = text.match(/^([^\n]+) 担当部課 [^\n]+\n事務事業名 電話[^\n]*\n([^\n]+) 作成者氏名/m);
      if (wrapped) name = wrapped[1] + wrapped[2];
    }
    if (!name) continue;
    seen.add(code);
    const record = project(input, code, name, null, text, start);
    record.evaluatedFiscalYear = 2013;
    record.department = text.match(/担当部課 (.+?) \d{3,4}/)?.[1] ?? null;
    record.warnings.push('費用表は24・25・26年度を掲載していますが、決算・予算・見込みの別が明示されないため金額項目へ変換していません。費用原文は個票の出典に保持。');
    const tailOffset = text.lastIndexOf('目標値 備考');
    const tail = text.slice(Math.max(0, tailOffset));
    if (tailOffset >= 0 && /指 標 名 24年度 25年度 26年度/.test(tail)) {
      // Require a complete, single-token label ending at the circled row marker. Formula/wrapped labels are skipped.
      const rows = [...tail.matchAll(/^(?:果 )?([^\s①②]+) [①②][^\n]*\n(?:指 )?([^\s]+) 実績値 ([\d,.]+|[－―ー-]) ([\d,.]+|[－―ー-]) [－―ー-] (?:H\d+ )?年度/gm)];
      for (const row of rows) {
        if (!/^[\d,]+(?:\.\d+)?$/.test(row[4])) continue;
        const prefix = tail.slice(0, row.index);
        const target = prefix.match(/単位 計画値 ([\d,.]+|[－―ー-]) ([\d,.]+|[－―ー-]) ([\d,.]+|[－―ー-])[^\n]*\n$/);
        const rawStart = start + tailOffset + row.index!;
        record.indicators.push({ name: `【成果指標】${row[1]}`, fiscalYear: 2013, unit: row[2],
          actual: row[4], target: target && /^[\d,]+(?:\.\d+)?$/.test(target[2]) ? target[2] : null,
          evidence: evidence(input, target ? target[0] + row[0] : row[0], target ? rawStart - target[0].length : rawStart) });
      }
    }
    results.push(record);
  }
  return results;
}
