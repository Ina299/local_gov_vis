import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

const SOURCES = new Set(['6c150492b4c9efb9e907f56e', '8c81d0d29b2bc97031cfc38b']);
const yearOf = (era: string, year: string) => (era.normalize('NFKC') === 'R' ? 2018 : 1988) + (year === '元' ? 1 : Number(year.normalize('NFKC')));
const numeric = (value: string) => Number(value.normalize('NFKC').replaceAll(',', ''));

/** Individually titled internal evaluations only; external reprints and summary lists are excluded. */
export function extractShimanto(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '39412' || !SOURCES.has(input.sourceId)) return [];
  // The infrastructure sheet is also a boundary, but is not parsed as a municipal project sheet.
  const headers = [...input.text.matchAll(/^(?:R([３４])事(?:務事業内部評価シート（事後評価）|後評価シート)|社会資本総合整備計画の評価シート（事後評価）)\n/gm)];
  const result: ProjectEvaluation[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (!header[1]) continue;
    const start = header.index!;
    const block = input.text.slice(start, headers[i + 1]?.index ?? input.text.length);
    // A cut-off source may supply complete preceding sheets. Never include its last unbounded sheet.
    if (input.truncated && i === headers.length - 1) continue;
    const evaluationYear = 2018 + Number(header[1].normalize('NFKC'));
    const assessed = /事務事業のR([０-９\d]+)年度の実績に対する評価/.exec(block);
    const title = /^事業名 (.+?) 所管 (.+)$/m.exec(block);
    const complete = /\n-\s*\d+\s*-\s*$/.test(block) && (evaluationYear === 2021 ? block.includes('自 己 評 価') : block.includes('待される効果'));
    if (!assessed || !title || !complete || !block.includes('◆KPI（重要業績評価指標）')) continue;
    const evaluatedFiscalYear = 2018 + Number(assessed[1].normalize('NFKC'));
    const code = `name:${title[1]}`;
    const key = `${code}:${evaluationYear}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const record = project(input, code, title[1], evaluationYear, block, start);
    record.department = title[2];
    record.evaluatedFiscalYear = evaluatedFiscalYear;
    record.warnings.push('事業コード未掲載のため名称由来の識別キーを使用。計画額を予算額と見なさず、費用は実績欄のみ抽出。KPIは自治体の表記を保持し、活動指標・成果指標に推定分類していません。');
    if (input.truncated) record.warnings.push('資料末尾は切詰め。後続の個票見出しまで揃った個票だけを採用。');
    const costTable = /◆(?:R[０-９\d]+)?計画額と実績額の比較（単位：千円）\n([\s\S]*?)(?=◆KPI)/.exec(block);
    if (costTable) {
      record.evidence.push(evidence(input, costTable[0], start + costTable.index));
      const actual = /^実績((?: [\d,]+){2,7})$/m.exec(costTable[0]);
      const columns = actual?.[1].trim().split(/ +/).map(numeric);
      // Total is the first column; require reconciliation against the financial-source columns.
      // Blank, signed, wrapped, or inconsistent rows are retained as evidence, never guessed.
      if (actual && columns && columns[0] === columns.slice(1).reduce((a, b) => a + b, 0)) {
        record.amounts.push({ kind: 'actual', fiscalYear: evaluatedFiscalYear, amountYen: columns[0] * 1000,
          rawValue: actual[1].trim().split(/ +/)[0], rawUnit: '千円', evidence: evidence(input, costTable[0], start + costTable.index) });
      }
    }
    const kpiStart = block.indexOf('KPIの内容 単位 当初値 目標値 現状値');
    const kpiEnd = block.indexOf('\n◆', kpiStart);
    if (kpiStart >= 0 && kpiEnd > kpiStart) {
      const kpi = block.slice(kpiStart, kpiEnd);
      // Three explicit year/value pairs are required. Missing baseline years or cells are not shifted.
      const cell = '([RＲHＨ])([０-９\\d元]+) ([△▲]? ?[０-９\\d,.，．]+|[ー－-])';
      const row = new RegExp(`^(.+?) ([^ \\n]+) ${cell} ${cell} ${cell}(?: [０-９\\d.]+[%％])?$`, 'gm');
      for (const match of kpi.matchAll(row)) {
        const targetYear = yearOf(match[6], match[7]);
        const actualYear = yearOf(match[9], match[10]);
        const source = evidence(input, match[0], start + kpiStart + match.index!);
        const common = { name: `KPI／${match[1]}`, unit: match[2], evidence: source };
        if (targetYear === actualYear) record.indicators.push({ ...common, fiscalYear: actualYear, target: match[8], actual: match[11] });
        else {
          record.indicators.push({ ...common, fiscalYear: targetYear, target: match[8], actual: null });
          record.indicators.push({ ...common, fiscalYear: actualYear, target: null, actual: match[11] });
        }
      }
    }
    // The cached PDF text interleaves vertically centred labels and prose. Preserve a whole
    // labelled evaluation region instead of manufacturing sentence/column boundaries.
    const narrativeStart = evaluationYear === 2021 ? block.indexOf('◆確認事項') : block.indexOf('実 施 手 段');
    const narrativeEnd = evaluationYear === 2021 ? block.indexOf('今後見込まれる', narrativeStart) : costTable?.index ?? -1;
    if (narrativeStart >= 0 && narrativeEnd > narrativeStart) {
      const raw = block.slice(narrativeStart, narrativeEnd).trim();
      record.outcomes = raw;
      record.evidence.push(evidence(input, raw, start + narrativeStart));
      record.warnings.push('効果欄は確認事項・取組状況を含む評価記述の原文。中央配置の見出しで文章が分断されるため、成果の文章だけへの分離はしていません。');
    }
    if (evaluationYear === 2021) {
      const scale = 'A：拡充 B：継続 C：縮小 D：休廃止 －：事業完了';
      const tail = block.slice(block.lastIndexOf('今後の課題、方針等'));
      const rating = /(?:^|\n)([A-DＡ-Ｄ―－])\n/.exec(tail);
      if (rating && tail.includes(scale)) record.ratings.push({ kind: 'self', label: '自己評価', value: rating[1], scale,
        evidence: evidence(input, tail, start + block.lastIndexOf('今後の課題、方針等')) });
    } else {
      const direction = /◆今後の方向性（該当箇所に○）\n([^\n]*)\n([^\n]*)/.exec(block);
      const selected = direction?.[0].match(/○ (改善して継続|現状のまま継続|休廃止|終 了)/g) ?? [];
      if (direction && selected.length === 1) record.ratings.push({ kind: 'self', label: '今後の方向性', value: selected[0].slice(2), scale: null,
        evidence: evidence(input, direction[0], start + direction.index) });
    }
    result.push(record);
  }
  return result;
}
