import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence } from '../shared';
import { kanumaKitaibarakiEntries } from '../batch7/g0-kanuma-kitaibaraki';

// ---------------------------------------------------------------- 鹿沼市 事業評価調書（R5jigyou.pdf）
// 公開済みレコード（年度の記載なし）は同じPDFの調書から作られている（batch7/g0-kanuma-kitaibaraki.ts）。同じ抽出で事業名・所管・根拠を
// 作り直し、調書の「事業の目指す姿」のうち「将来像」を目的、「手段」を事業内容として付ける（「対象」は付けない）。
// 将来像は次のどちらかの並びのものだけ採る。
//  (a) 空行の後の「将来像 」に続く1行で、次の行が空行か「<Do>」（見出しが本文の途中の行に重なった調書は採らない）。
//  (b) 「将来像」の行、空行（間に「○○ 係」の行と空行が1組入ってもよい）、本文の行、空行、「<Do> 事業の実施状況」。
// 手段は「手段」の行、空行、本文の行、空行の並びで、本文に見出し・所管の行が混ざらないもの。
// 「<Do>」の実施内容は「実」「施」「内」「容」の縦書きの見出しや協働・共創の欄と混ざって範囲が確定しないため対象外。

const LABEL = /^(対象|手段|将来像|事業の|目指す姿|\S+ (部|課|係|室)|<Do>.*)$/;
const block = (lines: string) => lines.split('\n').every(l => l.trim() && !LABEL.test(l.trim()));

function unwrapLines(raw: string): string {
  const lines = raw.split('\n').map(l => l.trim());
  return lines.reduce((s, l, i) => i === 0 ? l : s + (lines[i - 1].length >= 30 && !/[。.]$/.test(lines[i - 1]) ? '' : '\n') + l, '');
}

function fields(planText: string): { p: string; pAt: number; a: string | null; aAt: number } | null {
  const plan = `${planText}<Do> 事業の実施状況\n`;
  if (plan.split('将来像').length !== 2) return null;
  let p: string | null = null, pAt = -1;
  const a1 = /\n\n将来像 ([^\n]+)\n(?=\n|<Do>)/.exec(plan);
  const a2 = /\n将来像\n\n(?:\S+ 係\n\n)?((?:[^\n]+\n)*?[^\n]+)\n\n<Do> 事業の実施状況\n/.exec(plan);
  if (a1) { p = a1[1]; pAt = a1.index + '\n\n将来像 '.length; }
  else if (a2 && block(a2[1])) { p = a2[1]; pAt = a2.index + a2[0].indexOf(`\n\n${a2[1]}\n\n<Do>`) + 2; }
  if (!p || !block(p)) return null;
  const m = /\n手段\n\n((?:[^\n]+\n)*?[^\n]+)\n\n/.exec(plan);
  const ok = m && plan.split('\n手段\n').length === 2 && block(m[1]);
  return { p, pAt, a: ok ? m[1] : null, aAt: ok ? m.index + '\n手段\n\n'.length : -1 };
}

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  const sheets = kanumaKitaibarakiEntries['09205'].extract(input, inputs);
  const out: ProjectEvaluation[] = [];
  for (const s of sheets) {
    const start = Number(/^extracted-text:chars:(\d+)-/.exec(s.evidence[0].cell ?? '')?.[1] ?? -1);
    const doAt = input.text.indexOf('<Do> 事業の実施状況', start);
    if (start < 0 || doAt < 0) continue;
    // 調書の計画欄（<Plan> から <Do> の手前まで）。<Do> の行の直前の改行までを含める。
    const plan = input.text.slice(start, doAt);
    const f = fields(plan);
    if (!f) continue;
    const purpose = unwrapLines(f.p);
    if (purpose.length < 5) continue;
    s.id = `${s.id}-narrative`;
    s.amounts = []; s.indicators = []; s.ratings = [];
    s.purpose = purpose;
    s.evidence.push(evidence(input, f.p, start + f.pAt));
    if (f.a) { s.activities = unwrapLines(f.a); s.evidence.push(evidence(input, f.a, start + f.aAt)); }
    s.warnings = [s.warnings[0], '鹿沼市 事業評価調書の「事業の目指す姿」の「将来像」を目的、「手段」を事業内容とした（折り返しの改行のみ除去）。年度は調書に明記がないため未設定。'];
    out.push(s);
  }
  return out;
}

export const entry = { extract, scope: '鹿沼市 事業評価調書（R5jigyou.pdf）の「将来像」（目的）・「手段」（事業内容）。年度の記載がない公開済みレコードを、同じPDFの同じ調書に限って補強。' };
