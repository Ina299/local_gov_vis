/**
 * 秋田県「事業評価調書（目的設定、中間評価、事後評価）」（様式３、政策・戦略別のPDFに1事業1〜2ページで収録。令和７・８年度評価分）。
 * 調書ごとに事業名・部局名・課室名・評価年度を読む。
 * 金額は「２ 事業概要及び財源」の表（事業内訳ごとに 令和◯年度予算額／令和◯年度決算(見込)額／最終年度決算(見込)額）から、
 * 評価年度の予算額の合計だけを、次の検算が通る場合に収録する:
 *   表の数値だけの行を順に読み、先頭から事業内訳 k 行分を（予算額, 決算(見込)額）の組として取ったとき、予算額の和と決算(見込)額の和が
 *   どちらも後続の数値（合計欄）に現れる k がちょうど1つに定まる。事業内訳の番号（1〜5だけの行）は数値から除く。
 * 決算(見込)額は決算か見込かが欄名で区別されないため収録しない。事業（中間）評価結果一覧表・報告書の一覧は調書と重複するため対象外。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { mergeReprints, nfkc, num, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const N = String.raw`\d{1,3}(?:,\d{3})*`;
const SHEET = /事業評価調書（目的設定、中間評価、事後評価）\n/g;
const reiwa = (s: string) => 2018 + num(s === '元' ? '1' : s);

type Tok = { raw: string; value: number; start: number };

function budgetTotal(t: string, from: number, to: number): { tok: Tok; fy: number; fyRaw: string; fyStart: number; k: number; sumS: number } | null {
  const blk = t.slice(from, to);
  const hdr = /令和(\S+)年度\n予算額\n\n令和(\S+)年度\n決算\(見込\)額\n\n最終年度\n決算\(見込\)額/.exec(blk);
  if (!hdr) return null;
  const toks: Tok[] = [];
  let pos = 0;
  for (const line of blk.split('\n')) {
    if (new RegExp(`^${N}(?: ${N})*$`).test(line) && !/^[1-5]$/.test(line)) {
      let off = 0;
      for (const part of line.split(' ')) { toks.push({ raw: part, value: num(part), start: from + pos + off }); off += part.length + 1; }
    }
    pos += line.length + 1;
  }
  const sols: { k: number; b: number; s: number }[] = [];
  for (let k = 1; k <= Math.min(10, Math.floor(toks.length / 2)); k++) {
    let b = 0, s = 0;
    for (let i = 0; i < k; i++) { b += toks[2 * i].value; s += toks[2 * i + 1].value; }
    const rest = toks.slice(2 * k).map(x => x.value);
    if (b > 0 && rest.includes(b) && rest.includes(s)) sols.push({ k, b, s });
  }
  if (sols.length !== 1) return null;
  const { k, b, s } = sols[0];
  const tok = toks.slice(2 * k).find(x => x.value === b)!;
  return { tok, fy: reiwa(nfkc(hdr[1])), fyRaw: hdr[0], fyStart: from + hdr.index, k, sumS: s };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  const starts = [...t.matchAll(SHEET)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, si) => {
    const end = starts[si + 1] ?? t.length;
    const sheet = t.slice(s, end);
    const bg = sheet.indexOf('１ 事業実施の背景');
    if (bg < 0) return;
    const head = sheet.slice(0, bg);
    const ey = /\(評価年度：令和(\S+)年度）/.exec(head);
    const nm = /\n事業名\n\n([^\n]+)\n\n/.exec(head) ?? /\n事 業 名 ([^\n]+)\n/.exec(head);
    if (!ey || !nm) return;
    const name = nm[1].trim();
    const evalYear = reiwa(nfkc(ey[1]));
    const p = project(input, `${evalYear}-${nfkc(name)}`, name, evalYear, nm[0].trim(), s + nm.index + nm[0].indexOf(nm[1]) - (nm[0].startsWith('\n事 業 名') ? '事 業 名 '.length : '事業名\n\n'.length));
    p.evidence.push(evidence(input, ey[0], s + ey.index));
    const bu = /\n部局名\n(?:チーム名|班名)\n\n([^\n]+)\n/.exec(head) ?? /\n部 局 名 ([^\n]+)\n/.exec(head);
    const ka = /\n\n([^\n]+)\n\n$/.exec(head);
    if (bu && /(?:部|局|本部|委員会|庁)$/.test(bu[1].trim()) && ka && /(?:課|室|センター)$/.test(ka[1]) && !/年度/.test(ka[1])) {
      p.department = `${bu[1].trim()} ${ka[1]}`;
      p.evidence.push(evidence(input, bu[0].trim(), s + bu.index + 1), evidence(input, ka[1], s + ka.index + 2));
    } else p.warnings.push('部局名・課室名の欄が抽出テキストで確定しないため担当課は未収録。');
    const fin = sheet.indexOf('２ 事業概要及び財源'), eff = sheet.indexOf('３ 事業の効果');
    const r = fin >= 0 && eff > fin ? budgetTotal(t, s + fin, s + eff) : null;
    if (r && r.fy === evalYear) {
      p.amounts.push({ kind: 'budget', fiscalYear: r.fy, amountYen: r.tok.value * 1000, rawValue: r.tok.raw, rawUnit: '千円', evidence: evidence(input, r.tok.raw, r.tok.start) });
      p.evidence.push(evidence(input, r.fyRaw, r.fyStart));
      p.warnings.push(`予算額は「２ 事業概要及び財源」の合計欄（令和${nfkc(r.fyRaw.slice(2, r.fyRaw.indexOf('年度')))}年度予算額、千円）。事業内訳${r.k}行の予算額の和と決算(見込)額の和がともに合計欄の値に現れることを確認。決算(見込)額は見込額を含みうるため未収録。`);
    } else p.warnings.push('事業概要及び財源の表の値の並びが抽出テキストで崩れており、予算額の合計を検算で確定できないため金額は未収録。決算(見込)額は見込額を含みうるため未収録。');
    out.push(p);
  });
  return mergeReprints(out, p => `${nfkc(p.projectName)}|${p.evaluationYear}`);
}

export const entries: Record<string, Entry> = {
  '05000': {
    scope: '事業評価調書（様式３、令和７・８年度評価）の事業名・部局名・課室名・評価年度と、評価年度の予算額の合計（事業内訳との検算が通るもののみ）。決算(見込)額、指標、判定、評価結果一覧表・報告書・施策評価は対象外。',
    extract,
  },
};
