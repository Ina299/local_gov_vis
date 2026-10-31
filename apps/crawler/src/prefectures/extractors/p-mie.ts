/**
 * 三重県「県政レポート」（令和8年版。みえ元気プランの令和7年度の成果）第3章 施策の取組。
 * 56の施策ごとに「（参考）施策にかけたコスト（単位：百万円）」の表があり、令和4〜8年度の「予算額等」が並ぶ。
 * 凡例「予算額等：７年度は決算額、８年度は予算額を記載」により、7年度の列を決算額、8年度の列を予算額として収録する
 * （4〜6年度の列は決算・予算の別が印字されないため対象外）。個別の事務事業の金額は掲載がないため施策単位。
 * 施策の見出し（施策 n－m／施策名／（主担当部局：○○））から次の見出しまでに表がちょうど1つあり、
 * 表題・列見出し（令和４年度〜８年度）・「予算額等」・数値5つ・「概算人件費」が抽出テキストでこの順に連続する施策だけを収録する。
 * 行見出しと数値が離れて出力された施策（14－1、14－5）は対象外。全体版と第3章の分冊は同じ内容のため値の一致を確認して統合する。
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
    p.warnings.push('施策単位の金額（施策を構成する基本事業・事務事業の合計。個別事業の金額は原文に記載なし）。担当は施策の「主担当部局」で、他部局の事業を含む場合がある。');
    p.warnings.push('金額は「（参考）施策にかけたコスト」表の「予算額等」行（単位：百万円、概数）。凡例「予算額等：７年度は決算額、８年度は予算額を記載」により令和7年度の列を決算額、令和8年度の列を予算額とした。令和4〜6年度の列は決算・予算の別が印字されないため未収録。概算人件費は含まない。');
    out.push(p);
  });
  return out;
}

export const entries: Record<string, Entry> = {
  '24000': {
    scope: '令和8年版県政レポート 第3章 施策の取組（全体版と第3章の分冊）の施策ごとの「（参考）施策にかけたコスト」: 施策名・主担当部局・令和7年度決算額と令和8年度予算額（百万円）。令和4〜6年度の列、概算人件費、行見出しと数値が離れて出力された施策、第2章（7つの挑戦）・第4〜5章、個別の事務事業は対象外。',
    extract: (input, inputs) => acrossDocuments(input, inputs, extractMie, p => p.projectCode!),
  },
};
