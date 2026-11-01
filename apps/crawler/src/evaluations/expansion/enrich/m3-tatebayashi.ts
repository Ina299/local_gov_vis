/**
 * 10207 館林市: 実施計画書（【令和N年度事業】実施計画書。事務事業評価の個別資料 R3_05・r405・r505・R6_05 と、
 * 総合戦略関連事業の資料２／３）の「【事業の目的及び内容】」欄を、公開済みレコード（同年度の事業評価一覧の行・
 * 個別資料の事業）の空欄の目的として補う。欄の左に印字された見出し「【Plan】」「事業目的」は行頭にだけ現れ、取り除く。
 * 事業計画（予定）・事業評価調書の実績欄（金額の列が混在）は対象外。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';

/** sourceId → 令和N年度（資料の見出し【令和N年度事業】と一致すること）。 */
const DOCS: Record<string, number> = {
  '447e17f8616528a2a39d2763': 3, '958ada449838310366ae4c17': 4, c9415672051eb8b47ca16795: 5, '68ff6ef2db523eae6134115e': 6,
  '1749d81c6dd37294a5f9aa32': 3, '6c17467057485fe1e95c0046': 4, '385b1b82ef14dc4f5f1176e5': 5, ade636c277ee9dbb39e01ff4: 6,
};
const WIDE = '０１２３４５６７８９';
const MARK = /^(・|○|〇|●|◆|■|※|①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩|【|（[０-９\d]+）)/;
/** 本文1行は50字前後。これより短い行の次の行は折り返しではない。 */
const WRAP = 40;

function extract(input: CachedInput): ProjectEvaluation[] {
  const reiwa = DOCS[input.sourceId];
  if (input.municipalityCode !== '10207' || !reiwa || input.truncated) return [];
  const t = input.text, r = `令和${WIDE[reiwa]}`, year = 2018 + reiwa, out: ProjectEvaluation[] = [];
  const plan = `【${r}年度事業】実施計画書`;
  const starts = [...t.matchAll(new RegExp(plan, 'g'))].map(m => m.index!);
  starts.forEach((s, k) => {
    const sheet = t.slice(s, starts[k + 1] ?? t.length);
    const hi = sheet.indexOf('【総合計画との関連】');
    if (hi <= 0) return;
    // 事業名: 款・項・目（企業会計は「〇〇事業会計」）の直後の1行（公開済みの抽出と同じ取り方）。
    const names = [...sheet.slice(0, hi).matchAll(/\n\n([０-９\d]{1,2}・[０-９\d]{1,2}・[０-９\d]{1,2}|[^\n]+事業会計)\n\n([^\n]+)\n\n/g)];
    if (names.length !== 1 || /千円|予算|担当|事業名|総合戦略|重要事業|^[^\n]{0,1}$/.test(names[0][2])) return;
    const name = names[0][2], nameAt = s + names[0].index! + names[0][0].indexOf(`\n${name}\n`) + 1;
    const pm = [...sheet.matchAll(/\n【事業の目的及び内容】\n/g)];
    if (pm.length !== 1) return;
    const from = pm[0].index! + pm[0][0].length;
    const end = sheet.slice(from).search(new RegExp(`\\n\\n?${r}年度事業計画（主要な事業とその取組内容）\\n`));
    if (end <= 0) return;
    const raw = sheet.slice(from, from + end);
    if (raw.includes('\n\n') || (raw.match(/【Plan】/g) ?? []).length !== 1 || (raw.match(/事業目的/g) ?? []).length !== 1) return;
    const lines = raw.split('\n').filter(l => l !== '【Plan】' && l !== '事業目的').map(l => l.replace(/^(【Plan】|事業目的) /, '').trim());
    if (!lines.length || lines.some(l => !l || /【Plan】|事業目的|千円/.test(l))) return;
    let value = '';
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i], prev = lines[i - 1] ?? '', wrap = i > 0 && !MARK.test(l) && prev.length >= WRAP && !/。$/.test(prev);
      // 記号なし・折り返しでもない短い行（委員名・延長・設立年月日などの行）が混ざる欄は採らない。
      if (i > 0 && !MARK.test(l) && !wrap && l.length < WRAP && !/。$/.test(l)) return;
      value += i === 0 ? l : (wrap ? '' : '\n') + l;
    }
    if (value.length < 6) return;
    const p = project(input, `narrative-${s}`, name, null, name, nameAt);
    p.id = stableId(input, `narrative-${s}`, null);
    p.projectCode = null;
    p.evaluatedFiscalYear = year;
    p.purpose = value;
    p.evidence.push(evidence(input, plan, s), evidence(input, raw, s + from));
    p.warnings.push(`館林市 【${r}年度事業】実施計画書の「【事業の目的及び内容】」欄を目的として収録。欄の左の見出し（【Plan】・事業目的）を行頭から除き、PDFの折り返しの改行だけを除いた。評価対象年度は見出しの年度。`);
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '館林市 【令和３〜６年度事業】実施計画書（事務事業評価の個別資料、総合戦略関連事業の資料）の「事業の目的及び内容」欄。事業計画（予定）・事業評価調書の実績欄は対象外。',
};
