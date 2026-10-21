import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, mergeReprints } from '../batch7/g1-util';

const HEAD = /No\.(\d+)\n【様式１】\n\n令和 ?(\d+)\n\n年度\n\n事務事業評価シート\n\n/g;
const DATE = '令和 \\d+ 年 \\d+ 月 \\d+ 日';
// Name cell positions seen in the extracted text; anything else is skipped rather than guessed.
const NAME = [
  /^事務事業名\n\n([^\n]+)\n\n(?:予算款項目|担当部課)\n/,
  /^事務事業名\n予算款項目\n\n([^\n]+)\n(?:\d+\n\n)?一般 /,
  new RegExp(`^事務事業名\\n予算款項目\\n\\n${DATE}\\n\\n([^\\n]+)\\n\\n担当部課\\n`),
  new RegExp(`^${DATE}\\n\\n事務事業名\\n\\n([^\\n]+)\\n\\n(?:担当部課|予算款項目)\\n`),
];
const COLS = 'R8予算\n\nR7決算\n\nR6決算\n\nR5決算\n';
const TOTAL = /事業費総額・・・①\n\n(?:R8予算\n\nR7決算\n\nR6決算\n\nR5決算\n\n)?([\d,]+) ([\d,]+) ([\d,]+) ([\d,]+)\n/;
const SHARE = /（②\+③\+④）\/①\n\n([\d,]+) ([\d,]+) ([\d,]+) ([\d,]+)\n\n?([\d.]+)%\n\n([\d.]+)%\n\n([\d.]+)%\n\n([\d.]+)%\n/;
const n = (s: string) => Number(s.replaceAll(',', ''));

/** 仙北市 令和8年度 事務事業評価シート（様式１）。 */
export function extractSemboku(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '05215' || input.sourceId !== '633888305a917977d004b39a') return [];
  const heads = [...input.text.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (const [k, h] of heads.entries()) {
    const start = h.index!, body = start + h[0].length, end = heads[k + 1]?.index ?? input.text.length;
    const seg = input.text.slice(body, end), nm = NAME.map(r => r.exec(seg)).find(Boolean);
    if (!nm || /令和|^一般|^[\d\s,-]+$/.test(nm[1])) continue;
    const p = project(input, `No.${h[1]}`, nm[1], 2018 + Number(h[2]), h[0] + nm[0], start);
    const intro = seg.slice(0, Math.max(0, seg.indexOf('１.事務事業の目的')));
    const d = /担当部課\n(?:\d+\n)?\n([^\n]+)\n\n担当者職名/.exec(intro);
    if (d && /(?:課|センター|出張所|館|室)$/.test(d[1])) p.department = d[1];
    const t = TOTAL.exec(seg), sh = SHARE.exec(seg), c = seg.indexOf(COLS);
    let verified = false;
    if (t && sh && c >= 0 && c < t.index + t[0].length) {
      const total = [1, 2, 3, 4].map(i => n(t[i])), general = [1, 2, 3, 4].map(i => n(sh[i])), pct = [5, 6, 7, 8].map(i => Number(sh[i]));
      verified = total.every((v, i) => v > 0 && general[i] <= v && Math.abs(Math.round(general[i] / v * 1000) / 10 - pct[i]) < 0.051);
      if (verified) {
        const pieces = [t[1], t[2], t[3], t[4]];
        let o = body + t.index + t[0].length - 1 - pieces.join(' ').length;
        const meta: [kind: 'budget' | 'actual', year: number][] = [['budget', 2026], ['actual', 2025], ['actual', 2024], ['actual', 2023]];
        pieces.forEach((v, i) => { p.amounts.push(amount(input, meta[i][0], meta[i][1], v, '円', v, o)); o += v.length + 1; });
        p.evidence.push(evidence(input, sh[0], body + sh.index));
      }
    }
    p.warnings.push('仙北市 令和8年度事務事業評価シート（様式１）の見出しから事業名を収録（担当部課は欄の位置が確定する票のみ）。' +
      (verified ? '事業費総額・・・①（円）を列見出し（R8予算・R7決算・R6決算・R5決算）の順に収録し、一般財源等の額÷事業費総額が4列とも記載の割合と一致することを検算済み。' : '事業費総額の行が列の対応を確定できる形で抽出されていない、または割合の検算が一致しないため金額は未収録。') +
      '一次・外部・二次評価の判定は○印の位置が抽出テキストで崩れるため未収録。成果指標・事務事業評価一覧（段組み崩れ）は未構造化。評価対象年度は本文に明記がなく未設定。');
    out.push(p);
  }
  return mergeReprints(out, p => `${p.projectCode}:${p.evaluationYear}`);
}
