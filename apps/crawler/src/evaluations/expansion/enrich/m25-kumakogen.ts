/**
 * 38386 久万高原町: 臨時交付金 実施事業一覧、評価表（令和5年度コロナ・令和5年度物価高騰・令和6年度物価高騰）。
 * 「事業の概要」欄は①目的・効果 ②交付金を充当する経費内容 ③積算根拠 ④事業の対象 の順で、ページ内の行の順に並ぶ。
 * ①の段落（次の②の行の手前まで）を目的として収録する。ページ内の①の段落の数が事業の行の数と一致するページだけ採る。
 * 事業名・評価対象年度は公開済みレコード（batch12/m0-d.ts）と同じ: 事業名はPDFの改行を除いたもの、年度は
 * 事業始期・終期が同じ会計年度に収まる場合だけその年度（評価実施年度は未設定）。効果の欄は計画時の成果目標の列と
 * 行ごとに混在するページがあるため収録しない。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { joinLines, sheetRecord } from './m21-util';

/** raw: 事業名の欄の原文（改行込み）。fy: 事業始期・終期（印字）が同じ会計年度に収まる場合のその年度。 */
type Row = { raw: string; name: string; fy: number | null };
const DOCS: Record<string, { title: string; pages: Row[][] }> = {
  '4e9bb621674975e54fbc11f0': {
    title: '令和５年度 新型コロナウイルス感染症対応地方創生臨時交付金実施事業一覧、評価表',
    pages: [[
      { raw: '非課税世帯等臨時特別支\n援事業（令和五年度愛媛\n県久万高原町電力・ガ\nス・食料品等価格高騰重\n点支援給付金）【低所得\n者世帯給付金】', name: '非課税世帯等臨時特別支援事業（令和五年度愛媛県久万高原町電力・ガス・食料品等価格高騰重点支援給付金）【低所得者世帯給付金】', fy: 2023 },
      { raw: '非課税世帯等臨時特別支\n援事業（令和五年度愛媛\n県久万高原町電力・ガス・\n食料品等価格高騰重点支\n援給付金）（事務費）', name: '非課税世帯等臨時特別支援事業（令和五年度愛媛県久万高原町電力・ガス・食料品等価格高騰重点支援給付金）（事務費）', fy: 2023 },
      { raw: '久万高原町物価高騰対応\n等消費活性化支援事業\n（令和５年度）（商品券発行\n等事業分）', name: '久万高原町物価高騰対応等消費活性化支援事業（令和５年度）（商品券発行等事業分）', fy: 2023 },
    ], [
      { raw: '原油高騰対策事業者経営\n支援事業', name: '原油高騰対策事業者経営支援事業', fy: 2023 },
      { raw: '原油高騰対策公共交通事\n業者経営支援事業', name: '原油高騰対策公共交通事業者経営支援事業', fy: 2023 },
    ]],
  },
  'ca2916fe637fbe68c9f8d596': {
    title: '令和５年度 物価高騰対応重点支援地方創生臨時交付金実施事業一覧、評価表',
    pages: [[
      { raw: '非課税世帯等臨時特別支援事業（令\n和五年度愛媛県久万高原町電力・ガ\nス・食料品等価格高騰重点支援給付\n金）【低所得者世帯給付金（第２\n弾）】', name: '非課税世帯等臨時特別支援事業（令和五年度愛媛県久万高原町電力・ガス・食料品等価格高騰重点支援給付金）【低所得者世帯給付金（第２弾）】', fy: 2023 },
      { raw: '物価高騰対応重点支援地方創生臨時\n一体支援 交付金事業【令和五年度均等割のみ\n課税給付】', name: '物価高騰対応重点支援地方創生臨時交付金事業【令和五年度均等割のみ課税給付】', fy: 2023 },
      { raw: '物価高騰対応重点支援地方創生臨時\n一体支援 交付金事業【低所得子育て世帯加算\n給付】', name: '物価高騰対応重点支援地方創生臨時交付金事業【低所得子育て世帯加算給付】', fy: 2023 },
      { raw: '子育て世帯物価高騰対策支援事業', name: '子育て世帯物価高騰対策支援事業', fy: 2023 },
      { raw: 'こども園に対する物価高騰対策支援事\n業', name: 'こども園に対する物価高騰対策支援事業', fy: 2023 },
    ], [
      { raw: 'プレミアム商品券発行事業', name: 'プレミアム商品券発行事業', fy: null },
      { raw: '障がい者施設に対する物価高騰対策\n支援事業', name: '障がい者施設に対する物価高騰対策支援事業', fy: 2023 },
      { raw: '介護サービス事業所等に対する物価\n高騰対策支援事業', name: '介護サービス事業所等に対する物価高騰対策支援事業', fy: 2023 },
      { raw: '養護老人ホームに対する物価高騰対\n策支援事業', name: '養護老人ホームに対する物価高騰対策支援事業', fy: 2023 },
      { raw: '病院施設に対する物価高騰対策支援\n事業', name: '病院施設に対する物価高騰対策支援事業', fy: 2023 },
    ], [
      { raw: '老人保健施設に対する物価高騰対策\n支援事業', name: '老人保健施設に対する物価高騰対策支援事業', fy: 2023 },
    ]],
  },
  'ae53e6c15ac89e66b58dd514': {
    title: '令和６年度 物価高騰対応重点支援地方創生臨時交付金実施事業一覧、評価表',
    pages: [[
      { raw: '一体支援\n・令和６年度新たな低所得者支援給付\n金事業\n・令和６年度定額減税補足給付金（調\n整給付金）事業', name: '一体支援・令和６年度新たな低所得者支援給付金事業・令和６年度定額減税補足給付金（調整給付金）事業', fy: null },
      { raw: '住民税非課税世帯物価高騰支援給付\n金事業', name: '住民税非課税世帯物価高騰支援給付金事業', fy: 2024 },
      { raw: '久万高原町介護サービス事業所等物\n価高騰対策支援金交付事業', name: '久万高原町介護サービス事業所等物価高騰対策支援金交付事業', fy: null },
    ]],
  },
};

/** ①の段落: 行頭の「①」（見出しの「①目的・効果」を除く）から、行頭の「②」（前に数値の列が入ることがある）の行の手前まで。 */
const PURPOSE = /(?<=\n)①(?!目的・効果)[^\n]*(?:\n(?![\d,]* ?②)[^\n]*)*?(?=\n(?:[\d,]+ )?②)/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  const spec = DOCS[input.sourceId];
  if (input.municipalityCode !== '38386' || !spec || !input.text.startsWith(spec.title)) return [];
  const t = input.text, starts: number[] = [];
  for (let i = 0; i >= 0; i = t.indexOf(spec.title, i + 1)) starts.push(i);
  if (starts.length !== spec.pages.length) return [];
  const out: ProjectEvaluation[] = [];
  spec.pages.forEach((rows, pi) => {
    const from = starts[pi], to = starts[pi + 1] ?? t.length, seg = t.slice(from, to);
    const blocks = [...seg.matchAll(PURPOSE)];
    if (blocks.length !== rows.length) return;
    let cur = 0;
    rows.forEach((r, i) => {
      const at = seg.indexOf(r.raw, cur);
      if (at < 0) return;
      cur = at + r.raw.length;
      const b = blocks[i], raw = b[0];
      out.push(sheetRecord(input, `kumakogen:${input.sourceId}:${pi}:${i}`, { value: r.name, raw: r.raw, at: from + at },
        { evaluationYear: null, evaluatedFiscalYear: r.fy }, null,
        [{ key: 'purpose', raw, at: from + b.index!, value: joinLines(raw).slice(1) }],
        `久万高原町 ${spec.title}の「事業の概要」欄の「①目的・効果」の段落を目的として収録（PDFの改行を除き、先頭の①を除いた）。`
        + 'ページ内の①の段落の数が事業の行の数と一致する場合に、行の順に対応づけた。'));
    });
  });
  return out;
}

export const entry = {
  extract,
  scope: '久万高原町 臨時交付金 実施事業一覧、評価表（令和5年度コロナ・令和5年度物価高騰・令和6年度物価高騰）の「事業の概要」①目的・効果。効果の欄は成果目標の列と混在するページがあるため対象外。',
};
