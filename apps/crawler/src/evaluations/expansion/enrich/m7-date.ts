/**
 * 07213 伊達市: 事務事業評価表（令和6年度実施事業）。公開済みレコード（g6-07213 と同じ評価表・同じ見出し）の空欄に、
 * 「意図【PLAN】」を目的、「事業概要【PLAN】」を事業内容として補う。「目的と方針」は施策（主な取組）単位の共通文なので使わない。
 * PLAN欄は見出しと本文が別々の段落で出力され、見出しの位置は本文とずれるが、本文の段落は 目的と方針・事業概要・対象・意図 の順に並ぶ。
 * 「目的と方針」から「意図の実現の」の手前までに見出し3つがこの順に1回ずつあり、本文がちょうど4段落で、対象・意図の段落が
 * それぞれの欄の幅に収まる場合だけ採る。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';
import { eraYear } from '../batch7/g6-util';

// g6-07213 の見出し（整理番号・実施年度・事業名・担当課・業務名）。
const HEAD = /事務事業評価表\n\n(\d+)\n\n(令和|平成)(\S+)年度実施事業\n事業名\n\n([^\n]+)\n\n担当課\n\n([^\n]+)\n\n業務名\n\n([^\n]+)\n\n担当係\n/g;
const HEADINGS = ['事業概要\n【PLAN】', '対象\n【PLAN】', '意図\n【PLAN】'];
/** 対象の欄は全角17字前後、意図の欄は28字前後で折り返す。 */
const TARGET_WIDTH = 18, INTENT_WIDTH = 30;
/** 折り返しとみなす前の行の最低文字数（意図・事業概要の欄の幅より少し短く）。 */
const WRAP = { intent: 24, summary: 45 };

/** 欄の幅いっぱいの行（句点で終わらない）の後の改行だけを除く。 */
const join = (raw: string, minWrap: number) =>
  raw.split('\n').reduce((acc, l, i, ls) => acc + (i === 0 ? '' : ls[i - 1].length >= minWrap && !/。$/.test(ls[i - 1]) ? '' : '\n') + l, '');

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '07213' || input.format !== 'pdf') return [];
  const text = input.text, heads = [...text.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    if (input.truncated && i === heads.length - 1) return;
    const start = h.index!, end = heads[i + 1]?.index ?? text.length, sheet = text.slice(start, end);
    const fy = eraYear(h[2], h[3]);
    if (fy !== 2024 || !/課|室|局|所|館/.test(h[5])) return;
    const a = sheet.indexOf('目的と方針\n【PLAN】\n\n'), b = sheet.indexOf('\n意図の実現の', a);
    if (a < 0 || b < 0 || sheet.indexOf('目的と方針\n【PLAN】', a + 1) >= 0) return;
    const from = start + a + '目的と方針\n【PLAN】\n\n'.length;
    const paras = [...text.slice(from, start + b).matchAll(/[^\n]+(?:\n[^\n]+)*/g)].map(m => ({ raw: m[0], at: from + m.index! }));
    const at = HEADINGS.map(x => paras.findIndex(q => q.raw === x));
    if (at.some(k => k < 0) || !(at[0] < at[1] && at[1] < at[2]) || HEADINGS.some(x => paras.filter(q => q.raw.includes(x.split('\n')[0] + '\n')).length !== 1)) return;
    const body = paras.filter(q => !HEADINGS.includes(q.raw));
    if (body.length !== 4 || body.some(q => /【PLAN】|【DO】|千円/.test(q.raw))) return;
    const [, summary, target, intent] = body;
    const widest = (q: { raw: string }) => Math.max(...q.raw.split('\n').map(l => l.length));
    if (widest(target) > TARGET_WIDTH || widest(intent) > INTENT_WIDTH || widest(summary) <= INTENT_WIDTH) return;
    const business = h[4].replace(/（再掲）$/, ''), task = h[6];
    const name = task === '－' ? business : `${business}：${task}`;
    const p = project(input, `narrative-${h[1]}`, name, null, h[0].replace(/\n$/, ''), start);
    p.department = h[5]; p.evaluatedFiscalYear = fy;
    p.purpose = join(intent.raw, WRAP.intent);
    p.activities = join(summary.raw, WRAP.summary);
    p.evidence.push(evidence(input, summary.raw, summary.at), evidence(input, target.raw, target.at), evidence(input, intent.raw, intent.at));
    p.warnings.push('伊達市 事務事業評価表（令和6年度実施事業）の「意図【PLAN】」を目的、「事業概要【PLAN】」を事業内容として収録（対象は目的の前提として根拠にのみ記録）。'
      + 'PLAN欄の本文が 目的と方針・事業概要・対象・意図 の4段落に分かれ、対象・意図の段落が欄の幅に収まる場合のみ。PDFの折り返しの改行を除いた。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '伊達市 事務事業評価表（令和6年度実施事業）の「意図」（目的として）と「事業概要」（PLAN欄の本文が4段落に分かれ、欄の幅で対応が確かめられるもの）。施策単位の「目的と方針」とチェック項目の文章評価は対象外。',
};
