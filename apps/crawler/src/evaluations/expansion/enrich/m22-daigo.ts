import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { centeredEnd, joinWrapped } from './m22-util';

// ---------------------------------------------------------------- 大子町（令和５年度 事務事業評価調査書）
// 公開済みレコードは同じ資料（1693881482_doc_14_0.pdf）から作られ、目的は見出しと同じ行に1行で書かれた事業だけにある。
// 目的が複数行の調査書では、見出し「目的」が欄の縦の中央の単独の行になり、続く「事務事業内容」欄の文と行が続く。
// 見出しの前後の行数が揃い句点で終わる位置を欄の終わりとし（m22-util の centeredEnd）、1つに決まる場合だけ採る。
const STOP = /^事務事業内容/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '08364' || !input.sourceUrl.endsWith('/1693881482_doc_14_0.pdf')) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  for (const h of t.matchAll(/\n令和 5 年度 事務事業評価調査書\n[\s\S]*?\n事務事業名 ([^\n]+)\n対象 [^\n]+\n/g)) {
    if (h[0].slice(1).includes('\n令和 5 年度 事務事業評価調査書\n')) continue;
    const at = h.index! + h[0].length, lines = t.slice(at, at + 2000).split('\n');
    const li = lines.findIndex(l => l === '目的' || l.startsWith('目的 '));
    if (li < 0 || li > 4 || lines.slice(0, li).some(l => !l.trim() || STOP.test(l))) continue;
    const inline = lines[li].slice(2).trim(), end = centeredEnd(lines, li, inline, STOP);
    if (end === null) continue;
    const name = h[1].trim();
    const p = project(input, `${name}:purpose`, name, 2023, `事務事業名 ${h[1]}`, h.index! + h[0].indexOf('事務事業名 '));
    p.projectCode = null;
    p.purpose = joinWrapped([...lines.slice(0, li), ...(inline ? [inline] : []), ...lines.slice(li + 1, end + 1)]);
    p.evidence.push(evidence(input, lines.slice(0, end + 1).join('\n'), at));
    p.warnings.push('大子町 令和５年度 事務事業評価調査書の「目的」欄。見出しを除き、欄の幅での折り返しは改行を除いてつないだ。'
      + '事務事業内容欄との区切りは、見出しが欄の縦の中央にあることから前後の行数で判定（1つに決まる場合のみ）。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '大子町 令和５年度 事務事業評価調査書: 目的欄（複数行で見出しが単独の行になるものを含む。事務事業内容欄との区切りが1つに決まるもの）。',
};
