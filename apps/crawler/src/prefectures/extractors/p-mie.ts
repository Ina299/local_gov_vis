/**
 * 三重県「県政レポート」（令和8年版。みえ元気プランの令和7年度の成果）第3章 施策の取組。
 * 56の施策ごとに「（参考）施策にかけたコスト（単位：百万円）」の表があり、令和4〜8年度の「予算額等」が並ぶ。
 * 凡例「予算額等：７年度は決算額、８年度は予算額を記載」により、7年度の列を決算額、8年度の列を予算額として収録する
 * （4〜6年度の列は決算・予算の別が印字されないため対象外）。個別の事務事業の金額は掲載がないため施策単位。
 * 施策の見出し（施策 n－m／施策名／（主担当部局：○○））から次の見出しまでに表がちょうど1つあり、
 * 表題・列見出し（令和４年度〜８年度）・「予算額等」・数値5つ・「概算人件費」が抽出テキストでこの順に連続する施策だけを収録する。
 * 行見出しと数値が離れて出力された施策（14－1、14－5）は対象外。全体版と第3章の分冊は同じ内容のため値の一致を確認して統合する。
 * 施策の目標（めざす姿）・総合評価（Ａ〜Ｄ）とその評価の理由も同じ施策の欄から収録する（aims）。KPIの表は年度・目標値・実績値の列が
 * 抽出テキストで入り交じるため対象外。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { acrossDocuments, amount, nfkc, num, type Entry } from '../../evaluations/expansion/batch9/i1-util';

/** 半角・全角の数字が混在して印字される（例: 2１８,２９７、１０，８６５） */
const N = String.raw`[\d０-９]{1,3}(?:[,，][\d０-９]{3})*`;
const Y = (d: string) => String.raw`${d} ?年度`;
const HEAD = /\n施策 ?([\d０-９]{1,2}) ?[－-] ?([\d０-９])(?: ([^\n]{2,40})|\n\n([^\n]{2,40}))\n（主担当部局：([^）\n]{2,30})）\n/g;
/** 表題 → 列見出し（令和４〜８年度、単位の位置は揺れる）→ 予算額等 → 数値5つ → 概算人件費 */
const COST = new RegExp(String.raw`（参考）施策にかけたコスト(?: |\n+)(?:（単位：百万円）\n+)?令和[４4]年度\n+(?:（単位：百万円）\n+)?${Y('[５5]')}\n+${Y('[６6]')}\n+${Y('[７7]')}\n+${Y('[８8]')}\n+予算額等\n+(${N})\n+(${N})\n+(${N})\n+(${N})\n+(${N})\n+概算人件費`, 'g');
const INTRO = '令和７年度に県が取り組んだ事業の成果と課題を';
const LEGEND = '予算額等：７年度は決算額、\n８年度は予算額を記載';

const GOAL = /\n施策の目標\n（めざす姿）\n([^]+?)\n\nめざす姿の実現に向けた総合評価\n/g;
const SCALE_HEAD = /〔 Ａ 順調\n\n?Ｂ おおむね順調\n\n?Ｃ やや遅れている\n\n?Ｄ 遅れている 〕/;
const SCALE = 'Ａ 順調／Ｂ おおむね順調／Ｃ やや遅れている／Ｄ 遅れている';

/**
 * 施策の目標（めざす姿）を目的、「めざす姿の実現に向けた総合評価」の評価の理由を成果、総合評価の記号を評価として収録する。
 * 評価の理由の欄には「総合評価」「評価の理由」の欄名と評価記号（Ａ〜Ｄの1文字だけの行）が段組みで入り交じるため、
 * それらの行を除いた本文の行が2つ以下の連続した塊になり、評価記号の行がちょうど1つの場合だけ収録する。
 */
function aims(input: CachedInput, p: ProjectEvaluation, sec: string, from: number) {
  const goals = [...sec.matchAll(GOAL)];
  if (goals.length !== 1) return;
  const g = goals[0], gAt = from + g.index! + g[0].indexOf(g[1]);
  if (/総合評価|評価の理由|〔/.test(g[1])) return;
  p.purpose = g[1].split('\n').map(l => l.trim()).join('');
  p.evidence.push(evidence(input, g[1], gAt));
  const bodyAt = g.index! + g[0].length;
  const scale = SCALE_HEAD.exec(sec.slice(bodyAt));
  if (!scale) return;
  const lines: { s: string; at: number }[] = [];
  let pos = bodyAt;
  for (const l of sec.slice(bodyAt, bodyAt + scale.index).split('\n')) { lines.push({ s: l, at: pos }); pos += l.length + 1; }
  const letters = lines.filter(l => /^[ＡＢＣＤABCD]$/.test(l.s.trim()));
  if (letters.length !== 1) return;
  // 本文の行の連続した塊（空行・欄名・評価記号の行で区切る）
  const runs: { s: string; at: number }[][] = [];
  let cur: { s: string; at: number }[] = [];
  for (const l of lines) {
    const v = l.s.trim();
    if (!v || v === '総合評価' || v === '評価の理由' || l === letters[0]) { if (cur.length) runs.push(cur); cur = []; continue; }
    cur.push(l);
  }
  if (cur.length) runs.push(cur);
  const letter = letters[0];
  const value = letter.s.trim().normalize('NFKC');
  p.ratings.push({ kind: 'self', label: '施策の総合評価', value: `${letter.s.trim()}（${SCALE.split('／').find(x => x.normalize('NFKC').startsWith(value))!.slice(2)}）`,
    scale: SCALE, evidence: evidence(input, letter.s, from + letter.at) });
  p.evidence.push(evidence(input, scale[0], from + bodyAt + scale.index));
  if (!runs.length || runs.length > 2) return;
  p.outcomes = runs.flat().map(l => l.s.trim()).join('');
  for (const r of runs) {
    const raw = sec.slice(r[0].at, r[r.length - 1].at + r[r.length - 1].s.length);
    p.evidence.push(evidence(input, raw, from + r[0].at));
  }
}

function extractMie(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  const intro = t.indexOf(INTRO);
  const legend = t.indexOf(LEGEND, intro);
  if (intro < 0 || legend < 0) return [];
  const heads = [...t.matchAll(HEAD)].filter(m => m.index! > intro);
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    const from = h.index! + 1, to = heads[i + 1]?.index ?? t.length;
    const sec = t.slice(from, to);
    // 表題が1つで、それが厳密な形で読めるものだけ
    if ((sec.match(/（参考）施策にかけたコスト/g) ?? []).length !== 1) return;
    const c = [...sec.matchAll(COST)];
    if (c.length !== 1) return;
    const m = c[0], at = from + m.index!;
    const code = `${nfkc(h[1])}-${nfkc(h[2])}`;
    const name = (h[3] ?? h[4]).trim();
    const raw = h[0].slice(1, -1);
    const p = project(input, `施策${code}`, name, null, raw, from);
    p.evaluatedFiscalYear = 2025;
    p.department = h[5].trim();
    p.evidence.push(evidence(input, INTRO, intro), evidence(input, LEGEND, legend));
    p.amounts.push(
      { ...amount(input, 'actual', 2025, m[4], '千円', m[0], at), rawUnit: '百万円', amountYen: num(m[4]) * 1_000_000 },
      { ...amount(input, 'budget', 2026, m[5], '千円', m[0], at), rawUnit: '百万円', amountYen: num(m[5]) * 1_000_000 },
    );
    aims(input, p, sec, from);
    p.warnings.push('施策単位の金額（施策を構成する基本事業・事務事業の合計。個別事業の金額は原文に記載なし）。担当は施策の「主担当部局」で、他部局の事業を含む場合がある。');
    p.warnings.push('金額は「（参考）施策にかけたコスト」表の「予算額等」行（単位：百万円、概数）。凡例「予算額等：７年度は決算額、８年度は予算額を記載」により令和7年度の列を決算額、令和8年度の列を予算額とした。令和4〜6年度の列は決算・予算の別が印字されないため未収録。概算人件費は含まない。');
    out.push(p);
  });
  return out;
}

export const entries: Record<string, Entry> = {
  '24000': {
    scope: '令和8年版県政レポート 第3章 施策の取組（全体版と第3章の分冊）の施策ごとの「（参考）施策にかけたコスト」: 施策名・主担当部局・令和7年度決算額と令和8年度予算額（百万円）、施策の目標（めざす姿）・総合評価とその評価の理由。令和4〜6年度の列、KPIの表、概算人件費、行見出しと数値が離れて出力された施策、第2章（7つの挑戦）・第4〜5章、個別の事務事業は対象外。',
    extract: (input, inputs) => acrossDocuments(input, inputs, extractMie, p => p.projectCode!),
  },
};
