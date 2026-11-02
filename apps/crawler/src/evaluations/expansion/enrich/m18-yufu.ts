import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { joinWrapped } from './m10-util';

// ---------------------------------------------------------------- 由布市（令和8年度 事務事業事後評価表、令和7年度実施事業）
// 公開済みレコードは同じ評価表の「事務事業名」ごとの事業（評価年度2026・事業年度2025、担当課つき）。
// 事業内容: 「事業の概要」欄。事務事業名の行の次の行から「総合計画実施計画との関連」の手前までの文で、欄の見出し「事業の概要」は
//   独立した行または行頭に置かれる（見出しの語だけを除く）。事務事業項目が長く次の行に折り返すおそれがあるシート
//   （事務事業名の行が45字以上）は、項目の続きと概要の境が決まらないため採らない。
// 目的は足さない。「(１)事業の目的」のうち「③意図」欄は「期待できる効果、今後の見通し等」を書く欄で目的ではなく、
// ①対象・②手段の欄は2列が同じ行に並ぶため。
const ID = '5a7fb2885a6e29fb775a7761';
const width = (s: string) => [...s].length;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '44213' || input.sourceId !== ID || !input.text.startsWith('令和８年度\n事務事業事後評価表\n令和７年度実施事業')) return [];
  const t = input.text, heads = [...t.matchAll(/^担当課 (\S+) 担当係 [^\n]*\n事務事業名 (.+?) 事務事業項目(?: ([^\n]*))?\n/gm)];
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    if (input.truncated && i === heads.length - 1) return;
    const start = h.index!, body = h.index! + h[0].length, seg = t.slice(body, heads[i + 1]?.index ?? t.length);
    const ov = /^((?:[^\n]+\n)+?)総合計画実施計画との関連\n/.exec(seg);
    if (!ov || width(h[0].split('\n')[1]) >= 45) return;
    const raw = ov[1].slice(0, -1), lines = raw.split('\n');
    const labeled = lines.filter(l => /^事業の概要(?: |$)/.test(l)).length;
    const text = lines.map(l => l.replace(/^事業の概要 ?/, '')).filter(Boolean);
    if (labeled !== 1 || !text.length || text.length > 4 || /^[\d,.%\s]+$/m.test(text.join('\n'))) return;
    const name = h[2].trim();
    const p = project(input, `${name}:narrative`, name, 2026, h[0].slice(0, -1), start);
    p.evaluatedFiscalYear = 2025;
    p.department = h[1];
    p.activities = joinWrapped(text.join('\n'), 45);
    p.evidence.push(evidence(input, raw, body));
    p.warnings.push('事務事業事後評価表の「事業の概要」欄（事業内容。欄の見出しの語を除き、欄の幅での折り返しだけを除いてつないだ）。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '由布市 令和8年度 事務事業事後評価表（令和7年度実施事業）: 事業の概要欄（事業内容）。③意図欄は期待できる効果・今後の見通しの欄で目的ではないため対象外。①対象・②手段の欄は2列が同じ行に並ぶため対象外。行財政改革推進計画の取組票は目的の欄がなく対象外。',
};
