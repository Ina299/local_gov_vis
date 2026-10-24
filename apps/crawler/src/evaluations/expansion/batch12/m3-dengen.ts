/** Batch-12 (m3) extractors for 電源立地地域対策交付金「事業評価総括表／事業評価個表」: 01343 鹿部町, 11383 神川町. */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, nfkc, type Entry } from '../batch9/i1-util';

const GRANT_NOTE = '事務事業評価ではなく電源立地地域対策交付金の事業評価（交付金事業ごとの総括表・個表）。';
const SOURCES: Record<string, Set<string>> = {
  // 鹿部町 R4・R6・R7（R5 は総括表のみで年度が本文にないため、平成28・29年頃の個表のみの様式は年度・列が確定しないため除外）
  '01343': new Set(['69d448e8c9852120915629f3', 'db2abc2ad30bac3c907346c8', 'e0e405f516ed767dde0a4705']),
  // 神川町 平成30年度・令和元年度・令和３年度・令和４年度
  '11383': new Set(['596d2d682868edac9dc30974', 'a3742c80ed3798d925290cae', 'd784f5f0ecfacd72387dd21b', 'fde9105b3ab0c49c8a2bae67']),
};
const TOWN: Record<string, string> = { '01343': '鹿部町', '11383': '神川町' };
const SUMMARY = 'Ⅰ．事業評価総括表';
const era = (g: string, n: string) => (g === '平成' ? 1988 : 2018) + (n === '元' ? 1 : Number(nfkc(n)));

function dengen(input: CachedInput): ProjectEvaluation[] {
  const code = input.municipalityCode, town = TOWN[code];
  if (!town || !SOURCES[code]?.has(input.sourceId)) return [];
  const t = input.text, starts = [...t.matchAll(new RegExp(SUMMARY, 'g'))].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const block = t.slice(s, starts[k + 1] ?? t.length), split = block.indexOf('Ⅱ．事業評価個表');
    if (split < 0 || block.indexOf('Ⅱ．事業評価個表', split + 1) >= 0) return;
    const summary = block.slice(0, split), sheet = block.slice(split);
    // Fiscal year: printed on the 総括表 heading (神川町) or the 個表 heading (鹿部町); both must agree when both are printed.
    const y1 = /^Ⅰ．事業評価総括表（(平成|令和)([0-9０-９]+|元)年度）/.exec(summary), y2 = /^Ⅱ．事業評価個表（(平成|令和)([0-9０-９]+|元)年度）/.exec(sheet);
    const years = [y1, y2].filter(Boolean).map(m => era(m![1], m![2]));
    if (!years.length || years.some(y => y !== years[0])) return;
    const fy = years[0];
    // Name: the 総括表 cell printed right before the 事業者名 cell (鹿部町) or before the town and the two amount cells (神川町).
    // Otherwise the cell right before the town, accepted only when the 個表 prints it as its own line after the number 1.
    const name = new RegExp(`交付金事業の名称\\n\\n([^\\n]+)\\n\\n交付金事業者名`).exec(summary) ?? new RegExp(`\\n\\n([^\\n]+)\\n\\n${town}\\n\\n[\\d,]+\\n\\n`).exec(summary)
      ?? [new RegExp(`\\n\\n([^\\n]+)\\n\\n${town}\\n\\n`).exec(summary)].find(m => m && sheet.includes(`\n1\n${m[1]}\n`)) ?? null;
    if (!name || !nfkc(sheet).includes(nfkc(name[1])) || /措置|交付金/.test(name[1])) return;
    const nameAt = s + name.index + name[0].indexOf(name[1]);
    const p = project(input, nfkc(name[1]), name[1], null, name[1], nameAt);
    p.projectCode = null;
    p.evaluatedFiscalYear = fy;
    const yh = y2 ?? y1!;
    p.evidence.push(evidence(input, yh[0], y2 ? s + split : s));
    const dept = /\n交付金事業の担当課室\n([^\n]+)\n/.exec(sheet);
    if (dept && !dept[1].startsWith('交付金')) {
      p.department = dept[1];
      p.evidence.push(evidence(input, dept[0].trim(), s + split + dept.index + 1));
    }
    // 総括表 row: 事業者名, 交付金事業に要した経費, 交付金充当額 (単位：円) printed in this order.
    const row = new RegExp(`\\n\\n${town}\\n\\n([\\d,]+)\\n\\n([\\d,]+)\\n\\n`).exec(summary);
    if (row && summary.includes('（単位：円）')) {
      const raw = row[0].trim(), at = s + row.index + 2;
      p.amounts.push(amount(input, 'actual', fy, row[1], '円', raw, at));
      p.warnings.push('金額は事業評価総括表の「交付金事業に要した経費」（円）。「交付金充当額」と備考の総事業費は種別が異なるため未収録。');
    }
    p.warnings.push(GRANT_NOTE, '成果指標・活動指標は個表の抽出テキストで目標値・実績値・単位の並びが崩れるため未収録。評価年度は本文に明記がないため未設定（評価対象年度は表題の年度）。');
    out.push(p);
  });
  return out;
}

const SCOPE = '電源立地地域対策交付金の事業評価総括表・個表の交付金事業ごとの事業名・担当課室・評価対象年度・総括表の「交付金事業に要した経費」（円）。交付金の効果検証であり事務事業評価ではない。成果指標・活動指標（列が崩れる）、年度が本文にない資料は対象外。';
export const dengenEntries: Record<string, Entry> = {
  '01343': { extract: input => dengen(input), scope: `鹿部町 令和4・6・7年度の${SCOPE}` },
  '11383': { extract: input => dengen(input), scope: `神川町 平成30年度〜令和4年度の${SCOPE}` },
};
