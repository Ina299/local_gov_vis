import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

/**
 * 玉名市 令和07年度事務ふりかえり結果一覧表（対象：令和06年度事務事業）。
 * 抽出テキストは列が大きく崩れているため、空行の直後に「事務事業の名称」1行・「事務事業コード」・「事業期間」が
 * 連続して並ぶ行だけを事業名とコードの組として採用する。所管課・投入コスト・成果指標・次年度の方向性は行対応が確定しないため転記しない。
 */
const SOURCE = '4470619c4b2f9109627b3dac';
const HEADER = '令和07年度事務ふりかえり結果一覧表\n対象：令和06年度事務事業';
const ROW = /\n\n([^\n\s、]{4,}事業)\n(\d{3}-\d{2})\n((?:[ＨHR]\d+|\d{4})年度～[^\n]*)\n/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== SOURCE) return [];
  const t = input.text, head = t.indexOf(HEADER);
  if (head !== 0) return [];
  const rows = [...t.matchAll(ROW)];
  const names = rows.map(m => m[1]), codes = rows.map(m => m[2]);
  return rows.filter(m => names.filter(n => n === m[1]).length === 1 && codes.filter(c => c === m[2]).length === 1
    && t.split(`\n${m[2]}\n`).length === 2).map(m => {
    const raw = m[0].slice(2, -1), start = m.index! + 2;
    const p = project(input, m[2], m[1], 2025, raw, start);
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, HEADER, head));
    p.warnings.push('一覧表の抽出テキストは列が崩れているため、事業名・事務事業コード・事業期間が連続する行のみ採用。所管課・投入コスト・成果指標・次年度の方向性は行の対応が確定しないため転記していません。');
    return p;
  });
}

export const tamanaEntries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '43206': { extract, scope: '令和07年度事務ふりかえり結果一覧表（令和06年度事務事業）のうち、事業名・事務事業コード・事業期間が抽出テキスト上で連続し対応が確定する事業のみ（名称とコードのみ）。所管課・コスト・成果指標・方向性は列崩れのため対象外。' },
};
export const entries = tamanaEntries;
