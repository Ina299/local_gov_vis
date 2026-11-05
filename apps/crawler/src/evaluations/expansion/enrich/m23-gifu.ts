import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, stableId } from '../shared';
import { entries as gifu } from '../batch12/m4-gifu';

// ---------------------------------------------------------------- 岐阜市（事業評価シート(R3年度事業評価用)・課別PDF）
// 公開済みレコードは batch12/m4-gifu の抽出で、目的・内容は「事業の目的\n\n<目的>\n\n事業の内容\n\n<内容>\n\n事\n業\n」の並びの票だけにある。
// ここでは同じ票のうち、抽出テキストで次の並びになった票から目的・事業の内容を取り出す（事業名・担当課・年度は元の抽出をそのまま使う）。
//  (1) 見出し2つが続き、本文が「事業の対象」の縦書き見出しの後にまとめて出る票:
//      「事業の目的\n\n事業の内容\n\n事\n業\nの\n対\n象\n\n<本文>\n\n何を\n」。本文は目的・内容の2段落がつながっているため、
//      段落の終わり（句点・閉じ括弧で終わり、欄幅に満たない行）がちょうど1か所で、2段落とも句点・閉じ括弧で終わる票だけ、前を目的・後を内容とする。
//  (2) 目的だけ見出しの直後にあり、内容が対象見出しの前後に出る票:
//      「事業の目的\n\n<目的>\n\n事業の内容\n\n(<内容>\n\n何を\n事\n業\n | 事\n業\nの\n対\n象\n\n<内容>\n\n何を\n)」。目的は1段落に限る。
//  (3) 目的が見出しの前に出る票: 「【２.事業概要】\n<目的1行>\n事業の目的\n\n事業の内容\n\n事\n業\nの\n対\n象\n\n<内容>\n\n何を\n」。
// 「令和３年度（実施内容）」欄は「どのくらい」欄と行が混ざる票があるため使わない。
const VERTICAL = '事\n業\nの\n対\n象\n\n';
const END = /[。）)]$/;

/**
 * 段落（空行を含まない行の並び）を、欄幅の8割に満たず句点・閉じ括弧で終わる行の後で区切る。
 * 欄幅の8割に満たないのに句点・閉じ括弧で終わらない行（箇条・見出し）があれば、段落の区切りが決まらないため null。
 */
function paragraphs(block: string): string[][] | null {
  const lines = block.split('\n'), width = Math.max(...lines.map(l => [...l.trim()].length));
  const out: string[][] = [[]];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim(), short = [...l].length < width * 0.8;
    out[out.length - 1].push(lines[i]);
    if (i === lines.length - 1) break;
    if (short && !END.test(l)) return null;
    if (short) out.push([]);
  }
  return out;
}
/** 折り返しの改行を除く。箇条の記号で始まる行の前の改行は残す。 */
const joinWrapped = (s: string) => s.split('\n').map(x => x.trim()).reduce((a, l, i) => a + (i && /^(・|○|●|◎|※|[①-⑳]|（[０-９\d]+）|\(\d+\))/.test(l) ? '\n' : '') + l, '');
const single = (block: string) => !block.includes('\n\n') && block.trim().length > 0 && paragraphs(block)?.length === 1 && END.test(block.trim());

interface Found { purpose: string; activities: string | null; raw: string; at: number }
function narrative(t: string, overview: number, cost: number): Found | null {
  const sec = t.slice(overview, cost);
  // (1)
  let m = /^【２\.事業概要】\n事業の目的\n\n事業の内容\n\n事\n業\nの\n対\n象\n\n([^\n][^]*?)\n\n何を\n/.exec(sec);
  if (m) {
    const ps = paragraphs(m[1]);
    if (!ps || ps.length !== 2 || !ps.every(p => END.test(p[p.length - 1].trim()))) return null;
    return { purpose: joinWrapped(ps[0].join('\n')), activities: joinWrapped(ps[1].join('\n')), raw: m[0].slice(0, -'\n\n何を\n'.length), at: overview };
  }
  // (3)
  m = /^【２\.事業概要】\n([^\n]+)\n事業の目的\n\n事業の内容\n\n事\n業\nの\n対\n象\n\n([^\n][^]*?)\n\n何を\n/.exec(sec);
  if (m) {
    if (!single(m[1]) || !single(m[2])) return null;
    return { purpose: m[1].trim(), activities: joinWrapped(m[2]), raw: m[0].slice(0, -'\n\n何を\n'.length), at: overview };
  }
  // (2)
  m = /^【２\.事業概要】\n事業の目的\n\n([^\n][^]*?)\n\n事業の内容\n\n/.exec(sec);
  if (!m || !single(m[1])) return null;
  const rest = sec.slice(m[0].length);
  const a = /^([^\n][^]*?)\n\n何を\n事\n業\n/.exec(rest) ?? (rest.startsWith(VERTICAL) ? /^事\n業\nの\n対\n象\n\n([^\n][^]*?)\n\n何を\n/.exec(rest) : null);
  if (a && single(a[1]) && !/^(何を|誰に|どのくらい|事)$/m.test(a[1]))
    return { purpose: joinWrapped(m[1]), activities: joinWrapped(a[1]), raw: (m[0] + a[0]).slice(0, -'\n\n何を\n'.length), at: overview };
  return { purpose: joinWrapped(m[1]), activities: null, raw: m[0].slice(0, -'\n\n'.length), at: overview };
}

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '21201') return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  for (const p of gifu['21201'].extract(input, inputs)) {
    if (p.purpose) continue;
    const pos = /^extracted-text:chars:(\d+)-/.exec(p.evidence[0].cell ?? '');
    if (!pos || p.evidence[0].sourceUrl !== input.sourceUrl) continue;
    const s = Number(pos[1]), next = t.indexOf('事業評価シート(R3年度事業評価用)', s + 1), end = next < 0 ? t.length : next;
    const overview = t.indexOf('【２.事業概要】', s), cost = t.indexOf('【３.支出（行政コスト）】', s);
    if (overview < 0 || cost < 0 || cost > end || overview > cost) continue;
    const f = narrative(t, overview, cost);
    if (!f) continue;
    out.push({ ...p, id: stableId(input, `${p.projectCode ?? p.projectName}:purpose`, null), amounts: [], indicators: [], ratings: [],
      purpose: f.purpose, activities: f.activities, outcomes: null,
      evidence: [...p.evidence, evidence(input, f.raw, f.at)],
      warnings: ['岐阜市「事業評価シート(R3年度事業評価用)」の「事業の目的」「事業の内容」欄。抽出テキストで見出しと本文の位置がずれた票のうち、'
        + '本文の段落と欄の対応が並びから一意に決まるものだけ収録（目的・内容の本文が続けて出る票は、段落の区切りが1か所の場合のみ前を目的・後を内容とする）。折り返しの改行は除いた。'] });
  }
  return out;
}

export const entry = {
  extract,
  scope: '岐阜市 事業評価シート(R3年度事業評価用): 抽出テキストで見出しと本文の位置がずれ、公開済みレコードに目的・内容が入らなかった票の「事業の目的」「事業の内容」（段落と欄の対応が一意な票のみ）。',
};
