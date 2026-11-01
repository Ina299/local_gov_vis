/**
 * 11222 越谷市: 平成３０年度実施事業 事務事業評価表（事後評価、部別PDF）。公開済みレコード（同じ評価表）の空欄の目的に「目的」欄を補う。
 * 「対象・目的・手段（内容）」の見出しと本文は別々に出力されるため、見出し「目的」の直後（空行のあと）の段落が句点で終わり、
 * その次の段落のあとに見出し「手段」が来る（＝目的の段落と手段の本文が区切られている）場合だけ採る。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';
import { sheets } from '../batch7/g1-util';

const HEADING = '平成３０年度実施事業 事務事業評価表（事後評価）';
/** 本文1行は60字余り。 */
const WRAP = 55;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11222' || input.format !== 'pdf' || !input.text.startsWith(HEADING) || input.truncated) return [];
  const out: ProjectEvaluation[] = [];
  for (const sheet of sheets(input.text, HEADING)) {
    const t = sheet.text;
    const name = t.match(/\n事業名 ([^\n]+)\n\n個別評価/), dept = t.match(/\n部名 ([^\n]+)\n課名 ([^\n]+)\n/);
    if (!name || !dept) continue;
    const m = [...t.matchAll(/\n目的\n\n(?!手段)/g)];
    if (m.length !== 1) continue;
    const from = m[0].index! + m[0][0].length, end = t.indexOf('\n\n', from);
    if (end < 0) continue;
    const raw = t.slice(from, end), lines = raw.split('\n');
    // 次の段落（手段の本文）のあとに見出し「手段」が来ること。
    const after = t.slice(end + 2, end + 2 + 400);
    const next = after.indexOf('\n\n');
    if (next < 0 || !/^手段( |\n)/.test(after.slice(next + 2)) || /手段|（内容）|対象|目的/.test(raw)) continue;
    if (!raw.endsWith('。') || lines.some((l, i) => i < lines.length - 1 && l.length < WRAP)) continue;
    const p = project(input, `narrative-${sheet.start}`, name[1], null, name[0].slice(1), sheet.start + name.index! + 1);
    p.id = stableId(input, `narrative-${sheet.start}`, null);
    p.department = `${dept[1]} ${dept[2]}`; p.evaluatedFiscalYear = 2018;
    p.purpose = lines.join('');
    p.evidence.push(evidence(input, HEADING, sheet.start), evidence(input, raw, sheet.start + from));
    p.warnings.push('越谷市 事務事業評価表（平成30年度実施事業）の「目的」欄を収録。見出し「目的」直後の段落で、次の段落のあとに見出し「手段」が続くものに限る。PDFの折り返しの改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '越谷市 平成30年度実施事業 事務事業評価表（部別PDF）の「目的」欄（見出しの直後の段落が句点で終わり、手段の見出しと区切られているもの）。手段（内容）・指標の説明は対象外。',
};
