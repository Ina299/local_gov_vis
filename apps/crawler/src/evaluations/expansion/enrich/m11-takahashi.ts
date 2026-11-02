/**
 * 33209 高梁市: 令和５・６年度 高梁市事務事業評価シート。公開済みレコードの空欄の目的を補う。
 * 目的欄の本文が1行のシート（「目 的 …」が1行）は公開済み。ここでは本文が複数行で、欄の見出しが本文の行の間に
 * 単独の行として出るものを読む。本文は「事業内容」の行の次から「対 象」欄の見出しの手前まで（見出しの行を除く）。
 * 見出しは欄の縦の中央に印字されるため、見出しの前後の行数が等しいことを求める（対象欄の本文が見出しより上に
 * 割れて出た行を目的に含めないため）。さらに各行は、前の行が欄の幅いっぱいで句点で終わらない（折り返し）か、
 * 箇条の記号で始まるかのどちらかであること。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';

const SHEET = /令和([５６])年度 [高⾼]梁市事務事業評価シート\n作成[日⽇][^\n]*\n部 会 名[^\n]*\n(事業番号 (\d+) 事 業 名 (.+?) 所 属 名 ([^\n]+))\n係 名[^\n]*\nⅠ 計画\n事業内容\n/g;
const LABEL = /^(目 的|事 業 の 目 的)$/, TARGET = /^(対 象|事 業 の 対 象 者)( |$)/;
const MARK = /^(・|･|※|【|［|〔|＜|<|◆|◇|■|□|●|○|◎|[①-⑳]|（[0-9０-９]+）|\([0-9]+\))/;
/** 本文1行は令和５年度様式で全角60字余り、令和６年度様式で70字前後。 */
const WRAP = { 2023: 55, 2024: 62 } as const;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '33209' || input.format !== 'pdf') return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(SHEET)) {
    const year = m[1] === '５' ? 2023 : 2024, wrap = WRAP[year];
    const from = m.index! + m[0].length, lines: string[] = [];
    let pos = from;
    while (lines.length < 12) {
      const nl = t.indexOf('\n', pos);
      if (nl < 0) break;
      const l = t.slice(pos, nl);
      if (TARGET.test(l)) break;
      lines.push(l); pos = nl + 1;
    }
    if (!TARGET.test(t.slice(pos, t.indexOf('\n', pos)))) continue;
    const at = lines.findIndex(l => LABEL.test(l));
    if (at < 1 || lines.filter(l => LABEL.test(l)).length !== 1 || at !== lines.length - 1 - at) continue;
    const body = lines.filter((_, i) => i !== at);
    if (!body.every((l, i) => l.trim() && (i === 0 || MARK.test(l) || (body[i - 1].length >= wrap && !/。$/.test(body[i - 1]))))) continue;
    const value = body.reduce((acc, l, i) => acc + (i === 0 ? '' : MARK.test(l) ? '\n' : '') + l, '');
    const name = m[4].trim();
    const p = project(input, `narrative|${m[3]}`, name, year, m[2], m.index! + m[0].indexOf(m[2]));
    p.id = stableId(input, `narrative|${m[3]}|${m.index}`, year); p.projectCode = null;
    p.department = m[5].trim(); p.purpose = value;
    p.evidence.push(evidence(input, m[0].slice(0, m[0].indexOf('\n')), m.index!), evidence(input, lines.join('\n'), from));
    p.warnings.push(`高梁市 令和${m[1]}年度 事務事業評価シートの「${lines[at]}」欄（本文が複数行のもの）を収録。本文の行の間に出る欄の見出しの行とPDFの折り返しの改行を除いた。`);
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '高梁市 令和５・６年度 事務事業評価シートの目的欄のうち、本文が複数行で欄の見出しが本文の行の間に単独で出るもの（見出しの前後の行数が等しいもの）。',
};
