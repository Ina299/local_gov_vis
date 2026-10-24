/**
 * Batch-12 (m6-f4) extractors: 22213 掛川市（臨時交付金等活用事業評価の事業別シート）、14382 箱根町（令和６年度 施策別評価シートの
 * 「施策を構成する実施計画事業の評価」表）、45402 新富町（地方創生推進交付金 事業実施報告（様式１））。
 */
import type { EvaluationAmount, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';
import { mergeReprints, num } from '../batch9/i1-util';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

const kanjiDigit = (s: string) => Number(s.normalize('NFKC'));
const reiwa = (s: string) => 2018 + (s === '元' ? 1 : kanjiDigit(s));
const key = (p: ProjectEvaluation) => `${p.projectName}\n${p.evaluatedFiscalYear}`;

// ---------------------------------------------------------------- 22213 掛川市
/** 令和２〜６年度 交付金活用事業評価（資料２）. 外部評価抜粋版（総合計画の施策の方向評価）は対象外。 */
const KAKEGAWA = new Set(['54be8193107649a54d71831d', '54c97639a97d3d38cd238beb', 'f725bf0e514bb0ec25845bcb', 'cbc970535f96eb3a0c4022b7', 'b2da374d594633f77c8aa001']);
const KAKEGAWA_TITLE = /^(?:資料２\n\n)?令和([２-６2-6])年度\n(?:新型コロナウイルス感染症対応|物価高騰重点支援)[^]{0,200}?事業評価\n/;
/** A sheet starts with its list number and the responsible 課; 事業名 is printed before, after or below the name depending on the page layout. */
const DEPT = '([^\\n]{1,40}(?:課|館|局|室))';
const KAKEGAWA_SHEETS: RegExp[] = [
  new RegExp(`(?<=\\n)(\\d{1,2})\\n\\n${DEPT}\\n\\n?事業名\\n\\n((?:[^\\n]+\\n){1,2})\\n`, 'g'),
  new RegExp(`(?<=\\n)(\\d{1,2})\\n\\n${DEPT}\\n\\n?事業名\\n\\n([^\\n]+\\n)(?=[①-④]-)`, 'g'),
  new RegExp(`(?<=\\n)(\\d{1,2})\\n\\n${DEPT}\\n\\n([^\\n]+\\n)\\n事業名\\n`, 'g'),
  new RegExp(`(?<=\\n)(\\d{1,2})\\n\\n${DEPT}\\n\\n?事業名\\n\\n?国の経済対策との関係\\n\\n?目的\\n対象\\n（交付対象者・\\n対象施設等）\\n\\n([^\\n]+\\n)(?=[①-④]-)`, 'g'),
];
const N = '([\\d,]+)';
/** 令和２年度型: label and value alternate (合計 … 一般財源, then the carry-over to the next year). */
const AMOUNT_ALTERNATE = new RegExp(`令和(\\S{1,2})年度 合計\\n${N}\\n国庫支出金\\n${N}\\n財\\n県支出金\\n${N}\\n源\\n地方債\\n${N}\\n内\\nその他\\n${N}\\n訳\\n一般財源\\n${N}\\n令和\\S{1,2}年度 繰越\\n${N}\\n`);
/** 令和３年度型: carry-over from the previous year first, then 合計 … 一般財源. */
const AMOUNT_ALTERNATE_CARRY_FIRST = new RegExp(`令和\\S{1,2}年度 繰越\\n${N}\\n令和(\\S{1,2})年度 合計\\n${N}\\n国庫支出金\\n${N}\\n財\\n県支出金\\n${N}\\n源\\n地方債\\n${N}\\n内\\nその他\\n${N}\\n訳\\n一般財源\\n${N}\\n`);
/** Labels first, then the seven values in label order (合計, 国庫, 県, 地方債, その他, 一般財源, 繰越／前年度事業費分). */
const AMOUNT_STACKED = new RegExp(`令和(\\S{1,2})年度 合計\\n国庫支出金\\n(?:\\(臨時交付金分\\)\\n)?財\\n県支出金\\n源\\n地方債\\n内\\nその他\\n訳\\n一般財源\\n令和\\S{1,2}年度 ?(?:繰越|事業費分)\\n\\n事業費内訳\\n\\n?(?:人工\\n\\n)?${Array(7).fill(N).join('\\n')}\\n`);
const KAKEGAWA_INDICATOR = /成果指標\n([^\n]+)\n\n単位\n\n目標値\n\n実績値\n\n([^\n]+)\n\n([^\n]+)\n\n([^\n]+)\n\n令和/;

function kakegawaAmount(input: CachedInput, sheet: string, at: number, year: number): { amount: EvaluationAmount | null; note: string } {
  const unitMatch = sheet.match(/事業費（(千円|円)）\n/);
  if (!unitMatch) return { amount: null, note: '事業費欄の単位表記が見つからないため事業費は未収録。' };
  const unit = unitMatch[1] as '円' | '千円';
  let m: RegExpMatchArray | null, total: string, parts: string[], carry: string, label: string;
  if ((m = sheet.match(AMOUNT_ALTERNATE))) [label, total, parts, carry] = [m[1], m[2], m.slice(3, 8), m[8]];
  else if ((m = sheet.match(AMOUNT_ALTERNATE_CARRY_FIRST))) [carry, label, total, parts] = [m[1], m[2], m[3], m.slice(4, 9)];
  else if ((m = sheet.match(AMOUNT_STACKED))) [label, total, parts, carry] = [m[1], m[2], m.slice(3, 8), m[8]];
  else return { amount: null, note: '事業費欄の数値と項目名の並びが抽出テキストで崩れているため事業費は未収録。' };
  if (reiwa(label.normalize('NFKC')) !== year) return { amount: null, note: '事業費欄の年度が評価対象年度と一致しないため事業費は未収録。' };
  // Only accept when the financing rows add up to 合計 and nothing was carried over (so 合計 is that year's spending alone).
  if (num(total) !== parts.reduce((s, v) => s + num(v), 0) || num(carry) !== 0)
    return { amount: null, note: '事業費欄の合計と財源内訳の和が一致しない、または繰越額があり年度帰属を確定できないため事業費は未収録。' };
  return {
    amount: { kind: 'actual', fiscalYear: year, amountYen: num(total) * (unit === '千円' ? 1000 : 1), rawValue: total, rawUnit: unit, evidence: evidence(input, m[0], at + m.index!) },
    note: `事業費は事業別シートの「令和${label}年度実績 事業費」の合計（財源内訳の和と一致、繰越額0を確認）。交付金活用事業としての事業費で、市の事業全体の決算額とは限らない。`,
  };
}

function kakegawa(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '22213' || !KAKEGAWA.has(input.sourceId)) return [];
  const t = input.text, title = t.match(KAKEGAWA_TITLE);
  if (!title) return [];
  const year = reiwa(title[1]);
  const heads = KAKEGAWA_SHEETS.flatMap(re => [...t.matchAll(re)]).sort((a, b) => a.index! - b.index!);
  const out: ProjectEvaluation[] = [];
  heads.forEach(h => {
    // 「資料の見方」は記入例を兼ねた見本ページなので除外。
    if (t.slice(Math.max(0, h.index! - 120), h.index!).includes('資料の見方')) return;
    const name = h[3].replace(/\n/g, '');
    if (/国の経済対策|目的|事業期間|事業名/.test(name)) return;
    // The sheet runs until the next sheet's 事業名 label, so values of a neighbouring (unmatched) sheet are never read.
    const at = h.index!, next = t.indexOf('事業名\n', at + h[0].length), sheet = t.slice(at, next < 0 ? t.length : next);
    if (!sheet.includes('内部評価')) return;
    const p = project(input, name, name, null, h[0], at);
    p.projectCode = null;
    p.department = h[2];
    p.evaluatedFiscalYear = year;
    p.evidence.push(evidence(input, title[0].trimEnd(), 0));
    const { amount, note } = kakegawaAmount(input, sheet, at, year);
    if (amount) p.amounts.push(amount);
    const ind = sheet.match(KAKEGAWA_INDICATOR);
    if (ind && ![ind[2], ind[3], ind[4]].some(v => /^[ー－-]$/.test(v.trim())))
      p.indicators.push({ name: ind[1], fiscalYear: year, target: ind[3], actual: ind[4], unit: ind[2], evidence: evidence(input, ind[0], at + ind.index!) });
    p.warnings.push(`掛川市 令和${title[1]}年度 交付金活用事業評価の事業別シート（No.${h[1]}）。評価年度は表紙に年度の明示がないため未設定、評価対象年度は表題の令和${title[1]}年度。`);
    p.warnings.push(note);
    p.warnings.push('内部評価（実績・効果・課題）と地域創生戦略会議委員の外部評価は文章のみで段階評価がないため ratings は未設定。人工（従事人数）は未収録。成果指標は1指標のみの欄を原文どおり収録（複数指標・空欄は未収録）。');
    out.push(p);
  });
  return mergeReprints(out, key);
}

// ---------------------------------------------------------------- 14382 箱根町
/** 第６次総合計画 後期基本計画 令和６年度 施策別評価結果. 平成29〜令和元年度版・総括評価報告書は表の列が崩れるため対象外。 */
const HAKONE = 'd6e29fb001e9649d567faecd';
const HAKONE_TITLE = '箱根町第６次総合計画\n後期基本計画\n\n令和６年度 施策別評価結果';
const HAKONE_TABLE = '施策を構成する実施計画事業の評価';
const PROGRESS = '計画通り実施できた|概ね計画通り実施できた|計画の半分程度実施できた|計画通り実施できなかった';
const HAKONE_ROW = new RegExp(`(?<=\\n)(\\d{1,2}) ([^\\n]+)\\n\\n(${PROGRESS})\\n\\n([^\\n]{2,15})(?=\\n)`, 'g');
const PROGRESS_SCALE = '計画通り実施できた／概ね計画通り実施できた／計画の半分程度実施できた／計画通り実施できなかった';
const DIRECTION_SCALE = '計画通り実施（予定）／計画を変更し実施（予定）／廃止／休止';

function hakone(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '14382' || input.sourceId !== HAKONE || !input.text.startsWith(HAKONE_TITLE)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  let from = 0;
  for (;;) {
    const at = t.indexOf(HAKONE_TABLE, from);
    if (at < 0) break;
    const stop = t.indexOf('施策の進捗状況', at), end = stop < 0 ? t.length : stop;
    from = at + HAKONE_TABLE.length;
    // Rows whose name and progress were printed on one line, or detached from the table, do not match and are skipped.
    for (const m of t.slice(at, end).matchAll(HAKONE_ROW)) {
      if (/該当事業なし/.test(m[2])) continue;
      const start = at + m.index!, e = evidence(input, m[0], start);
      // 「（再掲）」は別の施策の表にも載る同じ事業なので、名前から外して再掲どうしを統合（値が食い違えば除外）する。
      const name = m[2].replace(/（再掲）$/, '');
      const p = project(input, name, name, null, m[0], start);
      p.projectCode = null;
      p.evaluatedFiscalYear = 2024;
      p.evidence.push(evidence(input, HAKONE_TITLE, 0));
      p.ratings.push({ kind: 'self', label: '事業の進捗度', value: m[3], scale: PROGRESS_SCALE, evidence: e });
      p.ratings.push({ kind: 'self', label: '今後の方向性', value: m[4], scale: DIRECTION_SCALE, evidence: e });
      p.warnings.push('箱根町 令和６年度 施策別評価結果（第６次総合計画 後期基本計画）の施策別評価シート「施策を構成する実施計画事業の評価」表の1行。評価対象年度は表題の令和６年度、評価年度は明示がないため未設定。');
      p.warnings.push('担当課は施策単位（施策担当課）でしか記載がないため未設定。事業費・指標は事業単位の記載がないため未収録。行番号は施策内の通し番号のため事業コードとしては使用していない。');
      out.push(p);
    }
  }
  return mergeReprints(out, key);
}

// ---------------------------------------------------------------- 45402 新富町
interface Report { year: number; yearRaw: string; name: string; nameRaw: string[]; amount?: { raw: string; value: string; check?: [string, string] } }
const KOYU = 'こゆ地域づくり推進機構「稼ぐ・創る・賑う」創出プロジェクト';
const KOYU2 = 'こゆ地域づくり推進機構２．０ 関係・交流人口拡大プロジェクト';
/** 地方創生推進交付金 事業実施報告（様式１）: one business per file; the name and amounts are pinned per file because the form layout differs by year. */
const SHINTOMI: Record<string, Report> = {
  '529f1323a1ab0ac5b49a37bc': { year: 2017, yearRaw: '平成29年度 実績額［単位：円］', name: KOYU, nameRaw: ['こゆ地域づくり推進機構「稼ぐ・創る・賑う」創\n出プロジェクト'],
    amount: { raw: '平成29年度 実績額［単位：円］\n¥28,739,530', value: '28,739,530', check: ['¥14,249,599', '¥14,489,931'] } },
  '5e302fe2132bddc3e8533dc5': { year: 2018, yearRaw: '平成30年度 実績額［単位：円］', name: KOYU, nameRaw: ['こゆ地域づくり推進機構「稼ぐ・創る・', '賑う」創出プロジェクト'],
    amount: { raw: 'ア. 総事業費\n\n¥42,757,668', value: '42,757,668' } },
  'af413d3bde7ec8d2ec4f61b3': { year: 2019, yearRaw: '令和01年度 実績額［単位：円］', name: KOYU, nameRaw: ['こゆ地域づくり推進機構「稼ぐ・創る・', '賑う」創出プロジェクト'],
    amount: { raw: 'ア. 総事業費\n\n¥37,085,122', value: '37,085,122' } },
  '4c1d1709105c54ef7a809ec4': { year: 2020, yearRaw: '令和2年度 実績額［単位：円］', name: KOYU2, nameRaw: ['こゆ地域づくり推進機構２．０ 関\n係・交流人口拡大プロジェクト'] },
  'c665cc69bf38d8571f67f548': { year: 2021, yearRaw: 'ア.令和3年度交\n付対象事業費', name: KOYU2, nameRaw: ['こゆ地域づくり推進機構２．０ 関', '係・交流人口拡大プロジェクト'],
    amount: { raw: 'ア.令和3年度交\n付対象事業費\n\n41,528,407', value: '41,528,407' } },
  'da0c6a7d14c2ee57cf262aa7': { year: 2022, yearRaw: 'ア.令和4年度国費実\n績額', name: KOYU2, nameRaw: ['こゆ地域づくり推進機構２．０ 関係・交\n', '流人口拡大プロジェクト'] },
};
const EFFECT_SCALE = '① 地方創生に非常に効果的であった／② 地方創生に相当程度効果があった／③ 地方創生に効果があった／④ 地方創生に対して効果がなかった';
const POLICY_SCALE = '① 事業の継続／② 事業の発展／③ 事業の改善／④ 事業の中止／⑤ 事業の終了';

function shintomi(input: CachedInput): ProjectEvaluation[] {
  const r = SHINTOMI[input.sourceId];
  if (input.municipalityCode !== '45402' || !r || !/事業実施報告（様式１）\n/.test(input.text.slice(0, 80))) return [];
  const t = input.text;
  if ([...r.nameRaw, r.yearRaw].some(s => t.indexOf(s) < 0)) return [];
  const p = project(input, r.name, r.name, null, r.nameRaw[0]);
  p.projectCode = null;
  p.evaluatedFiscalYear = r.year;
  for (const s of [...r.nameRaw.slice(1), r.yearRaw]) p.evidence.push(evidence(input, s));
  const dept = t.match(/担当部局課名( |\n\n)(総合政策課)\n/);
  if (dept) { p.department = dept[2]; p.evidence.push(evidence(input, dept[0].trimEnd(), dept.index!)); }
  if (r.amount && t.includes(r.amount.raw)) {
    const at = t.indexOf(r.amount.raw);
    // 平成29年度: 総額 is accepted only because it equals うち国費 + うち単費 printed next to it.
    const ok = !r.amount.check || num(r.amount.value) === r.amount.check.reduce((s, v) => s + num(v.replace('¥', '')), 0);
    if (ok) p.amounts.push({ kind: 'actual', fiscalYear: r.year, amountYen: num(r.amount.value), rawValue: r.amount.value, rawUnit: '円', evidence: evidence(input, r.amount.raw, at) });
  }
  // Selected answers are printed without the space the 凡例 lines carry (「① 地方創生…」), so exactly one unspaced match is the answer.
  const effects = [...t.matchAll(/[①-④]地方創生に[^\n]+/g)];
  if (effects.length === 1) p.ratings.push({ kind: 'self', label: '事業効果（地方創生への効果）', value: effects[0][0], scale: EFFECT_SCALE, evidence: evidence(input, effects[0][0], effects[0].index!) });
  const policies = [...t.matchAll(/[①-⑤]事業の(?:継続|発展|改善|中止|終了)(?:（[^\n（）]*(?:（[^\n（）]*）[^\n（）]*)*）)?/g)];
  if (policies.length === 1) p.ratings.push({ kind: 'self', label: '今後の方針', value: policies[0][0], scale: POLICY_SCALE, evidence: evidence(input, policies[0][0], policies[0].index!) });
  p.warnings.push('新富町 地方創生推進交付金（デジタル田園都市国家構想交付金）事業実施報告（様式１）。1ファイル1事業。様式の段組みが年度で異なり事業名が他欄と混在して出力されるため、事業名・実績額の位置は資料ごとに原文を確認して固定。評価年度は明示がないため未設定。');
  p.warnings.push(p.amounts.length
    ? `実績額は様式の「${r.amount!.raw.split('\n')[0]}」欄の値（交付金事業としての実績額）。${r.year === 2021 ? '令和３年度は交付対象事業費。' : ''}`
    : '実績額欄は総額・国費・単費等の値の並びが崩れて対応を確定できないため未収録。');
  p.warnings.push('KPI表は当初値・目標値・実績値の列が抽出テキストで崩れているため未収録。今後の方針の選択肢が欄外の記述と混在して途中で切れる場合は選択肢番号と見出し部分のみ記録。');
  return [p];
}

export const entries: Record<string, Entry> = {
  '22213': {
    extract: input => kakegawa(input),
    scope: '令和２〜６年度の新型コロナ・物価高騰対応臨時交付金・デジタル田園都市国家構想交付金等の活用事業評価（資料２）の事業別シートの事業名・担当課・評価対象年度、合計と財源内訳が一致し繰越のない実績事業費、単一の成果指標（目標・実績）。内部評価・外部評価の文章、人工、総合計画「施策の方向」評価（外部評価抜粋版）は対象外。',
  },
  '14382': {
    extract: input => hakone(input),
    scope: '令和６年度 施策別評価結果（第６次総合計画 後期基本計画）の「施策を構成する実施計画事業の評価」表に載る事業名と事業の進捗度・今後の方向性（原文ラベル）。施策の進捗状況・施策評価、総合戦略の施策別評価、平成29〜令和元年度版と前期総括評価（表の列が崩れるため）は対象外。',
  },
  '45402': {
    extract: input => shintomi(input),
    scope: '地方創生推進交付金（デジタル田園都市国家構想交付金）事業実施報告（様式１）の事業名・担当課・対象年度・実績額（列の対応が確定できる年度のみ）・事業効果・今後の方針。KPI表、総合戦略実施計画書の検証（施策の取組単位）、先行型・加速化交付金の一覧（列が崩れるため）は対象外。',
  },
};
