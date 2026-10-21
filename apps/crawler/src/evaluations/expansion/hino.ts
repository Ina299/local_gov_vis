import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** Independent project-level external opinions, explicitly not complete assessment sheets. */
export function extractHino(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13212' || input.format !== 'pdf' || input.truncated || !input.text.includes('平成 24 年度日野市行政評価システム') || !input.text.includes('平成 23 年度の 31 事務事業を評価')) return [];
  const tableStart = input.text.indexOf('（別表１）平成 24 年度');
  const tableEnd = input.text.indexOf('人件費を含みません。', tableStart);
  const end = input.text.indexOf('\n５ 市民評価委員会からの提案\n', tableEnd);
  if (tableStart < 0 || tableEnd < 0 || end < 0) return [];
  const table = input.text.slice(tableStart, tableEnd + '人件費を含みません。'.length);
  const body = input.text.slice(tableEnd, end);
  const headers = [...body.matchAll(/^事業番号 事務事業名 所管部署 ※頁\n/gm)];
  const categories = [...body.matchAll(/^[ⅠⅡⅢⅣⅤⅥ] (.+)（総合評価：([Ａ-Ｇ]) [^\n]+\n/gm)];
  const rows: ProjectEvaluation[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index!;
    const next = headers[i + 1]?.index ?? body.length;
    const category = categories.filter(m => m.index! < start).at(-1);
    const nextCategory = categories.find(m => m.index! > start && m.index! < next);
    const block = body.slice(start, nextCategory?.index ?? next);
    let identity = block.match(/^([0-9]+) (\S+) (\S+) ([0-9]+)\n評価者意見の概要\n/m);
    let department: string | undefined;
    if (!identity) {
      // This source wraps the department around the project line for no. 244.
      const wrapped = block.match(/^子ども家庭支援\n(244) (親の子育て力向上支援事業経費) (5)\nセンター\n評価者意見の概要\n/m);
      if (wrapped) { identity = wrapped; department = '子ども家庭支援センター'; }
    }
    if (!identity || !category) continue;
    const code = identity[1]; const name = identity[2];
    if (seen.has(code)) throw new Error(`Duplicate Hino opinion: ${code}`);
    seen.add(code);
    const absolute = tableEnd + start;
    const item = project(input, code, name, 2012, block, absolute);
    item.department = department ?? identity[3];
    item.evaluatedFiscalYear = 2011;
    item.ratings.push({kind: 'external', label: '市民評価委員会 総合評価', value: `${category[2]} ${category[1]}`,
      scale: null, evidence: evidence(input, category[0], tableEnd + category.index!)});
    // Keep the external opinion's own label, without recasting recommendations as achieved outcomes.
    item.ratings.push({kind: 'external', label: '評価者意見の概要', value: block.slice(block.indexOf('評価者意見の概要\n') + '評価者意見の概要\n'.length).replace(/\n[0-9]+\s*$/, '').trim(),
      scale: null, evidence: evidence(input, block, absolute)});
    const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const amountLine = table.match(new RegExp(`(?:^| )${code} ${escape(name)} ([^\\n]+)$`, 'm'));
    const amount = amountLine?.[1].match(/(?:^| )([0-9][0-9,]*)$/)?.[1];
    if (amount && table.includes('事業費は平成 23 年度決算額及び正職員人件費相当額を合算したもの。')) {
      item.amounts.push({kind: ['224','477','369'].includes(code) ? 'actual' : 'fullCost', fiscalYear: 2011,
        amountYen: Number(amount.replace(/,/g, '')) * 1000, rawValue: amount, rawUnit: '千円',
        evidence: evidence(input, table, tableStart)});
    }
    item.warnings.push('市民評価報告の事業別意見を部分構造化したレコードであり、完全な事務事業評価個票ではありません。概要一覧行だけの事業は追加していません。評価者意見は第三者の評価・提言であり実現した成果とは区別。');
    item.warnings.push(['224','477','369'].includes(code) ? '事業費は原典注記による平成23年度決算額（人件費を含まない例外事業）。' : '事業費は原典注記による平成23年度決算額と正職員人件費相当額の合算。');
    rows.push(item);
  }
  return rows;
}
