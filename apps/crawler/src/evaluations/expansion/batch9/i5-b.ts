import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, mergeReprints, sheets } from '../batch7/g1-util';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

const kanjiDigits: Record<string, number> = { '２': 2, '３': 3, '４': 4, '５': 5, '６': 6 };

/** 大崎市 主要施策の成果（事務事業評価）令和2〜6年度版（各資料はおよそ12万字で打ち切り）。 */
const OSAKI_SOURCES = new Set([
  'da6b7be5995a7976797e0a90', 'd7a7c65f0ab345cb371f0dd1', // 令和2年度
  'bdef009111563ef074dbe735', 'fc2f1fb72834f2ea98a925a3', // 令和3年度
  'e67215ce27ebdad3021bcd45', '0d81247af9cd5ac3c54df678', '9c9b9b18c20f0137fa02d609', // 令和4年度
  '122c450281cae22c778fd1ae', 'b95743cd67b79ebe13da1030', '30a543192838ca5ba3560f47', // 令和5年度
  'ca946703500d24b78153f4c8', '2a3c2049550f46feb343a2f7', 'b0886b187c71a52dbb636be7', // 令和6年度
]);
const OSAKI_DIRECTIONS = ['廃止', '事務事業統合・連携', '事業完了', '現状維持', '事務事業のやり方改善', '拡大'];
const OSAKI_JUDGES: [string, string, string][] = [['目的妥当性', '◆ 目的妥当性', '◆ 有効性'], ['有効性', '◆ 有効性', '◆ 効率性'], ['効率性', '◆ 効率性', '【評価の総括と今後の方向性】']];

/** One ☑ among a fixed option set inside [from, to) of a sheet; null when zero/several are checked or options are missing. */
function checked(sheet: string, from: number, to: number, options: string[]): { label: string; index: number; raw: string } | null {
  const region = sheet.slice(from, to);
  if (!options.every(o => region.includes(`☑ ${o}\n`) || region.includes(`□ ${o}\n`))) return null;
  const hits = options.filter(o => region.includes(`☑ ${o}\n`));
  if (hits.length !== 1) return null;
  const raw = `☑ ${hits[0]}`;
  return { label: hits[0], index: from + region.indexOf(`${raw}\n`), raw };
}

/**
 * 目的妥当性・有効性・効率性の「適切／見直す必要がある」。抽出テキストで□欄が隣の区画へずれることがあるため、
 * 評価欄全体で☑が3つだけのときに限り、全て「適切」ならそのまま、混在する場合は各区画に☑が1つずつある場合のみ採用。
 */
function osakiJudges(sheet: string, from: number, to: number): { label: string; value: string; raw: string; index: number }[] | null {
  const opts = ['適切', '見直す必要がある'];
  const start = sheet.indexOf('◆ 目的妥当性', from);
  if (start < 0 || start > to) return null;
  const hits = [...sheet.slice(start, to).matchAll(/☑ (適切|見直す必要がある)\n/g)];
  const boxes = [...sheet.slice(start, to).matchAll(/[☑□] (適切|見直す必要がある)\n/g)];
  if (hits.length !== 3 || boxes.length !== 6) return null;
  if (hits.every(h => h[1] === '適切')) return OSAKI_JUDGES.map(([label], k) => ({ label, value: '適切', raw: '☑ 適切', index: start + hits[k].index! }));
  const out = OSAKI_JUDGES.map(([label, a, b]) => {
    const f = sheet.indexOf(a, start), t = sheet.indexOf(b, f);
    if (f < 0 || t < 0) return null;
    const region = sheet.slice(f, t), hs = opts.filter(o => region.includes(`☑ ${o}\n`));
    if (hs.length !== 1 || region.split(`☑ ${hs[0]}\n`).length !== 2) return null;
    return { label, value: hs[0], raw: `☑ ${hs[0]}`, index: f + region.indexOf(`☑ ${hs[0]}\n`) };
  });
  return out.every(Boolean) ? out as { label: string; value: string; raw: string; index: number }[] : null;
}

/** 大崎市 主要施策の成果（事務事業評価表）2ページ1組の事務事業評価表。担当課評価（☑）と今後の方向性を収録。 */
function parseOsaki(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '04215' || !OSAKI_SOURCES.has(input.sourceId)) return [];
  const out: ProjectEvaluation[] = [];
  for (const { start, text: sheet } of sheets(input.text, /令和[２-６]年度主要施策の成果（事務事業評価表）/g)) {
    const year = 2018 + kanjiDigits[sheet[2]];
    const page2 = sheet.match(/\n事業番号\n\n(\d{5,6})\n\n事務事業名\n\n([^\n]+)\n\n【事務事業を取り巻く/);
    if (!page2) continue;
    const p2 = page2.index! + 1, summary = sheet.indexOf('【評価の総括と今後の方向性】', p2), past = sheet.indexOf('現在の課題・問題点', summary);
    if (summary < 0 || past < 0) continue;
    const direction = checked(sheet, summary, past, OSAKI_DIRECTIONS);
    const judges = osakiJudges(sheet, p2, past);
    if (!direction || !judges) continue;
    const [, code, name] = page2;
    // 表の見方（記入例）は事業番号が空欄で一致しない。表紙側の事業番号欄とも一致することを確認。
    const head = sheet.slice(0, sheet.indexOf('【事務事業の現状】') < 0 ? p2 : sheet.indexOf('【事務事業の現状】'));
    if (!new RegExp(`\\n${code}\\n`).test(head) || !head.includes(name)) continue;
    const p = project(input, code, name, null, page2[0].slice(1), start + p2);
    p.evaluatedFiscalYear = year;
    const headingRaw = sheet.slice(0, '令和６年度主要施策の成果（事務事業評価表）'.length);
    p.evidence.push(evidence(input, headingRaw, start));
    const depts = [...head.matchAll(/\n\n([^\n]+)\n[^\n]+\n[^\n]+\n\d{2,4}-\d{3,4}[^\n]*\n/g)].filter(m => /(?:部|局|委員会|事務所|支所)[^\n]*(?:課|室|センター|事務所|館|局)$/.test(m[1]));
    if (depts.length === 1) {
      p.department = depts[0][1];
      p.evidence.push(evidence(input, depts[0][1], start + depts[0].index! + 2));
    }
    p.ratings.push({ kind: 'self', label: '今後の事務事業の方向性', value: direction.label, scale: OSAKI_DIRECTIONS.join('／'), evidence: evidence(input, direction.raw, start + direction.index) });
    for (const j of judges) p.ratings.push({ kind: 'self', label: `担当課評価（${j.label}）`, value: j.value, scale: '適切／見直す必要がある', evidence: evidence(input, j.raw, start + j.index) });
    p.warnings.push(`令和${'２３４５６'[year - 2020]}年度主要施策の成果（事務事業評価表）の1事業分から、事業番号・事務事業名・担当部課・担当課評価（目的妥当性・有効性・効率性の各「適切／見直す必要がある」）・今後の事務事業の方向性（☑印）を収録。見出しの「令和${'２３４５６'[year - 2020]}年度主要施策の成果」により評価対象年度を${year}年度とした。評価の実施年度は本文に明記がなく未設定。事業費・各指標の推移表は抽出テキストで年度列（決算額・予算額）と行（財源・事業費・人件費）の対応が確定できないため金額・指標とも未収録。個別設問①〜⑥の回答と文章欄は未構造化。保存済み本文は約12万字で打ち切られており資料の一部の事業のみが対象。`);
    if (!p.department) p.warnings.push('担当部課は抽出テキストの並びから一意に確定できず未設定。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

/** 同じ年度に同名で事業番号の異なる事業（地域別の地域おこし協力隊活用事業など）は名称で区別できないため全資料を通して除外。 */
function extractOsaki(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  const mine = parseOsaki(input);
  if (!mine.length) return mine;
  const codes = new Map<string, Set<string>>();
  for (const p of inputs.flatMap(parseOsaki)) {
    const k = `${p.evaluatedFiscalYear}:${p.projectName}`;
    codes.set(k, (codes.get(k) ?? new Set()).add(p.projectCode!));
  }
  return mine.filter(p => codes.get(`${p.evaluatedFiscalYear}:${p.projectName}`)!.size === 1);
}

const TOKOROZAWA_R8 = 'fb6db673deed9f276e5c00c3';
const TOKOROZAWA_HEAD = '令和８年度事務事業評価表：令和７年度事務事業\n\n【様式１】\n';
const TOKOROZAWA_DIRECTION = 'Ⅰ：事業規模拡大 Ⅱ：継続 Ⅲ：要改善 Ⅳ：事業規模縮小 Ⅴ：事業終了';
const TOKOROZAWA_CHECKS: [string, string][] = [
  ['施策への貢献度', 'A：貢献している B：やや貢献している C：貢献の度合いが低い'],
  ['必要性（市民ニーズ）', 'A：高まっている B：変わらない C：薄れている'],
  ['効率性（見直しの余地）', 'A：余地はない B：余地はある'],
  ['達成度・進捗状況', 'A：計画以上 B：計画どおり C：計画どおりでない'],
];

/** 所沢市 令和8年度事務事業評価表【様式1】（令和7年度事務事業。1事業1ページ）。 */
function extractTokorozawa(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11208' || input.sourceId !== TOKOROZAWA_R8 || !input.text.startsWith('【様式１】\n\n令和8年度 事務事業評価表')) return [];
  const out: ProjectEvaluation[] = [];
  for (const { start, text: sheet } of sheets(input.text, TOKOROZAWA_HEAD)) {
    const h = sheet.match(/^[^]*?【様式１】\n(\d{3}) ([^\n]+)\n\n([^\n ]+部) ([^\n ]+)\n/);
    if (!h || !sheet.includes(TOKOROZAWA_DIRECTION)) continue;
    const ratings: { label: string; value: string; scale: string; raw: string; at: number }[] = [];
    for (const [label, scale] of TOKOROZAWA_CHECKS) {
      const re = new RegExp(`${label.replace(/[()（）]/g, '\\$&')}\\n\\n([ABC])\\n\\n${scale.slice(0, 4)}`, 'g');
      const ms = [...sheet.matchAll(re)];
      if (ms.length !== 1) { ratings.length = 0; break; }
      ratings.push({ label, value: ms[0][1], scale, raw: ms[0][0].slice(0, label.length + 3), at: ms[0].index! });
    }
    // 方向性は単独行のⅠ〜Ⅴ（凡例行を除く）が1つだけの場合のみ。
    const dir = [...sheet.matchAll(/\n([ⅠⅡⅢⅣⅤ])\n/g)];
    if (ratings.length !== TOKOROZAWA_CHECKS.length || dir.length !== 1) continue;
    const [, plan, name, bu, ka] = h;
    const nameRaw = `${plan} ${name}`, nameAt = start + TOKOROZAWA_HEAD.length;
    const p = project(input, `${plan} ${name}`, name, 2026, nameRaw, nameAt);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2025;
    p.department = `${bu} ${ka}`;
    p.evidence.push(evidence(input, TOKOROZAWA_HEAD.slice(0, '令和８年度事務事業評価表：令和７年度事務事業'.length), start), evidence(input, p.department, nameAt + nameRaw.length + 2));
    const row = (label: string) => {
      const ms = [...sheet.matchAll(new RegExp(`\\n${label}\\n\\n([\\d,]+)千円\\n\\n([\\d,]+)千円\\n\\n([\\d,]+)千円\\n`, 'g'))];
      return ms.length === 1 ? ms[0] : null;
    };
    const header = /\nR5\n\nR6\n\nR7\n/.test(sheet);
    const budget = row('予算現額'), actual = row('決算額（R7見込）'), full = row('決算額\\+人件費');
    const add = (m: RegExpMatchArray | null, kind: 'budget' | 'actual' | 'fullCost', years: number[]) => {
      if (!m) return;
      let off = 1;
      years.forEach((fy, k) => {
        const v = m[k + 1], raw = `${v}千円`, at = m[0].indexOf(raw, off);
        off = at + raw.length;
        p.amounts.push(amount(input, kind, fy, v, '千円', raw, start + m.index! + at));
      });
    };
    if (header) {
      add(budget, 'budget', [2023, 2024, 2025]);
      add(actual, 'actual', [2023, 2024]);
      add(full, 'fullCost', [2023, 2024]);
    }
    // 指標は R5現状・R7実績・R10目標 の各ラベル直後に値が並ぶ場合のみ（値が3行まとめて並ぶ様式は列対応が確定しないため除外）。
    const ind = [...sheet.matchAll(/\nR5現状\n\n([^\n]+)\n\nR7実績\n\n([^\n]+)\n\nR10目標\n\n([^\n]+)\n/g)];
    const iname = [...sheet.matchAll(/\n指標\n\n([^\n]+)\n\n/g)];
    if (ind.length === 1 && iname.length === 1) {
      const m = ind[0], raw = m[0].slice(1, -1), at = start + m.index! + 1, ev = () => evidence(input, raw, at);
      const unitM = [...sheet.matchAll(/\n([^\n\d]{1,4})\n\nR5現状\n/g)];
      const unit = unitM.length === 1 ? unitM[0][1] : null;
      p.indicators.push({ name: iname[0][1], fiscalYear: 2023, target: null, actual: m[1], unit, evidence: ev() });
      p.indicators.push({ name: iname[0][1], fiscalYear: 2025, target: null, actual: m[2], unit, evidence: ev() });
      p.indicators.push({ name: iname[0][1], fiscalYear: 2028, target: m[3], actual: null, unit, evidence: ev() });
      p.evidence.push(evidence(input, iname[0][1], start + iname[0].index! + 5));
    }
    for (const r of ratings) p.ratings.push({ kind: 'self', label: r.label, value: r.value, scale: r.scale, evidence: evidence(input, r.raw, start + r.at) });
    p.ratings.push({ kind: 'self', label: '今後の方向性', value: dir[0][1], scale: TOKOROZAWA_DIRECTION, evidence: evidence(input, dir[0][0].slice(1, 2), start + dir[0].index! + 1) });
    p.warnings.push('令和8年度事務事業評価表【様式1】（令和7年度事務事業）の1ページから、計画コード付き事業名・所属・事業評価（施策への貢献度・必要性・効率性・達成度の A〜C）・今後の方向性（Ⅰ〜Ⅴ）を収録。計画コードは施策単位で複数事業に共通のため事業コードとしては扱っていない。');
    p.warnings.push(header
      ? '予算現額はR5〜R7、決算額はR5・R6のみ（R7欄は「決算額（R7見込）」の見込値のため実績として収録しない）、決算額+人件費はR5・R6を総コストとして収録。3列がそろって1行に並ぶ場合のみ。正規職員人件費は予算・決算の別が不明なため未収録。'
      : '抽出テキストで年度見出し（R5・R6・R7）の並びが崩れており列対応が確定しないため金額は未収録。');
    if (!p.indicators.length) p.warnings.push('基本方針に対する事業目標（R5現状・R7実績・R10目標）は値が見出しと分かれて並び対応が確定しないため未収録。');
    else p.warnings.push('基本方針に対する事業目標の指標（R5現状・R7実績・R10目標）を原文の値のまま収録（施策単位の指標で、事業単独の成果とは限らない）。');
    p.warnings.push('保存済み本文は約12万字で打ち切られており、169事業中の前半のみが対象。');
    out.push(p);
  }
  return mergeReprints(out, p => `${p.department}:${p.projectName}`);
}

export const entries: Record<string, Entry> = {
  '04215': { extract: extractOsaki, scope: '主要施策の成果（事務事業評価表）令和2〜6年度版の保存済み本文（各約12万字で打ち切り）から、事業番号・事務事業名・担当部課・担当課評価（目的妥当性・有効性・効率性）・今後の方向性を構造化。事業費・指標の推移表（列対応が確定しないため）、文章欄、設問別回答は対象外。' },
  '11208': { extract: extractTokorozawa, scope: '令和8年度事務事業評価表【様式1】（令和7年度事務事業）の保存済み本文（約12万字で打ち切り）から、事業名・所属・予算現額・決算額（R5・R6）・総コスト・事業目標指標・事業評価（A〜C）・方向性（Ⅰ〜Ⅴ）を構造化。【様式2】一覧と令和4〜7年度の旧様式（4事業が段組みで混在し列対応が確定しない）は対象外。' },
};
