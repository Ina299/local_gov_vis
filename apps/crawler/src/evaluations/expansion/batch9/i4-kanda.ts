import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, project } from '../shared';
import { amount, mergeReprints, nfkc } from '../batch7/g1-util';

/** 苅田町 事務事業評価書の政策別評価シートPDF（公表ページの年度ごとに6冊）→ その冊子の評価年度（西暦）。 */
const SHEETS: Record<string, number> = Object.fromEntries([
  ...['7ca43b5d664ec371bbc1caa6', '6c123c17d0edf97986f078ac', 'af8818470c57f5c7b84b01fe', '2692c214de57cebf540fd41f', '581b3b94a6f7e4ad6cfdb388', '8f477aa983fb8e54a74e9abc'].map(id => [id, 2025]),
  ...['96b6927a3743b688d0a6fcfa', 'd8804764fc543ad90921b31f', 'c4bbff216977340ccef542ea', 'fda2f2b8b3f73692e5eaad86', 'b74057fea36889279a7a9bdb', '016bd0d11733b66566a467d0'].map(id => [id, 2024]),
  ...['36916a0c18a9f10822acc6dd', '7e745df2f2159389734a8de8', '7909d0ea460be9b4bbcc398f', '0849af3e961df62efdbfc5e3', 'a55569d66be53471de1b1466', '2512dd9f4600505e80dc73ad'].map(id => [id, 2023]),
]);

const SHEET = /No\.\n(\d+)\n評価種別\n\n事 務 事 業 評 価 シ ー ト\n\n令和([0-9０-９]+)年度\n\n([^\n]+)\n\n（令和([0-9０-９]+)年度実施分）\n\n([^\n]+)\n\n事業名\n/g;
const DEPT = /(?:課|室|局)$/;
const num = (s: string) => Number(s.replaceAll(',', ''));

/** 経費表の計【Ａ】・人件費【Ｂ】・計（Ａ＋Ｂ）を5列すべての検算一致で特定する。 */
function costs(input: CachedInput, seg: string, base: number, evaluated: number) {
  const head = /R(\d)年度(決算|予算)\n\nR(\d)年度(決算|予算)\n\nR(\d)年度(決算|予算)\n\nR(\d)年度(決算|予算)\n\nR(\d)年度(決算|予算)\n/.exec(seg);
  if (!head) return null;
  const cols = [0, 1, 2, 3, 4].map(i => ({ year: 2018 + Number(head[1 + i * 2]), kind: head[2 + i * 2] as '決算' | '予算' }));
  if (cols.some((c, i) => i && c.year !== cols[i - 1].year + 1)) return null;
  const label = seg.indexOf('計 （Ａ＋Ｂ）', head.index);
  if (label < 0) return null;
  // Contiguous runs of paragraph-separated numbers after the labels.
  const nums: { raw: string; start: number }[][] = [];
  let run: { raw: string; start: number }[] = [];
  for (const m of seg.slice(label).matchAll(/([^\n]+)(?:\n\n|\n|$)/g)) {
    if (/^[\d,]+$/.test(m[1])) run.push({ raw: m[1], start: base + label + m.index! });
    else { if (run.length) nums.push(run); run = []; }
    if (nums.length > 4) break;
  }
  if (run.length) nums.push(run);
  for (const r of nums) for (let i = 0; i + 15 <= r.length; i++) {
    const a = r.slice(i, i + 5), b = r.slice(i + 5, i + 10), ab = r.slice(i + 10, i + 15);
    if (a.every((x, j) => num(x.raw) + num(b[j].raw) === num(ab[j].raw)) && ab.some(x => num(x.raw) > 0)) {
      const out = a.map((x, j) => amount(input, cols[j].kind === '決算' ? 'actual' : 'budget', cols[j].year, x.raw, '千円', x.raw, x.start));
      const j = cols.findIndex(c => c.kind === '決算' && c.year === evaluated);
      if (j >= 0) out.push(amount(input, 'personnel', evaluated, b[j].raw, '千円', b[j].raw, b[j].start), amount(input, 'fullCost', evaluated, ab[j].raw, '千円', ab[j].raw, ab[j].start));
      return out;
    }
  }
  return null;
}

/** 苅田町 事務事業評価シート（令和5〜7年度評価）。 */
export function extractKanda(input: CachedInput): ProjectEvaluation[] {
  const cycle = SHEETS[input.sourceId];
  if (input.municipalityCode !== '40621' || !cycle) return [];
  const heads = [...input.text.matchAll(SHEET)], out: ProjectEvaluation[] = [];
  for (const [k, h] of heads.entries()) {
    const [head, no, evalYear, kind, doneYear, name] = h;
    if (/^(事業名|所管課|No\.)$/.test(name)) continue;
    const start = h.index!, end = heads[k + 1]?.index ?? input.text.length, seg = input.text.slice(start, end);
    const year = 2018 + Number(nfkc(evalYear)), done = 2018 + Number(nfkc(doneYear));
    // A sheet whose printed years disagree with its booklet (typo or stale sheet) is skipped, not corrected.
    if (year !== cycle || done !== cycle - 1) continue;
    const p = project(input, `No.${no}`, name, year, head, start);
    p.evaluatedFiscalYear = done;
    const d = /^事業名\n\n?([^\n]+)\n所管課/.exec(seg.slice(head.length - 4)) ?? /事務事業の性格\n\n([^\n]+)\n\n課\n/.exec(seg.slice(0, 400));
    if (d && !/\d/.test(d[1])) p.department = DEPT.test(d[1]) ? d[1] : `${d[1]}課`;
    const a = costs(input, seg, start, done);
    if (a) p.amounts.push(...a);
    p.warnings.push(`苅田町 事務事業評価シート（令和${evalYear}年度・令和${doneYear}年度実施分、評価種別「${kind}」）の見出しから事業名・No.を収録。` +
      '所管課はシート上部の欄から（「企画」「課」のように分かれた欄は連結）。今後の方針は○印の位置が抽出テキストで崩れ、別資料の評価一覧は根拠資料が異なるため未収録。' +
      (a ? '経費は計【Ａ】＋人件費【Ｂ】＝計（Ａ＋Ｂ）が5列すべてで一致した表のみ千円単位で収録（Ａは列見出しの決算/予算の別に従う。人件費・総コストは実施年度の決算列のみ）。' : '経費表は列の対応が検算で確定しないため金額は未収録。') +
      '活動指標・成果指標は未構造化。');
    out.push(p);
  }
  return mergeReprints(out, p => `${p.projectCode}:${p.evaluationYear}`);
}
