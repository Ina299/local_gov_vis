/**
 * 46218 霧島市: 令和7年度 事務事業評価シート（教育総務課・学校教育課・社会教育課の課別PDF）。
 * 「２．事務事業の事業概要・目的・指標＜Do＞」の見出しの直後から「対象(誰に、何を対象にしているのか)」の表の見出しの手前までが
 * 事業概要・目的の欄（1列の文章）で、これを目的として収録する。「４．令和7年度の実績・成果」は事業費の表と行ごとに混在するため収録しない。
 * 公開済みレコードは同じシートの事務事業名（番号 － 名称）から作られ、評価年度 2025。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { sheetRecord } from './m21-util';

const HEAD = /\n令和7年度 事務事業評価シート [\d-]+\n１．基本情報\n事務事業名 \d+ － ([^\n]+)\n/g;
const BODY = /\n２．事務事業の事業概要・目的・指標＜Do＞\n((?:[^\n]+\n)*?)対象\(誰に、何を対象にしているのか\)/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '46218' || !/\/gyokaku\/documents\/10\d_r7[a-z]+\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i], start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    if (input.truncated && i === heads.length - 1) continue;
    const b = BODY.exec(seg);
    if (!b || !b[1].trim()) continue;
    const raw = b[1].slice(0, -1);
    // 表のセル（数値・単位だけの行）が混ざる場合は採らない。
    if (raw.split('\n').some(l => /^[アイウ]?\s*[\d,.%％\s]+$/.test(l) || /\s\d[\d,]*\s\d[\d,]*\s\d/.test(l))) continue;
    const nameAt = start + h[0].lastIndexOf(h[1]);
    out.push(sheetRecord(input, `${start}`, { value: h[1].trim(), raw: h[1], at: nameAt }, { evaluationYear: 2025, evaluatedFiscalYear: null }, null,
      [{ key: 'purpose', raw, at: start + b.index! + b[0].indexOf('＜Do＞\n') + 5 }],
      '霧島市 令和7年度 事務事業評価シートの「事務事業の事業概要・目的」欄の本文を目的として収録（PDFの折り返しの改行を除いた）。'));
  }
  return out;
}

export const entry = {
  extract,
  scope: '霧島市 令和7年度 事務事業評価シート（教育委員会の課別PDF）の「事務事業の事業概要・目的」欄。',
};
