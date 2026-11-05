/**
 * 01204 旭川市: 旭川市行財政改革推進委員会 答申書「令和 5 年度行政評価の実施について」の「第 4 個別事業の概要及び評価（各論）」。
 * 公開済みレコード（事業名・評価年度2023）に、各事業の「【事業の概要】」の「内容」欄を事業内容として足す。目的の欄はない。
 * 内容欄の本文は担当部局の行の次の行から、事業費（「N 千円」）の行の手前までで、句点で終わるもの。見出し「内容」が本文の行の間に
 * 出力される版（空行・「内容」・空行が挟まる）は、その見出しを除いてつなぐ（根拠は見出しを含む範囲）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { sheetRecord } from './m24-util';

const HEAD = /\n(\d)．([^\n]+)\n【事業の概要】\n担当部局\n(?:内容\n)?\n([^\n]+)\n((?:[^\n]*\n)*?)([\d,]+ 千円)\n/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01204' || !input.sourceUrl.endsWith('/d082188_d/fil/tousin.pdf') || input.truncated) return [];
  const t = input.text;
  if (!t.includes('令和 5 年度行政評価の実施について')) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(HEAD)) {
    const labelFirst = m[0].includes('\n担当部局\n内容\n'), raw = m[4].replace(/\n$/, '');
    // 見出し「内容」が担当部局の直後にない版は、本文の間にちょうど1回だけ出ること。
    const parts = raw.split('\n\n内容\n\n');
    if (labelFirst ? parts.length !== 1 : parts.length !== 2) continue;
    if (!/。$/.test(raw) || raw.split('\n').some(l => /千円|事業費|内訳/.test(l))) continue;
    const name = m[2].trim(), at = m.index! + m[0].indexOf(`\n${m[3]}\n`) + m[3].length + 2;
    const p = sheetRecord(input, name, { value: name, raw: m[2], at: m.index! + m[1].length + 2 }, { evaluationYear: 2023, evaluatedFiscalYear: null },
      [{ key: 'activities', raw, at }],
      '旭川市行財政改革推進委員会 答申書（令和 5 年度行政評価）の「【事業の概要】」の「内容」欄を事業内容として収録。'
      + '見出し「内容」が本文の行の間に出力される版は見出しを除いてつなぎ、折り返しの改行を除いた。');
    p.activities = parts.join('').split('\n').join('');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '旭川市 行財政改革推進委員会 答申書（令和 5 年度行政評価）の個別事業: 「【事業の概要】」の「内容」欄（事業内容）。目的の欄はない。',
};
