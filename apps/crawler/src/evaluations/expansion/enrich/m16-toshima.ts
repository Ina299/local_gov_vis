import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 豊島区 令和4年度（令和5年度実施）事務事業評価表（事業ごとのPDF）
// 公開済みレコードは同じ評価表から作られ、目的が空。「１．事業の概要」の「（２）事業の目的・期待する効果」欄を目的として足す。
// 抽出テキストでは欄の見出し（「事業の目的・期」「待する効果」、または「事業の目的・」「期待する効果」）が本文の行の間・
// 行頭に挟まるため、見出しの断片（定形）の行・行頭だけを除き、残りの行を欄の本文とする。欄は「（２）」の行から
// 「（３）事業概要」の行の手前まで。根拠は見出しを含む原文のまま。
// 「（３）事業概要」は見出しと同じ行に1行だけ書かれ、空行で終わる場合に限って事業内容として足す（2行以上は右の
// 取組内容の列と混ざるため採らない）。
const LABEL = /^(事業の目的・期|待する効果|事業の目的・|期待する効果|事業の目的・期待する効果)$/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13116' || !/\/documents\/37123\/[0-9]{2}_[a-z0-9]+\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text;
  const head = /^令和([0-9０-９]+)年度（令和([0-9０-９]+)年度実施）事務事業評価表\n/.exec(t);
  // 事務事業名は見出しの次の行・同じ行のいずれか（担当組織が前後に来る）。
  const nm = /\n(事務事業名(?:\n\n| )(?!担当組織 )([^\n]+?))(?:\n\n担当組織 | 担当組織 |\n\n)/.exec(t.slice(0, 400))
    ?? /\n(事務事業名\n\n担当組織 [^\n]+\n\n([^\n]+))\n\n/.exec(t.slice(0, 400));
  if (!head || !nm) return [];
  const n = (s: string) => Number(s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
  const name = nm[2].trim();
  const p = project(input, `${name}:purpose`, name, 2018 + n(head[2]), nm[1], nm.index + 1);
  p.evaluatedFiscalYear = 2018 + n(head[1]);
  const a = t.indexOf('\n（２）\n'), b = t.indexOf('\n（３）事業概要', a);
  if (a < 0 || b < 0 || t.indexOf('\n（２）\n', a + 1) >= 0) return [];
  const raw = t.slice(a + '\n（２）\n'.length, b);
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l && !LABEL.test(l)).map(l => l.replace(/^事業の目的・期 /, ''));
  if (!lines.length || lines.some(l => /^事業の目的・|^待する効果|^（[０-９]）/.test(l))) return [];
  // 欄の幅で折り返した行（句点で終わらず、欄の最長行に近い長さの行）の後の改行だけを除く。
  const width = Math.max(...lines.map(l => l.length));
  p.purpose = lines.reduce((acc, l, i) => acc + (i === 0 ? '' : lines[i - 1].length >= width - 3 && !/[。．]$/.test(lines[i - 1]) ? '' : '\n') + l, '');
  p.evidence.push(evidence(input, raw, a + '\n（２）\n'.length));
  p.warnings.push('豊島区 事務事業評価表の「（２）事業の目的・期待する効果」欄。本文に挟まる欄の見出しの断片（「事業の目的・期」「待する効果」等）だけを除き、欄の幅で折り返した改行を除いた。');
  const act = /^（３）事業概要 ([^\n]+)\n\n/.exec(t.slice(b + 1));
  if (act && /。$/.test(act[1])) {
    p.activities = act[1].trim();
    p.evidence.push(evidence(input, act[1], b + 1 + '（３）事業概要 '.length));
  }
  return [p];
}

export const entry = { extract, scope: '豊島区 令和4年度（令和5年度実施）事務事業評価表の「事業の目的・期待する効果」欄と、1行で書かれた「事業概要」。公開済みの評価表由来レコードの補強用。' };
