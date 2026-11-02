/**
 * 08203 土浦市: 教育委員会 点検・評価報告書（令和3〜7年度分）の点検・評価報告シート。公開済みレコードの空欄の目的・事業内容・成果を補う。
 * 事業名・担当課・年度は公開済みレコードを作った抽出（batch9/i3-city）をそのまま使い、その事業名の行を含むシートから欄を読む。
 * 抽出テキストでは欄の見出しと本文の並びがシートごとに崩れるため、見出しの直後の段落が次の欄の見出しで終わる場合だけ採る。
 * - 目的: 「事業目的」の直後の段落の直後が「事業内容」の見出し。
 * - 事業内容: 「事業内容」の直後の段落の直後が「令和N年度\n活動実績」の見出し。
 * - 成果: 「成果」の直後から「指標」または「課題及び」の見出しまで。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, stableId, type CachedInput } from '../shared';
import { entries as i3 } from '../batch9/i3-city';
import { segments } from '../batch9/i3-util';
import { block, blockEvidence, type Block } from './m3-narrative';

const SHEET = /点検・評価報告シート（令和[０-９\d]+年度分）\n/g;
/** 本文1行は40字前後。 */
const WRAP = 34;

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '08203') return [];
  const base = i3['08203'].extract(input, inputs);
  if (!base.length) return [];
  const t = input.text, sheets = segments(t, SHEET), out: ProjectEvaluation[] = [];
  const field = (seg: string, start: number, label: string, next: RegExp, stop = /^$/): { b: Block; at: number } | null => {
    const head = `\n${label}\n\n`, i = seg.indexOf(head);
    if (i < 0 || seg.indexOf(head, i + 1) >= 0) return null;
    const b = block(t, start + i + head.length, stop, { minWrap: WRAP });
    return b && next.test(t.slice(b.at + b.raw.length)) ? { b, at: start + i + 1 } : null;
  };
  for (const p of base) {
    const at = Number(/^extracted-text:chars:(\d+)-/.exec(p.evidence[0].cell ?? '')?.[1] ?? -1);
    const sheet = sheets.find(s => s.start <= at && at < s.end);
    if (!sheet || (input.truncated && sheet.end === t.length)) continue;
    const seg = t.slice(sheet.start, sheet.end);
    const purpose = field(seg, sheet.start, '事業目的', /^\n\n事業内容\n/);
    const activities = field(seg, sheet.start, '事業内容', /^\n\n令和[０-９\d]+年度\n活動実績\n/);
    const outcomes = field(seg, sheet.start, '成果', /^\n(\n?指標|\n課題及び)\n/, /^(指標|課題及び)$/);
    if (!purpose && !activities && !outcomes) continue;
    const q: ProjectEvaluation = { ...p, id: stableId(input, `narrative|${p.evaluatedFiscalYear}|${p.projectName}|${at}`, null),
      amounts: [], indicators: [], ratings: [], evidence: [...p.evidence], warnings: [...p.warnings] };
    for (const [k, f, label] of [['purpose', purpose, '事業目的'], ['activities', activities, '事業内容'], ['outcomes', outcomes, '成果']] as const) {
      if (!f) continue;
      q[k] = f.b.value;
      q.evidence.push(evidence(input, label, f.at), blockEvidence(input, f.b));
    }
    q.warnings.push('土浦市 教育委員会 点検・評価報告シートの「事業目的」「事業内容」「成果」欄を収録（見出しの直後の段落が次の欄の見出しで終わるものに限る）。PDFの折り返しの改行を除いた。');
    out.push(q);
  }
  return out;
}

export const entry = {
  extract,
  scope: '土浦市 教育委員会 点検・評価報告書（令和3〜7年度分）の点検・評価報告シートの「事業目的」「事業内容」「成果」欄（見出しの直後の段落が次の欄の見出しで終わるもの）。',
};
