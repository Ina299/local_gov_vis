import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

export function extractTateyama(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '16323' || input.sourceId !== '73cee9f56b426a0d506da747') return [];
  const starts = [...input.text.matchAll(/^令和[6６]年度 主要施策事業/gm)];
  const result: ProjectEvaluation[] = [];
  for (let i = 0; i < starts.length; i++) {
    if (input.truncated && i === starts.length - 1) continue;
    const start = starts[i].index!;
    const remaining = input.text.slice(start, starts[i + 1]?.index ?? input.text.length);
    const footer = remaining.match(/\n-\s*[0-9０-９]+\s*-/);
    if (!footer) continue;
    const raw = remaining.slice(0, footer.index! + footer[0].length);
    let name = raw.match(/^事務事業名 (.+)$/m)?.[1];
    if (!name || !raw.includes('５ 点検・評価')) continue;
    if (name.startsWith('（読解力向上') && raw.includes('学力向上事業 新規・継続')) name = `学力向上事業${name.split(' 継続')[0]}`;
    const record = project(input, `主要施策事業p${footer[0].normalize('NFKC').replace(/\D/g, '')}`, name.normalize('NFKC'), 2024, raw, start);
    record.evaluatedFiscalYear = 2024;
    record.department = raw.match(/^所 属 (.+) 担当係 (.+)$/m)?.slice(1).join(' ') ?? null;
    const costs = raw.match(/令和[2２]年度 令和[3３]年度 令和[4４]年度 令和[5５]年度 令和[56５６]年度\n予 *算\s+決算額 決算額 決算額 決算額 見込額\n(?:図書館費 )?事業費（千円） ([0-9,]+) ([0-9,]+) ([0-9,]+) ([0-9,]+) ([0-9,]+)/);
    if (costs) for (let j = 0; j < 4; j++) record.amounts.push({ kind: 'actual', fiscalYear: 2020 + j,
      amountYen: Number(costs[j + 1].replaceAll(',', '')) * 1000, rawValue: costs[j + 1], rawUnit: '千円',
      evidence: evidence(input, costs[0], start + costs.index!) });
    const analysis = raw.match(/５ 点検・評価\n([\s\S]*?)\n-\s*/);
    if (analysis) record.outcomes = analysis[1].trim();
    const sectionPatterns = [
      ['活動指標', /３ 活動指標の実績\n([\s\S]*?)４ 成果指標等の実績/],
      ['成果指標', /４ 成果指標等の実績\n([\s\S]*?)(?=コスト指標|５ 点検・評価)/],
    ] as const;
    for (const [label, pattern] of sectionPatterns) {
      const section = raw.match(pattern);
      if (!section || !section[0].includes('実績見込')) continue;
      let previousWasComplete = false;
      for (const [lineIndex, line] of section[1].split('\n').entries()) {
        const previous = section[1].split('\n')[lineIndex - 1] ?? '';
        const hasUnambiguousStart = previousWasComplete || /^実 績/.test(previous);
        previousWasComplete = false;
        const row = line.match(/^[①②③④⑤] (\S+) (\S+) (\S+) ([0-9,.%]+|-) ([0-9,.%]+|-) ([0-9,.%]+|-) ([0-9,.%]+|-) ([0-9,.%]+|-)$/);
        if (!row || !hasUnambiguousStart) continue;
        previousWasComplete = true;
        if (row[7] === '-' || row[1].endsWith('の')) continue;
        record.indicators.push({ name: `【${label}】${label === '活動指標' ? `${row[1]}／${row[2]}` : row[1]}`,
          fiscalYear: 2023, target: null, actual: row[7], unit: row[3],
          evidence: evidence(input, section[0], start + section.index!) });
      }
    }
    record.warnings.push('令和6年度の費用・指標は見込額/実績見込のため確定実績へ未採用。決算は令和2〜5年度、構造化した指標実績は令和5年度のみ。');
    record.warnings.push('原典の個票ページを事業識別子に採用。折返しによって名称境界が明確でない指標は未採用。');
    if (name.includes('ＩＣＴ')) record.warnings.push('経費表の最終年度が令和5年度と重複表記されるが修正を推測せず、最終見込列を除外。');
    result.push(record);
  }
  return result;
}
