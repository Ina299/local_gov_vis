/** Batch-9 (i0) extractors: 41341 基山町 (事務事業評価シート) and 14342 二宮町 (基礎評価一覧). */
import type { EvaluationAmount, EvaluationRating, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';
import { type Entry, acrossInputs, digits, toNum } from '../batch8/h3-util';

// ---- 41341 基山町 ----

/** Sheet sets acquired in round 3: R2〜R6 実施分 (one PDF per year). Summary lists repeat the sheets without a year and are not used. */
const KIYAMA_SHEETS = new Set(['1d43ccf245d7aea7e330b2a4', '1b118f8508d9366249d2623f', 'e7f635f44f7fa1dc5528677c', '0c2dea4458851dc4c64d0d10', '0754f5756ae5df1e640fdc26']);
const KIYAMA_LABELS = new Set(['事業名', '事業番号', '事', '業', '担当課', '担当係', '総合計画基本計画の', '位置付け', '事業の概要', '根拠法令等', '１．事業の概要（Plan）']);
const KIYAMA_DIRECTIONS = new Set(['継続', '完了', '廃止', '拡大']);
const TOKEN = String.raw`([\d,]+|[―－-])`;

function kiyamaSheets(input: CachedInput): ProjectEvaluation[] {
  if (!KIYAMA_SHEETS.has(input.sourceId)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const heads = [...t.matchAll(/令和(.{1,2})年度事務事業評価シート/g)];
  heads.forEach((h, i) => {
    const start = h.index!, end = i + 1 < heads.length ? heads[i + 1].index! : t.length;
    const seg = t.slice(start, end), headEnd = seg.indexOf('\n基本計画\n');
    if (headEnd < 0) return;
    const head = seg.slice(0, headEnd);
    const lines = head.split('\n').slice(1).map(l => l.trim()).filter(Boolean);
    const kakari = head.match(/担当係\n\n(.+)\n/)?.[1].trim();
    const nums = lines.filter(l => /^\d+$/.test(l));
    const deps = [...new Set(lines.filter(l => !KIYAMA_LABELS.has(l) && /(課|室|局)$/.test(l)))];
    const rest = lines.filter(l => !KIYAMA_LABELS.has(l) && !nums.includes(l) && !deps.includes(l) && l !== kakari);
    // The name, number and section move around in the extracted text; anything not uniquely identified is skipped.
    if (nums.length !== 1 || deps.length !== 1 || rest.length !== 1) return;
    const year = 2018 + digits(h[1]);
    // One 事業番号 can be split between sections (separate sheets), so the id is keyed on number and section.
    const p = project(input, `${nums[0]}:${deps[0]}`, rest[0], null, head, start);
    p.projectCode = nums[0];
    p.department = deps[0];
    p.evaluatedFiscalYear = year;
    p.warnings.push('シート表題「令和X年度事務事業評価シート」の年度（取組内容・決算の年度）を評価対象年度とした。評価実施年度はこの資料に明記がないため null。');
    const money = seg.match(new RegExp(String.raw`令和(.{1,2})年度（予算）\n\n総事業費\n内 補助金等\n\n令和(.{1,2})年度（決算）\n\n${TOKEN}\n\n千円\n\n${TOKEN}\n\n千円\n\n${TOKEN}\n\n千円\n\n${TOKEN}\n\n千円`));
    if (money && 2018 + digits(money[1]) === year && 2018 + digits(money[2]) === year) {
      const [b, a, sb, sa] = money.slice(3, 7);
      const n = (s: string) => /^[\d,]+$/.test(s) ? toNum(s) : null;
      // Row order is 総事業費(予算, 決算) then 内 補助金等(予算, 決算); a subsidy larger than the total would mean another order.
      const consistent = (n(sb) === null || n(b) === null || n(sb)! <= n(b)!) && (n(sa) === null || n(a) === null || n(sa)! <= n(a)!);
      if (consistent) {
        const ev = evidence(input, money[0], start + money.index!);
        const add = (kind: EvaluationAmount['kind'], raw: string) => {
          if (n(raw) !== null) p.amounts.push({ kind, fiscalYear: year, amountYen: n(raw)! * 1000, rawValue: raw, rawUnit: '千円', evidence: ev });
        };
        add('budget', b); add('actual', a);
        if (p.amounts.length) p.warnings.push('金額は「総事業費」行の予算・決算（千円）。「内 補助金等」は記録していない。');
      }
    }
    const r = seg.match(/第１次評価\n\n(\S+)\n\n第２次評価\n\n(\S+)\n/);
    if (r && KIYAMA_DIRECTIONS.has(r[1]) && KIYAMA_DIRECTIONS.has(r[2])) {
      const ev = evidence(input, r[0], start + r.index!);
      p.ratings.push({ kind: 'self', label: '事業の方向性 第１次評価（担当課長）', value: r[1], scale: null, evidence: ev },
        { kind: 'self', label: '事業の方向性 第２次評価（基山町行政評価委員会）', value: r[2], scale: null, evidence: ev });
    }
    out.push(p);
  });
  // A name sheeted by two sections in the same year is two businesses under one name; the shared identity cannot hold both.
  const sections = new Map<string, Set<string | null>>();
  for (const p of out) sections.set(p.projectName, (sections.get(p.projectName) ?? new Set()).add(p.department));
  return out.filter(p => sections.get(p.projectName)!.size === 1);
}

// ---- 14342 二宮町 ----

/** 基礎評価（１次評価・２次評価）一覧 for 令和５・６年度実績. The 令和７年度実績 list and the per-課 sheets have corrupted glyphs in the extracted text and are not used. */
const NINOMIYA_LISTS = new Set(['b7929560d833687e656109e3', '7edbad488c6b06d4464825b9']);
const N_RATE = '(良好|適当|不良)', N_DIR = '(拡大・拡充|現状維持|要改善|統廃合|休・廃止)';
const N_ROW = new RegExp(String.raw`\n([^\n]+?)((?: ※)?|\n\n※)\n\n([^\n]+(?:課|室|局))\n\n${N_RATE}\n\n${N_DIR}\n\n${N_RATE}\n\n${N_DIR}(?=\n)`, 'g');
const N_PREV_ROW = new RegExp(`${N_DIR}\\n\\n$`);
const N_NOT_NAME = new RegExp(`${N_RATE}|${N_DIR}|^※$|^[－−-]$|方向性|総合評価|^[0-9０-９]+(-[0-9０-９]+)?$`);

function ninomiyaRows(input: CachedInput): ProjectEvaluation[] {
  if (!NINOMIYA_LISTS.has(input.sourceId)) return [];
  const t = input.text, y = t.match(/^基礎評価（１次評価・２次評価）一覧（令和(.{1,2})年度実績）/);
  if (!y) return [];
  const year = 2018 + digits(y[1]), out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(N_ROW)) {
    const name = m[1].trim(), before = t.slice(0, m.index! + 1);
    // Only rows that directly follow a complete row or a 施策 heading; elsewhere the name column is displaced from its ratings.
    const anchored = N_PREV_ROW.test(before) || /\n[0-9０-９]+-[0-9０-９]+\n\n[^\n]+\n$/.test(before);
    if (!anchored || N_NOT_NAME.test(name)) continue;
    const raw = m[0].slice(1), at = m.index! + 1;
    // The list has no project numbers; the id is keyed on the name and year instead.
    const p = project(input, `list:${name}:${year}`, name, null, raw, at);
    p.projectCode = null;
    p.department = m[3];
    p.evaluatedFiscalYear = year;
    const ev = evidence(input, raw, at);
    const rate = (label: string, value: string): EvaluationRating => ({ kind: 'self', label, value, scale: null, evidence: ev });
    p.ratings.push(rate('1次評価（担当課） 総合評価', m[4]), rate('1次評価（担当課） 方向性', m[5]),
      rate('2次評価（庁内評価委員会） 総合評価', m[6]), rate('2次評価（庁内評価委員会） 方向性', m[7]));
    p.warnings.push('一覧表題「（令和X年度実績）」の年度を評価対象年度とした。評価実施年度は本文に明記がないため null。',
      '事業名・担当課・評価が連続して抽出された行のみ構造化（列がずれた行と２次評価意見は対象外）。※印は複数施策への重複掲載。');
    out.push(p);
  }
  return out;
}

export const entries: Record<string, Entry> = {
  '41341': { extract: acrossInputs(kiyamaSheets),
    scope: '令和２〜６年度実施分の事務事業評価シート（1事業1枚）から事業番号・事業名・担当課・総事業費の予算／決算（令和３年度分以降、千円）・第１次／第２次評価の方向性を構造化。令和２年度分の決算見込と財源内訳、事業評価の文章、同年度に複数課で別シートがある同名事業、年度の書かれていない評価結果一覧、行政評価の概要説明は対象外。' },
  '14342': { extract: acrossInputs(ninomiyaRows),
    scope: '基礎評価（１次評価・２次評価）一覧（令和５・６年度実績）の行から予算等事業名・担当課・１次／２次評価の総合評価と方向性を構造化。列がずれた行、２次評価意見、文字化けした令和７年度実績一覧と各課の基礎評価シート、施策評価シート、案内ページは対象外。' },
};
