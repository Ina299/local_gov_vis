import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, mergeReprints, sheets } from './g1-util';

const HEADING = '平成３０年度実施事業 事務事業評価表（事後評価）';
const LABELS = new Set(['３０年度', '３１年度', '２９年度', '当初予算', '決算', '補正・繰越等']);
const num = (s: string) => Number(s.replaceAll(',', ''));

/** 資源投入量: 11 rows (人工3・コスト4・財源4) x 5 columns. The column after the 「３１年度 当初予算」 label is FY2019 budget;
 * the others keep printed order 29決算 / 30当初予算 / 30補正・繰越等 / 30決算. Accepted only when a printed unit cost confirms a settled column. */
function resources(sheet: string) {
  const anchor = '（単位：円) ④一 般 財 源\n\n人工\n\n';
  const a = sheet.indexOf(anchor);
  if (a < 0) return null;
  const values: string[] = [];
  let pos = a + anchor.length, end = pos, label31: number | null = null, prev = '';
  for (const para of sheet.slice(pos).split('\n\n')) {
    if (/年度実績|年度目標|活動結果|単位/.test(para)) break;
    let lp = pos;
    for (const line of para.split('\n')) {
      if (/^[\d,]+(?:\.\d+)?$/.test(line)) { values.push(line); end = lp + line.length; }
      else if (!LABELS.has(line) && /^[\d,.\-△]+$/.test(line)) return null;
      if (prev === '３１年度' && line === '当初予算') label31 = values.length;
      prev = line; lp += line.length + 1;
    }
    pos += para.length + 2;
  }
  if (values.length !== 55 || label31 === null || label31 % 11 !== 0 || label31 === 55) return null;
  const groups = Array.from({ length: 5 }, (_, i) => values.slice(i * 11, i * 11 + 11));
  for (const g of groups) {
    const v = g.map(num);
    if (Math.abs(v[0] + v[1] - v[2]) > 0.015 || v[3] + v[4] + v[5] !== v[6] || v[7] + v[8] + v[9] + v[10] !== v[4]) return null;
  }
  const i31 = label31 / 11, rest = groups.filter((_, i) => i !== i31);
  const cols = { settled29: rest[0], initial30: rest[1], settled30: rest[3], initial31: groups[i31] };
  // 単位当りコスト = 合計 ÷ 実績値; one printed confirmation of a settled column is required.
  for (const m of sheet.matchAll(/(２９年度実績|３０年度実績)\n([\d,.]+)\n([\d,.]+)\n/g)) {
    const qty = num(m[2]), unit = num(m[3]), total = num((m[1] === '２９年度実績' ? cols.settled29 : cols.settled30)[6]);
    if (qty > 0 && unit > 0 && Math.abs(total / qty - unit) <= Math.max(1, unit * 0.001)) return { cols, end, check: { raw: m[0].trimEnd(), start: m.index! } };
  }
  return null;
}

export function extractKoshigaya(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11222' || input.format !== 'pdf' || !input.text.startsWith(HEADING)) return [];
  const out: ProjectEvaluation[] = [];
  for (const sheet of sheets(input.text, HEADING)) {
    const name = sheet.text.match(/\n事業名 ([^\n]+)\n\n個別評価/), dept = sheet.text.match(/\n部名 ([^\n]+)\n課名 ([^\n]+)\n/), no = sheet.text.match(/^.+\n事業番号： ?(\d+)\n/);
    if (!name || !dept) continue;
    const department = `${dept[1]} ${dept[2]}`;
    const p = project(input, no ? `事業番号${no[1]}` : `${department}:${name[1]}`, name[1], null, name[0].slice(1), sheet.start + name.index! + 1);
    p.department = department; p.evaluatedFiscalYear = 2018;
    p.evidence.push(evidence(input, HEADING, sheet.start), evidence(input, dept[0].slice(1), sheet.start + dept.index! + 1));
    if (no) p.evidence.push(evidence(input, no[0].slice(no[0].indexOf('事業番号')), sheet.start + no.index! + no[0].indexOf('事業番号')));
    const res = resources(sheet.text), s = sheet.text.indexOf('資源投入量');
    if (res && s >= 0 && s < res.end) {
      const { cols, check } = res, raw = sheet.text.slice(s, res.end), rs = sheet.start + s;
      const add = (kind: 'actual' | 'budget' | 'personnel' | 'fullCost', fy: number, v: string) => { if (num(v) !== 0) p.amounts.push(amount(input, kind, fy, v, '円', raw, rs)); };
      add('actual', 2017, cols.settled29[4]); add('personnel', 2017, cols.settled29[3]); add('fullCost', 2017, cols.settled29[6]);
      add('budget', 2018, cols.initial30[4]);
      add('actual', 2018, cols.settled30[4]); add('personnel', 2018, cols.settled30[3]); add('fullCost', 2018, cols.settled30[6]);
      add('budget', 2019, cols.initial31[4]);
      p.evidence.push(evidence(input, check.raw, sheet.start + check.start));
      p.warnings.push('資源投入量の表は11行×5列を読み取り、各列で人工・コスト合計・財源合計の検算が一致し、「３１年度 当初予算」見出し直後の列を31年度当初予算、残りを印字順に29年度決算・30年度当初予算・補正・繰越等・30年度決算とした上で、活動指標の単位当りコスト（29年度実績または30年度実績）と合計÷実績値が一致した場合のみ収録。事業費は②事業費、人件費は①人件費、総コストは合計（①+②+③、減価償却費を含む）。0円の欄は収録していません。当初予算の人件費・合計は収録していません。');
    } else p.warnings.push('資源投入量の表は段組み崩れ・空欄、または単位当りコストとの照合不能により列対応を確定できないため金額を収録していません。');
    const overalls = [...sheet.text.matchAll(/\n([ＡＢＣＤ]（[^）\n]+）)\n/g)], overall = overalls.length === 1 && sheet.text.includes('総合評価') ? overalls[0] : null;
    if (overall) p.ratings.push({ kind: 'self', label: '総合評価', value: overall[1], scale: null, evidence: evidence(input, overall[1], sheet.start + overall.index! + 1) });
    p.warnings.push('表題「平成３０年度実施事業 事務事業評価表（事後評価）」により評価対象年度を2018年度とした。評価実施年度は本文に明記がないため未設定。活動・成果指標は値の列配置が名称と離れて出力されるため未構造化。');
    out.push(p);
  }
  return mergeReprints(out, p => `${p.department}\n${p.projectName}`);
}
