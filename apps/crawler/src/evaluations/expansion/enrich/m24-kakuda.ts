/**
 * 04208 角田市: 教育委員会の点検評価報告書（令和４〜６年度事業分）の「事 業 名」ごとの評価票。公開済みレコードは
 * education-assist-supplement の抽出（事業名・年度のみ。目的・内容・評価の欄は縦中央配置で混線するため未収録）。
 * 「事業の目的」の見出しは欄の縦の中央に置かれ、抽出テキストでは欄の本文が見出しの前後に分かれる。見出しの前の行数を k として、
 * 見出しの後の k−1・k・k＋1 行のうち、欄の本文の最後の行が句点で終わる切り方がちょうど1つに決まる場合だけ目的とする。
 * 事業の内容・成果の欄は同じ理由で次の欄との境界が確定しないため採らない。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { sheetRecord } from './m24-util';

const YEARS: Record<string, [number, number]> = { '7bfab964f6b2aed52d402100': [2024, 2023], 'caae103adb9e7e30f3634a30': [2025, 2024], 'f6c6ec29bd174c709890af25': [2023, 2022] };
const LABELS = /事業の(目的|内容)|^成 果|^評$|^価$|^課 題/;

function extract(input: CachedInput): ProjectEvaluation[] {
  const years = YEARS[input.sourceId];
  if (input.municipalityCode !== '04208' || !years || input.format !== 'pdf' || input.truncated) return [];
  const t = input.text, heads = [...t.matchAll(/^事 業 名 (.+)$/gm)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i], start = h.index!, part = t.slice(start, heads[i + 1]?.index ?? t.length);
    if (!part.includes('事業の内容')) continue;
    const lines = part.split('\n'), L = lines.findIndex(l => /^事業の目的( |$)/.test(l));
    if (L < 1) continue;
    const before = lines.slice(1, L), inline = lines[L].slice('事業の目的'.length).trim();
    if (before.some(l => LABELS.test(l))) continue;
    const k = before.length, fits: number[] = [];
    for (const n of [k - 1, k, k + 1]) {
      if (n < 0 || L + n + 1 >= lines.length) continue;
      const after = lines.slice(L + 1, L + 1 + n), field = [...before, ...(inline ? [inline] : []), ...after];
      if (!field.length || after.some(l => LABELS.test(l))) continue;
      if (/。$/.test(field[field.length - 1])) fits.push(n);
    }
    if (fits.length !== 1) continue;
    const n = fits[0];
    // 根拠は見出しの行を含む欄の範囲そのもの。値は見出しの語を除いた本文の行をつなぐ。
    const from = start + lines[0].length + 1, raw = lines.slice(1, L + 1 + n).join('\n');
    const value = [...before, ...(inline ? [inline] : []), ...lines.slice(L + 1, L + 1 + n)].join('');
    const p = sheetRecord(input, `${years[1]}:${h[1]}`, { value: h[1], raw: h[0], at: start }, { evaluationYear: years[0], evaluatedFiscalYear: years[1] },
      [{ key: 'purpose', raw, at: from }],
      '角田市 教育委員会点検評価の評価票の「事業の目的」欄。見出しが欄の縦中央にあるため、見出しの前後の行数が釣り合い、'
      + '本文の最後の行が句点で終わる切り方が1つに決まる場合のみ収録。見出しの語を除き、折り返しの改行を除いた。');
    p.purpose = value;
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '角田市 教育委員会の点検評価報告書（令和４〜６年度事業分）の評価票: 「事業の目的」欄（縦中央の見出しの前後で欄の範囲が1つに決まるもの）。',
};
