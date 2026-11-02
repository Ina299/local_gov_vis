import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 熊谷市（外部評価の事業概要説明シート、目的・手段・手法）
// 公開済みレコードは外部評価の事業概要説明シート（gaiyou-A/B.pdf は平成23年度、sheetA/B.pdf は平成24年度の評価、各12事業）。
// 公開済みレコードの年度はコスト表の「(予算)」の年度（シートの最新年度）で、ここでも各シートの「平成ｎ年度(予算)」から取る。
// 「1 事業概要」の「目的(何のために)」欄を目的、「手段・手法(どのように何を提供するか)」欄を事業内容とする。
// 欄は見出しの次の行から次の見出し（対象(誰に)／実施形態・A．直営など）の手前までの行（目的は見出しの前の空行1つまで可）で、途中に空行を含む版・施策名の行が混ざる版は採らない。
const NAME = /^事務事業名称\n\n([^\n]+)\n/gm;
const PURPOSE = /\n目的\(何のために\)\n((?:[^\n]+\n)+?)\n?対象[(（]誰に[)）]\n/;
const MEANS = /\n手段・手法\(どのように何を提供するか\)\n((?:[^\n]+\n)+?)(?=実施形態|[ABC][．.]|委託内容と実施主体|\n)/;
const BUDGET = /平成([０-９]+)年度\(予算\)/g;
const WIDE = 36;
const MARK = /^([①-⑳・※●○◎■□〔【]|[0-9０-９]+[).）．.]|[（(][0-9０-９]+[）)])/;
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
/** 欄の幅に近い（WIDE字以上で句点で終わらない）行の後の改行だけを除く。箇条の行の前の改行は残す。 */
const join = (lines: string[]) => lines.reduce((acc, l, i) => acc + (i === 0 ? '' : lines[i - 1].length >= WIDE && !lines[i - 1].endsWith('。') && !MARK.test(l) ? '' : '\n') + l, '');
const field = (raw: string) => {
  const lines = raw.replace(/\n$/, '').split('\n').map(l => l.trim());
  if (!lines.length || lines.some(l => !l || /^施策\d|^[\d,.\s%％-]+$/.test(l))) return null;
  return join(lines);
};

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11202' || input.format !== 'pdf' || !/\/gaibu1\.files\/(gaiyou-[AaBb]|sheet[AB])\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(NAME)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const start = heads[i].index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    // 年度はシート内の「(予算)」の年度がただ1つの場合だけ。
    const years = new Set([...seg.matchAll(BUDGET)].map(m => 1988 + Number(ascii(m[1]))));
    if (years.size !== 1) continue;
    const p0 = PURPOSE.exec(seg), m0 = MEANS.exec(seg);
    const purpose = p0 && field(p0[1]);
    if (!p0 || !purpose) continue;
    const activities = m0 ? field(m0[1]) : null;
    const name = heads[i][1].trim();
    const p = project(input, `narrative:${name}`, name, [...years][0], heads[i][0].slice(0, -1), start);
    p.projectCode = null;
    p.purpose = purpose;
    p.activities = activities;
    p.evidence.push(evidence(input, p0[1].slice(0, -1), start + p0.index + p0[0].indexOf(p0[1])));
    if (activities) p.evidence.push(evidence(input, m0![1].slice(0, -1), start + m0!.index + m0![0].indexOf(m0![1])));
    p.warnings.push('熊谷市 外部評価 事業概要説明シート「1 事業概要」の「目的(何のために)」欄を目的、「手段・手法(どのように何を提供するか)」欄を事業内容として収録。'
      + '年度はシートのコスト表の「(予算)」の年度。欄の幅での折り返しの改行だけを除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '熊谷市 外部評価 事業概要説明シート（平成23年度 gaiyou-A/B.pdf、平成24年度 sheetA/B.pdf）: 「目的(何のために)」・「手段・手法」欄。',
};
