import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 昭和村（令和５年度 教育委員会 点検・評価報告書の令和４年度 事業評価シート、事業の目的・内容）
// 公開済みレコードは同じ報告書（tenken_hyoukahoukokusho_r05.pdf）の事業評価シート21件（対象年度2022、実績・成果は収録済み）。
// 「事業の目的」欄は「事業名」の行の次の行から始まり、欄見出し「事業の目的」は本文の途中に単独の行か行頭に出力される。
// 見出しを除いて句点で終わる最初の行までを目的とし、途中の行がすべて欄の幅いっぱい（本文の最長の行から3字以内）で、
// 最後の行が欄の幅より短い（同じ欄に次の文が続かない）ことを確かめる。続く行から「事業の対象」の行の手前までを事業の内容とする
// （欄見出し「事業の内容」は同じく単独の行か行頭）。年度は各シートの見出し「令和ｎ年度 事業評価シート」の年度を対象年度とする。
const HEAD = /^令和([０-９]+)年度 事業評価シート\n/gm;
const NAME = /^事業名 [①-⑳] ?([^\n]+)\n/m;
const MARK = /^([○・●◎■□※]|[0-9０-９]+ )/;
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

interface Line { text: string; raw: string; at: number }
function lines(t: string, from: number, to: number): Line[] {
  const out: Line[] = [];
  let pos = from;
  while (pos < to) {
    const nl = t.indexOf('\n', pos), end = nl < 0 || nl > to ? to : nl, raw = t.slice(pos, end);
    out.push({ text: raw.replace(/^事業の(目的|内容)(?: |$)/, '').trim(), raw, at: pos });
    pos = end + 1;
  }
  return out;
}
const join = (ls: string[], width: number) => ls.reduce((acc, l, i) => acc + (i === 0 ? '' : ls[i - 1].length >= width - 3 && !ls[i - 1].endsWith('。') && !MARK.test(l) ? '' : '\n') + l, '');

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '07446' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/tenken_hyoukahoukokusho_r05.pdf') || input.truncated) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const n = NAME.exec(seg), target = seg.indexOf('\n事業の対象 ');
    if (!n || target < 0) continue;
    const all = lines(t, start + n.index + n[0].length, start + target), body = all.filter(l => l.text);
    // 目的: 句点で終わる最初の行まで。
    const end = body.findIndex(l => l.text.endsWith('。'));
    if (end < 0) continue;
    const pur = body.slice(0, end + 1), acts = body.slice(end + 1), width = Math.max(...body.map(l => l.text.length));
    if (pur.slice(0, -1).some(l => l.text.length < width - 3) || (pur.length > 1 && pur[pur.length - 1].text.length >= width - 1)) continue;
    // 見出しの行は目的・内容それぞれに1つだけで、目的の見出しは内容の本文より前、内容の見出しは目的の本文より後にあること
    // （見出しが相手の欄の側に出力された版は欄の境界が違うおそれがあるので採らない）。
    const purEnd = pur[pur.length - 1].at, actStart = acts[0]?.at ?? start + target;
    const labels = (k: string) => all.filter(l => new RegExp(`^事業の${k}(?: |$)`).test(l.raw));
    const lp = labels('目的'), la = labels('内容');
    if (lp.length !== 1 || lp[0].at >= actStart || (acts.length ? la.length !== 1 || la[0].at <= purEnd : la.length)) continue;
    const name = n[1].trim();
    const p = project(input, `narrative:${name}`, name, null, n[0].slice(0, -1), start + n.index);
    p.projectCode = null; p.evaluatedFiscalYear = 2018 + Number(ascii(heads[i][1]));
    p.purpose = join(pur.map(l => l.text), width);
    const contentful = acts.filter(l => l.text);
    p.activities = contentful.length ? join(contentful.map(l => l.text), width) : null;
    const raw = (ls: Line[]) => t.slice(ls[0].at, ls[ls.length - 1].at + ls[ls.length - 1].raw.length);
    p.evidence.push(evidence(input, heads[i][0].slice(0, -1), start), evidence(input, raw(pur), pur[0].at));
    if (contentful.length) p.evidence.push(evidence(input, raw(acts), acts[0].at));
    p.warnings.push('昭和村 令和４年度 事業評価シートの「事業の目的」欄を目的、「事業の内容」欄を事業内容として収録。'
      + '欄見出しが本文の途中・行頭に出力されるため見出しを除き、目的は句点で終わる最初の行まで（途中の行が欄の幅いっぱいで、最後の行が欄の幅より短いもの）に限る。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '昭和村 令和５年度 教育委員会 点検・評価報告書（tenken_hyoukahoukokusho_r05.pdf）の令和４年度 事業評価シート: 「事業の目的」・「事業の内容」欄。',
};
