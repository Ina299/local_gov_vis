/**
 * 08225 常陸大宮市: 第２期常陸大宮市創生総合戦略 評価書（令和３〜５年度）の「地方創生関係交付金に係る事業計画書（評価書）」
 * 「地方創生応援税制活用事業評価書」。公開済みレコード（事業名・対象年度）に、「事業目的」欄を目的、当該年度の「事業内容」欄を
 * 事業内容として足す。抽出テキストでは「事業目的」の本文が見出しの前後のどちらかに出力されるため、「事業概要」から「事業期間」
 * までのうち句点で終わる文章の段落がちょうど1つのシートだけ、その段落を目的とする。事業内容は「事業内容（令和N年度）」の見出しの
 * 直後に本文が続き、Nが評価書の年度と同じ場合だけ採る（本文が見出しの前後に分かれるシートは採らない）。
 * 同じ事業名のシートが1冊に2枚ある場合は、公開済みレコードと同じ最初の1枚だけ。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { type Field, sheetRecord } from './m24-util';

const NAMES = ['御前山ダム周辺活性化事業', 'いばらきサイクルツーリズム推進強化事業', 'つながる茨城チャレンジフィールドプロジェクト',
  '道の駅常陸大宮遊具設置', '乳児育児用品購入助成事業', '大宮運動公園市民球場整備事業'];
const HEAD = /令和(\d+)年度\n\n(地方創生[^\n]*評価書）?)\n/g;
const z2h = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '08225' || !/\/data\/doc\/\d+_doc_15_0\.pdf$/.test(input.sourceUrl) || input.truncated) return [];
  const t = input.text;
  if (!t.startsWith('第２期常陸大宮市創生総合戦略\n')) return [];
  const heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [], seen = new Set<string>();
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i], start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const names = NAMES.filter(n => seg.includes(n));
    if (names.length !== 1 || seen.has(names[0])) continue;
    const name = names[0], year = 2018 + Number(h[1]);
    seen.add(name);
    const a = seg.indexOf('事業概要\n'), b = seg.indexOf('\n事業期間\n');
    if (a < 0 || b < a || !seg.slice(a, b).includes('\n事業目的\n')) continue;
    const fields: Field[] = [];
    const paras = [...seg.slice(a, b).matchAll(/(?<=\n\n)[^\n][\s\S]*?(?=\n\n|$)/g)].map(m => ({ raw: m[0].trimEnd(), at: m.index! })).filter(m => /。$/.test(m.raw) && m.raw.length >= 20);
    if (paras.length === 1) fields.push({ key: 'purpose', raw: paras[0].raw, at: start + a + paras[0].at });
    const act = /\n事業内容\n（令和([0-9０-９]+)年度）\n\n((?:[^\n]+\n)*?[^\n]+)\n\n/.exec(seg);
    if (act && 2018 + Number(z2h(act[1])) === year && act[2].length >= 10 && !/^(２|基準値|完成時期)/.test(act[2]))
      fields.push({ key: 'activities', raw: act[2], at: start + act.index! + act[0].indexOf(act[2]) });
    if (!fields.length) continue;
    out.push(sheetRecord(input, `${year}:${name}`, { value: name, raw: name, at: start + seg.indexOf(name) }, { evaluationYear: null, evaluatedFiscalYear: year }, fields,
      `常陸大宮市 第２期創生総合戦略 評価書の「${h[2]}」。「事業目的」欄（事業概要から事業期間までの唯一の文章の段落）を目的、`
      + '評価書の年度の「事業内容」欄（見出しの直後に本文が続くもの）を事業内容として収録。折り返しの改行を除いた。'));
  }
  return out;
}

export const entry = {
  extract,
  scope: '常陸大宮市 第２期創生総合戦略 評価書（令和３〜５年度）の交付金・応援税制事業の評価書: 「事業目的」（目的）・当該年度の「事業内容」（事業内容）。',
};
