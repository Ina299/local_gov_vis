/**
 * 静岡県 令和7年度 事業別見直し状況一覧（部局別PDF、課ごとのページ）の事業名・部局名・課名。
 *
 * 表の列は 事業名／経費区分・開始・終了年度・R8統合／R6最終・R7当初予算・R8当初予算（各 歳出・一般財源）／改善ポイント等。
 * 事業の行は「事業名の段落 → 経費区分等の短い記号の段落 → 4値（R6最終・R7当初の歳出/一般財源）→『・』で始まる改善ポイント」
 * の並びで確定できるものだけを収録する（事業名は4値の直前の記号段落をさかのぼった最初の段落）。
 * 金額: 表に単位の表記は印字されていないが、千円とみなす（利用者の判断。2026-11）。4値の3番目（R7当初予算の歳出）を令和7年度の予算額、
 * 改善ポイントの直後の2値の1番目（R8当初予算の歳出）を令和8年度の予算額として収録する（列の並びは各ページの「計」行の合計で確認済み）。
 * R6最終予算は当初予算と区別するため収録しない。「-」・「△」の値は収録しない。
 * 健康福祉部・経済産業部の PDF は取得テキストが1ページ分しかない／未取得のため実質対象外。総合計画（概要版）は対象外。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { amount, nfkc, num, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const CODE = '22000';
const PAGE = '事業別見直し状況一覧\n局 名';
const V = String.raw`(?:△ ?\d{1,3}(?:,\d{3})*|\d{1,3}(?:,\d{3})*|[-－])`;
const VPARA = new RegExp(`^${V}(?: ${V})*$`);
const LABELS = new Set(['計', '合計', '小計', '歳出', '一般財源', 'R7当初予算', 'R8当初予算', 'R6最終', '事 業 名', '事業名', '部局名', '課 名', '局 名',
  '評価と改善措置のポイント', '今後の事業展開', '政策体系 No', '指 標', '目標', 'R5実績', 'R6実績', 'R8目標', 'R8目標／目標', '事', '業']);

type Para = { s: string; at: number };
const paragraphs = (t: string, base: number): Para[] => [...t.matchAll(/[^\n]+(?:\n[^\n]+)*/g)].map(m => ({ s: m[0], at: base + m.index! }));
const values = (ps: Para[]) => ps.flatMap(p => [...p.s.matchAll(new RegExp(V, 'g'))].map(m => ({ raw: m[0], at: p.at + m.index! })));
const positive = (v: string) => /^\d/.test(v) && num(v) > 0;
const vcount = (p: Para) => (VPARA.test(p.s) ? [...p.s.matchAll(new RegExp(V, 'g'))].length : 0);
/** 経費区分・開始/終了年度・統合番号などの短い記号だけの段落。 */
const isCode = (p: Para) => p.s.split(/\s+/).every(w => w.length <= 2 || /^[SＳHＨRＲ][0-9０-９]{1,2}$/.test(w) || /^[①-⑳]$/.test(w));

function extractOne(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== CODE || !input.text.startsWith(PAGE)) return [];
  const t = input.text;
  const starts = [...t.matchAll(new RegExp(PAGE, 'g'))].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  const seen = new Map<string, number>();
  // 部局名: 資料（部局別PDF）内の「部局名」欄の値が1種類だけの場合に全行へ適用
  const buVals = [...t.matchAll(/\n部局名\n\n([^\n]+)\n\n/g)].filter(m => /^\S+(?:部|局|本部|事務局|委員会)$/.test(m[1]));
  const buName = new Set(buVals.map(m => m[1])).size === 1 ? { s: buVals[0][1], at: buVals[0].index! + '\n部局名\n\n'.length } : null;
  starts.forEach((s, pi) => {
    const pageText = t.slice(s, starts[pi + 1] ?? t.length);
    const paras = paragraphs(pageText, s);
    const kaIdx = paras.findIndex((p, i) => p.s === '業' && /^[^\s・、]+(?:課|室|所|センター)$/.test(paras[i + 1]?.s ?? ''));
    const ka = kaIdx >= 0 ? paras[kaIdx + 1] : null;
    paras.forEach((p, i) => {
      // 4値（R6最終・R7当初の歳出／一般財源）の段落列の始まり
      if (!vcount(p) || (i > 0 && vcount(paras[i - 1]))) return;
      let n = 0, j = i;
      while (paras[j] && vcount(paras[j])) n += vcount(paras[j++]);
      if (n !== 4 || !paras[j]?.s.startsWith('・')) return;
      // 事業名: 記号段落をさかのぼる
      let k = i - 1;
      while (paras[k] && isCode(paras[k]) && !LABELS.has(paras[k].s)) k--;
      if (k === i - 1) return; // 記号段落がない並びは事業行と確定できない
      const nm = paras[k];
      if (!nm || LABELS.has(nm.s) || nm.s.startsWith('・') || vcount(nm) || nm.s.length < 3) return;
      // 折り返しは2行まで（2行目に空白や経費区分の語が混じるものは事業名と経費区分が入り混じっているため除く）
      const lines = nm.s.split('\n');
      if (lines.length > 2 || (lines.length === 2 && (/\s/.test(lines[1]) || /政策|年次|県行|国行|部局|義務|準義|人件|県単|県奨|国奨/.test(lines[1])))) return;
      const name = lines.join('');
      if (/[：:\s]|実績|目標|見直し状況|千円/.test(name) || /^歳入/.test(name) || !/(?:費|事業|金|業務|計画|対策|経費|基金)(?:（[^）]*）)?$/.test(name)) return;
      const c = (seen.get(nfkc(name)) ?? 0) + 1;
      seen.set(nfkc(name), c);
      const r = project(input, `${name}#${c}`, name, 2025, nm.s, nm.at);
      r.evidence.push(evidence(input, t.slice(paras[k + 1].at, paras[i - 1].at + paras[i - 1].s.length), paras[k + 1].at));
      if (buName) {
        r.department = ka ? `${buName.s} ${ka.s}` : buName.s;
        r.evidence.push(evidence(input, buName.s, buName.at));
        if (ka) r.evidence.push(evidence(input, ka.s, ka.at));
      }
      const v4 = values(paras.slice(i, j));
      const block = (a: number, b: number) => t.slice(paras[a].at, paras[b - 1].at + paras[b - 1].s.length);
      if (positive(v4[2].raw)) r.amounts.push(amount(input, 'budget', 2025, v4[2].raw, '千円', block(i, j), paras[i].at));
      let e = j;
      while (paras[e]?.s.startsWith('・')) e++;
      let f = e, m = 0;
      while (paras[f] && vcount(paras[f]) && m < 2) m += vcount(paras[f++]);
      const v8 = m === 2 ? values(paras.slice(e, f)) : [];
      if (v8.length === 2 && positive(v8[0].raw)) r.amounts.push(amount(input, 'budget', 2026, v8[0].raw, '千円', block(e, f), paras[e].at));
      r.warnings.push('令和7年度 事業別見直し状況一覧（令和8年度当初予算編成時の点検）。予算額はR7当初・R8当初の歳出（表に単位の印字がないため千円とみなした）。R6最終予算・一般財源は収録していない。');
      out.push(r);
    });
  });
  return out;
}

export const entries: Record<string, Entry> = {
  [CODE]: {
    scope: '令和7年度 事業別見直し状況一覧（部局別PDF）の事業名・部局名・課名（事業名→経費区分→予算値→改善ポイントの並びで行が確定できたもの）。R7当初・R8当初予算の歳出（単位の表記がないため千円とみなす）。総合計画・記載要領は対象外。',
    extract: (input) => extractOne(input),
  },
};
