/** Batch-9 (i0) extractors: 40216 小郡市 (事務事業評価シート) and 05211 潟上市 (事務事業評価表). */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';
import { type Entry, dedupe, digits, norm, toNum } from '../batch8/h3-util';

/**
 * Like acrossInputs, but after merging identical reprints also drops every record whose name or code is shared with another
 * record of the same period (two sheets under one name cannot hold one identity; no distinct decision is recorded).
 */
function acrossInputsUnique(raw: (input: CachedInput) => ProjectEvaluation[]): Entry['extract'] {
  const memo = new WeakMap<CachedInput[], ProjectEvaluation[]>();
  return (input, inputs) => {
    let all = memo.get(inputs);
    if (!all) {
      const merged = dedupe(inputs.flatMap(i => raw(i)));
      const keys = (p: ProjectEvaluation) => [`n:${norm(p.projectName)}`, ...(p.projectCode ? [`c:${norm(p.projectCode)}`] : [])]
        .map(k => `${k}|${p.evaluationYear}|${p.evaluatedFiscalYear}`);
      const count = new Map<string, number>();
      for (const p of merged) for (const k of keys(p)) count.set(k, (count.get(k) ?? 0) + 1);
      all = merged.filter(p => keys(p).every(k => count.get(k) === 1));
      memo.set(inputs, all);
    }
    return all.filter(p => p.evidence[0].sourceUrl === input.sourceUrl && p.evidence[0].sha256 === input.sourceSha256);
  };
}

// ---- 40216 小郡市 ----

/** Per-department sheet PDFs of the 令和5年度事務事業 round (the 目次 PDFs only list names and are not used). */
const OGORI_SHEETS = new Set(['0489f5c35964e91695a655f0', '175ce0d5da31ed2d2e9c88a3', '2039dcd047bfc94507d329c1', '235084c3531dec23daf668f4',
  '2da57aba340e58e530c13b41', '40ba127cf5d24975298be7e5', '40c44eb92783714cfb86faa9', '42f46aeb9b7dabaa9251df79', '5593ea239e33e37c25c1faef',
  '578c88c8e780c1c8ec8d9a4f', '616a60f0ec5f23a73efc15b8', '67c711886a043c8504e50c2d', '6fa748d8613682d24f221ef6', '749d6512fea0532d0c877b7a',
  '79f7dc26450543cb97aef73a', '80fc7fe79a4e6bfde6013772', '94f894ff28f9168bfd06380f', '95e215f708bc8d811f1bc33f', '97737c06da2a6a581a3d273b',
  'af2bea38b80fe362e7f3ad61', 'ba0d368ee61f724d7a59aa5d', 'c5ffbc630c3448f2ec90d9ca', 'c6ac8fb7871654da6692853f', 'cad8300fa46e01f7111f930b',
  'cfbef20d6eef6360e7424fa7', 'd5e981bfd4d7ebe0b4745bdf', 'da3c3874c20c445d404dcdbe', 'e3ca2f4475da597e38556672', 'e95244cd10fbd7c39a7b40f6',
  'f5ab9dec20c1769f60d19186', 'fdb79449014565b28b7fc8b4']);
const sheetNo = (s: string) => s.normalize('NFKC').replace(/[ー－‐-]/g, '-');

function ogoriSheets(input: CachedInput): ProjectEvaluation[] {
  if (!OGORI_SHEETS.has(input.sourceId)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const heads = [...t.matchAll(/事務事業評価シート（令和(\d+)年度事務事業）/g)];
  heads.forEach((h, i) => {
    const start = h.index!, end = i + 1 < heads.length ? heads[i + 1].index! : t.length, seg = t.slice(start, end);
    // Each sheet repeats its number/name block on both pages; the chunk between two titles must name one sheet only.
    const ids = [...seg.matchAll(/シートNo\. (\S+)\n事業No\. (\S+)\n\n事務事業名\n開始年度\n\n(.+)\n/g)];
    if (!ids.length || new Set(ids.map(m => JSON.stringify([sheetNo(m[1]), m[2], m[3].trim()]))).size !== 1) return;
    const [, no, code, name] = ids[0];
    const fy = 2018 + digits(h[1]);
    const p = project(input, `${sheetNo(no)}:${code}`, name.trim(), null, ids[0][0].trimEnd(), start + ids[0].index!);
    p.projectCode = /^[A-Z]\d+$/.test(code) ? code : null;
    p.evaluatedFiscalYear = fy;
    for (const m of ids.slice(1)) p.evidence.push(evidence(input, m[0].trimEnd(), start + m.index!));
    const heads2 = new Set([...seg.matchAll(/作成責任者 (\S+?(?:課|室|局|館|所|センター))長\n/g)].map(m => m[1]));
    if (heads2.size === 1) p.department = [...heads2][0];
    p.warnings.push(`シート表題「事務事業評価シート（令和${h[1]}年度事務事業）」の年度を評価対象年度とした。評価実施年度はこの資料に明記がないため null。`);
    // 予算状況の「計・執行額・執行率」は列見出し（R04年度/R05年度）の直前に並ぶ。執行率と一致する場合だけ執行額を採る。
    const triples = [...seg.matchAll(/\n(\d+\.\d\d)\n([\d,]+)\n([\d,]+)\n/g)];
    let amounts = false;
    for (const y of ['04', '05']) {
      const ex = [...seg.matchAll(new RegExp(String.raw`([\d,]+)\n([\d,]+)\n(\d+)%\nR${y}年度`, 'g'))];
      if (ex.length !== 1) continue;
      const [raw, kei, exec, rate] = ex[0];
      if (!(toNum(kei) > 0) || Math.abs(toNum(exec) / toNum(kei) * 100 - Number(rate)) > 1) continue;
      const year = 2018 + Number(y), ev = evidence(input, raw, start + ex[0].index!);
      p.amounts.push({ kind: 'actual', fiscalYear: year, amountYen: toNum(exec) * 1000, rawValue: exec, rawUnit: '千円', evidence: ev });
      amounts = true;
      // 投入工数「計」・人件費合計・総費用 の3行のうち、総費用＝執行額＋人件費 を満たす組が一意な場合だけ人件費・総費用を採る。
      const fit = triples.filter(m => toNum(exec) + toNum(m[2]) === toNum(m[3]));
      if (!fit.length || new Set(fit.map(m => `${m[2]}/${m[3]}`)).size !== 1) continue;
      const m = fit[0], tev = evidence(input, m[0].slice(1, -1), start + m.index! + 1);
      p.amounts.push({ kind: 'personnel', fiscalYear: year, amountYen: toNum(m[2]) * 1000, rawValue: m[2], rawUnit: '千円', evidence: tev },
        { kind: 'fullCost', fiscalYear: year, amountYen: toNum(m[3]) * 1000, rawValue: m[3], rawUnit: '千円', evidence: tev });
    }
    if (amounts) p.warnings.push('金額は予算状況の「執行額」（千円）を決算として採用（「計」に対する執行率が原文の執行率と一致するものだけ）。人件費合計・総費用（人件費等修正前）は、総費用＝執行額＋人件費合計 が成り立つ組が一意に定まる場合だけ記録。当初予算・補正予算・修正後総費用は記録していない。');
    out.push(p);
  });
  return out;
}

// ---- 05211 潟上市 ----

/**
 * 事務事業評価表 (令和７年度＝令和６年度実施分, 令和５年度＝令和４年度実施分). The 最終評価 lists are separate documents; a record's evidence
 * must stay within its own document, so they are not attached.
 */
const KATAGAMI_SHEETS = new Set(['34a0307e4e2e91f313767289', '511bd937470a76a719200f19']);
const KATAGAMI_DIRECTIONS = '拡充|現状維持継続|事務事業改善|縮小・終期設定|休止・廃止';
const KATAGAMI_SCALE = '１ 拡充／２ 現状維持継続／３ 事務事業改善／４ 縮小・終期設定／５ 休止・廃止';

function katagamiSheets(input: CachedInput): ProjectEvaluation[] {
  if (!KATAGAMI_SHEETS.has(input.sourceId)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const heads = [...t.matchAll(/令和(.{1,2})年度（令和(.{1,2})年度事業実施分）潟上市事務事業評価表/g)];
  heads.forEach((h, i) => {
    const start = h.index!, end = i + 1 < heads.length ? heads[i + 1].index! : t.length, seg = t.slice(start, end);
    // The page-2 heading carries the name cleanly; one sheet shows "#REF!" there and is skipped.
    const names = [...seg.matchAll(/事業名\n\n(.+)\n\n４．事務事業の評価/g)];
    if (names.length !== 1 || names[0][1].includes('#REF!')) return;
    const name = names[0][1].trim();
    const p = project(input, name, name, 2018 + digits(h[1]), names[0][0], start + names[0].index!);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2018 + digits(h[2]);
    p.evidence.push(evidence(input, h[0], start));
    const dept = seg.match(/課名\n\n(\S+課)\n\n/);
    if (dept) { p.department = dept[1]; p.evidence.push(evidence(input, dept[0].trim(), start + dept.index!)); }
    const dirs = [...seg.matchAll(new RegExp(`■([１-５])\\s*(${KATAGAMI_DIRECTIONS})`, 'g'))];
    if (dirs.length === 1) p.ratings.push({ kind: 'self', label: '今後の方向性（担当部署の自己評価）', value: `${dirs[0][1]} ${dirs[0][2]}`, scale: KATAGAMI_SCALE,
      evidence: evidence(input, dirs[0][0], start + dirs[0].index!) });
    // 「R6年度決算額の内訳」の計は、事業費表の同年度実績値と同じ数字が表中にある場合だけ決算として採る。
    const fyLabel = `R${digits(h[2])}年度決算額の内訳`, kei = [...seg.matchAll(/計：([\d,]+)千円/g)];
    if (seg.includes(fyLabel) && kei.length === 1 && seg.includes(`\n${kei[0][1]}\n`)) {
      p.amounts.push({ kind: 'actual', fiscalYear: p.evaluatedFiscalYear, amountYen: toNum(kei[0][1]) * 1000, rawValue: kei[0][1], rawUnit: '千円',
        evidence: evidence(input, kei[0][0], start + kei[0].index!) });
      p.warnings.push(`金額は「${fyLabel}（主なものを抜粋）」欄の計（千円）。事業費表の他年度・財源内訳は列の対応が確定できないため記録していない。`);
    }
    out.push(p);
  });
  return out;
}

export const entries: Record<string, Entry> = {
  '40216': { extract: acrossInputsUnique(ogoriSheets),
    scope: '令和5年度事務事業の事務事業評価シート（部局別PDF）を1シート1件で構造化（事業名・事業No.・担当課・予算状況の執行額と人件費・総費用）。指標・点検評価の○△・目次PDFは対象外。' },
  '05211': { extract: acrossInputsUnique(katagamiSheets),
    scope: '令和5・7年度の潟上市事務事業評価表を1事業1件で構造化（事業名・課名・今後の方向性・決算額内訳の計）。指標表・事業費表の他年度・最終評価一覧（別資料）・外部評価コメントは対象外。' },
};
