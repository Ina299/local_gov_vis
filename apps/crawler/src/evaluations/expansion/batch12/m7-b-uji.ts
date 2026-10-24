import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project, stableId } from '../shared';
import { amount, type Entry } from '../batch9/i1-util';
import { municipalityRecords } from '../batch11/k0-util';

// ---------------------------------------------------------------- 26204 宇治市（歳入歳出決算にかかる主要な施策の成果説明書）
// 部門別決算成果概要の事業カード: 所管課／決算額（千円）／目的／事務事業名／事業内容／成果・実績／事業評価（文章）。
/** 第5回取得の成果説明書（平成22〜令和5年度決算のうち13冊。令和4年度版は本文なし）。 */
const UJI_SOURCES = new Set(['275700db02d1c5e3f8c7c6d5', '28c0d50e5b48b40bf9eacf25', '3f9721f1e11db6e90de04055', '4f0f511f50e38acaeb779836',
  '571e65814bc9857bfbe9fcba', '5bcb6ba86491f7e235461874', '5d27ac439b3c9a494b8d4b73', '6e71a62262f94a7978af1452', '7fe926db4a363351cc4564f4',
  '91e74111cc14d6d8600fd6f9', 'a68686f13b17c7f89c360775', 'b1133e5a0dea8947d9f5e056', 'f6e1c5654e7d80d277907a9e']);
const DIGITS = '０１２３４５６７８９';
const TITLE = /^(令和|平成) ?([元\d０-９]+) ?年度\n歳 入 歳 出 決 算 に か か る\n主 ?要な施 ?策の成 ?果説明 ?書\n/;
/** 所管課（1行）・決算額（千円の数値1行）で始まる事業カードの見出し。 */
const HEAD = /^所管課\n([^\n]+)\n決算額\n(([\d,]+) ?千円)\n/gm;
const NAME = /^事務事業名 ([^\n]+)\n\n?事業内容\n/gm;

function fiscalYear(era: string, n: string): number {
  const k = n === '元' ? 1 : Number([...n].map(c => (DIGITS.includes(c) ? DIGITS.indexOf(c) : c)).join(''));
  return (era === '令和' ? 2018 : 1988) + k;
}

function extractUji(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '26204' || !UJI_SOURCES.has(input.sourceId)) return [];
  const t = input.text, title = TITLE.exec(t);
  if (!title) return [];
  const fy = fiscalYear(title[1], title[2]);
  // カード境界は「所管課」で始まる行（見出しが崩れたカードも境界として扱い、名称が2つ入った区間は捨てる）。
  const bounds = [...t.matchAll(/^所管課/gm)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  for (const h of t.matchAll(HEAD)) {
    const start = h.index!, next = bounds.find(b => b > start) ?? t.length;
    const dept = h[1].trim();
    if (dept === '各担当課' || /決算額|事務事業名|所管/.test(dept)) continue; // 各課合算の集計カードは対象外
    const seg = t.slice(start, next), names = [...seg.matchAll(NAME)];
    if (names.length !== 1 || (seg.match(/^事務事業名/gm) ?? []).length !== 1) continue;
    const n = names[0], name = n[1].trim();
    if (!name || /^(事業内容|成果・実績|事業評価)$/.test(name)) continue;
    const nameAt = start + n.index!;
    const p = project(input, name, name, null, n[0].replace(/\n\n?事業内容\n$/, ''), nameAt);
    p.id = stableId(input, `${dept}|${name}`, fy);
    p.projectCode = null;
    p.department = dept;
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, h[0].trimEnd(), start), evidence(input, title[0].trimEnd(), title.index));
    p.amounts.push(amount(input, 'actual', fy, h[3], '千円', h[2], start + h[0].indexOf(h[2])));
    p.warnings.push(`宇治市 ${title[1]}${title[2]}年度 歳入歳出決算にかかる主要な施策の成果説明書の事業カード。カード見出しの「決算額」（千円）を${fy}年度の実績として収録。評価実施年度は本文に明記がないため未設定。「事業評価」欄は文章のみで評語がないため評価区分は未収録（原文は資料を参照）。成果・実績の数値は段組みで項目と値の対応が崩れるため未収録。`);
    out.push(p);
  }
  return out;
}

const ujiAll = (input: CachedInput, inputs: CachedInput[]) =>
  municipalityRecords(input, inputs, extractUji, p => `${p.department}|${p.projectName}|${p.evaluatedFiscalYear}`);

export const ujiEntries: Record<string, Entry> = {
  '26204': { extract: ujiAll, scope: '宇治市 歳入歳出決算にかかる主要な施策の成果説明書（平成22〜令和5年度決算のうち第5回取得の13冊）の部門別事業カードの事務事業名・所管課・決算額（千円、当該決算年度の実績）。見出し（所管課・決算額）や事務事業名の行が崩れたカード、各担当課合算の集計カード、事業評価の文章、成果・実績の数値、決算概要・財政状況の表は対象外。' },
};
