import type { EvaluationAmount, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

/**
 * Batch-8 h0: education-board project sheets (教育委員会 点検・評価報告書) of small municipalities.
 * - 01396 真狩村 令和元年度報告書: 「事務事業点検・評価調書」13件。事業名・所管・事業費決算（千円）のみ。
 * - 18204 小浜市 平成26年度（平成25年度分）報告書: 対象事業一覧（25/24年度決算額・増減）と施策別一覧（25年度決算額・評価）。
 * 01646 本別町は施策の推進状況の文章のみで事務事業単位の評価がないため対象外。
 */
type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

const MAKKARI_ID = '4450bf38ad0e8ad43355a534';
const OBAMA_ID = '762f102d40afc3b74933a663';
const toNum = (s: string) => Number(s.normalize('NFKC').replaceAll(',', ''));

function makkari(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== MAKKARI_ID) return [];
  const t = input.text;
  if (!t.startsWith('令 和 元 年 度\n\n真狩村教育委員会の活動状況に関する\n点検・評価報告書')) return [];
  const sheets = [...t.matchAll(/事務事業点検・評価調書\n№([０-９\d]+)\n\n１．事業名等\n事業名 ([^\n]+)\n/g)];
  const out: ProjectEvaluation[] = [];
  sheets.forEach((m, k) => {
    const from = m.index!, to = k + 1 < sheets.length ? sheets[k + 1].index! : t.length;
    const p = project(input, `No.${m[1].normalize('NFKC')}`, m[2].trim(), null, m[0], from);
    p.evaluatedFiscalYear = 2019;
    p.warnings.push('報告書表題「令和元年度」と事業実施期日（平成31年4月～令和2年3月）から評価対象年度を令和元年度としました。評価実施年度は本文に明記がないため null。');
    const seg = t.slice(from, to), overview = seg.indexOf('２．事業概要');
    const dept = [...seg.slice(0, overview < 0 ? 0 : overview).matchAll(/\n(教育委員会\n([^\n]+))\n/g)];
    if (dept.length === 1) {
      p.department = `教育委員会 ${dept[0][2].trim()}`;
      p.evidence.push(evidence(input, dept[0][1], from + dept[0].index! + 1));
    }
    const a = seg.indexOf('事業費決算'), b = seg.indexOf('３．事業の成果');
    const costs = a >= 0 && b > a ? [...seg.slice(a, b).matchAll(/(?<![\d０-９,])([\d０-９][\d０-９,]*)千円/g)] : [];
    if (costs.length === 1) {
      const c = costs[0], start = from + a + c.index!;
      const amount: EvaluationAmount = { kind: 'actual', fiscalYear: 2019, amountYen: toNum(c[1]) * 1000, rawValue: c[1], rawUnit: '千円',
        evidence: evidence(input, t.slice(from + a, start + c[0].length), from + a) };
      p.amounts.push(amount);
      p.warnings.push('事業費決算は「千円、未満四捨五入」の表示値です。');
    } else {
      p.warnings.push('事業費決算欄に複数の金額（内訳・合計）が抽出されたため、金額は転記していません。');
    }
    p.warnings.push('評価欄（必要性・事業の効果・費用対効果・今後の方向性）は抽出テキストでチェック印と自己評価／外部評価の対応が崩れているため転記していません。');
    out.push(p);
  });
  return out;
}

const N = String.raw`-?\d{1,3}(?:,\d{3})*`;
const NAME = String.raw`[^\n]*(?:事業|補助金|費)[^\n]*`;

function obama(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== OBAMA_ID) return [];
  const t = input.text;
  if (!t.startsWith('平成２６年度\n（平成２５年度分）\n\n小浜市教育委員会の事務の管理\n及び執行状況の点検・評価報告書')) return [];
  type Row = { name: string; raw: string; start: number };
  const byName = new Map<string, { rows: Row[]; fy25: { value: string; row: Row }[]; fy24: { value: string; row: Row }[]; rating: { value: string; row: Row } | null }>();
  const get = (name: string) => {
    if (!byName.has(name)) byName.set(name, { rows: [], fy25: [], fy24: [], rating: null });
    return byName.get(name)!;
  };
  // 対象事業一覧（25年度決算額・24年度決算額・増減）。増減が一致する行だけ採用。
  const listEnd = t.indexOf('点検・評価の方法');
  for (const m of t.slice(0, listEnd).matchAll(new RegExp(String.raw`(?<=\n\n)(${NAME})\n\n(${N})\n\n(${N})\n\n(${N})(?=\n)`, 'g'))) {
    if (toNum(m[2]) - toNum(m[3]) !== toNum(m[4])) continue;
    const row = { name: m[1].trim(), raw: m[0], start: m.index! }, e = get(row.name);
    e.rows.push(row); e.fy25.push({ value: m[2], row }); e.fy24.push({ value: m[3], row });
  }
  // 施策別の「点検及び評価を行う事務事業」一覧（25年度決算額・評価）。
  for (const m of t.matchAll(new RegExp(String.raw`(?<=\n)(${NAME})\n\n(${N})\n\n([ＡＢＣＤ])(?=\n)`, 'g'))) {
    if (m.index! < listEnd || /決算額/.test(m[1])) continue;
    const row = { name: m[1].trim(), raw: m[0], start: m.index! }, e = get(row.name);
    e.rows.push(row); e.fy25.push({ value: m[2], row });
    if (e.rating && e.rating.value !== m[3]) e.fy25.push({ value: '', row }); // 評価が食い違う再掲は除外
    else e.rating ??= { value: m[3], row };
  }
  // 事務事業評価シート（一覧から行が取れない事業は事業名欄のみ）。
  const sheetStart = t.indexOf('◆事務事業評価シート');
  for (const m of t.slice(sheetStart).matchAll(/(?<=\n\n)([^\n]*(?:事業|費))\n(?:（[^\n]+）\n)?\n事 業 名\n/g)) {
    const name = m[1].trim();
    if (byName.has(name)) continue;
    const e = get(name);
    e.rows.push({ name, raw: m[0], start: sheetStart + m.index! });
  }
  const out: ProjectEvaluation[] = [];
  for (const [name, e] of byName) {
    const values25 = new Set(e.fy25.map(x => x.value));
    if (values25.size > 1 || e.fy24.length > 1 && new Set(e.fy24.map(x => x.value)).size > 1) continue; // 再掲の値が食い違う
    const first = e.rows[0];
    // 小浜市の一覧に事業コードはないため、ID の安定化には事業名を使う。
    const p = project(input, name, name, 2014, first.raw, first.start);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2013;
    for (const r of e.rows.slice(1)) p.evidence.push(evidence(input, r.raw, r.start));
    if (e.fy25.length) {
      const r = e.fy25[0];
      p.amounts.push({ kind: 'actual', fiscalYear: 2013, amountYen: toNum(r.value) * 1000, rawValue: r.value, rawUnit: '千円', evidence: evidence(input, r.row.raw, r.row.start) });
    }
    if (e.fy24.length) {
      const r = e.fy24[0];
      p.amounts.push({ kind: 'actual', fiscalYear: 2012, amountYen: toNum(r.value) * 1000, rawValue: r.value, rawUnit: '千円', evidence: evidence(input, r.row.raw, r.row.start) });
    }
    if (e.rating) p.ratings.push({ kind: 'self', label: '評価（点検及び評価を行う事務事業一覧）', value: e.rating.value,
      scale: 'Ａ・Ｂ・Ｃ・Ｄ評価基準表（公共性＋有効性と効率性のポイントによる判定）', evidence: evidence(input, e.rating.row.raw, e.rating.row.start) });
    p.warnings.push('報告書表題「平成２６年度（平成２５年度分）」から評価年度を平成26年度、評価対象年度を平成25年度としました。金額は一覧表の決算額（千円）。');
    if (!e.fy25.length) p.warnings.push('一覧表の行が抽出テキストで事業名と分離しているため、事業名のみの部分構造化です。');
    p.warnings.push('評価シートの財源内訳・有効性等のポイント・担当課は2事業が同一ページに並ぶ段組み崩れで行対応が確定できないため転記していません。');
    out.push(p);
  }
  return out;
}

export const eduSmallEntries: Record<string, Entry> = {
  '01396': { extract: makkari, scope: '真狩村教育委員会 点検・評価報告書（令和元年度）の事務事業点検・評価調書13件の事業名・所管・事業費決算（単一値の場合のみ）。チェック欄の評価、教育委員会活動状況・決算状況の表は対象外。' },
  '18204': { extract: obama, scope: '小浜市教育委員会 点検・評価報告書（平成25年度分）の対象18事業: 対象事業一覧の25/24年度決算額（増減が一致する行のみ）と施策別一覧の評価（Ａ～Ｄ）。評価シートの財源内訳・ポイント・所見は対象外。' },
};
export const entries = eduSmallEntries;
