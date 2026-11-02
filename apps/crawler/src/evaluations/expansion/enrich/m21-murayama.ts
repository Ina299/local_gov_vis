/**
 * 06208 村山市: 教育委員会事務事業点検・評価報告書（令和５年度版・令和７年度版）の事務事業点検・評価書1枚1件。
 * 事業名・年度は公開済みレコードを作った抽出（batch11/k1-edu）をそのまま使い、同じ評価書（ページ）の「目 的」欄を足す。
 * 評価書は目的・内容などの欄が2列に並び、抽出テキストでは欄の本文が見出しの前後に散らばるため、
 * 「目 的」の見出しの直後の段落が句点で終わり、各行が欄の幅で折り返された文章で、直後に決まった次の欄（必要性・評価項目など）が
 * 続く場合だけ採る。箇条（□・〔）で始まる段落（内容欄の本文）や、文の途中で終わる段落は採らない。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { stableId, evidence, type CachedInput } from '../shared';
import { entries as k1 } from '../batch11/k1-edu';
import { joinLines } from './m21-util';

const SHEET = /村山市教育委員会 ?事務事業点検・評価書\n/g;
const PURPOSE = /\n目 的\n\n((?:[^\n]+\n)*?[^\n]+)\n\n(必 要 性|市が行なうべきか。|評価項目|所管|事|（|2)\n/;

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '06208') return [];
  const t = input.text, starts = [...t.matchAll(SHEET)].map(m => m.index!), out: ProjectEvaluation[] = [];
  for (const p of k1['06208'].extract(input, inputs)) {
    const at = Number(/^extracted-text:chars:(\d+)-/.exec(p.evidence[0].cell ?? '')?.[1] ?? NaN);
    const k = starts.filter(s => s <= at).length - 1;
    if (k < 0) continue;
    const from = starts[k], seg = t.slice(from, starts[k + 1] ?? t.length);
    if (input.truncated && k === starts.length - 1) continue;
    const m = PURPOSE.exec(seg);
    if (!m) continue;
    const lines = m[1].split('\n');
    if (!/。$/.test(lines[lines.length - 1]) || /^[□〔■]/.test(lines[0])) continue;
    // 各行が欄の幅（全角28字前後）で折り返しているか、句点で終わること（短い行は表のセル・別の欄の語）。
    if (!lines.every((l, i) => i === lines.length - 1 || l.length >= 24 || /。$/.test(l))) continue;
    if (lines.some(l => l.length > 34)) continue;
    const q: ProjectEvaluation = { ...p, id: stableId(input, `m21:purpose|${p.projectName}|${from}`, p.evaluationYear),
      amounts: [], indicators: [], ratings: [], evidence: [p.evidence[0]], warnings: [...p.warnings] };
    q.purpose = joinLines(m[1]);
    q.evidence.push(evidence(input, m[1], from + m.index! + 6));
    q.warnings.push('村山市 事務事業点検・評価書の「目 的」欄のうち、見出しの直後に続く段落（句点で終わるもの）を収録。PDFの折り返しの改行を除いた。');
    out.push(q);
  }
  return out;
}

export const entry = {
  extract,
  scope: '村山市 教育委員会事務事業点検・評価報告書（令和４・６年度事業分）の事務事業点検・評価書の「目 的」欄（見出し直後の段落が確定するもの）。',
};
