/**
 * 安芸高田市 平成25年度 事務事業評価シート（公開済みレコードの元と同じ個票）の「事務事業実施にかかるコストと業績（Do）」から、
 * 人件費と合計（直接事業費＋人件費）を構造化する。24・25・26年度の列は決算・予算の別が明示されないため直接事業費は収録せず、
 * 人件費（personnel）と合計（fullCost）を、直接事業費＋人件費＝合計 かつ 国県補助金等＋受益者負担＋一般財源等＝合計 が
 * 成り立つ列に限り記録する。
 */
import type { EvaluationAmount, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, stableId } from '../shared';
import { extractAkitakata } from '../akitakata';
import type { Entry } from '../batch9/i1-util';

const N = '(\\d{1,3}(?:,\\d{3})*)';
const row = (a: string, b: string) => new RegExp(Array.from({ length: 3 }, () => `${a}(?: ${N})? ${b}(?: ${N})?`).join(' '));
const DIRECT = row('直接事業費', '国県補助金等'), PERSONNEL = row('人件費', '受益者負担'), TOTAL = row('合計', '一般財源等');
const HEAD = /\n24年度 25年度 26年度 事業単位当たり/, UNIT = 'コスト コスト（千円） 財源（千円） コスト（千円） 財源（千円） コスト（千円） 財源（千円）';
const YEARS = [2012, 2013, 2014];
const value = (s: string | undefined) => (s === undefined ? 0 : Number(s.replace(/,/g, '')));

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '34214') return [];
  const out: ProjectEvaluation[] = [];
  for (const sheet of extractAkitakata(input)) {
    const pos = /^extracted-text:chars:(\d+)-(\d+)$/.exec(sheet.evidence[0].cell ?? '');
    if (!pos) continue;
    const start = Number(pos[1]), seg = input.text.slice(start, Number(pos[2]));
    const head = HEAD.exec(seg), unit = seg.indexOf(UNIT);
    const d = DIRECT.exec(seg), p = PERSONNEL.exec(seg), t = TOTAL.exec(seg);
    if (!head || unit < 0 || !d || !p || !t || !(head.index < unit && unit < d.index && d.index < p.index && p.index < t.index)) continue;
    const amounts: EvaluationAmount[] = [];
    YEARS.forEach((fiscalYear, c) => {
      const [direct, grant] = [d[2 * c + 1], d[2 * c + 2]], [personnel, fee] = [p[2 * c + 1], p[2 * c + 2]], [total, general] = [t[2 * c + 1], t[2 * c + 2]];
      if (!direct || !personnel || !total || value(personnel) === 0) return;
      if (value(direct) + value(personnel) !== value(total) || value(grant) + value(fee) + value(general) !== value(total)) return;
      const amt = (kind: EvaluationAmount['kind'], raw: string, m: RegExpExecArray): EvaluationAmount =>
        ({ kind, fiscalYear, amountYen: value(raw) * 1000, rawValue: raw, rawUnit: '千円', evidence: evidence(input, m[0], start + m.index) });
      amounts.push(amt('personnel', personnel, p), amt('fullCost', total, t));
    });
    if (!amounts.length) continue;
    // A different identity from the published record built from the same sheet, so the runner treats it as a sheet to match.
    const record: ProjectEvaluation = { ...sheet, id: stableId(input, `enrich:${sheet.projectCode}`, sheet.evaluationYear), indicators: [], ratings: [], amounts,
      evidence: [sheet.evidence[0], evidence(input, head[0].slice(1), start + head.index + 1), evidence(input, UNIT, start + unit)],
      warnings: [sheet.warnings[0], '費用表の24・25・26年度（平成）の列は決算・予算の別が明示されないため、直接事業費は収録せず、人件費（personnel）と合計＝直接事業費＋人件費（fullCost）のみ記録。各列で 直接事業費＋人件費＝合計、国県補助金等＋受益者負担＋一般財源等＝合計 が成り立ち人件費の記載がある列に限る（千円）。'] };
    out.push(record);
  }
  return out;
}

export const akitakataEntry: Entry = {
  extract,
  scope: '安芸高田市 平成25年度 事務事業評価シートのコスト表から、人件費と合計（直接事業費＋人件費、千円）を、内訳と合計が一致する列に限り構造化（公開済みレコードの補強用）。決算・予算の別が明示されない直接事業費、指標・チェック項目は対象外。',
};
