/**
 * 32204 益田市: 教育委員会 点検・評価報告書（令和８年度・令和７年度事業分）。
 * 「（４）重点項目別評価」の各評価対象事業（「① 評価対象事業「…」」の見出し）の直後の段落「この事業は、…」から、
 * 「評価対象事業目標として」の行の手前までを目的として収録する（段落に「目的」の語を含むものだけ。
 * 「…行うこととしています」で終わる段落は事業内容の説明のため採らない）。巻末の事務事業別点検・評価シートは
 * 列が行ごとに混在するため使わない。年度は表紙の「令和８年度（令和７年度事業分）」（公開済みレコードと同じ）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { joinLines, sheetRecord } from './m21-util';

const HEAD = /\n[①-⑳] 評価対象事業「([^」]+)」?\n(この事業は[\s\S]*?)\n評価対象事業目標として/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '32204' || !/\/2026kyoikutenken\.pdf$/.test(input.sourceUrl) || !input.text.startsWith('令和８年度\n（令和７年度事業分）\n')) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of input.text.matchAll(HEAD)) {
    const body = m[2];
    // 段落が改ページ（ページ番号の行）をまたぐもの、目的を述べていないものは採らない。
    if (!body.includes('目的') || /\n-\s*\d+\s*-\n/.test(body) || body.length > 600) continue;
    const name = joinLines(m[1]).trim();
    const nameAt = m.index! + m[0].indexOf(m[1]), bodyAt = m.index! + m[0].indexOf(body);
    out.push(sheetRecord(input, `masuda:${nameAt}`, { value: name, raw: m[1], at: nameAt },
      { evaluationYear: 2026, evaluatedFiscalYear: 2025 }, null,
      [{ key: 'purpose', raw: body, at: bodyAt, value: joinLines(body) }],
      '益田市 教育委員会点検・評価報告書（令和７年度事業分）の重点項目別評価で、評価対象事業の見出しの直後の「この事業は、…を目的としています。」の段落を目的として収録（PDFの改行を除いた）。'));
  }
  return out;
}

export const entry = {
  extract,
  scope: '益田市 教育委員会点検・評価報告書（令和７年度事業分）の重点項目別評価の各評価対象事業の目的を述べた段落。事務事業別点検・評価シート（列が混在）は対象外。',
};
