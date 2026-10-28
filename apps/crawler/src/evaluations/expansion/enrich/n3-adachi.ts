/** 足立区 (13121): 令和8年度 個別施策評価調書（令和7年度事業実施分）の「施策の手段として位置付けられる事務事業の評価結果」表。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

const num = (s: string) => Number(s.replaceAll(',', '').replace('△', '-'));
const HEAD = /令和８年度行政評価\n個別施策評価調書\n（令和７年度事業実施分）/;
const TABLE = /3\)施?施策の手段として位置付けられる事務事業の評価結果\n/g;
const ROW = /\n(\d{3,6}) ([^\n]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+) (拡充|改善・変更|現状維持|縮小|統合による終了|休止・終了)\n\n([^\n]+)\n\n([ＡＢＣＤ])(?=\n)/g;

/**
 * 施策の「投入コスト」表（単位:千円）: 令和4〜7年度の 事業費・人件費・総事業費・前年比 の16個の数値が段組みにかかわらずこの順に並ぶ。
 * 各年度で事業費＋人件費＝総事業費となる場合だけ、令和7年度の3値を返す。
 */
function policyCost(t: string, at: number): { values: number[]; raw: string; start: number } | null {
  const start = t.lastIndexOf('\n3 投入コスト\n', at);
  const end = t.indexOf('単位:千円', start);
  if (start < 0 || end < 0 || end > at) return null;
  const raw = t.slice(start + 1, end + '単位:千円'.length);
  if (!/令和4年度\n\n令和5年度\n\n令和6年度\n\n令和7年度/.test(raw)) return null;
  const nums = [...raw.matchAll(/\n\n(△?[\d,]+)(?=\n)/g)].map(m => num(m[1]));
  if (nums.length < 16 || ![0, 1, 2, 3].every(y => nums[y] + nums[4 + y] === nums[8 + y] && (y === 0 || nums[8 + y] - nums[7 + y] === nums[12 + y]))) return null;
  return { values: [nums[3], nums[7], nums[11]], raw, start: start + 1 };
}

/**
 * 各行（事務事業コード・名称・事業費・人件費・総事業費・課長評価・担当課・施策への貢献度）が1行ずつ読めるものだけを採る。
 * 表の単位・年度は、表の合計値（事業費・人件費・総事業費）が同じ施策の投入コスト表の令和7年度の値として表中に現れることで確認し、
 * 各行は事業費＋人件費＝総事業費を満たすものだけ。事業費は決算・予算の別が表にないため取らず、人件費・総事業費のみ。
 */
export function extractAdachiPolicyTables(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13121') return [];
  const t = input.text, head = t.match(HEAD);
  if (!head) return [];
  const out: ProjectEvaluation[] = [];
  const tables = [...t.matchAll(TABLE)];
  tables.forEach((tm, k) => {
    const from = tm.index!, stop = t.indexOf('5 庁内評価委員会', from);
    const to = Math.min(stop < 0 ? t.length : stop, tables[k + 1]?.index ?? t.length);
    const seg = t.slice(from, to);
    const cost = policyCost(t, from);
    if (!cost || !cost.values.every(v => seg.includes(`\n${v.toLocaleString('en-US')}\n`))) return;
    const costEv = evidence(input, cost.raw, cost.start);
    for (const r of seg.matchAll(ROW)) {
      if (num(r[3]) + num(r[4]) !== num(r[5])) continue;
      const p = project(input, r[1], r[2], 2026, r[0].slice(1), from + r.index! + 1);
      p.projectCode = r[1]; p.department = r[7]; p.evaluatedFiscalYear = 2025;
      const ev = p.evidence[0];
      p.evidence.push(evidence(input, head[0], head.index!), costEv);
      p.amounts.push({ kind: 'personnel', fiscalYear: 2025, amountYen: num(r[4]) * 1000, rawValue: r[4], rawUnit: '千円（人件費）', evidence: ev });
      p.amounts.push({ kind: 'fullCost', fiscalYear: 2025, amountYen: num(r[5]) * 1000, rawValue: r[5], rawUnit: '千円（総事業費＝事業費＋人件費）', evidence: ev });
      p.ratings.push({ kind: 'self', label: '総合評価(課長評価) 今後の方針', value: r[6], scale: '拡充 / 改善・変更 / 現状維持 / 縮小 / 統合による終了 / 休止・終了', evidence: ev });
      p.ratings.push({ kind: 'self', label: '施策への貢献度', value: r[8], scale: null, evidence: ev });
      p.warnings.push('個別施策評価調書の事務事業評価結果表の行から、令和7年度の人件費・総事業費（千円）、課長評価、施策への貢献度を取得。単位・年度は表の合計値が施策の投入コスト表（単位:千円）の令和7年度の値と一致することで確認。事業費は決算・予算の別が表に明記されないため未取得。');
      out.push(p);
    }
  });
  return out;
}
