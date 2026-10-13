import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** R6 action-plan individual sheets. Summary policy pages are never separate records. */
function extractOneIkoma(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '29209' || input.format !== 'pdf' || input.truncated) return [];
  const headers = [...input.text.matchAll(/^令和６年度アクションプラン 事業評価シート\n/gm)];
  const results: ProjectEvaluation[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index!;
    const raw = input.text.slice(start, headers[i + 1]?.index ?? input.text.length);
    const identity = raw.match(/^事 業 名 No\. (\d+) ([^\n]+)\n事 業 区 分/m);
    const policy = raw.match(/^施 策 体 系 (\d+) ([^\n]+?) 戦 略 的 施 策/m);
    if (!identity || !policy || !raw.includes('４ 事業の成果・評価') || !raw.includes('今後の取組方針')) continue;
    // No. restarts by policy. Its policy prefix is part of the stable identity.
    const code = `${policy[1]}-${identity[1]}`;
    if (seen.has(code)) throw new Error(`Duplicate Ikoma policy/project number in one source: ${code}`);
    seen.add(code);
    const item = project(input, code, identity[2], 2024, raw, start);
    item.evaluatedFiscalYear = 2024;
    item.department = raw.match(/担 当 課 (.+?) 関 係 課/)?.[1] ?? null;
    const cost = raw.match(/^R５決算 R６予算現額 R６決算（見込） R７予算\n事業費（千円） ([\d,]+) ([\d,]+) ([\d,]+) ([\d,]+)(?:\n|$)/m);
    if (cost) for (const [column, kind, year] of [[1,'actual',2023],[2,'budget',2024],[4,'budget',2025]] as const) {
      item.amounts.push({ kind, fiscalYear: year, amountYen: Number(cost[column].replaceAll(',', ''))*1000,
        rawValue: cost[column], rawUnit:'千円', evidence:evidence(input,cost[0],start+cost.index!) });
    }
    const outcome = raw.match(/^「めざす状態」実現に[\s\S]*?(?=\nKPI 指標１ 指標２)/m);
    if (outcome && outcome[0].replace('「めざす状態」実現に', '').replace('寄与したこと（事業の成果）', '').trim()) {
      item.outcomes = outcome[0];
      item.evidence.push(evidence(input,outcome[0],start+outcome.index!));
    }
    // Exactly one name and one target/actual token; multiple-column KPI tables stay in evidence.
    const kpi = raw.match(/^指標名（単位） ([^\s]+)\n目標値 ([^\s]+)\n実績値 ([^\s]+)\n/m);
    if (kpi) item.indicators.push({ name:`【KPI・活動成果区分未確認】${kpi[1]}`, fiscalYear:2024,
      target:kpi[2],actual:kpi[3],unit:null,evidence:evidence(input,kpi[0],start+kpi.index!) });
    const direction = raw.match(/^今後の取組方針 (現状維持|拡大|縮小|廃止|終了|見直し|統合)(?= |\n)/m);
    if (direction) item.ratings.push({kind:'self',label:'今後の取組方針',value:direction[1],scale:null,evidence:evidence(input,direction[0],start+direction.index!)});
    item.warnings.push('事業番号は施策体系番号とNo.を結合。R6決算（見込）は確定決算に変換せず原文に保持。事業費表4列が全て明示数値の場合のみR5決算/R6予算現額/R7予算を構造化。KPIは単一列のみで、活動・成果区分を推測しません。');
    results.push(item);
  }
  return results;
}


/** Repeated sheets in strategic-policy bundles are one project, with all source evidence retained. */
export function extractIkoma(input: CachedInput, inputs?: CachedInput[]): ProjectEvaluation[] {
  if (!inputs) return extractOneIkoma(input);
  const groups = new Map<string, { owner: string; record: ProjectEvaluation; conflicts: Set<string> }>();
  for (const source of [...inputs].sort((a, b) => a.sourceId.localeCompare(b.sourceId))) {
    for (const record of extractOneIkoma(source)) {
      const key = JSON.stringify([record.projectCode, record.projectName, record.evaluationYear]);
      const previous = groups.get(key);
      if (!previous) { groups.set(key, { owner: source.sourceId, record, conflicts: new Set() }); continue; }
      const retained = previous.record;
      retained.evidence.push(...record.evidence);
      const conflicting = previous.conflicts;
      for (const amount of record.amounts) {
        if (conflicting.has(`${amount.kind}:${amount.fiscalYear}`)) continue;
        const same = retained.amounts.find(entry => entry.kind === amount.kind && entry.fiscalYear === amount.fiscalYear);
        if (same && (same.amountYen !== amount.amountYen || same.rawUnit !== amount.rawUnit)) conflicting.add(`${amount.kind}:${amount.fiscalYear}`);
        else if (!same) retained.amounts.push(amount);
      }
      if (conflicting.size) {
        retained.amounts = retained.amounts.filter(amount => !conflicting.has(`${amount.kind}:${amount.fiscalYear}`));
        retained.warnings.push(`再掲資料間で金額が競合するため該当項目を保留: ${[...conflicting].join(', ')}`);
      }
      for (const indicator of record.indicators) if (!retained.indicators.some(entry => entry.name === indicator.name && entry.fiscalYear === indicator.fiscalYear && entry.target === indicator.target && entry.actual === indicator.actual)) retained.indicators.push(indicator);
      for (const rating of record.ratings) if (!retained.ratings.some(entry => entry.label === rating.label && entry.value === rating.value)) retained.ratings.push(rating);
      if (record.outcomes && retained.outcomes !== record.outcomes) retained.outcomes = [...new Set([retained.outcomes, record.outcomes].filter(Boolean))].join('\n\n');
      retained.warnings = [...new Set([...retained.warnings, ...record.warnings, '同一施策体系番号・事業番号・名称・評価年度の再掲個票を統合。費用を合算せず、全資料の証拠を保持。'])];
    }
  }
  return [...groups.values()].filter(group => group.owner === input.sourceId).map(group => group.record);
}
