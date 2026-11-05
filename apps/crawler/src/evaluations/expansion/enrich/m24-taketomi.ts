/**
 * 47381 竹富町: 令和７年度 事務事業評価シート「竹富町女性議会」（令和８年５月公表）。目的の欄は評価項目の設問と評価の記述が
 * 行ごとに混在するため採らず、事務事業名の下の「（事業概要）」欄を事業内容として足す。抽出テキストでは見出し「（事業概要）」が
 * 本文の2行の間に出力されるため、見出しを除いた前後の行をつなぐ（根拠は見出しを含む範囲）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { sheetRecord } from './m24-util';

const SHEET = /^令和７年度\n事務事業名\n\n事務事業評価シート（令和８年５月公表）\n\n(竹富町女性議会)\n(([^\n]+)\n\n（事業概要）\n\n([^\n]+))\n\n事業類型\n/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '47381' || !input.sourceUrl.endsWith('/hyouka--jyoseigikai.pdf') || input.truncated) return [];
  const m = SHEET.exec(input.text);
  if (!m || !/。$/.test(m[4])) return [];
  const nameAt = m[0].indexOf(`\n${m[1]}\n`) + 1;
  const p = sheetRecord(input, m[1], { value: m[1], raw: m[1], at: nameAt }, { evaluationYear: 2025, evaluatedFiscalYear: null },
    [{ key: 'activities', raw: m[2], at: nameAt + m[1].length + 1 }],
    '竹富町 事務事業評価シートの「（事業概要）」欄。見出しが本文の行の間に出力されるため、見出しを除いて前後の行をつないだ。');
  p.activities = m[3] + m[4];
  return [p];
}

export const entry = {
  extract,
  scope: '竹富町 令和７年度 事務事業評価シート（竹富町女性議会）: 「（事業概要）」欄（事業内容）。目的欄は評価の記述と混在するため対象外。',
};
