import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount } from '../batch9/i1-util';
import { type Entry, segments, uniqueBy } from './m1-util';

const byId = (inputs: CachedInput[], id: string) => inputs.find(i => i.sourceId === id);

// ---------------------------------------------------------------- 14150 相模原市 大規模事業評価（令和７年度・津久井総合事務所周辺公共施設再整備事業）
const SAGAMIHARA = { report: '023b4ac8d4226a29b33d6640', policy: 'b134398147411494c174e3f3', plan: 'b3acd15092952740b48ad824' };
const SAGAMIHARA_NAME = '津久井総合事務所周辺公共施設再整備事業';
function extractSagamihara(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '14150' || input.sourceId !== SAGAMIHARA.report) return [];
  const plan = byId(inputs, SAGAMIHARA.plan), policy = byId(inputs, SAGAMIHARA.policy);
  const title = `${SAGAMIHARA_NAME}に係る大規模事業評価について(答申)`, verdict = '本事業を実施することは妥当である。';
  const planHead = '令和７年度 相模原市大規模事業評価の実施に関する方針について', target = `（１）事 業 名：${SAGAMIHARA_NAME}\n（２）事業所管局：緑区役所`;
  const decision = `１ ${SAGAMIHARA_NAME}については、実施する。`;
  if (!plan || !policy || !input.text.includes(title) || !input.text.includes(verdict) || !plan.text.startsWith(planHead) || !plan.text.includes(target) || !policy.text.includes(decision)) return [];
  const p = project(input, SAGAMIHARA_NAME, SAGAMIHARA_NAME, 2025, title);
  p.projectCode = null;
  p.department = '緑区役所';
  p.evidence.push(evidence(plan, planHead, 0), evidence(plan, target), evidence(policy, decision));
  p.ratings.push({ kind: 'external', label: '相模原市大規模事業評価委員会 答申', value: verdict, scale: null, evidence: evidence(input, verdict) },
    { kind: 'self', label: '市の対応方針', value: '実施する', scale: null, evidence: evidence(policy, decision) });
  p.warnings.push('令和７年度 相模原市大規模事業評価（事業着手前の評価）。評価年度は実施方針の「令和７年度」、事業所管局は実施方針の記載による。答申の留意事項・対応方針の留意事項の本文は未収録。',
    '事業費・指標は本資料に記載がない（自己評価調書・市民意見は取得資料に含まれない）。評価対象年度は事前評価のため設定しない。');
  return [p];
}

// ---------------------------------------------------------------- 22304 南伊豆町 物価高騰対応重点支援地方創生臨時交付金活用事業 実績報告書・成果説明書
const MINAMIIZU: Record<string, string> = {
  '5a171dcd7600ae544a4f68dd': '物価高騰対応重点支援地方創生臨時交付金活用事業実績報告書',
  'e7c3d7dc0b09f2e42fa6f046': '物価高騰対応重点支援地方創生臨時交付金活用事業成果説明書',
};
function extractMinamiizu(input: CachedInput): ProjectEvaluation[] {
  const head = MINAMIIZU[input.sourceId];
  if (input.municipalityCode !== '22304' || !head || !input.text.startsWith(head)) return [];
  const out: ProjectEvaluation[] = [];
  for (const s of segments(input.text, new RegExp(head, 'g'))) {
    const m = /\n名\n\n((?:[^\n]+\n){1,2}?)\n/.exec(s.text), no = /事業番号\n+(?:名\n\n(?:[^\n]+\n){1,2}\n)?(\d+)\n/.exec(s.text);
    if (!m || !no) continue;
    const lines = m[1].trimEnd().split('\n');
    const name = lines[0] + (lines[1]?.startsWith('【') ? lines[1] : '');
    const deptLine = lines[1] && !lines[1].startsWith('【') && /課$/.test(lines[1]) ? lines[1] : null;
    const dept = deptLine ?? /所管課等\n\n(?:業\n\n)?([^\n]+課)\n/.exec(s.text)?.[1] ?? null;
    const p = project(input, `事業番号${no[1]}`, name, null, m[1].trimEnd(), s.at + m.index! + 4);
    // Sheet numbers restart in every report, so they are not used as a project code.
    p.projectCode = null;
    p.department = dept;
    p.evidence.push(evidence(input, head, s.at), evidence(input, no[0].trim(), s.at + no.index!));
    if (dept && !deptLine) { const d = /所管課等\n\n(?:業\n\n)?([^\n]+課)\n/.exec(s.text)!; p.evidence.push(evidence(input, d[0].trim(), s.at + d.index!)); }
    p.warnings.push(`南伊豆町 ${head}の事業シート1件。事業名・所管課・事業番号を収録。`,
      '資料に対象年度の明記がないため、決算額（円）・交付金充当額は年度を確定できず未収録。評価年度・評価対象年度も未設定。指標・結果・考察の文章は未収録。');
    out.push(p);
  }
  return uniqueBy(out);
}

// ---------------------------------------------------------------- 29447 野迫川村 令和5年度 物価高騰対応重点支援地方創生臨時交付金事業 実施状況・効果検証
const NOSEGAWA = '1e53423d1460b42df4ec587a';
const NOSEGAWA_HEAD = '令和5年度物価高騰対応重点支援地方創生臨時交付金事業実施状況・効果検証\n\n【野迫川村】';
const NOSEGAWA_ROWS: { raw: string; name: string; dept: string; cost?: string }[] = [
  { raw: '1\n\n住民課\n\n住民税非課税世帯へ\nの給付', name: '住民税非課税世帯への給付', dept: '住民課' },
  { raw: '2\n\n住民課\n\n一体支援枠', name: '一体支援枠', dept: '住民課' },
  { raw: '3\n\n産業課\n\n地域振興券配布事業', name: '地域振興券配布事業', dept: '産業課', cost: '4,877,000\n\n4,877,000\n\n0\n\n0' },
];
function extractNosegawa(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '29447' || input.sourceId !== NOSEGAWA || !input.text.startsWith(NOSEGAWA_HEAD)) return [];
  const t = input.text, total = '合 計\n\n12,957,000\n\n12,957,000\n\n0\n\n0';
  return NOSEGAWA_ROWS.flatMap(r => {
    const at = t.indexOf(`\n${r.raw}\n`);
    if (at < 0 || t.indexOf(`\n${r.raw}\n`, at + 1) >= 0) return [];
    const p = project(input, r.raw.split('\n')[0], r.name, null, r.raw, at + 1);
    p.projectCode = `番号${r.raw.split('\n')[0]}`;
    p.department = r.dept;
    p.evaluatedFiscalYear = 2023;
    p.evidence.push(evidence(input, NOSEGAWA_HEAD, 0));
    if (r.cost) {
      const costAt = t.indexOf(r.cost, at);
      // The row's four cells (実績事業費, 臨時交付金, 国県等補助金等, 村費) follow the description and add up (4,877,000 = 4,877,000 + 0 + 0).
      if (costAt > at && costAt - at < 400 && t.includes(total)) {
        p.amounts.push(amount(input, 'actual', 2023, '4,877,000', '円', r.cost, costAt));
        p.warnings.push('金額は実績事業費（円）。行の直後に実績事業費・臨時交付金・国県等補助金等・村費の4つの値が並び、実績事業費＝内訳の合計となる行のみ収録。');
      }
    }
    if (!p.amounts.length) p.warnings.push('実績事業費・財源内訳は2事業の行の数値が抽出テキストで混在し対応が確定できないため未収録。');
    p.warnings.push('野迫川村 令和5年度 物価高騰対応重点支援地方創生臨時交付金事業 実施状況・効果検証の事業行。事業内容・効果の文章は未収録。評価年度は本文に明示がないため未設定。');
    return [p];
  });
}

// ---------------------------------------------------------------- 43433 南阿蘇村 まち・ひと・しごと創生総合戦略 効果検証結果（1事業のみの報告）
const MINAMIASO: Record<string, { head: string; row: string; name: string; fy: number; dept?: string }> = {
  a0cda8fb2acca601b4a15d91: { head: '「南阿蘇村まち・ひと・しごと創生総合戦略」に係る効果検証結果報告\n「南阿蘇村まち・ひと・しごと創生総合戦略推進委員会」における効果検証会議（令和８年２月６日）の結果について、下記のとおり報告します。',
    row: '番号 年度\n\n1\n\nR6\n\n（単位:千円）\n\n事業名\n\n事業内容\n\n阿蘇立野ダム\n仮設備ヤード\n拠点施設整備\n事業', name: '阿蘇立野ダム仮設備ヤード拠点施設整備事業', fy: 2024, dept: '主幹課\n\n企画観\n光課' },
  dcd319c551c15804182ec971: { head: '「南阿蘇村まち・ひと・しごと創生総合戦略」に係る効果検証報告\n「南阿蘇村まち・ひと・しごと創生総合戦略推進委員会」における効果検証会議について、下記のとおり報告します。',
    row: 'R4\n\n事業名\n\n熊本地震の震\n災遺構等を活\n用した回廊型\nフィールド\nミュージアム\nによる交流人\n口拡大プロ\nジェクト', name: '熊本地震の震災遺構等を活用した回廊型フィールドミュージアムによる交流人口拡大プロジェクト', fy: 2022 },
};
function extractMinamiaso(input: CachedInput): ProjectEvaluation[] {
  const d = MINAMIASO[input.sourceId];
  if (input.municipalityCode !== '43433' || !d || !input.text.startsWith(d.head) || (input.text.match(/\n事業名\n/g) ?? []).length !== 1) return [];
  const at = input.text.indexOf(d.row);
  if (at < 0) return [];
  const p = project(input, d.name, d.name, null, d.row, at);
  p.projectCode = null;
  p.evaluatedFiscalYear = d.fy;
  p.evidence.push(evidence(input, d.head, 0));
  if (d.dept && input.text.split(d.dept).length === 2) { p.department = d.dept.split('\n\n')[1].replace('\n', ''); p.evidence.push(evidence(input, d.dept)); }
  p.warnings.push('南阿蘇村 まち・ひと・しごと創生総合戦略 効果検証報告（1事業のみ掲載の回）。事業名と年度欄の年度（事業実施年度）を収録。',
    '事業費・財源内訳は効果検証時点の予算か決算かが本文で確定しないため、検証結果・今後の方針は2列の文字が抽出テキストで交互に混在しているため、いずれも未収録。複数事業を掲載した回は列の対応が確定しないため対象外。');
  return [p];
}

export const smallEntries: Record<string, Entry> = {
  '14150': {
    extract: (input, inputs) => extractSagamihara(input, inputs),
    scope: '令和７年度 大規模事業評価の答申（津久井総合事務所周辺公共施設再整備事業）から、事業名・事業所管局・委員会答申・市の対応方針を構造化。実施方針・対応方針は根拠としてのみ使用し、留意事項の本文は対象外。',
  },
  '22304': {
    extract: input => extractMinamiizu(input),
    scope: '物価高騰対応重点支援地方創生臨時交付金活用事業の実績報告書・成果説明書の事業シートから、事業名・事業番号・所管課を構造化。対象年度が資料に明記されないため決算額・交付金充当額は対象外。',
  },
  '29447': {
    extract: input => extractNosegawa(input),
    scope: '令和5年度 物価高騰対応重点支援地方創生臨時交付金事業 実施状況・効果検証の事業行から、事業名・所管課と、内訳の合計で行が確定する事業のみ実績事業費（円）を構造化。令和6年度分は同名事業が並び列も混在するため対象外。',
  },
  '43433': {
    extract: input => extractMinamiaso(input),
    scope: 'まち・ひと・しごと創生総合戦略 効果検証報告のうち1事業のみを掲載した回（令和4・6年度事業）から、事業名・事業年度・主幹課を構造化。事業費は予算・決算の別が確定せず、評価欄は列崩れのため対象外。複数事業の回は対象外。',
  },
};
