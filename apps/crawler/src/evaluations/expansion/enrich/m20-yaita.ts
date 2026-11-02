import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 矢板市（地方創生臨時交付金 個別事業の評価報告）
// 公開済みレコードは同じ評価報告（令和３年度分 16153.pdf、令和５年度分 20476.pdf・21093.pdf）の事業ごとの票で、
// 対象年度（evaluatedFiscalYear）は票の「事業年度」。令和４年度分（18382.pdf）の公開済みレコードは年度を持たず突き合わせできない。
// 票に「目的」欄はなく、「事業概要」欄（事業の目的と内容を1段落で書いたもの）を事業内容として取る。本文が見出しの次の段落にあり、
// その直後に「事業経過等」が続く版だけ（見出しの後に総事業費・事業番号などの別の欄が割り込む版は採らない）。
// 成果は「① 成果・効果」の見出しの直後に「① 」で始まる本文があり、その後「② 成果等測定方法」の見出しが続く版だけ取る
// （見出しと本文が交互に出力される版は対応が並び順でしか決まらないため採らない）。
const HEAD = /^事業年度\n\n令和 ?([０-９\d元]+) ?年度\n/gm;
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
const NAME = /\n事業名\n\n([^\n]+)\n/;
const SUMMARY = /\n事業概要\n\n((?:[^\n]+\n)+)\n事業経過等\n/;
const OUTCOME = /\n①\s?成果・効果\n\n(① (?:[^\n]+\n)+)\n②\s?成果等測定方法\n/;
const FILES = /\/uploaded\/attachment\/(16153|20476|21093)\.pdf$/;

/** 欄の幅での折り返しの改行を除く（欄は1段落の文章なので、句点で終わる行の後だけ改行を残す）。 */
const join = (lines: string[]) => lines.reduce((acc, l, i) => acc + (i === 0 ? '' : lines[i - 1].endsWith('。') ? '\n' : '') + l, '');

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '09211' || input.format !== 'pdf' || !FILES.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const h = heads[i], start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const name = NAME.exec(seg), s = SUMMARY.exec(seg);
    if (!name || !s) continue;
    const lines = s[1].trimEnd().split('\n').map(l => l.trim());
    // 本文は文章であること（金額・日付・課名だけの行が混ざる版は採らない）。
    if (!lines.join('').includes('。') || lines.some(l => /^[\d,０-９ ]+円$|^R\d|^[^\s。、]*課$|^\d+(,\d+)*$/.test(l))) continue;
    const year = 2018 + (h[1] === '元' ? 1 : Number(ascii(h[1])));
    const p = project(input, `narrative:${name[1].trim()}:${year}`, name[1].trim(), null, seg.slice(0, name.index + name[0].length - 1), start);
    p.projectCode = null; p.evaluatedFiscalYear = year;
    p.activities = join(lines);
    p.evidence.push(evidence(input, s[1].trimEnd(), start + s.index + '\n事業概要\n\n'.length));
    const o = OUTCOME.exec(seg);
    if (o) {
      const ol = o[1].trimEnd().split('\n').map(l => l.trim());
      if (!ol.some(l => /^[②③]|成果等測定方法|^③評価/.test(l))) {
        p.outcomes = join(ol).replace(/^① /, '');
        p.evidence.push(evidence(input, o[1].trimEnd(), start + o.index + o[0].indexOf(o[1])));
      }
    }
    p.warnings.push('矢板市 地方創生臨時交付金 個別事業の評価報告の「事業概要」欄を事業内容として収録（目的欄はない）。'
      + '成果は「① 成果・効果」の本文が見出しの直後に続く版のみ。欄の幅での折り返しの改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '矢板市 地方創生臨時交付金 個別事業の評価報告（令和３・５年度分）: 「事業概要」欄（事業内容）と「① 成果・効果」欄（見出しと本文の対応が確定する版のみ）。目的欄はない。',
};
