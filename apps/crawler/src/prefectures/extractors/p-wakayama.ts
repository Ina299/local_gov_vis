/**
 * 和歌山県「主要施策の成果」（部課別主要施策の成果、一般会計）。部→課→款項（Ⅰ…）→番号付き事業の順で、
 * 事業ごとに（予算額）（決算額）の2列（単位：千円）が並ぶ。抽出テキストでは事業名の折り返しと金額の列が入り混じるため、
 * 「番号の行／1行で完結した事業名／金額2つ／説明文」が連続し、直前が説明文の終わりまたは見出しである箇所だけを収録する。
 * 部局別に分割されたPDFは同じ内容の再掲のため対象外（一括の「部課別主要施策の成果」から抽出）。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { amount, num, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const N = String.raw`\d{1,3}(?:,\d{3})*`;
const ITEM = new RegExp(String.raw`\n(\d{1,2}|[１-９][０-９]?)\n\n([^\n\d０-９][^\n]{2,38}?(?:事業|経費|費))\n\n(${N})\n\n(${N})\n\n([^\n]+)\n`, 'g');
const TITLE = /令 和 (\d|[０-９])年 度 主要 施 策の 成 果/;
const UNIT = '注）金額の単位：千円';

function extractWakayama(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  const title = TITLE.exec(t.slice(0, 200));
  const unitAt = t.indexOf(UNIT);
  // 一般会計の部課別（一括版）だけ: 目次に「部課別主要施策の成果」があり、知事直轄から警察本部まで含むもの
  if (!title || unitAt < 0 || !t.slice(0, 3000).includes('部課別主要施策の成果') || !t.includes('\n警察本部\n')) return [];
  const fy = 2018 + num(title[1]);
  // 見出し: 部（直後に（予算額））、課（直後の行がⅠ）、款項（ローマ数字の行）
  const bu = [...t.matchAll(/\n([^\s、。（）()]{2,20})\n\n（予算額）\n/g)].map(m => ({ at: m.index! + 1, name: m[1] }));
  const ka = [...t.matchAll(/\n(?:([^\s、。（）()]{2,20}事務局)\n)?([^\s、。（）()・]{2,20}(?:課|室|センター)|警察本部)\nⅠ\n/g)]
    .map(m => ({ at: m.index! + 1, name: m[2], bu: m[1] ?? null, raw: m[0].slice(1, -3) }));
  const roman = [...t.matchAll(/\n[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]\n/g)].map(m => m.index!);
  const carry = [...t.matchAll(/\n（前年度繰越分）\n/g)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  const seen = new Map<string, number>();
  for (const m of t.matchAll(ITEM)) {
    if (m.index! < unitAt) continue;
    const prevLines = t.slice(Math.max(0, m.index! - 400), m.index!).split('\n').map(l => l.trim()).filter(Boolean);
    const before = prevLines.at(-1) ?? '';
    // 直前の行が金額（他事業の列の混入）や事業名の断片なら、名前と金額の対応が確定しない
    const isNum = (s: string) => new RegExp(`^${N}$`).test(s);
    const prevOk = /[。）)]$/.test(before) || /^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]$/.test(before) || before === '（前年度繰越分）' || /^- \d+ -$/.test(before)
      || /費$/.test(before) && /^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]$/.test(prevLines.at(-2) ?? '') // 款項名
      || before.length >= 30 || /^[・〔]/.test(before) || /\d(?:件|人|回|箇所|施設|頭|校)$/.test(before) // 前の事業の説明文・実績
      || isNum(before) && (isNum(prevLines.at(-2) ?? '') || prevLines.at(-2) === '翌年度繰越額'); // 前の事業の金額2列（または繰越額）が完結
    const next = m[5].trim();
    if (!prevOk || new RegExp(`^${N}$`).test(next)) continue;
    if (num(m[4]) > num(m[3])) continue; // 決算額が予算額を上回る並びは列の取り違えの可能性
    const name = m[2].trim(), at = m.index! + 1;
    const k = [...ka].reverse().find(x => x.at < at);
    const b = [...bu].reverse().find(x => x.at < at);
    const lastHead = Math.max(k?.at ?? 0, ...roman.filter(r => r < at));
    const carried = carry.some(c => c > lastHead && c < at);
    const fullName = carried ? `${name}（前年度繰越分）` : name;
    const key = `${k?.at}|${fullName}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
    const raw = m[0].slice(1, m[0].length - 1 - m[5].length - 1);
    const p = project(input, `${k?.name ?? ''}-${fullName}-${seen.get(key)}`, fullName, null, raw, at);
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, title[0], title.index), evidence(input, UNIT, unitAt));
    p.amounts.push(amount(input, 'budget', fy, m[3], '千円', raw, at), amount(input, 'actual', fy, m[4], '千円', raw, at));
    if (k) {
      const buName = k.bu ?? (b && b.at < k.at ? b.name : null);
      p.department = buName ? `${buName} ${k.name}` : k.name;
      p.evidence.push(evidence(input, k.raw, k.at));
      if (!k.bu && b && b.at < k.at) p.evidence.push(evidence(input, b.name, b.at));
    }
    if (carried) p.warnings.push('「（前年度繰越分）」の見出しの下に掲載された事業（前年度からの繰越予算の執行分）。');
    p.warnings.push(`金額は（予算額）（決算額）の2列（単位：千円）。表題「令和${fy - 2018}年度主要施策の成果」により決算年度を${fy}年度とした。抽出テキストで番号・1行の事業名・金額2つ・説明文が連続する事業のみ収録し、事業名が折り返された事業や金額の並びが他事業と混在する事業は未収録。`);
    out.push(p);
  }
  return out;
}

export const entries: Record<string, Entry> = {
  '30000': {
    scope: '令和7年度主要施策の成果（一般会計・部課別主要施策の成果の一括版）の番号付き事業の予算額・決算額（千円）と部・課。事業名が抽出テキストで折り返された事業、金額の並びが他事業と混在して対応が確定しない事業、特別会計、部局別に分割された同内容のPDFは対象外。',
    extract: (input) => extractWakayama(input),
  },
};
