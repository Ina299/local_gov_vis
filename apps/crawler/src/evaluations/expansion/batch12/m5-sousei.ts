import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { eraYear, rating } from '../batch8/h6-util';
import { type Entry, groupAt, municipal } from './m5-util';

/* ---------- 06403 飯豊町 総合戦略 主要プロジェクト 外部検証の評価一覧 ---------- */

const IIDE_R6 = 'まち・ひと・しごと創⽣ 総合戦略\n第 2 期（令和 6 年度事業分）\n主要プロジェクト\n<<外部検証>>\n';
const IIDE_1 = '飯豊町まち・ひと・しごと総合戦略 第1期（平成27年度～令和2年度）外部検証(委員評価)\n';

/** 番号が1から順に並ぶ行だけ。抜けた番号は評価が「－」の行として本文にある場合だけ許し、それ以外で崩れた行以降は採用しない。 */
function consecutive<T extends RegExpMatchArray>(rows: T[], text: string): T[] {
  const out: T[] = [];
  let next = 1;
  for (const r of rows) {
    while (Number(r[1]) > next && new RegExp(`\n${next}\n\n[^\n]+\n\n－\n`).test(text)) next++;
    if (Number(r[1]) !== next) break;
    out.push(r); next++;
  }
  return out;
}

function iide(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, out: ProjectEvaluation[] = [];
  if (t.startsWith(IIDE_R6)) {
    const s = t.indexOf('\nNo\n\nプロジェクト名\n\n評価\n'), e = t.indexOf('外部検証 (意⾒)');
    if (s < 0 || e < s) return [];
    for (const r of consecutive([...t.slice(s, e).matchAll(/\n(\d{1,2})\n\n([^\n]+)\n\n([SABCD])\n(?=\n)/dg)], t.slice(s, e))) {
      const p = project(input, r[2], r[2], null, r[2], groupAt(r, 2, s));
      p.projectCode = null; p.evaluatedFiscalYear = 2024;
      p.ratings.push(rating(input, 'external', '外部検証（評価）', r[3], null, r[0].trim(), groupAt(r, 1, s)));
      p.evidence.push(evidence(input, IIDE_R6.trimEnd(), 0));
      p.warnings.push('飯豊町 まち・ひと・しごと創生総合戦略 第2期（令和6年度事業分）主要プロジェクトの外部検証（評価）一覧の行。表題の「令和6年度事業分」を評価対象年度とし、評価実施年度は明示がないため未設定。評価区分の定義は本資料にないため scale 未設定。',
        '主要プロジェクトは総合戦略の事業群で、所管課・KPI・予算は一覧にないため未設定。外部検証の意見（文章）、評価シート（令和4・5年度）・実績まとめの一覧は列の対応が崩れているため対象外。');
      out.push(p);
    }
  } else if (t.startsWith(IIDE_1)) {
    const rows = consecutive([...t.matchAll(/\n(\d{1,2})\n\n([^\n]+)\n\n([SABCD])\n\n(\d\.\d\d)\n\n([SABCD])\n\n([SABCD])\n(?=\n)/dg)], t);
    for (const r of rows) {
      const p = project(input, r[2], r[2], null, r[2], groupAt(r, 2));
      p.projectCode = null;
      p.ratings.push(rating(input, 'external', '外部評価', r[3], null, r[0].trim(), groupAt(r, 1)),
        rating(input, 'self', '内部評価', r[5], null, r[0].trim(), groupAt(r, 1)),
        rating(input, 'self', '自己評価', r[6], null, r[0].trim(), groupAt(r, 1)));
      p.evidence.push(evidence(input, IIDE_1.trimEnd(), 0));
      p.warnings.push('飯豊町 まち・ひと・しごと総合戦略 第1期（平成27年度～令和2年度）外部検証(委員評価)の一覧の行。計画期間全体の検証で単年度の明示がないため評価年度・評価対象年度は未設定。',
        `一覧の列順（外部評価・平均・内部評価・自己評価）どおりに記録。平均（${r[4]}）と委員別の点数は未構造化。番号が連続して読める行のみ。評価区分の定義は本資料にないため scale 未設定。`);
      out.push(p);
    }
  }
  return out;
}

/* ---------- 43501 錦町 令和6年度デジタル田園都市国家構想交付金事業の効果検証 ---------- */

const NISHIKI = '資料２\n\n令和６年度デジタル田園都市国家構想\n交付金事業の効果検証について\n';

function nishiki(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith(NISHIKI)) return [];
  const heads = [...t.matchAll(/\n１\n\n基本情報\n\n交付対象事業の名称\n\n([^\n]+)\n\n交付金区分\n\n([^\n]+)\n/dg)];
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    const s = h.index!, sheet = t.slice(s, heads[i + 1]?.index ?? t.length);
    const p = project(input, h[1], h[1], null, h[1], groupAt(h, 1));
    p.projectCode = null; p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, NISHIKI.trimEnd(), 0));
    p.warnings.push('錦町 令和6年度デジタル田園都市国家構想交付金事業の効果検証（資料２）の事業別シート。表題の令和6年度を評価対象年度とし、評価実施年度は明示がないため未設定。',
      '事業費（円）は対象年度か全体事業費か明示がないため未収録。KPIは指標名が取組内容等の欄の文と同じ行に折り返して混在し、指標名の範囲が確定できないため未収録。取組内容等は文章のため未構造化。');
    out.push(p);
  });
  return out;
}

export const entries: Record<string, Entry> = {
  '06403': { extract: municipal('06403', iide), scope: '飯豊町 総合戦略 主要プロジェクトの外部検証一覧（第2期 令和6年度事業分の評価、第1期 平成27〜令和2年度の外部・内部・自己評価）の番号が連続して読める行のプロジェクト名と評価。評価シート（令和4・5年度）・実績まとめ一覧（列崩れ）・KPI・外部意見の文章は対象外。' },
  '43501': { extract: municipal('43501', nishiki), scope: '錦町 令和6年度デジタル田園都市国家構想交付金事業の効果検証（資料２）の事業別シートの事業名（評価対象年度）。KPI（指標名が隣の欄と混在）・事業費・取組内容の文章・総合計画の進捗状況（資料１）は対象外。' },
};
