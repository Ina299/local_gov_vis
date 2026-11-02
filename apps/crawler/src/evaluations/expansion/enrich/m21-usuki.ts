/**
 * 44206 臼杵市: 事務事業評価シート（令和3年度）。目的の欄はないため、「事業内容（経緯）」欄を事業内容、「成果」欄を成果として収録する。
 * 欄の見出しの次の段落を本文とし、段落の直後が次の欄の見出し（事業内容なら「指標名」、成果なら「指標名」か「説明・算式・引用」）の
 * ときだけ採る。事業名は「新規・継続」の次の段落（公開済みレコードと同じ表記）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { labelled, sheetRecord, type Field } from './m21-util';

const SHEET = /臼杵市 事務事業評価シート\n（ 令和3年度）\n/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '44206' || !/\/230406-1\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(SHEET)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    if (input.truncated && i === heads.length - 1) continue;
    const name = /\n新規・継続\n\n([^\n]+)\n\n事務事業名\n/.exec(seg);
    if (!name) continue;
    const fields: Field[] = [];
    const activities = labelled(seg, start, /事業\n内容\n（経緯）/, /指標名/);
    if (activities) fields.push({ key: 'activities', ...activities });
    const outcomes = labelled(seg, start, /成果/, /指標名|説明・算式・引用/);
    if (outcomes) fields.push({ key: 'outcomes', ...outcomes });
    if (!fields.length) continue;
    out.push(sheetRecord(input, `${start}`, { value: name[1].trim(), raw: name[1], at: start + name.index! + 8 },
      { evaluationYear: 2021, evaluatedFiscalYear: null }, null, fields,
      '臼杵市 事務事業評価シート（令和3年度）の「事業内容（経緯）」「成果」欄の本文を収録（PDFの折り返しの改行を除いた）。目的の欄はない。'));
  }
  return out;
}

export const entry = {
  extract,
  scope: '臼杵市 事務事業評価シート（令和3年度）の「事業内容（経緯）」「成果」欄。目的の欄はないため目的は補強しない。',
};
