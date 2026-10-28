/** 芦別市 (01216): 主要事務事業実施の状況及び事務事業評価結果 一般会計 各款の個票（令和4〜6年度決算）の決算額。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

const fw = (s: string) => Number(s.replace(/[０-９]/g, d => String(d.charCodeAt(0) - 0xff10)));
const yen = (s: string) => Number(s.replace(/[,\s]/g, '').replace('△', '-'));
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NUMS = '(?:△?\\s?[\\d,]+\\n\\n)*△?\\s?[\\d,]+';
// 決算額（円）の表: 当年度・前年度の行（決算額と財源内訳）と増減の行。空欄の財源は抽出テキストに現れない。
const TABLE = new RegExp(`\\nＲ([０-９])\\n\\n(${NUMS})\\n\\nＲ([０-９])\\n\\n(${NUMS})\\n\\n増減\\n\\n(${NUMS})\\n`, 'g');
const TOC = /[〈<]目次[〉>]\s*令和([０-９\d]+)年度/;

/** 個票の見出し（事務事業名）は列崩れで位置が一定しないため、同年度の目次に「目番号 事務事業名」の行として載る名称と一致する見出し行に限る。 */
export function extractAshibetsuSheets(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '01216' || !input.text.includes('事 務 事 業 名')) return [];
  const out: ProjectEvaluation[] = [];
  let from = 0;
  for (const m of input.text.matchAll(TABLE)) {
    const start = m.index! + 1, regionFrom = from;
    from = start + m[0].length - 1;
    const year = 2018 + fw(m[1]), prev = 2018 + fw(m[3]);
    if (prev !== year - 1) continue;
    const rows = [m[2], m[4], m[5]].map(r => r.split('\n\n').map(yen));
    // 決算額＝財源内訳の合計、増減＝当年度−前年度 を満たす表だけを採る。
    if (!rows.every(r => r.length === 1 || r[0] === r.slice(1).reduce((a, b) => a + b, 0)) || rows[2][0] !== rows[0][0] - rows[1][0]) continue;
    const tocs = inputs.filter(i => { const t = i.text.match(TOC); return t && 2018 + fw(t[1]) === year; });
    // 見出し領域: 前の事業の「総合判定」以降この表まで、および表の後「事業内容及び成果」まで（列崩れで見出しが表の後に来る）。
    const judged = input.text.lastIndexOf('\n総合判定\n', start);
    const head = Math.max(regionFrom, judged);
    const body = input.text.indexOf('事業内容及び成果', from);
    const nextTable = input.text.indexOf('\nＲ', from);
    if (body < 0 || (nextTable >= 0 && nextTable < body)) continue;
    const names: { name: string; at: number }[] = [];
    for (const [a, b] of [[head, start], [from, body]]) {
      let pos = a;
      for (const line of input.text.slice(a, b).split('\n')) {
        const name = line.trim();
        if (name.length >= 2 && !/^[\d０-９,]+$/.test(name) && tocs.some(t => new RegExp(`\\n\\d+ ${escape(name)}\\n`).test(t.text)))
          names.push({ name, at: pos + line.indexOf(name) });
        pos += line.length + 1;
      }
    }
    if (new Set(names.map(n => n.name)).size !== 1) continue;
    const { name, at } = names[0];
    const p = project(input, `${year}:${name}`, name, null, name, at);
    p.evaluatedFiscalYear = year;
    const ev = evidence(input, m[0].slice(1, -1), start);
    p.evidence.push(ev);
    p.amounts.push({ kind: 'actual', fiscalYear: year, amountYen: rows[0][0], rawValue: m[2].split('\n\n')[0], rawUnit: '円（決算額）', evidence: ev });
    p.amounts.push({ kind: 'actual', fiscalYear: prev, amountYen: rows[1][0], rawValue: m[4].split('\n\n')[0], rawUnit: '円（決算額）', evidence: ev });
    p.warnings.push('各款の個票の決算額（円）表から当年度・前年度の決算額を取得（財源内訳の合計・増減との一致を確認）。事務事業名は同年度の目次に載る名称と一致する見出し行。年度は表の「Ｒ」表記による。');
    out.push(p);
  }
  return out;
}
