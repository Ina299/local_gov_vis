/**
 * 大阪府 主要事業マネジメントシート（平成27年度当初予算要求に添付、1事業1PDF）。
 * 事業名・部局名・担当室課のみ収録。予算額欄（H24〜H27要求）は年度ラベルと値が抽出テキストで入り交じり、どの値がどの年度か確定しないため金額は収録しない。
 * 一覧ページ（HTML）、行政評価制度の説明資料は事業票ではないため対象外。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { type Entry } from '../../evaluations/expansion/batch9/i1-util';

const HEAD = '主要事業マネジメントシート\n事業名\n\n';
const NL = String.fromCharCode(10);

function extractOne(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '27000' || input.format !== 'pdf') return [];
  const t = input.text;
  if (!t.startsWith(HEAD)) return [];
  const bureaus = [...t.matchAll(/^部局名 (.+)$/gm)];
  const tantos = [...t.matchAll(/^(?:(.+?) )?／ 担当室・?課(?: (.+))?$/gm)];
  if (bureaus.length > 1 || tantos.length !== 1) return [];
  const tm = tantos[0];
  // 事業名: 「事業名」直後の行（部局名の行でない場合）か、「／ 担当室課」の行の前半。
  const firstLine = t.slice(HEAD.length, t.indexOf(NL, HEAD.length));
  let name: { text: string; off: number } | null = null;
  if (tm[1]) name = { text: tm[1], off: tm.index! };
  else if (!firstLine.startsWith('部局名')) name = { text: firstLine, off: HEAD.length };
  else {
    // 部局名の行の後、「／ 担当室課」の行の前にある1行
    const between = t.slice(bureaus[0].index! + bureaus[0][0].length, tm.index!).split(NL).filter(l => l.trim());
    if (between.length === 1) name = { text: between[0], off: t.indexOf(between[0], bureaus[0].index!) };
  }
  if (!name || !/(事業|事業費|補助金|対策費)(\(.*\)|（.*）)?$/.test(name.text) || name.text.length > 120) return [];
  const p = project(input, `sheet:${name.text}`, name.text, null, name.text, name.off);
  p.evidence.push(evidence(input, HEAD.trimEnd(), 0));
  // 担当室課: 同じ行に値があればそれ、なければ次の空でない行が「…課／室」で終わる場合のみ。行末で折り返した値は次行（…課）とつなぐ。
  let tanto: string | null = tm[2] ?? null;
  let tantoRaw = tm[0], tantoOff = tm.index!;
  const after = t.slice(tm.index! + tm[0].length);
  if (tanto && !/[課室]$/.test(tanto)) {
    const cont = /^\n([^\n]{1,10}課)\n/.exec(after);
    if (cont) { tanto += cont[1]; tantoRaw = tm[0] + NL + cont[1]; }
    else tanto = null;
  } else if (!tanto) {
    const next = /^\n+([^\n]+)\n/.exec(after);
    if (next && /^\S+[課室]$/.test(next[1])) { tanto = next[1]; tantoRaw = tm[0] + next[0].slice(0, next[0].length - 1); }
  }
  const bureau = bureaus[0]?.[1] ?? null;
  if (bureau) p.evidence.push(evidence(input, bureaus[0][0], bureaus[0].index!));
  if (tanto) p.evidence.push(evidence(input, tantoRaw, tantoOff));
  p.department = [bureau, tanto].filter(Boolean).join(' ') || null;
  if (!tanto) p.warnings.push('担当室課の値が抽出テキストで確認できないため部局名のみ収録。');
  p.warnings.push('平成27年度当初予算要求に添付された主要事業マネジメントシート（評価調書ではない）。予算額欄（H24〜H26の予算額・実績、H27要求額）は年度ラベルと値が抽出テキストで入り交じり対応が確定しないため金額は未収録。');
  return [p];
}

export const entries: Record<string, Entry> = {
  '27000': {
    scope: '平成27年度当初予算要求 主要事業マネジメントシート（政策企画部・総務部の個別PDF）の事業名・部局名・担当室課のみ。予算額欄（年度と値の対応が抽出テキストで確定しない）、マネジメントシート一覧ページ、行政評価制度の説明資料は対象外。',
    extract: (input) => extractOne(input),
  },
};
