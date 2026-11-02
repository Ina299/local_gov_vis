import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 東かがわ市 ＰＤＣＡチェックシート（令和５年度実施分、R6_PDCA_all.pdf）
// 公開済みレコードは同じ冊子のチェックシートから作られ、目的が空。シートの【Plan】列の「■目的」欄を目的として足す。
// 抽出テキストでは見出し（■目的・■具体的取組・■成果指標の具体的検証結果）が先に並び、その後に各欄の本文が空行区切りで
// 続く。最初の本文ブロックが「■目的」欄であるのは、見出しの並びがこの形（■目的→■具体的取組→本文）の場合に限る。
// また「■目的」の直後に本文があり空行の後に【Do】が続く形も採る。【Do】・【Check】列の本文が同じ行に混ざった
// （右の列の文言を含む）ブロックは採らない。具体的取組の欄は右の列と混ざって終わりが確定しないため対象外。
const MIXED = /（インプット|達成状況|検証結果|■|【|^\s*$/m;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '37207' || !/\/material\/files\/group\/25\/R6_PDCA_all\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(/ＰＤＣＡチェックシート\n実施年度\n\n令和([０-９\d]+)年度\n/g)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const start = heads[i].index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const year = 2018 + Number(heads[i][1].replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
    const after = heads[i][0].length;
    const nm = /^(?:\n事務事業名\n\n([^\n【]+)\n【Plan】 計画\n|([^\n【]+)\n\n事務事業名\n)/.exec(seg.slice(after));
    if (!nm) continue;
    const name = (nm[1] ?? nm[2]).trim();
    // 本文ブロック（空行から空行まで）の位置を決める。
    let at = -1;
    const a = /\n■目的\n\n■具体的取組\n\n(?:■成果指標の具体的検証結果\n\n)?/.exec(seg);
    const b = /\n■目的\n(?=[^\n■【])/.exec(seg);
    if (a) at = a.index + a[0].length;
    else if (b) at = b.index + b[0].length;
    if (at < 0) continue;
    const end = seg.indexOf('\n\n', at);
    if (end < 0) continue;
    const raw = seg.slice(at, end);
    if (MIXED.test(raw)) continue;
    if (!a && !seg.startsWith('\n\n【Do】 実施・実行\n', end)) continue;
    const p = project(input, `${name}:purpose`, name, null, seg.slice(after, after + nm[0].length - 1), start + after);
    p.evaluatedFiscalYear = year;
    p.purpose = unwrap(raw);
    p.evidence.push(evidence(input, raw, start + at));
    p.warnings.push('東かがわ市 ＰＤＣＡチェックシートの【Plan】列「■目的」欄（欄の幅で折り返した改行のみ除去）。見出しの並びから欄の位置が確定するシートに限る。');
    out.push(p);
  }
  return out.filter(p => out.filter(o => o.projectName === p.projectName).length === 1);
}

export const entry = { extract, scope: '東かがわ市 ＰＤＣＡチェックシート（令和５年度実施分）の「■目的」欄。公開済みのチェックシート由来レコードの補強用。' };
