import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 水俣市（教育委員会 点検評価報告書 令和３〜７年度実績）
// 公開済みレコードは同じ報告書の重要政策事業（対象年度＝表紙の「令和N年度実績」）。票の「１【事業の概要、目的・目標】」の
// 「事業の概要」を事業内容、「事業の目的・目標」を目的として取る。
// 令和３年度版は見出しの行の次に本文が続く。令和４年度版以降は見出し（「事業の概要」「事業の」「目的・目標」）が本文の途中の行頭や
// 単独の行に出力されるため、見出しの語だけを除く。欄の境目は空行で、本文が空行でちょうど2段落に分かれ、1段落目が句点で終わり、
// 1段落目に「事業の概要」、2段落目に「事業の」「目的・目標」の見出しがある版だけを採る（段落の途中に空行が入る版は境目が決まらない）。
const ITEM = '１【事業の概要、目的・目標】\n';
const END = '\n２【投入経費】';
const YEAR = /^水俣市教育委員会 ?\n?点検・?評価報告書\n（令和([３-９])年度実績）\n/;
const NAMES = [/\n政策事業名 [１-９] ([^\n]+)\n種別\n/g, /\n([^\n]+)\n\n１ ?水俣市総合計画に掲載された事業\n/g];
const LABEL_LINE = /^(事業の概要|事業の|目的・目標)$/;
const LABEL_HEAD = /^(事業の概要|目的・目標) /;

/** 見出しの語を除き、欄の幅での折り返しの改行を除く（句点で終わる行の後だけ改行を残す）。 */
function clean(raw: string): string {
  const lines = raw.split('\n').filter(l => !LABEL_LINE.test(l.trim())).map(l => l.replace(LABEL_HEAD, '').trim());
  return lines.reduce((acc, l, i) => acc + (i === 0 ? '' : lines[i - 1].endsWith('。') ? '\n' : '') + l, '');
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '43205' || input.format !== 'pdf') return [];
  const t = input.text, y = YEAR.exec(t);
  if (!y) return [];
  const year = 2018 + Number(String.fromCharCode(y[1].charCodeAt(0) - 0xfee0));
  const out: ProjectEvaluation[] = [];
  let prev = 0;
  for (let at = t.indexOf(ITEM); at >= 0; prev = at, at = t.indexOf(ITEM, at + 1)) {
    const end = t.indexOf(END, at);
    if (end < 0 || (input.truncated && t.indexOf(ITEM, at + 1) < 0)) continue;
    // 事業名: 直前の票の後で、この票の見出しより前にある最後の事業名の行（令和４年度版は「政策事業名」の行、ほかは計画区分の直前の行）。
    const names = (t.includes('\n政策事業名 ') ? NAMES.slice(0, 1) : NAMES.slice(1)).flatMap(re => [...t.slice(prev, at).matchAll(re)].map(m => ({ name: m[1].trim(), at: prev + m.index! + 1 + m[0].slice(1).indexOf(m[1]) })));
    if (!names.length) continue;
    const n = names.sort((a, b) => b.at - a.at)[0];
    const bodyAt = at + ITEM.length, body = t.slice(bodyAt, end);
    let summary: { raw: string; at: number }, purpose: { raw: string; at: number };
    const a = /^\n?事業の概要\n\n((?:[^\n]+\n)+)\n事業の\n目的・目標\n\n((?:[^\n]+\n)*[^\n]+)\n?$/.exec(body);
    if (a) {
      summary = { raw: a[1].trimEnd(), at: bodyAt + a[0].indexOf(a[1]) };
      purpose = { raw: a[2], at: bodyAt + a[0].lastIndexOf(a[2]) };
    } else {
      const lead = /^\n*/.exec(body)![0].length, trimmed = body.slice(lead).replace(/\n+$/, '');
      const paras = trimmed.split('\n\n');
      if (paras.length !== 2 || paras.some(p => !p.trim() || p.startsWith('\n'))) continue;
      const [p1, p2] = paras, l1 = p1.split('\n'), l2 = p2.split('\n');
      if (!l1[l1.length - 1].trim().endsWith('。')) continue;
      if (l1.filter(l => /^事業の概要( |$)/.test(l)).length !== 1 || l2.filter(l => l === '事業の').length !== 1
        || l2.filter(l => /^目的・目標( |$)/.test(l)).length !== 1 || l1.some(l => /^(事業の|目的・目標)( |$)/.test(l)) || l2.some(l => /^事業の概要/.test(l))) continue;
      summary = { raw: p1, at: bodyAt + lead };
      purpose = { raw: p2, at: bodyAt + lead + p1.length + 2 };
    }
    const p = project(input, `narrative:${n.name}:${year}`, n.name, null, n.name, n.at);
    p.projectCode = null; p.evaluatedFiscalYear = year;
    p.activities = clean(summary.raw);
    p.purpose = clean(purpose.raw);
    if (!p.activities || !p.purpose) continue;
    p.evidence.push(evidence(input, summary.raw, summary.at), evidence(input, purpose.raw, purpose.at));
    p.warnings.push('水俣市 教育委員会点検評価報告書の「事業の概要」欄を事業内容、「事業の目的・目標」欄を目的として収録。'
      + '本文の途中に出力された見出しの語（事業の概要・事業の・目的・目標）を除き、欄の幅での折り返しの改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '水俣市 教育委員会 点検評価報告書（令和３〜７年度実績）: 「事業の目的・目標」（目的）・「事業の概要」（事業内容）欄。欄の境目が空行で確定する版のみ。',
};
