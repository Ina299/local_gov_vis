import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { type Entry, uniqueBy } from './m1-util';

// ---------------------------------------------------------------- 09301 上三川町 総合計画実施計画事業 評価結果（令和2〜4年度実績）
const SCALE = 'Ａ：まちづくりに対して有効である／Ｂ：まちづくりに対して有効であるが、改善の余地がある／Ｃ：まちづくりに対して有効性が少ない（評価委員会評価・3段階の単年度評価）';
const SCORE_SCALE = '各評価委員によるＡ、Ｂ、Ｃの３段階評価を、Ａを５点、Ｂを３点、Ｃを１点として算出した平均点を委員会の評価（Ａ：平均４点以上／Ｂ：平均４点未満３点以上／Ｃ：平均３点未満）';
const DOCS: Record<string, { head: string; basis: string; fy: number; list: RegExp; scored: boolean }> = {
  '4d49acb090fe1aeee29e5965': { head: '令和２年度\n\n総合計画実施計画\n事業評価結果について', basis: '「評価委員会評価」は、令和７年度に目標を達成するため、令和２年度の実績がどの\n程度進捗しているかを、下の３段階で評価したものです。',
    fy: 2020, list: /\n(\d+)(?:\n\n| )([^\n]+?)\n\n([ＡＢＣ])\n/g, scored: false },
  'ea0dc97df237ac79d1f56e56': { head: '令和３年度総合計画\n実施計画事業等評価結果', basis: '「評価委員会評価」は、令和７年度に目標を達成するため、令和３年度の実績がどの\n程度進捗しているかを、下の３段階で評価したものです。',
    fy: 2021, list: /\n(\d+)\n\n([^\n]+)\n\n(\d\.\d\d)\n\n([ABC])\n/g, scored: true },
  'a1f83692535d63ce738c171d': { head: '上三川町第７次総合計画\n－後期基本計画－\n\n令和４年度実施計画事業\n評価結果等について', basis: '「評価委員会評価」は、令和７年度に目標を達成するため、令和４年度の実績がど\nの程度進捗しているかを、下の３段階で評価したものです。',
    fy: 2022, list: /\n(\d+)\n\n([^\n]+)\n\n(\d\.\d\d)\n\n([ABC])\n/g, scored: true },
};

function extractKaminokawa(input: CachedInput): ProjectEvaluation[] {
  const doc = DOCS[input.sourceId];
  const t = input.text;
  if (input.municipalityCode !== '09301' || !doc || !t.startsWith(doc.head) || !t.includes(doc.basis)) return [];
  const sheetsAt = [...t.matchAll(/事業評価シート\n/g)].map(m => m.index!);
  if (!sheetsAt.length) return [];
  const firstSheet = sheetsAt[0], out: ProjectEvaluation[] = [];
  for (const row of t.slice(0, firstSheet).matchAll(doc.list)) {
    const name = row[2].trim();
    // The list row is attributed to the sheet whose 事業 field carries the same name, only when exactly one sheet does.
    const hits = [...t.matchAll(new RegExp(`\\n事業\\n\\n${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n`, 'g'))].filter(m => m.index! > firstSheet);
    if (hits.length !== 1) continue;
    const at = hits[0].index! + 1, start = Math.max(...sheetsAt.filter(s => s < at)), end = sheetsAt.find(s => s > at) ?? t.length;
    const sheet = t.slice(start, end);
    const p = project(input, name, name, null, hits[0][0].slice(1, -1), at);
    p.projectCode = null;
    p.evaluatedFiscalYear = doc.fy;
    p.evidence.push(evidence(input, doc.head, 0), evidence(input, doc.basis), evidence(input, row[0].slice(1, -1), row.index! + 1));
    const dept = [...sheet.matchAll(/担当課\n\n(\S+)\n\n係名/g)];
    if (dept.length === 1) { p.department = dept[0][1]; p.evidence.push(evidence(input, dept[0][0], start + dept[0].index!)); }
    const rating = doc.scored ? row[4] : row[3];
    p.ratings.push({ kind: 'external', label: '評価委員会評価（3段階・単年度）', value: rating, scale: SCALE, evidence: evidence(input, row[0].slice(1, -1), row.index! + 1) });
    if (doc.scored) p.ratings.push({ kind: 'external', label: '評価委員会 平均点', value: row[3], scale: SCORE_SCALE, evidence: evidence(input, row[0].slice(1, -1), row.index! + 1) });
    p.warnings.push(`上三川町 総合計画実施計画事業 評価結果（令和${'０１２３４５６７８９'[doc.fy - 2018]}年度実績）。事業名・評価委員会評価は冒頭の事業一覧の行から、担当課は事業名が一致する事業評価シート（1枚のみ一致する場合）の担当課欄から収録。`,
      '事業評価シートの指標（目標値・実績値）と定性評価（必要性・効率性・有効性）は抽出テキストで表の列が分離・混在しているため未収録。事業費の記載はない。評価実施年度は本文に明示がないため未設定。');
    out.push(p);
  }
  // Same name in one report (e.g. 地域おこし協力隊事業 by two departments) is kept only when the departments are known to differ.
  return uniqueBy(out, p => `${p.projectName}|${p.department ?? '?'}`).filter(p => p.department || out.filter(q => q.projectName === p.projectName).length === 1);
}

export const kaminokawaEntries: Record<string, Entry> = {
  '09301': {
    extract: input => extractKaminokawa(input),
    scope: '総合計画実施計画事業の評価結果（令和2〜4年度実績）から、事業一覧の事業名・総合計画等評価委員会の3段階評価（令和3・4年度分は平均点も）と、事業評価シートの担当課を構造化。シート内の指標・定性評価は列崩れのため対象外。令和5年度の施策評価と公営企業会計の収支表は対象外。',
  },
};
