/**
 * 42214 南島原市: 地方創生交付金事業実施調書（令和７年度事業、1事業1枚に再構成した資料3）。目的の欄はない。
 * 公開済みレコード（No.・事業名・対象年度2025）に、「③ 事業全体の具体的取組」欄を事業内容、「⑤ R７年度実績」欄を成果として足す。
 * ③は交付対象経費などの表の後の最後の段落（句点で終わり、金額を含まないもの）、⑤は見出しから「⑥」の見出しまで。
 * 「④ R７年度実施計画」（計画）と「⑦」の評価・方針は採らない。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { type Field, sheetRecord } from './m24-util';

const NAMES: Record<string, string> = {
  'No.1': '地方回帰と産業構造の変化を捉えた大規模人材還流プロジェクト（長崎移住サポートセンター負担金、地域情報の発信）',
  'No.2': 'まちの変化を力にした地域内外の交流拡大・地域の賑わい創出プロジェクト（自転車歩行者専用道路ソフト事業、長崎デスティネーションキャンペーン負担金）',
  'No.3': '「若者に選ばれる」畜産産地の実現で地域を活性化するプロジェクト（家畜導入事業補助金、和牛・乳牛保留事業費補助金）',
  'No.5': 'リモート相談窓口構築事業',
};
const SHEET = '地方創生交付金事業実施調書（令和７年度事業）\n担当課\n';

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '42214' || !input.sourceUrl.endsWith('/3_8781_82953_up_c01lt1no.pdf') || input.truncated) return [];
  const t = input.text, starts = [...t.matchAll(new RegExp(SHEET, 'g'))].map(m => m.index!), out: ProjectEvaluation[] = [];
  starts.forEach((start, i) => {
    const seg = t.slice(start, starts[i + 1] ?? t.length), no = /\n(No\.\d+)\n/.exec(seg), name = no && NAMES[no[1]];
    if (!name || !seg.replace(/\n/g, '').includes(name)) return;
    const fields: Field[] = [];
    const a = seg.indexOf('\n③ 事業全体の具体的取組\n'), b = seg.indexOf('\n④ R７年度実施計画\n', a);
    if (a >= 0 && b > a) {
      const region = seg.slice(a, b), cut = region.lastIndexOf('\n\n'), para = region.slice(cut + 2);
      if (cut >= 0 && /。$/.test(para) && !/円/.test(para)) fields.push({ key: 'activities', raw: para, at: start + a + cut + 2 });
    }
    const o = /\n⑤ R７年度実績\n((?:[^\n]+\n)*?[^\n]+)\n⑥ 本事業における重要業績評価指標/.exec(seg);
    if (o && !/円\n/.test(o[1])) fields.push({ key: 'outcomes', raw: o[1], at: start + o.index! + o[0].indexOf(o[1]) });
    if (!fields.length) return;
    const nameAt = start + seg.indexOf(no![0]) + 1;
    out.push(sheetRecord(input, no![1], { value: name, raw: no![1], at: nameAt }, { evaluationYear: null, evaluatedFiscalYear: 2025 }, fields,
      '南島原市 地方創生交付金事業実施調書（令和７年度事業）の「③ 事業全体の具体的取組」（事業内容）と「⑤ R７年度実績」（成果）。'
      + '折り返しの改行を除いた。④の実施計画・⑦の評価と方針は対象外。'));
  });
  return out;
}

export const entry = {
  extract,
  scope: '南島原市 地方創生交付金事業実施調書（令和７年度事業）: ③事業全体の具体的取組（事業内容）・⑤R７年度実績（成果）。目的の欄はない。',
};
