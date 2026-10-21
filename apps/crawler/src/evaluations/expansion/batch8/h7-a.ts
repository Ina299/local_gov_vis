import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, ascii, dedupe, eraYear, num } from '../batch7/g7-util';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

const NUM_LINE = /^([\d,]+(?:\.\d)?)(?: 百万円)?$/;
const lineAt = (t: string, re: RegExp, from: number, to: number) => {
  const out: { value: string; start: number; raw: string }[] = [];
  let pos = from;
  for (const line of t.slice(from, to).split('\n')) {
    const m = line.match(re);
    if (m) out.push({ value: m[1], start: pos, raw: line });
    pos += line.length + 1;
  }
  return out;
};

/** 和泉市教育委員会の点検・評価報告書（令和4〜7年度版）: 取組項目ごとの点検・評価シート先頭（事業名・予算額・決算額）。 */
const IZUMI = new Set(['61db7ed8185e46b9532c76d2', '740585de24be5fc6a86b99c7', '9d6798e7be9f4a314cb9b13b', '83b3b780070b5c2eda8db897']);
const IZUMI_STOP = new Set(['点検・評価の流れ', '和泉市教育大綱', '和泉市教育振興基本計画', '点検・評価報告書', '点検・評価シート', '参考資料', '教育委員会の活動状況', '和泉市教育委員会評価委員会規則']);
const DEPT = /^(?:教育・こども部|生涯学習部|教育部)/;

function extractIzumi(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '27219' || !IZUMI.has(input.sourceId)) return [];
  const t = input.text;
  const title = t.match(/^(令和)([０-９\d]+)年度\n和泉市教育委員会の点検・評価報告書\n（(令和)([０-９\d]+)年度事業対象）/);
  if (!title) return [];
  const year = eraYear(title[1], title[2]), fy = eraYear(title[3], title[4]);
  const tocStart = t.indexOf('目\n\n次'), tocEnd = t.indexOf('点検・評価の流れ\n\n●');
  if (tocStart < 0 || tocEnd < tocStart) return [];
  const names = new Set(t.slice(tocStart, tocEnd).split('\n')
    .map(l => l.replace(/^[０-９\d]+ +/, '').replace(/ *・・・.*$/, '').trim())
    .filter(l => l.length >= 3 && !/・・・|^[０-９\d\sⅠ-Ⅴ]+$/.test(l) && !IZUMI_STOP.has(l)));
  const heads = [...t.matchAll(/取組項目番号/g)].map(m => m.index!).filter(i => i > tocEnd);
  const out: ProjectEvaluation[] = [];
  for (let k = 0; k < heads.length; k++) {
    const start = heads[k], next = heads[k + 1] ?? t.length;
    // Sheet head ends at the 差異 footnote (令和5年度版〜) or the 主な取組内容 column (令和4年度版).
    const ends = [t.indexOf('※予算額と決算額の差', start), t.indexOf('年度の主な取組内容', start)].filter(i => i >= 0);
    const note = ends.length ? Math.min(...ends) : -1;
    if (note < 0 || note > next) continue;
    const head = t.slice(start, note);
    const bIdx = head.indexOf('予算額'), aIdx = head.indexOf('決算額');
    if (bIdx < 0 || aIdx < 0) continue;
    // Name: the one TOC title that appears as its own line (or as 「事業名 X」) in the sheet head.
    const found = lineAt(t, /^(?:事業名 )?(.+)$/, start, note).filter(l => names.has(l.value));
    if (new Set(found.map(f => f.value)).size !== 1) continue;
    const name = found[0].value;
    const raw = head.trimEnd();
    const p = project(input, `${fy}:${name}`, name, year, raw, start);
    p.projectCode = null;
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, title[0], 0));
    const dept = head.match(/担当課 ([^\n]+)|担当課\n\n([^\n]+)\n\n/), deptText = dept?.[1] ?? dept?.[2];
    if (deptText && DEPT.test(deptText)) p.department = deptText;
    // Three bare numbers in order: 取組項目番号, 予算額, 決算額 (百万円), each after its label.
    const nums = lineAt(t, NUM_LINE, start, note);
    // A rounded 0 百万円 is not a usable amount.
    const ok = nums.length === 3 && num(nums[0].value) <= 40 && nums[1].start - start > bIdx && nums[2].start - start > aIdx
      && num(nums[1].value) > 0 && num(nums[2].value) > 0;
    let amountsOk = ok;
    if (ok) {
      const sheetEnd = Math.min(next, t.length);
      const diff = t.slice(note, sheetEnd).match(/予算額と決算額の差異（([\d,]+)百万円）/);
      if (diff && Math.abs(num(nums[1].value) - num(nums[2].value)) !== num(diff[1])) amountsOk = false;
      if (diff && amountsOk) p.evidence.push(evidence(input, diff[0], note + t.slice(note, sheetEnd).indexOf(diff[0])));
    }
    if (amountsOk) {
      p.amounts.push(amount(input, 'budget', fy, nums[1].value, '千円', nums[1].raw, nums[1].start));
      p.amounts.push(amount(input, 'actual', fy, nums[2].value, '千円', nums[2].raw, nums[2].start));
      // amount() only knows 円/千円; restate the 百万円 values exactly.
      for (const a of p.amounts) { a.rawUnit = '百万円'; a.amountYen = num(a.rawValue) * 1_000_000; }
    }
    p.warnings.push(`教育委員会の点検・評価報告書（${ascii(title[0].split('\n')[0])}、${fy}年度事業対象）の取組項目シート。取組項目は複数の事務事業を束ねた単位で、原典の一評価単位のまま記録。事業名は目次の項目名と一致する行のみ採用。`);
    p.warnings.push(amountsOk
      ? '予算額・決算額は原文の百万円単位（四捨五入済みの概数）をそのまま円換算。シート先頭の数値が項目番号・予算額・決算額の3つだけで、ラベル順に並ぶ場合のみ採用し、差異注記があれば差額と照合済み。'
      : '予算額・決算額は段組み崩れで列対応が確定できないため未収録。');
    p.warnings.push('達成目標・達成度（S〜D）・評価委員の意見は列が混在するため未収録。');
    out.push(p);
  }
  return dedupe(out, p => p.projectName);
}

/** 網走市 令和６年度 主要施策の成果等報告書: 事業別シート（事業名・担当部署・予算現額・決算額）。 */
function extractAbashiri(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== 'e03f935dbbbe7a07d9466f39') return [];
  const t = input.text;
  const title = t.match(/^令和６年度\n主要施策の成果等報告書\n※ 各分野の主な事務事業の成果を、総合計画の体系ごとに掲載しています。/);
  if (!title) return [];
  const first = t.indexOf('事業名：');
  if (first < 0) return [];
  // Index of 主な事業 (before the first sheet); sheet names must equal one of these lines.
  const names = new Set(t.slice(0, first).split('\n').map(l => l.trim().replace(/^\S+係 /, ''))
    .filter(l => /(事業|補助金|負担金|費)(（\d事業）|\(\d事業\))?$/.test(l) && !/特別会計$/.test(l)));
  const anchors = [...t.matchAll(/予算現額/g)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  let prevEnd = first;
  for (const a of anchors) {
    const endM = /\n意? ?図\n/g; endM.lastIndex = a;
    const e = endM.exec(t);
    if (!e) continue;
    const end = e.index + e[0].length;
    const lo = prevEnd;
    prevEnd = end;
    // Name: index-listed lines between the previous sheet's 意図 and the far end of this sheet's money block.
    const found = lineAt(t, /^(.+?)(?: 担当部署：.*)?$/, lo, end).filter(l => names.has(l.value.trim()));
    if (new Set(found.map(f => f.value.trim())).size !== 1) continue;
    const name = found[0].value.trim();
    const nums = lineAt(t, /^([\d,]+)$/, a, end);
    const dept = [...t.slice(lo, end).matchAll(/担当部署： (\S+)/g)];
    const p = project(input, name, name, null, t.slice(found[0].start, found[0].start + found[0].raw.length), found[0].start);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, title[0], 0));
    if (dept.length === 1) p.department = dept[0][1];
    const yr = /\nR6\n/.test(t.slice(lo, end));
    const rest = nums.slice(2).reduce((s, n) => s + num(n.value), 0);
    const ok = yr && nums.length >= 3 && rest === num(nums[1].value);
    if (ok) {
      p.amounts.push(amount(input, 'budget', 2024, nums[0].value, '千円', nums[0].raw, nums[0].start));
      p.amounts.push(amount(input, 'actual', 2024, nums[1].value, '千円', nums[1].raw, nums[1].start));
    }
    p.warnings.push('主要施策の成果等報告書（決算時の議会提出書類）の事業別シート。評価段階・指標の欄はなく、今後の方向性は記述式のため ratings なし。評価年度の表記がないため evaluationYear は未設定、対象年度は表題・年度欄（R6）から2024。');
    p.warnings.push(ok
      ? '予算現額・決算額（千円）は、シート内の数値が「予算現額・決算額・財源内訳」の順に並び財源内訳の合計が決算額と一致する場合のみ採用。'
      : '予算現額・決算額は財源内訳との合計照合ができない（段組み崩れ・決算額0円等）ため未収録。');
    out.push(p);
  }
  return dedupe(out, p => p.projectName);
}

export const entries: Record<string, Entry> = {
  '27219': { extract: extractIzumi, scope: '和泉市教育委員会の点検・評価報告書（令和4〜7年度版）の取組項目別シート先頭（事業名・予算額・決算額〔百万円〕、項目番号・予算・決算の3数値がラベル順に並ぶもののみ）。達成目標・達成度・評価委員意見・案内ページは対象外' },
  '01211': { extract: extractAbashiri, scope: '令和6年度網走市主要施策の成果等報告書の事業別シート（事業名・担当部署・予算現額・決算額〔千円、財源内訳の合計が決算額と一致するもののみ〕）。特別会計・記述欄・総合計画の進行管理ページは対象外' },
};
