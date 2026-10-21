import type { EvaluationAmount, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const toNum = (s: string) => Number(s.replaceAll(',', ''));
const norm = (s: string) => s.normalize('NFKC').replace(/\s/g, '');

/**
 * 登別市 令和７年度（令和６年度分）事務事業評価シート（総合計画の章別 R71〜R76syou.pdf）。
 * 同じ章のPDFが4回掲載されており、3次評価まで記入済みの最終版（docs/2026040600015）だけを対象にする。
 * 先行3版（意見公募時の案）と対象事業一覧・概要・意見公募結果は返さない。
 */
const NOBORIBETSU_FINAL = new Set(['0875a19a422893b10f8dddcf', '0f4befd09e7ad2780f5f06b3', '6dd61a0b557cb380105d2547',
  '3a069d8b9d589d5f41a94cfc', '23d731d5a6a96334f03e858e', '37e148e5c7475c71f7eef2e3']);
const NB_HEADER = '令和７年度（令和６年度分）事務事業評価シート\n';
const NB_RESULTS = ['拡大', '改善', '継続', '統合', '縮小', '休止', '廃止', '終了'];
// 「前回評価」の見出しが別位置へずれる版も、値は 前回・１次・２次・３次 の順（意見公募版の3値と先頭3つが一致することを確認済み）。
const NB_RATING = new RegExp(`(前回評価\\n\\n)?１次評価\\n\\n２次評価\\n\\n３次評価\\n\\n((?:(?:${NB_RESULTS.join('|')})\\n\\n){4})`);
const NB_LABELS = ['前回評価', '１次評価', '２次評価', '３次評価'];
const NB_COLUMNS: [string, EvaluationAmount['kind'], number][] = [['R5当初予算', 'budget', 2023], ['R5決算', 'actual', 2023], ['R6決算', 'actual', 2024], ['R7当初予算', 'budget', 2025]];

function noboribetsuSheets(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, out: ProjectEvaluation[] = [];
  const starts: number[] = [];
  for (let i = t.indexOf(NB_HEADER); i >= 0; i = t.indexOf(NB_HEADER, i + 1)) starts.push(i);
  starts.forEach((from, k) => {
    const to = k + 1 < starts.length ? starts[k + 1] : t.length, sheet = t.slice(from, to);
    const head = sheet.match(/^令和７年度（令和６年度分）事務事業評価シート\n事務事業名\n\n([^\n]+)\n\n部・グループ\n\n([^\n]+)\n/)
      ?? sheet.match(/^令和７年度（令和６年度分）事務事業評価シート\n\n事務事業コード\n\n\d{8}\n\n事業・経費名\n\n([^\n]+)\n\n部・グループ\n\n([^\n]+)\n/);
    const codes = [...sheet.matchAll(/(?<![\d,])\d{8}(?![\d,])/g)];
    if (!head || codes.length !== 1) return;
    const p = project(input, codes[0][0], head[1], 2025, head[0], from);
    p.evaluatedFiscalYear = 2024;
    p.department = head[2];
    p.evidence.push(evidence(input, codes[0][0], from + codes[0].index!));

    const purpose = sheet.match(/目的・根拠・対象\n((?:[^\n]+\n)*?[^\n]*とする。)\n\n/);
    if (purpose) { p.purpose = purpose[1].replaceAll('\n', ''); p.evidence.push(evidence(input, purpose[1], from + purpose.index! + '目的・根拠・対象\n'.length)); }

    const rating = sheet.match(NB_RATING);
    if (rating && sheet.split('前回評価').length === 2) {
      if (!rating[1]) p.warnings.push('評価欄は「前回評価」の見出しが値の並びから離れて抽出されているため、値の4つ並びを 前回・１次・２次・３次 の順として転記。');
      const values = rating[2].split('\n\n').slice(0, 4);
      p.ratings = values.map((value, i) => ({ kind: 'self' as const, label: NB_LABELS[i], value, scale: NB_RESULTS.join('／'), evidence: evidence(input, rating[0], from + rating.index!) }));
    } else p.warnings.push('評価欄（前回・１次・２次・３次評価）の値の並びが抽出テキストで確定できないため、評価は転記していません。');

    const unit = sheet.indexOf('予算・決算の内訳（単位：千円）');
    if (unit >= 0) {
      for (const [label, kind, fiscalYear] of NB_COLUMNS) {
        // 「合計\nR5当初予算\n国庫…一般財源・合計」の並びで、財源の和と合計が一致する列だけ。
        const m = sheet.match(new RegExp(`\\n\\n(\\d[\\d,]*)\\n${label}\\n((?:\\d[\\d,]*\\n){6})`));
        if (!m) continue;
        const v = m[2].trim().split('\n').map(toNum);
        if (v.slice(0, 5).reduce((s, x) => s + x, 0) !== v[5] || v[5] !== toNum(m[1])) continue;
        const raw = m[0].slice(2, -1);
        p.amounts.push({ kind, fiscalYear, amountYen: v[5] * 1000, rawValue: m[1], rawUnit: '千円', evidence: evidence(input, raw, from + m.index! + 2) });
      }
    }
    if (p.amounts.length < NB_COLUMNS.length) p.warnings.push('予算・決算の内訳は、列見出しの直前に合計・直後に財源内訳（和が合計と一致）が並ぶ列だけを転記。R6当初・最終予算は列が混在するため転記していません。');
    p.warnings.push('指標等の状況（成果指標・活動指標）は抽出テキストで行と年度の対応が崩れているため転記していません。');
    out.push(p);
  });
  return out;
}

const nbCache = new Map<string, ProjectEvaluation[]>();
const nbParse = (input: CachedInput) => { if (!nbCache.has(input.sourceId)) nbCache.set(input.sourceId, noboribetsuSheets(input)); return nbCache.get(input.sourceId)!; };

function noboribetsu(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (!NOBORIBETSU_FINAL.has(input.sourceId)) return [];
  // 同名の事業が複数ある場合（所管が同じなら同一識別となる）は、どれも返さない。
  const all = inputs.filter(i => NOBORIBETSU_FINAL.has(i.sourceId)).flatMap(nbParse);
  const count = new Map<string, number>();
  for (const p of all) count.set(norm(p.projectName), (count.get(norm(p.projectName)) ?? 0) + 1);
  return nbParse(input).filter(p => count.get(norm(p.projectName)) === 1);
}

/**
 * 松原市 令和６年度 事務事業評価シート（課別PDF）。抽出テキストがあるのは企画政策課の1本のみ。
 * 人件費・事業費・コスト計の行は、4列すべてで 人件費＋事業費＝コスト計 が成り立つ場合だけ転記する。
 */
const MS_SHEET = '令和６年度\n事務事業名\n(予算事業名)\n担当課名\n\n事務事業評価シート\n';
// シートごとの事業名（シート先頭の事務事業名欄の表記）。
const MS_NAMES = ['松原市まち・ひと・しごと創生総合戦略策定事業', '移住定住促進事業', '市政報告会事業', 'スケートボードパークを核としたまちづくり事業', '子ども議会事業', '行政評価事業'];
const ROW = /(?:^|\n\n)((\d[\d,]*)\n\n(\d[\d,]*)\n\n(\d[\d,]*)\n\n(\d[\d,]*)\n\n[\d.]+%)(?=\n\n)/g;

function matsubara(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== '3237d1d3503e196077eed866') return [];
  const t = input.text, starts: number[] = [], out: ProjectEvaluation[] = [];
  for (let i = t.indexOf(MS_SHEET); i >= 0; i = t.indexOf(MS_SHEET, i + 1)) starts.push(i);
  if (starts.length !== MS_NAMES.length) return [];
  starts.forEach((from, k) => {
    const to = k + 1 < starts.length ? starts[k + 1] : t.length, overview = t.indexOf('Ⅰ.事務事業の概要', from);
    if (overview < 0 || overview > to) return;
    const head = t.slice(from, overview), codes = [...head.matchAll(/(?<!\d)\d{8}(?!\d)/g)], name = MS_NAMES[k];
    const nameAt = head.indexOf(`\n${name}\n`), dept = head.match(/\n(企画政策課)\n/);
    if (codes.length !== 1 || nameAt < 0 || !dept) return;
    const p = project(input, codes[0][0], name, 2024, head, from);
    p.department = dept[1];
    const sheet = t.slice(from, to), rows = [...sheet.matchAll(ROW)].map(m => ({ m, v: [m[2], m[3], m[4], m[5]].map(toNum) }));
    const triples: typeof rows[] = [];
    for (let i = 0; i + 2 < rows.length; i++) {
      const [a, b, c] = rows.slice(i, i + 3);
      if (a.v.every((x, j) => x + b.v[j] === c.v[j])) triples.push([a, b, c]);
    }
    if (triples.length === 1 && sheet.includes('人件費\n２\n内訳（千円） 事業費')) {
      const [personnel, cost, full] = triples[0];
      for (const [kind, row] of [['personnel', personnel], ['actual', cost], ['fullCost', full]] as const) {
        const raw = row.m[1], start = from + row.m.index! + row.m[0].indexOf(raw);
        [2021, 2022, 2023].forEach((fy, j) => p.amounts.push({ kind, fiscalYear: fy, amountYen: row.v[j] * 1000, rawValue: [row.m[2], row.m[3], row.m[4]][j], rawUnit: '千円', evidence: evidence(input, raw, start) }));
        if (kind === 'actual') p.amounts.push({ kind: 'budget', fiscalYear: 2024, amountYen: row.v[3] * 1000, rawValue: row.m[5], rawUnit: '千円', evidence: evidence(input, raw, start) });
      }
      p.warnings.push('令和3〜5年度の人件費・事業費・コスト計（千円）と令和6年度（目標・予算）の事業費を、人件費＋事業費＝コスト計が4列とも成立する行の組から転記。');
    } else p.warnings.push('投入資源の表は抽出テキストで行・列の対応が確定できないため金額を転記していません。');
    p.warnings.push('評価（●印）と指標値は抽出テキストで選択位置・列が失われているため転記していません。評価対象年度はシート上に明示がないため未設定。');
    out.push(p);
  });
  return out;
}

export const noboribetsuMatsubaraEntries: Record<string, Entry> = {
  '01230': { extract: noboribetsu, scope: '登別市 令和７年度（令和６年度分）事務事業評価シートの最終版（3次評価記入済み、章別6冊）。事業名・事務事業コード・部グループ・目的、前回／１次／２次／３次評価、予算・決算の内訳の合計（財源内訳と一致する列のみ）を構造化。指標表・同名事業・意見公募前の版・一覧表は対象外。' },
  '27217': { extract: matsubara, scope: '松原市 令和６年度 事務事業評価シート（企画政策課分。他課PDFは抽出テキストなし）。事業名・コード・担当課と、整合が取れる場合の人件費・事業費・コスト計。●印の評価・指標値は対象外。' },
};
export const entries = noboribetsuMatsubaraEntries;
