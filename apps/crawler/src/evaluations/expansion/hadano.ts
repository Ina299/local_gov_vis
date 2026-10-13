import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

// Reviewed title-cell line spans in this particular PDF extraction. The label is
// vertically centred, so text before `１ 事業名` can belong to the title itself.
const wrapped = new Set([3, 4, 5, 18, 27, 32, 38, 39, 40, 42, 48, 49, 50, 52]);
// University-specific descriptions of the same municipal activity are one row.
const repeated = new Map([[63, 14], [57, 23], [67, 23], [68, 23], [65, 28],
  [69, 36], [51, 18], [53, 21]]);

export function extractHadano(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '14211' || input.format !== 'pdf'
    || input.sourceId !== 'a8c1c6174410b216333d88f1'
    || !input.text.includes('平成３０年度\n行財政最適化支援報告書')) return [];
  const records = new Map<number, ProjectEvaluation>();
  const seen = new Set<number>();
  for (const header of input.text.matchAll(/^個票([０-９]+)\n/gm)) {
    const number = Number(header[1].normalize('NFKC'));
    if (number < 1 || number > 69) continue;
    const start = header.index!;
    const end = input.text.indexOf('\n附', start);
    if (end < 0) continue;
    const block = input.text.slice(start, end);
    // Require a complete numbered sheet, never a table-of-contents entry or
    // following policy chapter. A cut-off final page is not accepted.
    if (!block.includes('８ 今後の方向性') || /^個票[０-９]+$/m.test(block.slice(header[0].length))) continue;
    const lines = block.split('\n');
    const departmentLine = lines.findIndex(line => line.startsWith('所管課等 '));
    if (departmentLine < 0) continue;
    const department = number === 29 ? '生涯学習文化振興課・企画課'
      : lines[departmentLine].match(/^所管課等 (.+) 分類№ /)?.[1];
    const titleStart = number === 29 ? 4 : 2;
    const titleEnd = wrapped.has(number) ? 5 : number === 21 ? 4 : titleStart + 1;
    const titleRaw = lines.slice(titleStart, titleEnd).join('\n');
    if (!department || !titleRaw.includes('１ 事業名')) continue;
    const name = titleRaw.replace(/１ 事業名 ?/, '').replace(/\n/g, '').trim();
    if (!name) continue;
    if (seen.has(number)) throw new Error(`Duplicate Hadano sheet: ${number}`);
    seen.add(number);
    const primary = repeated.get(number);
    if (primary !== undefined) {
      const existing = records.get(primary);
      // If the primary sheet is absent, do not turn a reprint into a new project.
      if (!existing) continue;
      existing.projectCode += `,個票${number}`;
      existing.evidence.push(evidence(input, block, start));
      existing.warnings.push(`個票${number}「${name}」は同一市事業の大学別記載として統合。大学別の経費を合算していません。`);
      continue;
    }
    const item = project(input, `個票${number}`, name, 2018, block, start);
    item.department = department;
    item.warnings.push('大学連携施策の行財政最適化支援報告書の事業個票を部分構造化。評価年度は報告書の平成30年度、事業対象年度は複数年度のため未設定。個票の目的・概要・成果・課題・今後の方向性は全文の原文根拠に保持しています。');
    item.warnings.push('経費欄は大学提携に係る部分経費であり総事業費ではありません。平成29年度実績と平成30年度見込を原文に保持し、見込を予算・決算として分類せず、金額集計・数値指標・評価評点は保留しています。');
    records.set(number, item);
  }
  return [...records.values()];
}
