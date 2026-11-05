/**
 * 07501 石川町（福島県）: 教育委員会点検・評価表（平成24年度評価・平成23年度事業実施状況）。
 * 各票の「２．事業の目的と概要」（目標値の行の手前まで）を目的、「３．平成 23 年度の事業実施状況」（決算額の行の手前まで）を
 * 事業内容、「５．事業の効果」を成果として収録する。事業名・年度・担当係は公開済みレコード（education-assist-supplement.ts）と
 * 同じ取り方（点検・評価項目の欄、評価2012・対象2011、「担当係」の欄）。平成29年度の報告書は外部評価委員の意見だけで
 * 目的の欄がないため対象外。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { unwrap } from './m1-util';
import { sheetRecord, type Field } from './m21-util';

const HEAD = /^平成 24 年度教育委員会点検・評価表（平成 23 年度事業実施状況）$/gm;
/** 公開済みレコードにした票（教育委員全般の活動・複数施設の整備・体育振興などの票は除外されている）。 */
const ALLOWED = new Set([0, 2, 4, 5, 7, 8, 10, 11, 14, 15]);
/** 目的と概要の欄の中の目標値の行（ここから先は目標なので採らない）。 */
const TARGET = /^(平成 ?(23|２３) ?年度(の)?目標値|＜２３年度目標値＞|（平成２３年度目標）|Ｂ\.23 年度目標値)/;

/** label の行の次の行から、stop に一致する行の手前までの行。 */
function section(raw: string, base: number, label: RegExp, stop: RegExp): { raw: string; at: number } | null {
  const m = label.exec(raw);
  if (!m) return null;
  const from = m.index + m[0].length + 1, lines: string[] = [];
  for (const l of raw.slice(from).split('\n')) { if (stop.test(l.trim())) break; lines.push(l); }
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (!lines.length || lines.join('').replace(/\s/g, '').length < 4) return null;
  return { raw: lines.join('\n'), at: base + from };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '07501' || input.sourceId !== 'bc5b06a13317fb6184b51600' || input.truncated) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (!ALLOWED.has(i)) continue;
    const start = heads[i].index!, raw = t.slice(start, heads[i + 1]?.index ?? t.length).replace(/（別紙 2）\n?$/, '');
    const n = /1. 点検・評価項目 ([^\n]+)|1. 点検・評価項目\n([^\n]+)/.exec(raw);
    if (!n || !raw.includes('６．課題と改善')) continue;
    const nameRaw = n[1] ?? n[2], name = nameRaw.replace(/^\([12]\)\s*/, '');
    const fields: Field[] = [];
    const purpose = section(raw, start, /^２．事業の目的と概要$/m, new RegExp(`${TARGET.source}|^３．`));
    if (purpose) fields.push({ key: 'purpose', ...purpose, value: unwrap(purpose.raw) });
    const activities = section(raw, start, /^３．平成 23 年度の事業実施状況$/m, /^（決算額|^４．/);
    if (activities) fields.push({ key: 'activities', ...activities, value: unwrap(activities.raw) });
    const outcomes = section(raw, start, /^５．事業の効果$/m, /^６．/);
    if (outcomes) fields.push({ key: 'outcomes', ...outcomes, value: unwrap(outcomes.raw) });
    if (!fields.length) continue;
    out.push(sheetRecord(input, `ishikawa:${i}`, { value: name, raw: nameRaw, at: start + n.index! + n[0].indexOf(nameRaw) },
      { evaluationYear: 2012, evaluatedFiscalYear: 2011 }, /担当係 ([^\n]+)/.exec(raw)?.[1] ?? null, fields,
      '石川町 教育委員会点検・評価表（平成23年度事業実施状況）の「事業の目的と概要」（目標値の行を除く）を目的、「事業実施状況」（決算額の行を除く）を事業内容、'
      + '「事業の効果」を成果として収録（PDFの欄幅での折り返しの改行を除いた）。'));
  }
  return out;
}

export const entry = {
  extract,
  scope: '石川町（福島県）教育委員会点検・評価表（平成23年度事業実施状況）の「事業の目的と概要」「事業実施状況」「事業の効果」欄。平成29年度の報告書（外部評価意見のみ）は対象外。',
};
