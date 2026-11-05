import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m17-util';

// ---------------------------------------------------------------- 西川町（教育委員会事務事業点検・評価報告書 令和6・7年度）
// 公開済みレコードは同じ報告書の「事務事業点検・評価調書」の事業名から作られ、年度は表紙の「令和X年度」（evaluatedFiscalYear）。
// 調書ごとに「２ 事業の概要」の「事業目的」欄を目的、「事業内容」欄を事業内容、「４ 事業の実施状況」欄を成果とする。
// どの欄も見出しの直後から次の見出しの手前までが空行を含まない1段の場合のみ採る（段組みで他の欄の文が混ざる調書は採らない）。
// 事業名は「１ 事業名等」から施策体系の手前までの段のうち、所管課・係や見出しでない1行の段が1つだけの場合に採る。
const TITLE = /^令和([０-９]+)年度\n西川町教育委員会事務事業点検・評価報告書$/m;
const SHEET = /^事務事業点検・評価調書\n/gm;
const NOT_NAME = /^(事業名|[^\n]{1,8}[課係])$|^([０-９\d]|（|〔|施策体系)/;
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

function field(seg: string, head: string, next: string): { raw: string; at: number } | null {
  const a = seg.indexOf(head);
  if (a < 0) return null;
  const at = a + head.length, b = seg.indexOf(next, at);
  if (b < 0) return null;
  const raw = seg.slice(at, b);
  if (!raw.trim() || raw.includes('\n\n')) return null;
  return { raw, at };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '06322' || !/\/uploaded\/attachment\/\d+\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, title = TITLE.exec(t), out: ProjectEvaluation[] = [];
  if (!title) return [];
  const year = 2018 + Number(ascii(title[1]));
  const heads = [...t.matchAll(SHEET)];
  heads.forEach((h, i) => {
    if (input.truncated && i === heads.length - 1) return;
    const start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const n0 = seg.indexOf('１ 事業名等\n'), n1 = seg.search(/施策体系|〔第/);
    if (n0 < 0 || n1 < n0) return;
    const names = seg.slice(n0 + '１ 事業名等\n'.length, n1).split('\n\n').map(s => s.trim()).filter(s => s && !s.includes('\n') && !NOT_NAME.test(s));
    if (names.length !== 1) return;
    const name = names[0];
    const nameAt = seg.indexOf(`\n${name}\n`, n0) + 1;
    if (nameAt <= 0) return;
    const p = project(input, `R${title[1]}:${name}:narrative`, name, null, name, start + nameAt);
    p.evaluatedFiscalYear = year;
    p.evidence.push(evidence(input, title[0], title.index!));
    const pu = field(seg, '\n２ 事業の概要\n事業目的\n\n', '\n\n事業内容\n\n');
    const ac = field(seg, '\n\n事業内容\n\n', '\n\n３ 予算額・決算額\n');
    const oc = field(seg, '\n４ 事業の実施状況\n', '\n\n５ 事業の評価\n');
    if (pu) { p.purpose = unwrap(pu.raw); p.evidence.push(evidence(input, pu.raw, start + pu.at)); }
    if (ac) { p.activities = unwrap(ac.raw); p.evidence.push(evidence(input, ac.raw, start + ac.at)); }
    if (oc) { p.outcomes = unwrap(oc.raw); p.evidence.push(evidence(input, oc.raw, start + oc.at)); }
    if (!pu && !ac && !oc) return;
    p.warnings.push('西川町教育委員会 事務事業点検・評価調書の「事業目的」欄を目的、「事業内容」欄を事業内容、「事業の実施状況」欄を成果として収録'
      + '（欄が空行を含まない1段の場合のみ）。欄の幅での折り返しだけをつないだ。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '西川町 教育委員会事務事業点検・評価報告書（令和6・7年度）の点検・評価調書: 事業目的（目的）・事業内容・事業の実施状況（成果）。',
};
