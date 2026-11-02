/**
 * 13102 中央区: 令和5年度（令和4年度分）主要な施策の成果・行政評価の基本政策別冊子の事業別行政評価シート。
 * 公開済みレコード（目次・一覧から作られた149事業）の空欄の目的（「１ 事業の目的」欄）を補う。
 * シートの特定は batch7 g1-chuo・enrich n1-chuo と同じく目次の事業番号・事業名・掲載頁で行う。
 * 欄は見出しの直後から空行を挟んで「２ 財務情報」が続くまで。「４ 総括」の「現状・成果・課題」は現状・成果・課題が
 * 1つの欄に混在するため収録しない。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';
import { nfkc, sheets } from '../batch7/g1-util';

/** 欄の文の改行は、句点で終わる行の後と箇条（・等）の前だけ残し、それ以外（欄の幅での折り返し）は除く。 */
const joinWrapped = (raw: string) => raw.split('\n').reduce((acc, l, i, ls) =>
  acc + (i === 0 ? '' : /。$/.test(ls[i - 1]) || /^[・①-⑳〇○●◆■※【]/.test(l) ? '\n' : '') + l, '');
const SHEET = '令和５年度（令和４年度分） 事業別行政評価シート';
/** 基本政策別の冊子（合本は再掲のため使わない）。 */
const VOLUMES = new Set(['cce8f4525d530f4f791ba73f', 'f9560252cff493e89098020f', '97b70ea1402670322396109a', '015b9b8aba12634ce3318960', 'f94de717291d51c6ce6f2b08',
  '85d83b8bd4012bfeab354f05', 'a6ac9793dceda26e3553c9f0', '76857a97e4d32427a01a0cf9', '27c9658276acf4dc2e59a1af', 'aa765b169fba1a1c56f77297']);

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13102' || !VOLUMES.has(input.sourceId) || !/^(?:基本政策[１-９]|区政運営)\n/.test(input.text)) return [];
  const t = input.text, pages = sheets(t, SHEET), out: ProjectEvaluation[] = [];
  for (const toc of t.matchAll(/^【(\d+)】(.+?)\n?・{2,}[・ ]*(\d+)$/gm)) {
    const name = toc[2].replace(/（新規）$/, '');
    const found = pages.filter(s => s.text.includes(`－ ${toc[3]} －`));
    if (found.length !== 1) continue;
    const sheet = found[0], head = sheet.text.slice(0, sheet.text.indexOf('１ 事業の目的'));
    const dept = /^.+\n\n部課名\n\n([^\n]+)\n/.exec(sheet.text);
    if (!dept || !nfkc(head).includes(nfkc(name))) continue;
    const m = /\n１ 事業の目的\n((?:[^\n]+\n)+)\n２ 財務情報\n/.exec(sheet.text);
    if (!m || (sheet.text.match(/\n１ 事業の目的\n/g) ?? []).length !== 1) continue;
    const raw = m[1].slice(0, -1);
    const p = project(input, `narrative-${toc[1]}`, name, 2023, toc[0], toc.index);
    p.id = stableId(input, `narrative-${toc[1]}`, 2023);
    p.projectCode = null;
    p.department = dept[1];
    p.evaluatedFiscalYear = 2022;
    p.evidence.push(evidence(input, sheet.text.slice(0, dept[0].length), sheet.start));
    p.evidence.push(evidence(input, raw, sheet.start + m.index! + '\n１ 事業の目的\n'.length));
    p.purpose = joinWrapped(raw);
    p.warnings.push('中央区 事業別行政評価シートの「１ 事業の目的」欄を原文のまま収録（句点で終わる行の後と箇条の前以外の改行は欄の幅での折り返しとして除いた）。'
      + 'シートは目次の事業番号・事業名・掲載頁で特定し、シート冒頭に同じ名称があることを確認。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '中央区 令和5年度（令和4年度分）主要な施策の成果・行政評価の基本政策別冊子の事業別行政評価シート:「１ 事業の目的」。「４ 総括」は現状・成果・課題が混在するため対象外。',
};
