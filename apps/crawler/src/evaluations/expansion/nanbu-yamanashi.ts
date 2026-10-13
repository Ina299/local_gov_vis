import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

export function extractNanbuYamanashi(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '19366' || input.format !== 'pdf' || input.truncated) return [];
  const year = input.text.slice(0, 100).normalize('NFKC').match(/教育に関する事務の点検及び評価報告書\n\(令和(\d+)年度分\)/);
  if (!year) return [];
  // Circled detail headings plus two unnumbered library/museum detail sections; parent headings delimit only.
  const headers = [...input.text.matchAll(/^(?:[①-⑳] *([^\n]+)|（[12]）(南部図書館・富沢図書館|町立美術館)|[0-9０-９]+[．.][^\n]*|（[0-9０-９]+）[^\n]*)$/gm)];
  const result: ProjectEvaluation[] = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const name = h[1] ?? h[2];
    if (!name) continue;
    const raw = input.text.slice(h.index!, headers[i + 1]?.index ?? input.text.length);
    const rating = raw.match(/＊ 成 果 \[ 評価 ([１-５－―]) *\]/);
    const challenges = raw.indexOf('＊ 課 題');
    if (!rating || challenges < rating.index!) continue;
    const record = project(input, name, name, null, raw, h.index!);
    record.projectCode = null;
    record.evaluatedFiscalYear = 2018 + Number(year[1]);
    const overview = raw.indexOf('＊ 事業概要');
    record.activities = raw.slice(overview >= 0 ? overview + '＊ 事業概要'.length : h[0].length, rating.index!).trim();
    record.outcomes = raw.slice(rating.index! + rating[0].length, challenges).trim();
    record.ratings.push({ kind: 'self', label: '達成度の評価', value: rating[1], scale: '５：極めて満足／４：満足／３：普通／２：不満足／１：極めて不満足／－：評価しがたい', evidence: evidence(input, rating[0], h.index! + rating.index!) });
    record.warnings.push('教育委員会報告書の独立した評価単位を収録。複数施設・イベントをまとめた節も含み、単一予算事業や町の全事務事業数とは一致しません。');
    record.warnings.push('表紙の年度分は対象年度。発行年月から評価年度を推定していません。事業費・委託料等は予算・決算種別を確定できず金額化していません。');
    result.push(record);
  }
  return result;
}
