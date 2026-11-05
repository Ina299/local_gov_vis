/**
 * 28213 西脇市: 令和05年度 当初予算事業の概要説明書（兼評価説明書）。「２．対象・目的・内容」の「事業の目的
 * （どういう状態にするために）」を目的、「事業概要」を事業内容、「実績・成果等の説明」を成果として収録する。
 * 目的の本文は見出しの前に出る形（「（誰・何を）」の後の段落の次に「事業の目的」）と後に出る形（「事業の目的」の次の段落の後に
 * 「事業の対象」）があり、どちらかの形に一致する場合だけ採る。「事業の内容」は見出し「（どういう内容を行うのか)」が本文の行に
 * 入り込むため採らない。年度は公開済みレコードと同じ（評価年度 令和5年度）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { sheetRecord, type Field } from './m21-util';

const PARA = '((?:[^\\n]+\\n)*?[^\\n]+)';
const PURPOSE = [
  new RegExp(`\\n（誰・何を）\\n\\n${PARA}\\n\\n?事業の目的\\n（どういう状態\\nにするために\\)\\n`),
  new RegExp(`\\n事業の目的\\n\\n${PARA}\\n\\n事業の対象\\n\\n（どういう状態\\nにするために\\)\\n`),
];
const OVERVIEW = new RegExp(`\\n２．対象・目的・内容\\n${PARA}\\n\\n事業概要\\n`);
const RESULT = new RegExp(`\\n単位当たりのコスト\\n\\n${PARA}\\n\\n実績・成果\\n等の説明\\n`);

function field(t: string, re: RegExp, key: Field['key']): Field | null {
  const m = re.exec(t);
  return m ? { key, raw: m[1], at: m.index! + m[0].indexOf(m[1]) } : null;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '28213' || !/\/R5[a-z-]+_hyoukahyou\.pdf$/.test(input.sourceUrl)
    || !input.text.startsWith('令和05年度\n\n当初予算事業の概要説明書\n（兼評価説明書）\n')) return [];
  const t = input.text, name = /\n要求区分\n\n([^\n]+)\n\n\d{5}\n/.exec(t);
  if (!name) return [];
  const fields = [field(t, PURPOSE[0], 'purpose') ?? field(t, PURPOSE[1], 'purpose'), field(t, OVERVIEW, 'activities'), field(t, RESULT, 'outcomes')]
    .filter((f): f is Field => f !== null);
  if (!fields.length) return [];
  const at = name.index! + name[0].indexOf(name[1]);
  return [sheetRecord(input, 'nishiwaki', { value: name[1].trim(), raw: name[1], at }, { evaluationYear: 2023, evaluatedFiscalYear: null }, null, fields,
    '西脇市 当初予算事業の概要説明書（兼評価説明書、令和05年度）の「事業の目的」を目的、「事業概要」を事業内容、「実績・成果等の説明」を成果として収録（PDFの改行を除いた）。')];
}

export const entry = {
  extract,
  scope: '西脇市 当初予算事業の概要説明書（兼評価説明書、令和05年度）の「事業の目的」「事業概要」「実績・成果等の説明」。「事業の内容」（見出しが本文に混在）は対象外。',
};
