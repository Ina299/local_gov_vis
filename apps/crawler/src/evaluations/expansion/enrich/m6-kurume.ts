import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m6-util';

// ---------------------------------------------------------------- 久留米市（教育委員会の点検・評価報告書の重点事業シート）
// 公開済みレコード（各年度の重点事業シート、対象年度＝シートの表題の年度）の「事業目的」欄。抽出テキストで
// 「事業目的\n\n〈目的〉\n\n事業内容\n」と目的がラベルの間に挟まる形のシートに限る（ラベルが続けて並び、目的・内容の文章が
// 後ろにまとめて続くシートは境が決まらないため採らない）。事業内容は後ろに事業目標・指標の文章が区切りなく続くシートがあり、
// 終わりが決まらないため採らない。事業名はシートの「事 業 名」欄（または「※以下から選択」の後の行）、担当課は様式により位置が
// 揺れるため設定しない。
const HEAD = /(令和|平成)([０-９元]+)年度重点事業シート\n/g;
const digit = (s: string) => (s === '元' ? 1 : Number(s.replace(/[０-９]/g, c => String(c.charCodeAt(0) - 0xff10))));

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '40203' || !/\/3070kyouikuiinkai\/files\/[^/]+\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i], start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const year = (h[1] === '令和' ? 2018 : 1988) + digit(h[2]);
    const name = /\n事 業 名\n\n([^\n]+)\n\n事業種別\n/.exec(seg) ?? /\n事 業 名\n事業種別\n※以下から選択\n\n([^\n]+)\n\n/.exec(seg);
    const purposeOnly = /\n事業目的\n\n((?:[^\n]+\n)+)\n事業内容\n/.exec(seg);
    if (!name || !purposeOnly || seg.split('\n事業目的\n').length !== 2) continue;
    // ラベルが欄の縦中央に来るため、目的の前半がラベルより前に出る（直前の行が文章）シートや、事業内容の箇条
    // （①・(1)・※）が目的の後に続くシートは、目的の範囲が決まらないため採らない。
    const before = seg.slice(0, purposeOnly.index).trimEnd().split('\n').at(-1) ?? '';
    if (!seg.slice(0, purposeOnly.index).endsWith('\n') || !/^([\d,]+ 千円|（新規・拡充・継続）|担当課|[^\s、。]+課)$/.test(before)) continue;
    if (/^(事業内容|担当課|事業費|区分|※|[①-⑳]|[(（][0-9０-９]+[)）])/m.test(purposeOnly[1]) || !purposeOnly[1].trimEnd().endsWith('。')) continue;
    const p = project(input, `${name[1]}:narrative`, name[1], null, name[0].slice(1, -1), start + name.index! + 1);
    p.evaluatedFiscalYear = year;
    p.purpose = unwrap(purposeOnly[1].trimEnd(), 30);
    p.evidence.push(evidence(input, purposeOnly[0].slice(1, -1), start + purposeOnly.index! + 1));
    p.warnings.push('教育委員会の点検・評価報告書の重点事業シート（対象年度は表題の年度）の「事業目的」欄。欄の幅いっぱいで折り返した改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '久留米市 教育委員会 点検・評価報告書の重点事業シート: 事業目的（目的）。目的がラベルの間に挟まって並ぶシートのみ。事業内容は終わりが決まらないため対象外。',
};
