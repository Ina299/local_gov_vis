/**
 * 28218 小野市: 物価高騰対応重点支援地方創生臨時交付金の実施状況及び効果検証（令和5・6年度）。
 * 「事業の概要【実施計画作成時点】」欄は①目的・効果 ②交付金を充当する経費内容 ③積算根拠 ④事業の対象 の順で、
 * 表の行の順に並ぶ。①の段落（次の②の行の手前まで）を目的として収録する。事業名・担当部署・年度は公開済みレコード
 * （batch12/m4-small-a.ts）と同じ（年度は表題の年度を評価対象年度）。各事業の①の段落は、文書内の①の段落の
 * 通し番号で固定した（事務費のみの行（公開済みレコードなし）も①の段落を持つため、その分を飛ばす）。①の段落が
 * 事業名の後にあり、事業ごとの特記（均等割のみ課税・子育て世帯・№11事業の増刷・拡大分）が事業名と一致することを確認済み。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { joinLines, sheetRecord } from './m21-util';

type Row = { raw: string; name: string; dept: string; block: number };
const DOCS: Record<string, { header: string; year: number; rows: Row[] }> = {
  'd118ac2be0aa8f634aa0b8e8': { header: '令和5年度 物価高騰対応重点支援地方創生臨時交付金の実施状況及び効果検証', year: 2023, rows: [
    { raw: '低所得世帯物価\n単 高騰緊急支援給\n1\n社会福祉課\n独 付金【物価高騰\n対策給付金】', name: '低所得世帯物価高騰緊急支援給付金【物価高騰対策給付金】', dept: '社会福祉課', block: 0 },
    { raw: '低所得世帯物価\n高騰緊急支援給\n単 付金（均等割の\n2\n社会福祉課\n独 み課税世帯分）\n【物価高騰対策\n給付金】', name: '低所得世帯物価高騰緊急支援給付金（均等割のみ課税世帯分）【物価高騰対策給付金】', dept: '社会福祉課', block: 1 },
    { raw: '低所得世帯物価\n高騰緊急支援給\n単\n3\n付金（子育て世帯 社会福祉課\n独\n分）【物価高騰対\n策給付金】', name: '低所得世帯物価高騰緊急支援給付金（子育て世帯分）【物価高騰対策給付金】', dept: '社会福祉課', block: 2 },
  ] },
  '52cea90eeb3dda15264042cd': { header: '令和6年度 物価高騰対応重点支援地方創生臨時交付金の実施状況及び効果検証', year: 2024, rows: [
    { raw: '低所得世帯物価\n単 高騰緊急支援給\n1\n社会福祉課\n独 付金【物価高騰\n対策給付金】', name: '低所得世帯物価高騰緊急支援給付金【物価高騰対策給付金】', dept: '社会福祉課', block: 0 },
    { raw: '低所得者支援及\n単\nび定額減税補足 社会福祉課\n独\n給付金支給事業', name: '低所得者支援及び定額減税補足給付金支給事業', dept: '社会福祉課', block: 1 },
    // block 2 は「№2事業（事務費）」の行。
    { raw: '低所得世帯物価\n単 高騰緊急支援給\n社会福祉課\n独 付金（総合経済\n対策分）', name: '低所得世帯物価高騰緊急支援給付金（総合経済対策分）', dept: '社会福祉課', block: 3 },
    { raw: '物価高騰緊急支\n単\n援プレミアム商品 産業創造課\n独\n券事業', name: '物価高騰緊急支援プレミアム商品券事業', dept: '産業創造課', block: 4 },
    { raw: '物価高騰緊急支\n単\n援プレミアム商品 産業創造課\n独\n券拡充事業', name: '物価高騰緊急支援プレミアム商品券拡充事業', dept: '産業創造課', block: 5 },
    { raw: '物価高騰緊急支\n単\n援プレミアム商品 産業創造課\n独\n券拡大事業', name: '物価高騰緊急支援プレミアム商品券拡大事業', dept: '産業創造課', block: 6 },
  ] },
};

/** ①の段落: 行頭の「①」（見出しの「①目的・効果」を除く）から、行頭の「②」の行の手前まで。 */
const PURPOSE = /(?<=\n)①(?!目的・効果)[^\n]*(?:\n(?!②)[^\n]*)*?(?=\n②)/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  const spec = DOCS[input.sourceId];
  if (input.municipalityCode !== '28218' || !spec || !input.text.startsWith(spec.header)) return [];
  const t = input.text, blocks = [...t.matchAll(PURPOSE)];
  if (blocks.length !== 3 && blocks.length !== 7) return [];
  const out: ProjectEvaluation[] = [];
  for (const r of spec.rows) {
    const at = t.indexOf(r.raw), b = blocks[r.block];
    if (at < 0 || !b || b.index! < at) continue;
    out.push(sheetRecord(input, `ono:${input.sourceId}:${r.block}`, { value: r.name, raw: r.raw, at },
      { evaluationYear: null, evaluatedFiscalYear: spec.year }, r.dept,
      [{ key: 'purpose', raw: b[0], at: b.index!, value: joinLines(b[0]).slice(1) }],
      `小野市 ${spec.header}の「事業の概要【実施計画作成時点】」欄の「①目的・効果」の段落を目的として収録（PDFの改行を除き、先頭の①を除いた）。`
      + '行の順で事業に対応づけた。'));
  }
  return out;
}

export const entry = {
  extract,
  scope: '小野市 物価高騰対応重点支援地方創生臨時交付金の実施状況及び効果検証（令和5・6年度）の「事業の概要」①目的・効果。実施状況・効果検証の欄は金額・内訳と行ごとに混在するため対象外。',
};
