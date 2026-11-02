/**
 * 36403 藍住町: 教育に関する事務の管理及び執行の状況の点検及び評価報告書（平成30年度・令和6〜8年度）の事業評価シート。
 * 各シートは「事務事業名」「事業の目的」「事業の内容」「事業の対象」の欄が縦に並ぶ。欄の見出しの次の段落を本文とし、
 * 段落の直後が決まった次の見出し（目的なら「担当課名」か「事業の内容」、内容なら「事業の対象」）のときだけ採る。
 * 内容の本文が見出しより前に出るシート（列の並びが崩れたもの）は採らない。年度はシート冒頭の「令和７年度」等（対象年度）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { joinLines, labelled, seireki, sheetRecord, type Field } from './m21-util';

const HEAD = /\n(令和|平成)([０-９\d]+|元)年度\n\n事業評価シート\n事務事業名\n\n((?:[^\n]+\n)*?[^\n]+)\n\n総合計画の\n/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '36403' || !/\/file_contents\/(R\d|30)\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i], start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    if (input.truncated && i === heads.length - 1) continue;
    const fields: Field[] = [];
    const purpose = labelled(seg, start, /事業の目的/, /担当課名|事業の内容/);
    if (purpose) fields.push({ key: 'purpose', ...purpose });
    const activities = labelled(seg, start, /事業の内容/, /事業の対象/);
    if (activities) fields.push({ key: 'activities', ...activities });
    // 目的の本文が「事業番号」の値の直後に出て、その後に「事業の目的」「事業の内容」の見出しが続けて並ぶシート。
    const stacked = /\n事業番号\n\n\d+\n\n((?:[^\n]+\n)*?[^\n]+)\n\n事業の目的\n事業の内容\n\n/.exec(seg);
    if (!purpose && stacked) fields.push({ key: 'purpose', raw: stacked[1], at: start + stacked.index! + stacked[0].indexOf(stacked[1]) });
    if (!fields.length) continue;
    const dept = /\n担当課名\n\n([^\n]+課)\n/.exec(seg);
    const nameAt = start + h[0].indexOf('事務事業名\n\n') + 7;
    out.push(sheetRecord(input, `${start}`, { value: joinLines(h[3]), raw: h[3], at: nameAt },
      { evaluationYear: null, evaluatedFiscalYear: seireki(h[1], h[2]) }, dept?.[1] ?? null, fields,
      '藍住町 教育委員会の点検及び評価報告書の事業評価シートから「事業の目的」「事業の内容」欄の本文を収録（PDFの折り返しの改行を除いた）。'));
  }
  return out;
}

export const entry = {
  extract,
  scope: '藍住町 教育委員会の点検及び評価報告書（平成29年度・令和5〜7年度対象）の事業評価シートの「事業の目的」「事業の内容」欄。',
};
