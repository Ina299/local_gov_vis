/**
 * 22306 西伊豆町: デジタル田園都市国家構想交付金事業の達成状況（令和５・６年度、ChihososeiR5/R6_tassei.pdf）。目的の欄はない。
 * 公開済みレコード（事業名・対象年度）に、各事業の「◎令和N年度（実績）」の交付金額の次の「内容 （…）」欄を事業内容として足す。
 * 事業名は直前の「① 」「② 」の見出し、年度は「◎令和N年度（実績）」。見出しの下の事業の説明文は欄の名前がないため採らない。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { sheetRecord } from './m24-util';

const NAMES = ['森と海を繋ぐ６次産業化事業', 'デジタル・シティプロモーション事業（広域連携）'];
const ITEM = /\n◎令和([５６])年度（実績）\n[^\n]+ 千円\n内容 （((?:[^\n]+\n)*?[^\n]+)）\n\n/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '22306' || !/\/ChihososeiR[56]_tassei\.pdf$/.test(input.sourceUrl) || input.truncated) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  if (!t.startsWith('デジタル田園都市国家構想交付金事業\n')) return [];
  for (const m of t.matchAll(ITEM)) {
    // 事業の見出しは事業名だけの行（R5は「① 」「② 」付き）。
    const heads = [...t.slice(0, m.index!).matchAll(/\n(?:[①②] )?([^\n]+)\n/g)].filter(x => NAMES.includes(x[1])), h = heads[heads.length - 1];
    if (!h) continue;
    const year = m[1] === '５' ? 2023 : 2024, name = h[1];
    out.push(sheetRecord(input, `${year}:${name}`, { value: name, raw: h[1], at: h.index! + h[0].indexOf(h[1]) }, { evaluationYear: null, evaluatedFiscalYear: year },
      [{ key: 'activities', raw: m[2], at: m.index! + m[0].indexOf(m[2]) }],
      '西伊豆町 デジタル田園都市国家構想交付金事業の達成状況の「◎令和N年度（実績）」の「内容」欄（括弧内）を事業内容として収録。折り返しの改行を除いた。'));
  }
  return out;
}

export const entry = {
  extract,
  scope: '西伊豆町 デジタル田園都市国家構想交付金事業の達成状況（令和５・６年度）: 年度実績の「内容」欄（事業内容）。目的の欄はない。',
};
