/**
 * 30390 印南町: 令和６年度 印南町教育委員会事業評価調書（令和７年度 教育委員会評価）。
 * 調書の上段は「事務事業名」「目的」「事業内容」の3欄で、欄の見出しが縦書きのため、抽出テキストでは見出しの1字
 * （事・務・業・目・的・名・内・容）が単独の段落になるか、本文の行頭に「的 」「容 」として入る。
 * 「区分」（事業費の表）より前を空行で段落に分け、見出しの字だけの段落を除いたとき、事業名の段落（「名 事業名」の1行、
 * または「名」の段落の直後の段落）のほかに本文の段落がちょうど2つ残るものだけを採る。先の段落が目的、後の段落が事業内容
 * （行頭の「的 」は目的、「容 」は事業内容の段落にしかないこと）。値は行頭の見出しの字を除き、折り返しの改行を除いたもの。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { sheetRecord, type Field } from './m21-util';

const SHEET = /\n令和６年度\n\n印南町教育委員会事業評価調書\n担当係名：(\S+)\n/g;
const LABEL = /^[事務業目的名内容]$/;

interface Para { raw: string; at: number; lines: string[] }

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '30390' || !/\/R7kyouikuiinkaihyouka\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(SHEET)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i], body = h.index! + h[0].length;
    if (input.truncated && i === heads.length - 1) continue;
    const end = t.indexOf('\n区分\n', body);
    if (end < 0 || (heads[i + 1] && end > heads[i + 1].index!)) continue;
    const paras: Para[] = [];
    for (const m of t.slice(body, end).matchAll(/[^\n]+(?:\n[^\n]+)*/g)) paras.push({ raw: m[0], at: body + m.index!, lines: m[0].split('\n') });
    let name: { value: string; raw: string; at: number } | null = null, ok = true;
    const texts: Para[] = [];
    for (let k = 0; k < paras.length && ok; k++) {
      const p = paras[k], [first, ...rest] = p.lines;
      if (p.lines.every(l => LABEL.test(l))) continue;
      if (/^名 /.test(first) && rest.every(l => LABEL.test(l))) {
        if (name) ok = false;
        name = { value: first.slice(2).trim(), raw: first.slice(2), at: p.at + 2 };
      } else if (k > 0 && paras[k - 1].lines.at(-1) === '名' && !name) {
        if (p.lines.some(l => LABEL.test(l) || /^[的容] /.test(l))) ok = false;
        name = { value: p.lines.join(''), raw: p.raw, at: p.at };
      } else {
        if (p.lines.some(l => LABEL.test(l) || /^[事務業目名内] /.test(l))) ok = false;
        texts.push(p);
      }
    }
    if (!ok || !name || texts.length !== 2) continue;
    const [purpose, activities] = texts;
    if (purpose.lines.some(l => l.startsWith('容 ')) || activities.lines.some(l => l.startsWith('的 '))) continue;
    if (purpose.lines.filter(l => /^[的容] /.test(l)).length > 1 || activities.lines.filter(l => /^[的容] /.test(l)).length > 1) continue;
    const value = (p: Para) => p.lines.map(l => l.replace(/^[的容] /, '')).join('');
    const fields: Field[] = [
      { key: 'purpose', raw: purpose.raw, at: purpose.at, value: value(purpose) },
      { key: 'activities', raw: activities.raw, at: activities.at, value: value(activities) },
    ];
    out.push(sheetRecord(input, `${body}`, name, { evaluationYear: null, evaluatedFiscalYear: 2024 }, h[1], fields,
      '印南町教育委員会事業評価調書（令和６年度）の「目的」「事業内容」欄の本文を収録。縦書きの欄見出しの1字（行頭の「的 」「容 」）とPDFの折り返しの改行を除いた。'));
  }
  return out;
}

export const entry = {
  extract,
  scope: '印南町教育委員会事業評価調書（令和６年度事業）の「目的」「事業内容」欄（見出しの字を除いて事業名・目的・事業内容の段落が確定するもの）。',
};
