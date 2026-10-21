import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, project } from '../shared';
import { type Extract, amount, municipality, num } from './g6-util';

/** 朝霞市 事務事業評価シート（対象：R7年度実施事務事業）。施策評価シートの資料は対象外。 */
const SHEETS = new Set(['55a2e24904aca55f509d8226', '6b3d0da78afc8f95f0eb8744', '75fc28a0179e98da19d37f4e', '88b2cdebcd7dc33cc82cdedb', '962d5f4499bc37134e63c695', 'ec3ea71e361e56ed697705f9']);
const HEAD = /事務事業評価シート（対象：R7年度実施事務事業）\n\n([^\n]+)\n部名\/課名\/係名\n\n([^\n]+)\n\n／ ([^\n]+)\n/g;
/** 既存の構造化レコード（施策評価シートの事業費行、同じ R7 年度）と同名の事業。 */
const EXCLUDED = [
  '国民保護計画推進事業', '災害活動事業', '防災対策事業', '地域防災推進事業', '消防水利整備事業', '朝霞地区一部事務組合負担事業（常備消防）', '消防団運営事業', '消防団活動事業', '消防団施設等整備事業', '防犯対策推進事業', '消費生活啓発事業', '消費生活相談事業', '市民葬事業', '斎場管理運営事業',
];
const fmt = (n: number) => n.toLocaleString('en-US');

function parse(input: CachedInput): ProjectEvaluation[] {
  if (!SHEETS.has(input.sourceId)) return [];
  const text = input.text, heads = [...text.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  heads.forEach((m, k) => {
    const start = m.index!, end = k + 1 < heads.length ? heads[k + 1].index! : text.length, seg = text.slice(start, end);
    const name = m[1].trim();
    const p = project(input, name, name, null, m[0], start);
    p.projectCode = null; p.department = m[3].split(' ／ ')[0].trim(); p.evaluatedFiscalYear = 2025;
    // 総コスト表: R5・R6 は数値のみ、R7 は「千円」付きの見込み値。R5・R6 の人件費と総計（事業費＋人件費）が検算できるときだけ採用。
    const c0 = seg.indexOf('総コスト（事業費＋人件費）と事業費の内訳'), c1 = seg.indexOf('※事業費は千円未満切り捨て', c0);
    if (c0 >= 0 && c1 > c0) {
      const block = seg.slice(c0, c1 + '※事業費は千円未満切り捨て'.length);
      const cost = block.match(/\n事業費\n\n([\d,]+)\n\n([\d,]+)\n/), staff = block.match(/\n人件費\n\n([\d,]+)\n\n([\d,]+)\n/);
      if (block.includes('\nR5\n') && block.includes('\nR6\n') && cost && staff) {
        const t5 = num(cost[1]) + num(staff[1]), t6 = num(cost[2]) + num(staff[2]);
        if (block.includes(`\n${fmt(t5)}\n\n${fmt(t6)}\n`)) {
          const at = start + c0;
          p.amounts.push(amount(input, 'personnel', 2023, staff[1], '千円', block, at), amount(input, 'personnel', 2024, staff[2], '千円', block, at),
            amount(input, 'fullCost', 2023, fmt(t5), '千円', block, at), amount(input, 'fullCost', 2024, fmt(t6), '千円', block, at));
        }
      }
    }
    p.warnings.push('朝霞市事務事業評価シート（対象：R7年度実施事務事業）。総コスト表は R5・R6・R7(見込み) の3列で、千円単位。R5・R6 列の人件費と総計（事業費＋人件費の検算が一致した場合のみ）を採用。事業費は決算・予算の別が表に明記されていないため金額として載せず、R7 見込み値も載せない。活動・成果指標と総合判定（選択肢の印が抽出テキストに残っていない）は構造化していません。');
    out.push(p);
  });
  return out;
}

export const entries: Record<string, { extract: Extract; scope: string }> = {
  '11227': {
    extract: municipality('11227', parse, EXCLUDED),
    scope: '朝霞市の事務事業評価シート（対象：R7年度実施事務事業）から事業名・担当課と、検算できる R5・R6 の人件費・総コスト（千円）を構造化。事業費・R7見込み・指標・総合判定、施策評価シートは対象外。既存の構造化レコードと同名の事業は除外。',
  },
};
