import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project, stableId } from '../shared';
import { amount, num, type Entry } from '../batch9/i1-util';
import { municipalityRecords } from '../batch11/k0-util';

// ---------------------------------------------------------------- 24441 多気町（地方創生臨時交付金 実績報告（効果検証））
// 行: 実施計画計上№／交付金対象事業名／事業概要（事業始期・終期を含む）／総事業費（実績額）／事業費（本町実績額）／左記の内臨時交付金／担当課／事業実施状況／効果検証（評価）
interface Doc { fy: number; title: string; columns: 3 | 2 }
const TAKI_DOCS: Record<string, Doc> = {
  'c903d1795d6a51a335764e61': { fy: 2020, columns: 3, title: '◇令和２年度\n\n新型コロナウイルス感染症対応地方創生臨時交付金活用事業の効果検証' },
  'a9b85a4a1fa063da4d1e9b45': { fy: 2021, columns: 3, title: '令和３年度\n実施\n計画\n計上\n№\n\n新型コロナウイルス感染症対応地方創生臨時交付金実績報告（効果検証）' },
  'ecadea162086ae8b7268083b': { fy: 2022, columns: 3, title: '令和４年度\n実施\n計画\n計上\n№\n\n新型コロナウイルス感染症対応地方創生臨時交付金実績報告（効果検証）' },
  // 令和７年度版は「総事業費（円）／左記の内臨時交付金（円）」の2列。令和５年度物価高騰分・令和６年度版は事業名と金額の並びが崩れているため、令和５年度新型コロナ分は事業名の折り返し・分割行・列崩れで採用できる行がないため対象外。
  'f574a3600e1f1a9227a89523': { fy: 2025, columns: 2, title: '令和７年度\n№\n\n物価高騰対応重点支援地方創生臨時交付金' },
};
const AMT = '(\\d{1,3}(?:,\\d{3})+|\\d{1,3})';
const DEPT = '([^\\s\\d][^\\s]*(?:課|室|局))';
/** №・事業名（1行）・事業概要（空行なしの1ブロック、事業始期・終期を含む）・金額列・担当課が空行区切りで連続する行のみ。 */
const ROW3 = new RegExp(`\\n\\n(\\d{1,2})\\n\\n([^\\n]+)\\n\\n((?:[^\\n]+\\n)+?)\\n${AMT}\\n\\n${AMT}\\n\\n${AMT} ${DEPT}\\n`, 'g');
const ROW2 = new RegExp(`\\n\\n(\\d{1,2})\\n\\n([^\\n]+)\\n\\n((?:[^\\n]+\\n)+?)\\n${AMT}\\n\\n${AMT} ${DEPT}\\n`, 'g');
const PERIOD = /R\d{1,2}\.\d{1,2} R\d{1,2}\.\d{1,2}/;

function extractTaki(input: CachedInput): ProjectEvaluation[] {
  const doc = TAKI_DOCS[input.sourceId];
  if (input.municipalityCode !== '24441' || !doc || !input.text.startsWith(doc.title)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  // 備考「No4、5は同一事業」「Ｎ０10・15は同一事業」「NO15と同一事業」で示された、交付配分別に分割された行の№は除外する。
  const split = new Set<string>();
  for (const m of t.matchAll(/[NＮ][OoＯｏ0０](\d+)(?:[、・](\d+)は|と)\n?同一/g)) for (const n of [m[1], m[2]]) if (n) split.add(n);
  for (const m of t.matchAll(doc.columns === 3 ? ROW3 : ROW2)) {
    const [, no, name, overview] = m;
    if (split.has(no) || !PERIOD.test(overview) || PERIOD.test(name) || /^[\d,]+$/.test(name) || /(事業名|事業概要|合計|同一事業)/.test(name)) continue;
    // 同じ事業名の行が資料内に複数ある（交付配分別に分割した行など）場合は、一部の行だけ拾うことになるため除外。
    if (t.split(`\n${name}\n`).length !== 2) continue;
    const vals = doc.columns === 3 ? [m[4], m[5], m[6]] : [m[4], m[5]];
    const dept = doc.columns === 3 ? m[7] : m[6];
    // 列ずれ検出: 交付金 ≦ 本町実績額 ≦ 総事業費（2列は 交付金 ≦ 総事業費）が成り立つ行のみ。
    const n = vals.map(num);
    if (n.some((v, k) => k > 0 && v > n[k - 1])) continue;
    const start = m.index! + 2, raw = m[0].slice(2).trimEnd();
    const p = project(input, name, name, null, raw, start);
    p.id = stableId(input, `${no}|${name}`, doc.fy);
    p.projectCode = null;
    p.department = dept;
    p.evaluatedFiscalYear = doc.fy;
    p.evidence.push(evidence(input, doc.title, 0));
    const town = doc.columns === 3 ? m[5] : m[4];
    const townAt = start + m[0].slice(2).lastIndexOf(doc.columns === 3 ? `\n\n${m[5]}\n\n` : `\n\n${m[4]}\n\n`) + 2;
    p.amounts.push(amount(input, 'actual', doc.fy, town, '円', town, townAt));
    p.warnings.push(doc.columns === 3
      ? `多気町 令和${doc.fy - 2018}年度 地方創生臨時交付金の実績報告（効果検証）の行（実施計画計上№${no}）。金額は「事業費（本町実績額）」（円）を${doc.fy}年度の実績として収録し、「総事業費（実績額）」（他団体負担分を含む場合あり）と臨時交付金充当額は根拠テキストに原文のまま含むが金額としては未収録。交付金≦本町実績額≦総事業費が成り立つ行のみ採用。評価実施年度は本文に明記がないため未設定。効果検証（評価）は文章のみで評語がないため評価区分は未収録。`
      : `多気町 令和${doc.fy - 2018}年度 物価高騰対応重点支援地方創生臨時交付金の実績報告（効果検証）の行（№${no}）。金額は「総事業費（円）」を${doc.fy}年度の実績として収録し、臨時交付金充当額は根拠テキストに原文のまま含むが金額としては未収録。交付金≦総事業費が成り立つ行のみ採用。評価実施年度は本文に明記がないため未設定。効果検証（評価）は文章のみで評語がないため評価区分は未収録。`);
    out.push(p);
  }
  return out;
}

const takiAll = (input: CachedInput, inputs: CachedInput[]) =>
  municipalityRecords(input, inputs, extractTaki, p => `${p.projectName}|${p.evaluatedFiscalYear}`);

export const takiEntries: Record<string, Entry> = {
  '24441': { extract: takiAll, scope: '多気町 地方創生臨時交付金の実績報告（効果検証）（令和2〜4年度新型コロナ対応分・令和7年度物価高騰対応分）のうち、事業名が1行で読め金額列の並びと大小関係が整合する行の事業名・担当課・本町実績額（令和7年度は総事業費）。同一事業を交付配分別に分割した行、令和5年度の新型コロナ対応分・物価高騰対応分と令和6年度版（事業名の折り返し・列の並びの崩れ）、効果検証の文章は対象外。' },
};
