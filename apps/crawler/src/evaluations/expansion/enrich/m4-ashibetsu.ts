/** 芦別市 (01216): 主要事務事業実施の状況及び事務事業評価結果 各款の個票（令和4〜6年度決算）の「事業目的」「事業内容及び成果」。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// 公開済みレコードは同年度の目次（事務事業名・所管・総合判定）から作られ、目的・事業内容が空欄。
// 個票は「№NNN」で始まり、縦書きの見出し「事 業 目 的」の最後の「的」の行の後から「事業内容及び成果」までが事業目的、
// その後「＜事務事業評価結果＞」までが事業内容及び成果。事務事業名は段組みで位置が一定しないため、
// n3-ashibetsu と同じく同年度の目次に「目番号 事務事業名」の行として載る名称と一致する見出し行（1種類だけ）に限る。
// 年度は決算額の表の「Ｒ（当年度）」「Ｒ（前年度）」の行による。年度表記のない令和3年度決算の個票は対象外。
const SHEET = /(?:^|\n)№(\d{3})\n/g;
const TOC = /[〈<]目次[〉>]\s*令和([０-９\d]+)年度/;
const fw = (s: string) => Number(s.replace(/[０-９]/g, d => String(d.charCodeAt(0) - 0xff10)));
const CONTENT = '\n事業内容及び成果\n', RESULT = /\n＜?事務事業評価結果＞\n/;

const tocCache = new WeakMap<CachedInput[], Map<number, Set<string>>>();
/** 同年度の目次に「目番号 事務事業名」の行として載る名称。 */
function tocNames(inputs: CachedInput[], year: number): Set<string> {
  let byYear = tocCache.get(inputs);
  if (!byYear) {
    byYear = new Map();
    for (const x of inputs) {
      const m = x.text.match(TOC);
      if (!m) continue;
      const y = 2018 + fw(m[1]), set = byYear.get(y) ?? new Set<string>();
      for (const l of x.text.matchAll(/\n\d+ ([^\n]+)(?=\n)/g)) set.add(l[1]);
      byYear.set(y, set);
    }
    tocCache.set(inputs, byYear);
  }
  return byYear.get(year) ?? new Set();
}

/** 本文の行だけからなる欄（空行で区切られた表の断片や数字だけの行を含まない）なら、前後の空白を除いた本文を返す。 */
function prose(raw: string): string | null {
  const text = raw.trim();
  if (!text || text.includes('\n\n')) return null;
  const lines = text.split('\n');
  if (lines.some(l => !l.trim() || /^[\d０-９,，.．△±％%円人件回]+$/.test(l.trim()))) return null;
  return text;
}

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '01216' || input.format !== 'pdf' || !input.text.includes('事業内容及び成果')) return [];
  const t = input.text, heads = [...t.matchAll(SHEET)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const start = heads[i].index! + (t[heads[i].index!] === '\n' ? 1 : 0), end = heads[i + 1]?.index ?? t.length;
    const seg = t.slice(start, end);
    // 2ページ以上の個票は同じ№で続く。事業目的は1ページ目にあり、事業内容及び成果は同じページで終わるものだけ採る。
    const c = seg.indexOf(CONTENT);
    if (c < 0 || seg.indexOf(CONTENT, c + 1) >= 0) continue;
    const rm = RESULT.exec(seg.slice(c)), r = rm && !seg.includes('次頁へ続く') ? c + rm.index : -1;
    const head = seg.slice(0, c);
    // 決算額の表の年度: 「Ｒ」の行が当年度・前年度の2種類だけで、当年度が先。
    const rs = [...head.matchAll(/\nＲ([０-９])\n/g)].map(m => fw(m[1]));
    if (rs.length !== 2 || rs[1] !== rs[0] - 1) continue;
    const year = 2018 + rs[0];
    const toc = tocNames(inputs, year);
    const names = new Set<string>();
    let at = -1;
    for (const m of head.matchAll(/\n([^\n]+)(?=\n)/g)) {
      const name = m[1].trim();
      if (name.length >= 2 && !/^[\d０-９,△\s]+$/.test(name) && toc.has(name)) { names.add(name); at = m.index! + 1 + m[1].indexOf(name); }
    }
    if (names.size !== 1) continue;
    const name = [...names][0];
    // 事業目的: 見出し「的」の行（表の後で最後のもの）の後から「事業内容及び成果」まで。
    const label = head.lastIndexOf('\n的\n');
    if (label < 0 || head.slice(label).includes('\nＲ')) continue;
    const purposeRaw = head.slice(label + 3);
    const purpose = prose(purposeRaw);
    const contentRaw = r < 0 ? '' : seg.slice(c + CONTENT.length, r);
    const content = r < 0 ? null : prose(contentRaw);
    if (!purpose && !content) continue;
    const p = project(input, `${year}:${name}:narrative`, name, null, name, start + at);
    p.evaluatedFiscalYear = year;
    if (purpose) {
      p.purpose = purpose;
      p.evidence.push(evidence(input, purpose, start + label + 3 + purposeRaw.indexOf(purpose)));
    }
    if (content) {
      p.activities = content;
      p.evidence.push(evidence(input, content, start + c + CONTENT.length + contentRaw.indexOf(content)));
    }
    p.warnings.push('各款の個票の「事業目的」欄を目的、「事業内容及び成果」欄を事業内容として原文のまま収録（表の断片や数字だけの行を含む欄は対象外。段組みで行頭の番号が本文から離れて抽出された箇所は番号を含まない）。'
      + '事務事業名は同年度の目次に載る名称と一致する見出し行。年度は決算額の表の「Ｒ」表記による。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '芦別市 主要事務事業実施の状況及び事務事業評価結果 各款の個票（令和4〜6年度決算）の「事業目的」と「事業内容及び成果」（事業内容として）。表の断片を含む欄は対象外。事務事業名は同年度の目次と一致する見出し行、年度は決算額の表の「Ｒ」表記に限る。令和3年度決算の個票（年度表記なし）は対象外。',
};
