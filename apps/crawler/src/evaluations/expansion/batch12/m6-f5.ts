/** Batch-12 (m6-f5) extractors: 01204 旭川市（行政評価 答申書の個別事業）, 29402 明日香村（教育委員会 事務事業点検評価）, 13107 墨田区（令和７年度 事務事業評価シート）. */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';
import { extractSumidaR7 } from './m6-f5-sumida';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** 旭川市 答申書「令和 5 年度行政評価の実施について」: 第 4 個別事業の概要及び評価（各論）の8事業。 */
function asahikawa(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01204' || input.sourceId !== 'aee5ca026b16b7e72fc4edbe') return [];
  const t = input.text, title = '答 申 書\n令和 5 年度行政評価の実施について';
  if (!t.startsWith(title)) return [];
  const from = t.indexOf('第 4 個別事業の概要及び評価（各論）\n1．'), to = t.indexOf('第 5 個別施設に関する評価（各論）', from);
  if (from < 0 || to < 0) return [];
  const heads = [...t.slice(from, to).matchAll(/\n(\d)．([^\n]+)\n【事業の概要】\n/g)];
  return heads.flatMap((h, k) => {
    const start = from + h.index! + 1, end = k + 1 < heads.length ? from + heads[k + 1].index! : to, sec = t.slice(start, end);
    const head = h[0].slice(1, -1), name = h[2].trim();
    const p = project(input, `事業${h[1]}`, name, 2023, head, start);
    p.evidence.push(evidence(input, title, 0));
    const dept = sec.match(/\n担当部局\n(?:内容\n)?\n([^\n]+(?:課|センター))\n/);
    if (dept) { p.department = dept[1]; p.evidence.push(evidence(input, dept[0].slice(1, -1), start + dept.index! + 1)); }
    // The first 千円 figure of the overview is the 事業費 (令和 5 年度当初予算) total; its label follows within the cell.
    const cost = sec.match(/\n([\d,]+) 千円\n(?:[^\n]*\n){0,6}?事業費\n(?:\n?[^\n]*\n){0,3}?（令和 5 年度/);
    const firstCost = sec.match(/\n([\d,]+) 千円\n/);
    if (cost && firstCost && cost.index === firstCost.index) {
      const raw = cost[0].slice(1);
      p.amounts.push({ kind: 'budget', fiscalYear: 2023, amountYen: Number(cost[1].replace(/,/g, '')) * 1000, rawValue: cost[1], rawUnit: '千円', evidence: evidence(input, raw, start + cost.index! + 1) });
    } else p.warnings.push('事業費（令和5年度当初予算）の位置を確定できないため金額は未収録。');
    const rating = [...sec.matchAll(/【当委員会の評価】\n(?:\n\d+\n\n\n)?方向性\n\n([^\n]+)\n/g)];
    if (rating.length === 1) p.ratings.push({ kind: 'external', label: '当委員会の評価（方向性）', value: rating[0][1], scale: null, evidence: evidence(input, rating[0][0], start + rating[0].index!) });
    p.warnings.push('旭川市行財政改革推進委員会の答申書（令和5年度行政評価）第4「個別事業の概要及び評価」から事業名・担当部局・事業費（令和5年度当初予算、千円）・委員会評価の方向性を収録。細節内訳・財源内訳は段組みが崩れ対応を確定できないため未収録。2次評価（行政評価検討会議）と個別施設評価は対象外。評価対象年度は明示がないため未設定。');
    return [p];
  });
}

/** 明日香村教育委員会 事務事業点検・評価報告書（令和７・８年度）の「事務事業点検評価」シートと、令和５年度報告書の叙述式の点検評価結果。 */
const ASUKA_SHEETS: Record<string, { year: number; evaluated: number; title: string }> = {
  '8d97e016932ec3c0c20e83ee': { year: 2026, evaluated: 2025, title: '事務事業点検・評価報告書\n（令和７年度実施事務事業分）' },
  'e7fe93eaecba39e9eebd8ac1': { year: 2025, evaluated: 2024, title: '事務事業点検・評価報告書\n（令和６年度実施事務事業分）' },
};
const ASUKA_NARRATIVE: Record<string, { year: number; evaluated: number; title: string }> = {
  '2858ba88656381924a21537c': { year: 2023, evaluated: 2022, title: '明日香村教育委員会事務事業点検評価報告書\n（令和４年度実施事務事業分）' },
};
// Sheet names that differ from the table of contents (verified as a full line on the sheet).
const ASUKA_EXTRA_NAMES = ['青少年事業', '青少年事業（20歳を祝う会）', '人権教育の推進', '総合型地域スポーツクラブ運営支援'];
const BASE_SCALE = { 継続性: 'Ａ 村民等のニーズが高く継続すべき事業である／Ｂ 法令等の定め、または一定のニーズがあり継続が求められる／Ｃ 村民等のニーズはあるが、時代変化に適応しなくなっている部分がある／Ｄ 村民等のニーズや社会変化に全く適応しておらず継続が不要な事業である',
  効果性: 'Ａ 十分な成果を挙げている／Ｂ 一定の成果を挙げている／Ｃ 一部に対して成果を挙げている／Ｄ 成果が見られない',
  効率性: 'Ａ 実施手法は適切であり、見直しの必要はない／Ｂ 実施手法は適切である／Ｃ 実施手法は適切であるが、一部見直しが必要である／Ｄ 見直しが必要である' };
const BASE: [keyof typeof BASE_SCALE, RegExp][] = [
  ['継続性', /・法令等の定め、または一定のニーズがあり継続が求められる\n([ＡＢＣＤ])\n(?:基\n)?（事業を継続すべきか）/g],
  ['効果性', /・一定の成果を挙げている\n([ＡＢＣＤ])\n(?:評 )?（成果を挙げているか）/g],
  ['効率性', /・実施手法は適切である\n([ＡＢＣＤ])\n(?:価\n)?（実施方法は適切か）/g],
];
// 総合評価: the single letter printed in the 総合評価 row (評価 / 今後の方向性 columns).
const TOTAL = /総合評価\n\n評価委員の意見\n\n([ＡＢＣＤ])\n\n今後の方向性\n|\n評価\n\n今後の方向性\n\n([ABCDＡＢＣＤ])\n/g;
const TOTAL_SCALE = 'Ａ 拡充（十分な事業水準にあり、かつ将来への必要度も高く、今後も拡充が必要）／Ｂ 継続（一定の事業水準にあり、今後も更なる効率化を図りつつも、現在の事業水準を維持）／Ｃ 見直し（事業の必要性はあるが、その手法・執行体制等見直しが必要）／Ｄ 廃止（事業を廃止（または休止））';

function asuka(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '29402') return [];
  const t = input.text, sheet = ASUKA_SHEETS[input.sourceId], narrative = ASUKA_NARRATIVE[input.sourceId];
  if (narrative) {
    const at = t.indexOf(narrative.title);
    if (at < 0 || at > 200) return [];
    return [...t.matchAll(/\n([^\n]+)（(教育課|文化財課)）\n事 業 目 的\n/g)].map(m => {
      const raw = m[0].slice(1, -1), p = project(input, `${m[2]}:${m[1]}`, m[1], narrative.year, raw, m.index! + 1);
      p.projectCode = null; p.department = m[2]; p.evaluatedFiscalYear = narrative.evaluated;
      p.evidence.push(evidence(input, narrative.title, at));
      p.warnings.push('明日香村教育委員会 令和５年度事務事業点検評価報告書（令和４年度実施事務事業分）の叙述式の点検評価結果（事業目的・事業実績・成果・課題）。評価記号・事業費の記載がない様式のため事業名と担当課のみ収録。');
      return p;
    });
  }
  if (!sheet) return [];
  const at = t.indexOf(sheet.title);
  if (at < 0 || at > 200) return [];
  const toc = t.slice(t.indexOf('点検評価結果\n'), t.indexOf('\nまとめ\n'));
  const names = [...toc.matchAll(/\n[◆■★]?([^\n・]+(?:・[^\n・]+)*)・{3,}[０-９]+/g)].map(m => m[1]).concat(ASUKA_EXTRA_NAMES);
  const starts = [...t.matchAll(/事務事業点検評価\n/g)].map(m => m.index!);
  const found: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const seg = t.slice(s, starts[k + 1] ?? t.length), headEnd = seg.indexOf('評価基準');
    if (headEnd < 0) return;
    const head = seg.slice(0, headEnd);
    const hits = names.filter(n => head.includes(`\n${n}\n`));
    if (hits.length !== 1) return;
    const name = hits[0], nameAt = s + head.indexOf(`\n${name}\n`) + 1;
    const p = project(input, name, name, sheet.year, name, nameAt);
    p.projectCode = null; p.evaluatedFiscalYear = sheet.evaluated;
    p.evidence.unshift(evidence(input, '事務事業点検評価', s));
    p.evidence.push(evidence(input, sheet.title, at));
    const dept = [...seg.matchAll(/所管課[ \n]+([^\n ]+課)\n/g)];
    if (dept.length === 1) { p.department = dept[0][1]; p.evidence.push(evidence(input, dept[0][0].trimEnd(), s + dept[0].index!)); }
    for (const [label, re] of BASE) {
      const ms = [...seg.matchAll(re)];
      if (ms.length === 1) p.ratings.push({ kind: 'self', label: `基本評価（${label}）`, value: ms[0][1], scale: BASE_SCALE[label], evidence: evidence(input, ms[0][0], s + ms[0].index!) });
    }
    const total = [...seg.matchAll(TOTAL)];
    if (total.length === 1) {
      const m = total[0], raw = m[0].replace(/^\n/, '').replace(/\n$/, '');
      p.ratings.push({ kind: 'self', label: '総合評価（今後の方向性）', value: m[1] ?? m[2], scale: TOTAL_SCALE, evidence: evidence(input, raw, s + m.index! + (m[0].startsWith('\n') ? 1 : 0)) });
    }
    p.warnings.push(`明日香村教育委員会 事務事業点検・評価報告書（令和${sheet.evaluated - 2018}年度実施事務事業分）の事務事業点検評価シート。評価記号は抽出テキスト上で評価欄の位置が確定できるもの（基本評価は評価基準行の間に単独で出力された記号、総合評価は「評価／今後の方向性」欄の単独の記号）のみ収録し、それ以外の配置の票では未収録。成果指標・事業費表は列の対応が票ごとに崩れるため未収録。`);
    found.push(p);
  });
  // A name printed on two sheets of one report cannot be told apart: drop both.
  return found.filter(p => found.filter(q => q.projectName === p.projectName).length === 1);
}

export const entries: Record<string, Entry> = {
  '01204': {
    extract: input => asahikawa(input),
    scope: '旭川市行財政改革推進委員会の答申書（令和5年度行政評価）第4「個別事業の概要及び評価」の8事業について事業名・担当部局・事業費（令和5年度当初予算）・委員会評価の方向性を構造化。個別施設の評価、総論、2次評価一覧、検討・反映状況表、概要資料は対象外。',
  },
  '29402': {
    extract: input => asuka(input),
    scope: '明日香村教育委員会の事務事業点検・評価報告書（令和7・8年度）の事務事業点検評価シートの事業名・所管課・基本評価（継続性・効果性・効率性）・総合評価（位置が確定できるもののみ）と、令和5年度報告書の叙述式点検評価結果の事業名・担当課。成果指標・事業費・評価委員の意見・まとめは対象外。',
  },
  '13107': {
    extract: extractSumidaR7,
    scope: '令和７年度施策評価シートに収録された事務事業評価シート（1事業1枚）から事業名・主管課・評価結果・予算決算額推移（合計検算一致時のみ）を構造化。施策評価本体、指標表、施策内事務事業一覧表、区民意見一覧は対象外。',
  },
};
