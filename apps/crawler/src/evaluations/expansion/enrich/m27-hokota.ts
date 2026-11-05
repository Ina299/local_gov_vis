import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m17-util';

// ---------------------------------------------------------------- 鉾田市（まち・ひと・しごと創生有識者会議 地方創生推進交付金事業の評価結果）
// 公開済みレコードは各年度の評価結果の「事業名」から作られ、年度は表題の「令和X年度 第１回」（evaluationYear のみ）。
// 表題の下の「事業名／事業の概要」の欄は、事業名の行の直後から空行または「実績値を踏まえた事業の今後について」
// 「事業の評価」の見出しの手前までが事業の概要の本文。これを事業内容とする。
// 令和8年度版は概要の中に【事業概要】【事業目的・効果】の小見出しがあり、【事業目的・効果】の段を目的、【事業概要】の段を事業内容とする。
// 令和元年度版は事業名が縦書き（1字ずつ改行）で事業の概要の欄がないため対象外。
const TITLE = /^(?:\d\/\d\n\n)?令和([０-９\d]+|元)年度 第１回 ?鉾田市まち・ひと・しごと創生有識者会議 委員による地方創生推進交付金事業の評価結果[^\n]*\n事業名\n\n事業の概要\n\n/gm;
const STOP = /^(実績値を踏まえた事業の今後について|事業の評価)$/;
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '08234' || !/\/data\/doc\/\d+_doc_\d+_\d+\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  for (const h of t.matchAll(TITLE)) {
    const year = 2018 + (h[1] === '元' ? 1 : Number(ascii(h[1])));
    let at = h.index! + h[0].length;
    const nl = t.indexOf('\n', at), name = t.slice(at, nl).trim();
    if (!name || name.length > 80) continue;
    at = nl + 1;
    const lines: string[] = [];
    let pos = at;
    while (pos < t.length) {
      const e = t.indexOf('\n', pos), line = t.slice(pos, e < 0 ? t.length : e);
      if (!line.trim() || STOP.test(line.trim())) break;
      lines.push(line);
      pos = (e < 0 ? t.length : e) + 1;
    }
    if (pos >= t.length && input.truncated) continue;
    if (!lines.length) continue;
    const raw = lines.join('\n');
    const p = project(input, `R${year - 2018}:${name}:narrative`, name, year, h[0] + name, h.index!);
    const a = raw.indexOf('【事業概要】\n'), b = raw.indexOf('\n【事業目的・効果】\n');
    if (a === 0 && b > 0) {
      const act = raw.slice('【事業概要】\n'.length, b), pur = raw.slice(b + '\n【事業目的・効果】\n'.length);
      if (!act.trim() || !pur.trim() || /【/.test(pur)) continue;
      p.activities = unwrap(act);
      p.purpose = unwrap(pur);
      p.evidence.push(evidence(input, act, at + '【事業概要】\n'.length), evidence(input, pur, at + b + '\n【事業目的・効果】\n'.length));
      p.warnings.push('鉾田市 地方創生推進交付金事業の評価結果の「事業の概要」欄のうち、【事業目的・効果】の段を目的、【事業概要】の段を事業内容として収録。欄の幅での折り返しだけをつないだ。');
    } else {
      if (a >= 0 || b >= 0) continue;
      p.activities = unwrap(raw);
      p.evidence.push(evidence(input, raw, at));
      p.warnings.push('鉾田市 地方創生推進交付金事業の評価結果の「事業の概要」欄を事業内容として収録（目的の欄はない）。欄の幅での折り返しだけをつないだ。');
    }
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '鉾田市 地方創生推進交付金事業の評価結果（令和2〜8年度）: 事業の概要（事業内容）、令和8年度版は【事業目的・効果】（目的）と【事業概要】（事業内容）。',
};
