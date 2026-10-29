import { COVERAGE_COLORS, COVERAGE_LEVELS, type CoverageLabel } from './evaluationCoverage';

/**
 * 政党の区分色（地図の「当選者の政党」）。色は意味（党）にだけ使う。
 * 公表資料の届出政党名をそのまま鍵にする。載っていない党・無所属は灰色
 */
export const PARTY_COLORS: Record<string, string> = {
  自由民主党: '#d6453d',
  立憲民主党: '#1f5fbf',
  日本維新の会: '#2e9e6c',
  公明党: '#e8a33d',
  国民民主党: '#e6c229',
  日本共産党: '#b03c8a',
  参政党: '#e07a1f',
  れいわ新選組: '#e65bb0',
  社会民主党: '#4db8d8',
  中道改革連合: '#7a5ac8',
  希望の党: '#5fa86b',
  日本のこころ: '#8c6d3f',
  無所属: '#7d8186',
};
export const PARTY_OTHER_COLOR = '#aeb2b8';

export function partyColor(party: string | null): string | null {
  if (party === null) return null;
  return PARTY_COLORS[party] ?? PARTY_OTHER_COLOR;
}

/** 当選者の交代の区分色（同じ＝薄い灰、交代（同党）＝琥珀、政党交代＝紫） */
export const WINNER_CHANGE_COLORS: Record<string, string> = {
  同じ当選者: '#d9dde3',
  '当選者が交代（同じ党）': '#e8a33d',
  政党が交代: '#6d4fc2',
};

/** 区分の指標の値 → 色 */
export function categoryColor(metricKey: string, label: string | null): string | null {
  if (label === null) return null;
  if (metricKey === 'electionWinnerChange') return WINNER_CHANGE_COLORS[label] ?? PARTY_OTHER_COLOR;
  if (metricKey === 'evaluationCoverage') return COVERAGE_COLORS[label as CoverageLabel] ?? PARTY_OTHER_COLOR;
  return partyColor(label);
}

/** 区分に順序がある指標の並び（凡例を件数順でなくこの順に出す）。順序のない区分は null */
export function categoryOrder(metricKey: string): readonly string[] | null {
  return metricKey === 'evaluationCoverage' ? COVERAGE_LEVELS : null;
}
