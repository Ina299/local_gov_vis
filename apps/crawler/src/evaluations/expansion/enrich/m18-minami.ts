import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { joinWrapped } from './m10-util';

// ---------------------------------------------------------------- 美波町（令和4年度 教育委員会事務事業点検・評価報告書）
// 公開済みレコードは同じ報告書の「（n）費目（決算額…円）」と、その中の「①…」の番号付き事務（「◎点検・評価等」は成果として収録済み）。
// 報告書は「実施状況とその成果・評価等」の形で、事務の見出しの直後から「◎点検・評価等」の手前までが実施状況の文。目的の欄はない。
// ここでは実施状況の文を事業内容として足す。「◎点検・評価」が1回だけの事務に限り（複数の小項目ごとに点検が並ぶ事務は
// 公開済みの成果と範囲が揃わないため採らない）、頁番号の行が割り込むものも採らない。
const ID = '9de68dc3f1561c15e6d850ed';

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '36387' || input.sourceId !== ID) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const sections = [...t.matchAll(/^（([０-９]+)）(.+?)（決算額[ 　]*([０-９，]+)円）/gm)];
  sections.forEach((s, i) => {
    if (input.truncated && i === sections.length - 1) return;
    let raw = t.slice(s.index, sections[i + 1]?.index ?? t.length);
    const e = raw.indexOf('\n◇');
    if (e >= 0) raw = raw.slice(0, e);
    const children = [...raw.matchAll(/^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])([^\n]+)$/gm)];
    const items = children.length
      ? children.map((m, j) => ({ name: `${s[2]}／${m[2]}`, head: m[0], raw: raw.slice(m.index, children[j + 1]?.index ?? raw.length), start: s.index! + m.index! }))
      : [{ name: s[2], head: s[0], raw, start: s.index! }];
    for (const item of items) {
      if ((item.raw.match(/◎点検・評価/g) ?? []).length !== 1) continue;
      const a = item.head.length + 1, b = item.raw.indexOf('\n◎点検・評価');
      if (item.raw[item.head.length] !== '\n' || b <= a) continue;
      const body = item.raw.slice(a, b);
      if (/^[０-９\d]+$|^◎|^◇|^（[０-９]+）/m.test(body) || body.length > 600) continue;
      const p = project(input, `${item.name}:activities`, item.name, 2023, item.head, item.start);
      p.evaluatedFiscalYear = 2022;
      p.activities = joinWrapped(body, 30);
      p.evidence.push(evidence(input, body, item.start + a));
      p.warnings.push('教育委員会事務事業点検・評価報告書の「実施状況とその成果・評価等」のうち、事務の見出しから「◎点検・評価等」までの実施状況の文（欄の幅での折り返しだけを除いてつないだ）。目的の欄はない。');
      out.push(p);
    }
  });
  return out;
}

export const entry = {
  extract,
  scope: '美波町 令和4年度 教育委員会事務事業点検・評価報告書: 事務ごとの実施状況の文（事業内容）。目的の欄はなく、「◎点検・評価」が複数並ぶ事務は対象外。',
};
