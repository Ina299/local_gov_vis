/**
 * 秋田県「事業評価調書（目的設定、中間評価、事後評価）」（様式３、政策・戦略別のPDFに1事業1〜2ページで収録。令和７・８年度評価分）。
 * 調書ごとに事業名・部局名・課室名・評価年度を読む。
 * 金額は「２ 事業概要及び財源」の表（事業内訳ごとに 令和◯年度予算額／令和◯年度決算(見込)額／最終年度決算(見込)額）から、
 * 評価年度の予算額の合計だけを、次の検算が通る場合に収録する:
 *   表の数値だけの行を順に読み、先頭から事業内訳 k 行分を（予算額, 決算(見込)額）の組として取ったとき、予算額の和と決算(見込)額の和が
 *   どちらも後続の数値（合計欄）に現れる k がちょうど1つに定まる。事業内訳の番号（1〜5だけの行）は数値から除く。
 * 決算(見込)額は決算か見込かが欄名で区別されないため収録しない。事業（中間）評価結果一覧表・報告書の一覧は調書と重複するため対象外。
 * 目的は「１ 事業実施の背景及び目的」欄の本文（折り返しの改行を詰めたもの）。
 * 指標は「３ 事業の効果を把握するための手法及び効果の見込み」の【指標Ⅰ】【指標Ⅱ】の表（年度／目標a／実績b／ｂ／ａ）。空欄は抽出テキストで
 * 詰まるため、目標・実績の値がそれぞれ連続した年度に並ぶと仮定し、ｂ／ａ（目標のある年度に必ず印字され、実績がなければ 0.0%）が全年度で
 * 実績÷目標と一致する並べ方がちょうど1つに定まる場合のみ収録する（別ページに続く後半の年度の表は対象外）。
 * 判定は「４ 中間評価」「６ 事後評価」の各観点の判定欄（a〜c、総合評価は A〜C）。観点の見出しの間にある1文字だけの行がちょうど1つの場合のみ。
 * 中間評価の総合評価は前回の結果（参考）と並んで印字され順序で区別できないため、2つの値が一致する場合のみ収録する。
 */
import type { EvaluationIndicator, EvaluationRating, ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { mergeReprints, nfkc, num, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const N = String.raw`\d{1,3}(?:,\d{3})*`;
const SHEET = /事業評価調書（目的設定、中間評価、事後評価）\n/g;
const reiwa = (s: string) => 2018 + num(s === '元' ? '1' : s);

type Tok = { raw: string; value: number; start: number };
type Ln = { text: string; start: number };

/** 和暦の年度見出し（30年度＝平成30年度、元年度＝令和元年度、２年度＝令和2年度）。 */
const fyOf = (h: string) => { const n = h === '元' ? 1 : num(h); return n >= 20 ? 1988 + n : 2018 + n; };
const linesOf = (t: string, from: number, to: number): Ln[] => {
  const out: Ln[] = []; let pos = from;
  for (const l of t.slice(from, to).split('\n')) { out.push({ text: l, start: pos }); pos += l.length + 1; }
  return out;
};

/** 【指標Ⅰ】〜次の指標（または「◎指標を設定することができない場合」）までの1指標。 */
function indicator(input: CachedInput, from: number, to: number): EvaluationIndicator[] {
  const t = input.text;
  const ls = linesOf(t, from, to);
  const ni = ls.findIndex(l => /^指標名/.test(l.text));
  if (ni < 0) return [];
  const nameLn = ls[ni].text === '指標名' ? ls[ni + 1] : { text: ls[ni].text.replace(/^指標名 /, ''), start: ls[ni].start + 4 };
  if (!nameLn || !nameLn.text.trim() || /^指標式/.test(nameLn.text) || ls[ni].text !== '指標名' && !ls[ni].text.startsWith('指標名 ')) return [];
  // 名称は1行で、次の行が「指標式」で始まる場合のみ（折り返した名称は対象外）。
  const after = ls.indexOf(ls.find(l => l.start > nameLn.start)!);
  if (!/^指標式/.test(ls[after]?.text ?? '')) return [];
  const yi = ls.findIndex(l => l.text === '年度');
  if (yi < 0) return [];
  const years: Ln[] = [];
  let i = yi + 1;
  while (/^(\d+|元|[０-９]+)年度$/.test(ls[i]?.text ?? '')) years.push(ls[i++]);
  const col = (label: string, re: RegExp) => {
    if (ls[i]?.text !== label) return null;
    const v: Ln[] = []; i++;
    while (i < ls.length && re.test(ls[i].text)) v.push(ls[i++]);
    return v;
  };
  const V = /^-?\d{1,3}(?:,\d{3})*(?:\.\d+)?$/;
  const tg = col('目標a', V), ac = col('実績b', V), rt = col('ｂ／ａ', /^\d+(?:\.\d+)?%$/);
  // 表の後ろは空行のみ（別の内容が混ざる表は対象外）。
  if (!years.length || !tg || !ac || !rt || ls.slice(i).some(l => l.text.trim()) || tg.length !== rt.length) return [];
  const Y = years.length, val = (l: Ln) => Number(l.text.replace(/,/g, ''));
  const sols: { t0: number; a0: number }[] = [];
  for (let t0 = 0; t0 + tg.length <= Y; t0++) for (let a0 = 0; a0 + ac.length <= Y; a0++) {
    if (!tg.length && a0 > 0) break;
    const ok = rt.every((r, k) => {
      const y = t0 + k, ai = y - a0, target = val(tg[k]), ratio = Number(r.text.slice(0, -1));
      if (ai < 0 || ai >= ac.length) return ratio === 0;
      return target > 0 && Math.abs(val(ac[ai]) / target * 100 - ratio) <= 0.051;
    });
    if (ok) sols.push({ t0, a0 });
  }
  // 目標・実績がない場合（未設定の指標）や、並べ方が一意に定まらない場合は収録しない。
  if (sols.length !== 1 || (!tg.length && !ac.length)) return [];
  const { t0, a0 } = sols[0];
  const name = nameLn.text.trim();
  const unit = /（([^（）]+)）(?:【[^】]+】)?$/.exec(name)?.[1] ?? null;
  const out: EvaluationIndicator[] = [];
  years.forEach((y, k) => {
    const tv = k >= t0 && k < t0 + tg.length ? tg[k - t0] : null, av = k >= a0 && k < a0 + ac.length ? ac[k - a0] : null;
    if (!tv && !av) return;
    const last = [tv, av].filter((x): x is Ln => !!x).reduce((a, b) => (a.start > b.start ? a : b));
    const raw = t.slice(nameLn.start, last.start + last.text.length);
    out.push({ name, fiscalYear: fyOf(nfkc(y.text.slice(0, -2))), target: tv?.text ?? null, actual: av?.text ?? null, unit, evidence: evidence(input, raw, nameLn.start) });
  });
  return out;
}

const SCALE = {
  need: 'a：必要性が高い／b：一定の必要性がある／c：必要性が低い',
  eff: 'ａ：有効性が高い（達成率の全てが100.0％以上）／ｂ：一定の有効性がある（a、ｃ以外の場合）／ｃ：有効性が低い（達成率が80.0％未満）',
  effi: 'ａ：効率性が高い／ｂ：一定の効率性がある／ｃ：効率性が低い',
  midAll: '「Ａ」：「必要性」、「有効性」、「効率性」の観点が全て「ａ」判定のもの／「Ｂ」：「Ａ」、「Ｃ」以外の判定のもの／「Ｃ」：「必要性」、「有効性」、「効率性」の観点が全て「ｃ」判定のもの',
  postAll: '「Ａ」：「有効性」、「効率性」の観点が全て「ａ」判定のもの／「Ｂ」：「Ａ」、「Ｃ」以外の判定のもの／「Ｃ」：「有効性」、「効率性」の観点が全て「ｃ」判定のもの',
};
const LOW = /^[a-cａ-ｃ]$/, UP = /^[A-CＡ-Ｃ]$/;

/** 中間評価・事後評価の判定。観点の見出し a からその観点の判定基準の行 b までの間で re に合う1文字の行（総合評価は判定基準の見出しまで）。 */
function ratings(input: CachedInput, s: number, sheet: string): EvaluationRating[] {
  const out: EvaluationRating[] = [];
  const mid = sheet.indexOf('４ 中間評価'), post = sheet.indexOf('６ 事後評価');
  const pick = (a: string, b: string, re: RegExp, from: number, until: number) => {
    const i = sheet.indexOf(a, from), j = i < 0 ? -1 : sheet.indexOf(b, i);
    if (i < 0 || j < 0 || j > until) return null;
    return linesOf(input.text, s + i, s + j).filter(l => re.test(l.text));
  };
  const add = (label: string, hits: Ln[] | null, scale: string) => {
    if (hits?.length === 1) out.push({ kind: 'self', label, value: hits[0].text, scale, evidence: evidence(input, hits[0].text, hits[0].start) });
  };
  if (mid >= 0 && post > mid) {
    add('中間評価 必要性', pick('（１）必要性', '（判定基準）a：必要性が高い', LOW, mid, post), SCALE.need);
    add('中間評価 有効性', pick('（２）有効性', '（判定基準）ａ：有効性が高い', LOW, mid, post), SCALE.eff);
    add('中間評価 効率性', pick('（３）効率性', '（判定基準）ａ：効率性が高い', LOW, mid, post), SCALE.effi);
    const all = pick('（３）効率性', '【総合評価の判定基準】', UP, mid, post);
    if (all?.length === 2 && all[0].text === all[1].text) out.push({ kind: 'self', label: '中間評価 総合評価', value: all[0].text, scale: SCALE.midAll, evidence: evidence(input, all[0].text, all[0].start) });
  }
  const end = sheet.indexOf('７ 類似事業', post);
  if (post >= 0 && end > post) {
    add('事後評価 有効性', pick('（１）有効性', '（判定基準）ａ：有効性が高い', LOW, post, end), SCALE.eff);
    add('事後評価 効率性', pick('（２）効率性', '（判定基準）ａ：効率性が高い', LOW, post, end), SCALE.effi);
    add('事後評価 総合評価', pick('（３）総合評価', '７ 類似事業', UP, post, end), SCALE.postAll);
  }
  return out;
}

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
    // 目的: 「１ 事業実施の背景及び目的」の本文。
    const pm = /１ 事業実施の背景及び目的\n([^]+?)\n２ 事業概要及び財源/.exec(sheet);
    if (pm && pm[1].trim()) {
      p.purpose = pm[1].split('\n').map(l => l.trim()).join('');
      p.evidence.push(evidence(input, pm[1], s + pm.index + pm[0].indexOf(pm[1])));
    }
    const i1 = sheet.indexOf('【指標Ⅰ】'), i2 = sheet.indexOf('【指標Ⅱ】'), i3 = sheet.indexOf('◎指標を設定することができない場合');
    if (i1 >= 0 && i2 > i1 && i3 > i2) p.indicators.push(...indicator(input, s + i1, s + i2), ...indicator(input, s + i2, s + i3));
    if (p.indicators.length) p.warnings.push('指標は【指標Ⅰ】【指標Ⅱ】の表から、空欄で詰まった目標・実績の年度をｂ／ａ（達成率）との検算で一意に特定できたもののみ。');
    p.ratings.push(...ratings(input, s, sheet));
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
    scope: '事業評価調書（様式３、令和７・８年度評価）の事業名・部局名・課室名・評価年度、事業実施の背景及び目的、評価年度の予算額の合計（事業内訳との検算が通るもののみ）、指標の目標・実績（達成率との検算で年度が一意に定まるもののみ）、中間評価・事後評価の判定（位置が一意のもののみ）。決算(見込)額、事業内訳の概要、判定理由、課題と今後の対応方針、評価結果一覧表・報告書・施策評価は対象外。',
    extract,
  },
};
