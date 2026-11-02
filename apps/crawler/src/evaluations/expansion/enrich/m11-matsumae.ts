/**
 * 01331 松前町: 教育委員会の事務・事業の点検及び評価シート（令和3〜6年度事務・事業分）。公開済みレコードの空欄の目的・事業内容を補う。
 * 事業名・担当課・年度は公開済みレコードを作った抽出（令和6年度分は batch8/h1、令和3〜5年度分は batch12/m7-c）をそのまま使い、
 * その事業名の位置を含むシートから「事務・事業の概要」の欄を読む。抽出テキストでは予算の状況の表の行が欄の本文に割り込むことがあるため、
 * 表の行（短い語・数値の行）が1行でも混ざる欄は採らない。
 * - 目的: 「①目的」の次の行から「②事業主体」の行の手前まで（間の空行は1つまで）。
 * - 事業内容: 「③事業内容及び対象者等」の次の行から空行の手前まで。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, stableId, type CachedInput } from '../shared';
import { entries as h1 } from '../batch8/h1';
import { entries as m7c } from '../batch12/m7-c';
import { segments } from '../batch9/i3-util';
import { block, blockEvidence, type Block } from './m3-narrative';

const SHEET = /教育委員会の事務・事業の点検及び評価シート\n/g;
/** 本文1行は全角26〜30字。 */
const WRAP = 22;

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '01331') return [];
  const base = [...h1['01331'].extract(input, inputs), ...m7c['01331'].extract(input, inputs)];
  if (!base.length) return [];
  const t = input.text, sheets = segments(t, SHEET), out: ProjectEvaluation[] = [];
  const field = (seg: string, start: number, label: string, stop: RegExp, next: RegExp): { b: Block; at: number } | null => {
    const head = `\n${label}\n`, i = seg.indexOf(head);
    if (i < 0 || seg.indexOf(head, i + 1) >= 0) return null;
    const b = block(t, start + i + head.length, stop, { minWrap: WRAP });
    return b && next.test(t.slice(b.at + b.raw.length)) ? { b, at: start + i + 1 } : null;
  };
  for (const p of base) {
    const at = Number(/^extracted-text:chars:(\d+)-/.exec(p.evidence[0].cell ?? '')?.[1] ?? -1);
    const sheet = sheets.find(s => s.start <= at && at < s.end);
    if (!sheet || (input.truncated && sheet.end === t.length)) continue;
    const seg = t.slice(sheet.start, sheet.end);
    const purpose = field(seg, sheet.start, '①目的', /^②事業主体/, /^\n\n?②事業主体/);
    const activities = field(seg, sheet.start, '③事業内容及び対象者等', /^$/, /^\n\n/);
    if (!purpose && !activities) continue;
    const q: ProjectEvaluation = { ...p, id: stableId(input, `narrative|${p.evaluatedFiscalYear}|${p.projectName}|${at}`, null),
      amounts: [], indicators: [], ratings: [], evidence: [...p.evidence], warnings: [...p.warnings] };
    for (const [k, f] of [['purpose', purpose], ['activities', activities]] as const) {
      if (!f) continue;
      q[k] = f.b.value;
      q.evidence.push(evidence(input, k === 'purpose' ? '①目的' : '③事業内容及び対象者等', f.at), blockEvidence(input, f.b));
    }
    q.warnings.push('松前町 教育委員会の事務・事業の点検及び評価シートの「①目的」「③事業内容及び対象者等」欄を収録（予算の表の行が割り込んだ欄は除く）。PDFの折り返しの改行を除いた。');
    out.push(q);
  }
  return out;
}

export const entry = {
  extract,
  scope: '松前町 教育委員会の事務・事業の点検及び評価シート（令和3〜6年度事務・事業分）の「①目的」「③事業内容及び対象者等」欄（予算の表の行が割り込んでいないもの）。',
};
