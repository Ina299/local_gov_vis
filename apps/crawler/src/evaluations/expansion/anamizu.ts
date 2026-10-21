import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

export function extractAnamizu(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '17461' || input.format !== 'html' || input.truncated || !input.text.startsWith('高度無線環境整備推進事業（令和2年度）における中間評価結果について')) return [];
  const start = input.text.indexOf('事業概要\n');
  const assessment = input.text.indexOf('\n評価\n', start);
  if (start < 0 || assessment < 0) return [];
  const raw = input.text.slice(start);
  const r = project(input, '高度無線環境整備推進事業', '高度無線環境整備推進事業', null, raw, start);
  r.projectCode = null;
  r.evaluatedFiscalYear = input.text.includes('令和7年度（3月末時点）') ? 2025 : null;
  r.activities = input.text.slice(start + '事業概要\n'.length, input.text.indexOf('目標達成状況', start)).trim();
  r.outcomes = input.text.slice(assessment + '\n評価\n'.length).trim();
  const indicator = input.text.match(/家庭用Wi-Fi設置数\n524箇所（令和5年度）\n176箇所\n171箇所\n184箇所/);
  if (indicator) for (const [i, actual] of ['176','171','184'].entries()) r.indicators.push({ name: '【目標達成状況】家庭用Wi-Fi設置数', fiscalYear: 2023 + i, target: i === 0 ? '524' : null, actual, unit: '箇所', evidence: evidence(input, indicator[0], indicator.index!) });
  r.warnings.push('令和2～3年度整備事業の中間評価。整備年度と評価対象実績年度を区別。令和8年度見直し目標367箇所を過年度の目標に遡及して適用していません。費用は本文に記載なし。');
  return [r];
}
