import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, num, rating } from '../batch8/h6-util';
import { type Entry, groupAt, municipal } from './m5-util';

/* ---------- 14205 藤沢市 令和8年度事務事業評価表（令和7年度実施事務事業、部局別 *-ji.pdf） ---------- */

const SHEET = '令和８年度 事務事業評価表\n\n（令和７年度実施事務事業）\n';
const NAME = [/^[^\n]+\n\n[^\n]+\n\n１．基本情報\n事務事業名\n\n([^\n]+)\n\n事業期間\n/d,
  /^[^\n]+\n\n[^\n]+\n\n１．基本情報\n事務事業名\n事業期間\n(?:対象\n)?\n([^\n]+)\n(?:令和|平成|昭和)[元\d０-９]+年度\n/d];
const DEPT = /\n所管課\n\n(?:～\n\n|(?:令和|平成|昭和)[元\d０-９]+年度\n\n){1,2}(?:単位\n\n)?([^\n]+?(?:課|室|センター|センタ―|事務所|館|担当))\n/d;
const ASPECTS = ['必要性', '公平性', '有効性', '効率性'] as const;
const DIRECTIONS = new Set(['現状のまま継続', '一部見直して継続', '拡大・拡充して継続', '縮小して継続', '事業完了', '休止・廃止']);

function parse(input: CachedInput): ProjectEvaluation[] {
  if (!/[-_]ji(?:_\d)?\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, starts = [...t.matchAll(new RegExp(SHEET, 'g'))].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((start, i) => {
    const sheet = t.slice(start, starts[i + 1] ?? t.length);
    const n = NAME.map(r => r.exec(sheet)).find(Boolean);
    if (!n || /^(事業期間|対象|所管課|単位|～)$/.test(n[1])) return;
    const name = n[1].trim();
    const p = project(input, name, name, 2026, n[1], groupAt(n, 1, start));
    p.projectCode = null; p.evaluatedFiscalYear = 2025;
    p.evidence.push(evidence(input, SHEET.trimEnd(), start));
    const d = DEPT.exec(sheet);
    if (d) { p.department = d[1]; p.evidence.push(evidence(input, d[1], groupAt(d, 1, start))); }

    // 3.行政コスト 令和７年度列: 行政費用A・事業費a・事業費以外b・職員給与費・賞与等・減価償却費等。A=a+b と b=内訳合計で検算できる場合だけ。
    const c = /\n\(単位：円\)\n対象1単位あたり費用\n令和７年度\n([\d,]+)\n([\d,]+)\n([\d,]+)\n([\d,]+)\n([\d,]+)\n([\d,]+)\n/d.exec(sheet);
    let costNote = '行政コスト表の令和７年度列が読めないため金額は未収録。';
    if (c) {
      const [A, a, b, s1, s2, s3] = c.slice(1, 7).map(num);
      if (A === a + b && b === s1 + s2 + s3) {
        p.amounts.push(amount(input, 'actual', 2025, c[2], '円', c[2], groupAt(c, 2, start)), amount(input, 'fullCost', 2025, c[1], '円', c[1], groupAt(c, 1, start)));
        costNote = '金額は行政コスト表の令和７年度列のみ（事業費(a)＝決算実績、行政費用【A】＝総コスト、単位：円。A＝a＋b、b＝内訳の合計を検算）。令和５・６年度列は空欄の行で列の対応が確定できないため未収録。';
      } else costNote = '行政コスト表の令和７年度列が検算（行政費用＝事業費＋事業費以外の費用）できないため金額は未収録。';
    }

    // 4.事業の評価: 4観点の評価結果（括弧内に観点名を含む行）と今後の実施方向性。
    for (const aspect of ASPECTS) {
      const r = new RegExp(`\\n【${aspect}】[^\\n]*\\n(?:評価結果\\n)?([^\\n]*（${aspect}[^\\n]*）)\\n`, 'd').exec(sheet);
      if (r) p.ratings.push(rating(input, 'self', `【${aspect}】評価結果`, r[1], null, r[1], groupAt(r, 1, start)));
    }
    const dir = /\n今後の実施方向性\n\n([^\n]+)\n/d.exec(sheet);
    if (dir && DIRECTIONS.has(dir[1])) p.ratings.push(rating(input, 'self', '今後の実施方向性', dir[1], null, dir[1], groupAt(dir, 1, start)));
    p.warnings.push('藤沢市 令和8年度事務事業評価表（令和7年度実施事務事業）。評価年度は表題の令和８年度、評価対象年度は令和７年度。',
      `${costNote}成果・活動指標は実績値と目標値の並びが抽出テキストで確定できないため未収録。所管課は「所管課」欄の直後に課名が読める場合のみ。`);
    out.push(p);
  });
  return out;
}

export const entries: Record<string, Entry> = {
  '14205': { extract: municipal('14205', parse), scope: '藤沢市 令和8年度事務事業評価表（部局別 *-ji.pdf、令和7年度実施事務事業）の各事業: 事業名・所管課・検算できる令和7年度の事業費と行政費用・4観点の評価結果と今後の実施方向性。指標・令和5/6年度のコスト・総合指針重点事業評価表（*-ju.pdf、評価結果や金額の欄がない計画記述）は対象外。' },
};
