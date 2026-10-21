import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { type Extract, amount, municipality, num } from './g6-util';

const SHEET = '令和７年度 事務事業評価表';
const NAME = /事務事業名\n事業期間\n(?:対象\n対象数\n根拠法令等\n事業概要\n)?\n*(?:（令和６年度実施事務事業）\n\n)?([^\n]+)(?=\n(?:(?:平成|令和|昭和)\S*年|～|\n対象\n|所管課\n))/;
const DEPT = /(課|室|センタ―|事務所|館|担当|ほか\S課)$/;
const ASPECTS = ['必要性', '公平性', '有効性', '効率性'] as const;
const DIRECTIONS = new Set(['現状のまま継続', '一部見直して継続', '拡大・拡充して継続', '縮小して継続', '事業完了', '休止・廃止']);

/** 藤沢市 令和7年度事務事業評価表（令和6年度実施事務事業、部局別 *-ji.pdf）: one record per sheet. */
function parse(input: CachedInput): ProjectEvaluation[] {
  if (!/[-_]ji\.pdf$/.test(input.sourceUrl)) return [];
  const out: ProjectEvaluation[] = [], starts = [...input.text.matchAll(new RegExp(SHEET, 'g'))].map(m => m.index!);
  starts.forEach((start, i) => {
    const sheet = input.text.slice(start, starts[i + 1] ?? input.text.length);
    if (!sheet.includes('（令和６年度実施事務事業）')) return;
    const n = NAME.exec(sheet);
    if (!n || /^(対象|所管課|単位|～)/.test(n[1])) return;
    const p = project(input, n[1], n[1], 2025, n[0], start + n.index);
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, `${SHEET}\n`, start));
    // 所管課: 「(旧所管課）」の後、空行・「～」・「単位」・数値を飛ばした最初の行が課名で終わる場合だけ。
    const d = /\(旧所管課）\n((?:(?:|～|単位|[\d,]+)\n)*)([^\n]+)\n/.exec(sheet);
    if (d && DEPT.test(d[2]) && !d[2].startsWith('(')) { p.department = d[2]; p.evidence.push(evidence(input, d[0].replace(/\n$/, ''), start + d.index)); }

    // 3.行政コスト 令和６年度列（行政費用A・事業費a・事業費以外b・職員給与費・賞与等・減価償却費等 …）。A=a+b と b=内訳合計で検算できる場合だけ。
    const c = /\(単位：円\)\n対象1単位あたり費用\n令和６年度\n([\d,]+)\n([\d,]+)\n([\d,]+)\n([\d,]+)\n([\d,]+)\n([\d,]+)\n/.exec(sheet);
    if (c) {
      const [A, a, b, s1, s2, s3] = c.slice(1, 7).map(num);
      if (A === a + b && b === s1 + s2 + s3) {
        p.amounts.push(amount(input, 'actual', 2024, c[2], '円', c[0].replace(/\n$/, ''), start + c.index), amount(input, 'fullCost', 2024, c[1], '円', c[0].replace(/\n$/, ''), start + c.index));
      } else p.warnings.push('行政コスト表の令和６年度列が検算（行政費用＝事業費＋事業費以外の費用）できないため金額は未採用。');
    }

    // 4.事業の評価: 4観点の評価結果（括弧内に観点名を含む行だけ）と今後の実施方向性。
    const r = /評価結果\n([^\n]*（必要性[^\n]*）)\n([^\n]*（公平性[^\n]*）)\n([^\n]*（有効性[^\n]*）)\n([^\n]*（効率性[^\n]*）)/.exec(sheet);
    if (r) ASPECTS.forEach((aspect, k) => p.ratings.push({ kind: 'self', label: `【${aspect}】評価結果`, value: r[k + 1], scale: null, evidence: evidence(input, r[0], start + r.index) }));
    const dir = /今後の実施方向性\n\n([^\n]+)/.exec(sheet);
    if (dir && DIRECTIONS.has(dir[1])) p.ratings.push({ kind: 'self', label: '今後の実施方向性', value: dir[1], scale: null, evidence: evidence(input, dir[0], start + dir.index) });

    // 2.事業の成果: 先頭の指標が「指標名・単位・R4・R5・R6・目標値・達成率・区分」の順で1行ずつ並ぶ場合だけ。
    const ind = /達成率\n([^\n]+)\n([^\n\d]+)\n([\d,.]+)\n([\d,.]+)\n([\d,.]+)\n([\d,.]+)\n([\d.]+%)\n(活動|成果)\n指標/.exec(sheet);
    if (ind && !/^(指標|\(|区分|単位)/.test(ind[1])) {
      const name = ind[1], ev = () => evidence(input, ind[0], start + ind.index);
      [2022, 2023, 2024].forEach((y, k) => p.indicators.push({ name, fiscalYear: y, target: null, actual: ind[k + 3], unit: ind[2], evidence: ev() }));
      p.indicators.push({ name, fiscalYear: null, target: ind[6], actual: null, unit: ind[2], evidence: ev() });
    }
    p.warnings.push('藤沢市 令和7年度事務事業評価表（令和6年度実施事務事業）。',
      '金額は行政コスト表の令和６年度列のみ（事業費＝実績、行政費用＝総コスト、単位：円）。令和４・５年度列は抽出テキストで内訳行との対応が確定できないため未採用。',
      '指標は先頭の1指標のみ。目標値の年度は表に明示がないため年度なしで記録。2番目以降の指標は列の並びが崩れているため未構造化。');
    out.push(p);
  });
  return out;
}

export const entries: Record<string, { extract: Extract; scope: string }> = {
  '14205': { extract: municipality('14205', parse), scope: '藤沢市 令和7年度事務事業評価表（部局別 *-ji.pdf、令和6年度実施事業）の各事業: 事業名・所管課・令和6年度の事業費と行政費用（検算できる場合）・4観点の評価結果と今後の実施方向性・先頭の成果/活動指標。総合指針重点事業評価表（*-ju.pdf）・資料リスト・一覧ページは対象外。' },
};
