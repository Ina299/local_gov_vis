/**
 * 19205 山梨市: 令和５年度 教育委員会自己点検・評価報告書（令和４年度事業対象）の事務事業ごとの評価シート。
 * 公開済みレコード（事業名・評価年度2023・対象年度2022）に、「事業の目的」の表の「意図」（○○という状態にする）を目的として、
 * 「ＤＯ（事務事業の実施）」の「事業内容（方法・手段など）」の令和４年度実施事業の欄を事業内容として足す。
 * 事業内容は、欄の本文が「令和４年度／実施事業」の見出しの前か後のどちらか一方だけにまとまり、直後が「ＣＨＥＣＫ」の見出しの場合だけ
 * 採る（見出しの後に⇒の補足が続くシートは、欄の本文の区切りが決まらないため採らない）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { type Field, sheetRecord } from './m24-util';

const HEAD = /\n\n([^\n]+課)\n\n([①-⑳])\n\n([^\n]+)\n\nＰＬＡＮ（計画）/g;
const INTENT = /\n意\n\n((?:[^\n]+\n)*?[^\n]+)\n\nという状態にする\n/;
const YEAR = '令和[4４]年度\n実施事業';
const ACT_AFTER = new RegExp(`\\n事業内容（方法・手段など）\\n\\n${YEAR}\\n\\n((?:[^\\n]+\\n)*?[^\\n]+)\\n\\nＣＨＥＣＫ（担当課による評価）`);
const ACT_BEFORE = new RegExp(`\\n事業内容（方法・手段など）\\n\\n?((?:[^\\n]+\\n)*?[^\\n]+)\\n\\n${YEAR}\\n\\nＣＨＥＣＫ（担当課による評価）`);

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '19205' || !input.sourceUrl.endsWith('/uploaded/attachment/4753.pdf') || input.truncated) return [];
  const t = input.text;
  if (!t.includes('【令和 4 年度事業対象】')) return [];
  const heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i], start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const fields: Field[] = [];
    const intent = INTENT.exec(seg);
    if (intent) fields.push({ key: 'purpose', raw: intent[1], at: start + intent.index! + 4 });
    const act = ACT_AFTER.exec(seg) ?? ACT_BEFORE.exec(seg);
    if (act) fields.push({ key: 'activities', raw: act[1], at: start + act.index! + act[0].indexOf(act[1]) });
    if (!fields.length) continue;
    const nameAt = start + h[0].lastIndexOf(`${h[3]}\n\nＰＬＡＮ`);
    const p = sheetRecord(input, h[3], { value: h[3], raw: h[3], at: nameAt }, { evaluationYear: 2023, evaluatedFiscalYear: 2022 }, fields,
      '山梨市教育委員会 自己点検・評価報告書（令和４年度事業対象）の評価シート。「事業の目的」の表の「意図」（という状態にする）を目的、'
      + '「事業内容（方法・手段など）」の令和４年度実施事業の欄を事業内容として収録。折り返しの改行を除いた。');
    if (intent) p.purpose = intent[1].split('\n').join('');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '山梨市 教育委員会自己点検・評価報告書（令和４年度事業対象）の評価シート: 「意図」（目的）・「事業内容（方法・手段など）」（事業内容）。',
};
