import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** Only numbered full assessment sheets; the report's introductory list is excluded. */
export function extractOtaki(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '12441' || input.format !== 'pdf') return [];
  const starts = [...input.text.matchAll(/^事務事業№ (\d+)\n大多喜町事務事業評価表\n/gm)];
  const rows: ProjectEvaluation[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < starts.length; i++) {
    if (i === starts.length - 1 && input.truncated) continue;
    const start = starts[i].index!;
    const block = input.text.slice(start, starts[i + 1]?.index ?? input.text.length);
    const year = block.match(/令和 (\d+) 年度事業分（ 事後 評価）/);
    const name = block.match(/^事務事業名 (.+?) 予算措置 /m)?.[1];
    if (!year || !name || !block.includes('１．事業内容') || !block.includes('３．指標の推移') || !block.includes('４．評価') || !block.includes('５．評価結果による今後の方針、改革改善') || !/今後の方針 [①②③④⑤⑥]事業/.test(block)) continue;
    const fiscalYear = 2018 + Number(year[1]);
    const code = `${fiscalYear}:no-${starts[i][1]}`;
    if (seen.has(code)) throw new Error(`Duplicate Otaki assessment number: ${code}`);
    seen.add(code);
    // The printed year describes the assessed fiscal year, not a publication cycle.
    const item = project(input, code, name.trim(), null, block, start);
    item.evaluatedFiscalYear = fiscalYear;
    item.department = block.match(/課 名 ([^\n]+)/)?.[1].replace(/\s+/g, '') ?? null;
    const assessmentStart = block.indexOf('４．評価');
    const assessmentEnd = block.indexOf('５．評価結果', assessmentStart);
    const assessment = block.slice(assessmentStart, assessmentEnd);
    for (const match of assessment.matchAll(/^(目的妥当性|有効性|効率性|公平性|優先性|総 合) ([0-9]+)(?= |\n)/gm)) {
      item.ratings.push({kind: 'self', label: match[1], value: match[2], scale: null,
        evidence: evidence(input, match[0], start + assessmentStart + match.index!)});
    }
    const sections = [
      ['活動指標', '◆手段（', '◆成果（'],
      ['成果指標', '◆成果（', '２．事業費推移'],
    ];
    for (const [label, begin, end] of sections) {
      const from = block.indexOf(begin); const to = block.indexOf(end, from);
      if (from < 0 || to <= from) continue;
      const section = block.slice(from, to);
      for (const match of section.matchAll(/[①②③] ([^\n]+)/g)) {
        // Indicator names only: lost cells prevent safe alignment to annual values.
        item.indicators.push({name: `【${label}】${match[0][0]}${label === '成果指標' ? '（求める結果）' : ''}${match[1].trim()}`, fiscalYear: null,
          target: null, actual: null, unit: null, evidence: evidence(input, section, start + from)});
      }
    }
    item.warnings.push('年度は「年度事業分（事後評価）」の対象年度。評価実施年度は未確定。総事業費の予算・決算・見込み区分は明示されず数値未転記。活動指標と求める成果指標は名称のみ保持し、年別値は空欄・折返しの位置を推測せず未設定。');
    rows.push(item);
  }
  return rows;
}
