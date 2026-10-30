/**
 * 東京都 「政策評価・事業評価・グループ連携事業評価の取組」（予算案資料の付属冊子）の事業評価の主な評価事例。
 * 各事例の見出し行「【所管局】事業名 ～ 見直しの観点 ～」から事業名と所管局を収録する（局が1つの場合のみ所管として記録）。
 * 事例ごとの予算額（「⑧○億円（⑦○億円）」等）は抽出テキストで数字が欠落している資料があり、
 * 数字が残る資料でも見出しとの対応が抽出テキストの並びで確定しないため収録しない。
 * 政策評価の事業ユニット一覧（ユニット単位）、統計的手法の分析事例、HTML の案内ページは対象外。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { type Entry } from '../../evaluations/expansion/batch9/i1-util';

const CODE = '13000';
const ORG = /^(?:[^・\s]+(?:局|庁|本部|室|委員会|事務局))(?:・[^・\s]+(?:局|庁|本部|室|委員会|事務局))*$/;

function extractOne(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== CODE || input.format !== 'pdf' || !input.text.includes('事業評価の取組（主な評価事例）')) return [];
  const t = input.text;
  const out: ProjectEvaluation[] = [];
  const seen = new Set<string>();
  for (const m of t.matchAll(/(?<=^|\n)【([^】\n]+)】([^\n]+)(?=\n)/g)) {
    const org = m[1], rest = m[2];
    if (!ORG.test(org)) continue;
    const name = rest.split(/\s*～/)[0].trim();
    if (name.length < 4 || /[：:]/.test(name) || /^\d/.test(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    const r = project(input, name, name, null, m[0], m.index!);
    if (!org.includes('・')) { r.department = org; r.evidence.push(evidence(input, `【${org}】`, m.index!)); }
    else r.warnings.push('複数局の共同事例のため所管局は未収録。');
    r.warnings.push('事業評価の主な評価事例の見出し。予算額は数字の欠落または見出しとの対応が確定しないため未収録。評価年度は資料に明記がないため未設定。');
    out.push(r);
  }
  return out;
}

export const entries: Record<string, Entry> = {
  [CODE]: {
    scope: '政策評価・事業評価・グループ連携事業評価の取組（予算案付属資料）の「事業評価の取組（主な評価事例）」各事例の見出しから事業名・所管局のみ。金額・評価結果は対象外（数字の欠落・対応未確定）。全事業の一覧ではない。',
    extract: (input) => extractOne(input),
  },
};
