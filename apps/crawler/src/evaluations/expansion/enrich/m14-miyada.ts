import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 宮田村（令和３年度 事務事業評価 内部評価まとめ・R2事業）
// 公開済みレコードは同じPDFの評価結果一覧（令和2年度実施事業、評価年度2021）。後半の「決算/評価シート【R2事業】」の
// 「事業目的」欄（①〜③の短い項目）を目的として収録する。事業名の欄は「事業名」「種類」の見出しと種類の値（自治事務など）の
// 行と並び順が版ごとに違うため、「事業名」の見出しから「総合計画」等の行までのうち見出し・種類の値を除いて1行だけ残る場合に限る。
// 「目的達成に向けた本年度の取り組みと事業量」欄は職員数などの表と混ざるため採らない。
const SHEET = /決算\/評価シート【R(?:02|2|２)事業】/g;
const PURPOSE = /\n事業目的((?: [^\n]*)?(?:\n[①-⑤][^\n]*)*)\n目的達成に向けた本年度の取り組みと事業量\n/;
/** 事業名の欄に混ざる見出し・種類の値。 */
const NOT_NAME = /^(種類|自治事務|法定受託事務|一部が法定受託事務( 評価 [要略])?|評価 [要略]|－|ー)$/;
const END = /^(総合計画|めざす姿|手段|評価 )/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '20388' || input.format !== 'pdf' || !input.sourceUrl.includes('/ck/2/files/R03')) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  if (!t.startsWith('令和３年度\n\n宮田村事務事業評価の結果\n')) return [];
  const heads = [...t.matchAll(SHEET)];
  for (let k = 0; k < heads.length; k++) {
    const start = heads[k].index!, seg = t.slice(start, heads[k + 1]?.index ?? t.length);
    const pm = PURPOSE.exec(seg);
    if (!pm) continue;
    const head = seg.slice(0, pm.index).split('\n'), ni = head.indexOf('事業名');
    if (ni < 0) continue;
    const names: string[] = [];
    for (const l of head.slice(ni + 1)) { if (END.test(l)) break; if (!NOT_NAME.test(l)) names.push(l); }
    if (names.length !== 1 || !names[0].trim()) continue;
    const name = names[0].trim();
    // ①〜⑤の項目のうち、本文のあるものだけ（空の番号は除く）。
    const items = [...pm[1].matchAll(/([①-⑤]) ?([^①-⑤\n]*)/g)].map(m => [m[1], m[2].trim()]).filter(([, v]) => v);
    if (!items.length) continue;
    const nameAt = start + seg.indexOf(`\n${names[0]}\n`, seg.indexOf('\n事業名\n')) + 1;
    const p = project(input, `narrative:${name}`, name, 2021, names[0], nameAt);
    p.projectCode = null; p.evaluatedFiscalYear = 2020;
    p.purpose = items.map(([n, v]) => `${n} ${v}`).join('\n');
    const raw = pm[0].slice(1, pm[0].indexOf('\n目的達成に向けた'));
    p.evidence.push(evidence(input, raw, start + pm.index + 1));
    p.warnings.push('宮田村 令和３年度事務事業評価（R2事業）の決算/評価シート「事業目的」欄（①〜③の項目）を目的として収録。本文のない番号は除いた。'
      + '「目的達成に向けた本年度の取り組みと事業量」欄は表と混ざるため未収録。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '宮田村 令和３年度 事務事業評価（R2事業）の決算/評価シート: 「事業目的」欄。事業名の行が1つに決まらないシートは対象外。',
};
