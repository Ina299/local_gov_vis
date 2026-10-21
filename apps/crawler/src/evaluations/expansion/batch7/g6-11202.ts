import type { EvaluationAmount, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { type Extract, amount, eraYear, municipality, num } from './g6-util';

/** 熊谷市 事務事業評価 外部評価の「事業概要説明シート」（平成23年度・24年度実施分）。 */
const SHEETS = new Set(['01560c590f1d087f55b7de02', 'eb4490cdb89b5aac78955de0', '4caa55daa376e7330e9e86a0', '0f628c90801e4368593ecdd3']);
const N = '(-?[\\d,]+)', YEAR = '平成([０-９\\d]+)年度\\((決算|予算)\\)';
const COLUMN = new RegExp(`${YEAR}\\n${Array(7).fill(N).join('\\n')}\\n`, 'g');
/** 年度見出しが k 列並び、続いて事業費・人件費・総額の行が k 個ずつ並ぶ表。 */
const rows = (k: number) => new RegExp(`${Array(k).fill(YEAR).join('\\n')}\\n(?:2 )?コスト\\(千円\\)\\n事業費\\n${Array(k).fill(N).join('\\n')}\\n支\\n人件費\\n${Array(k).fill(N).join('\\n')}\\n出\\n総額\\n${Array(k).fill(N).join('\\n')}\\n`, 'g');
const ROWS = [rows(3), rows(2)];
const INLINE = new RegExp(`${YEAR}\\n(?:2 )?コスト\\(千円\\)\\n事業費\\n${N}\\n支\\n人件費\\n${N}\\n出\\n総額\\n${N}\\n国・県支出金\\n${N}\\n収 市債\\n${N}\\n入 その他特定財源\\n${N}\\n一般財源\\n${N}\\n`, 'g');

/** 決算列は事業費・人件費・総額、予算列は事業費のみ（予算年度の人件費・総額は計画値のため載せない）。 */
function costs(input: CachedInput, era: string, kind: string, cost: string, staff: string, total: string, raw: string, start: number): EvaluationAmount[] {
  const year = eraYear('平成', era);
  if (year === null || num(cost) + num(staff) !== num(total)) return [];
  if (kind === '予算') return [amount(input, 'budget', year, cost, '千円', raw, start)];
  return [amount(input, 'actual', year, cost, '千円', raw, start), amount(input, 'personnel', year, staff, '千円', raw, start), amount(input, 'fullCost', year, total, '千円', raw, start)];
}

function parse(input: CachedInput): ProjectEvaluation[] {
  if (!SHEETS.has(input.sourceId)) return [];
  const text = input.text, out: ProjectEvaluation[] = [];
  const heads = [...text.matchAll(/事務事業名称\n\n([^\n]+)\n\n担当課\n\n([^\n]+)\n|事務事業名称\n担当課\n設置\(実施\)根拠等\n\n([^\n]+)\n([^\n]+)\n/g)];
  heads.forEach((m, k) => {
    const start = m.index!, end = k + 1 < heads.length ? heads[k + 1].index! : text.length, seg = text.slice(start, end);
    const name = (m[1] ?? m[3]).trim(), department = (m[2] ?? m[4]).trim();
    const held = seg.match(/外部評価実施(?:班及び実施)?日\n(?:[^\n]*\n){0,3}?平成 ?([０-９\d]+) ?年\s*[０-９\d]+ ?月 ?[０-９\d]+ ?日/);
    const p = project(input, name, name, held ? eraYear('平成', held[1]) : null, m[0], start);
    p.projectCode = null; p.department = department;
    if (held) p.evidence.push(evidence(input, held[0], start + held.index!));
    const years = new Map<string, EvaluationAmount[]>();
    const add = (list: EvaluationAmount[]) => { for (const a of list) years.set(`${a.kind}:${a.fiscalYear}`, [...(years.get(`${a.kind}:${a.fiscalYear}`) ?? []), a]); };
    for (const c of seg.matchAll(COLUMN)) {
      const v = c.slice(3), at = start + c.index!;
      if (num(v[3]) + num(v[4]) + num(v[5]) + num(v[6]) !== num(v[2])) continue;
      add(costs(input, c[1], c[2], v[0], v[1], v[2], c[0], at));
    }
    for (const [k, re] of [[3, ROWS[0]], [2, ROWS[1]]] as const) for (const c of seg.matchAll(re)) {
      const at = start + c.index!;
      for (let i = 0; i < k; i++) add(costs(input, c[1 + i * 2], c[2 + i * 2], c[2 * k + 1 + i], c[3 * k + 1 + i], c[4 * k + 1 + i], c[0], at));
    }
    for (const c of seg.matchAll(INLINE)) {
      if (num(c[6]) + num(c[7]) + num(c[8]) + num(c[9]) !== num(c[5])) continue;
      add(costs(input, c[1], c[2], c[3], c[4], c[5], c[0], start + c.index!));
    }
    // 同じ年度・種別が複数の読み取りで重なり、値が食い違う場合はその年度・種別を載せない。
    for (const list of years.values()) if (list.every(a => a.amountYen === list[0].amountYen)) p.amounts.push(list[0]);
    p.amounts.sort((a, b) => (a.fiscalYear ?? 0) - (b.fiscalYear ?? 0) || a.kind.localeCompare(b.kind));
    if (p.amounts.length) p.extractionStatus = 'partial';
    p.warnings.push('熊谷市事務事業評価 外部評価の事業概要説明シート。評価年は外部評価実施日の記載年。コストは千円単位で、事業費＋人件費＝総額（列方式は財源合計も）が一致する列だけを採用し、決算列は事業費（actual）・人件費・総額、予算列は事業費（budget）のみ。成果指標・外部評価結果（一覧表は段組み崩れのため）は構造化していません。');
    out.push(p);
  });
  return out;
}

export const entries: Record<string, { extract: Extract; scope: string }> = {
  '11202': {
    extract: municipality('11202', parse),
    scope: '熊谷市事務事業評価外部評価の事業概要説明シート（平成23・24年度、計48事業）から事業名・担当課・外部評価実施年と、合計が検算できる年度別コスト（千円、決算/予算）を構造化。成果指標、外部評価結果一覧、制度概要・会議録・日程表・要綱は対象外。',
  },
};
