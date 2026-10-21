import type { EvaluationAmount, EvaluationRating, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

/**
 * 地方創生関係交付金・電源立地地域対策交付金・企業版ふるさと納税の「交付対象事業ごと」の効果検証（事業評価個表・評価書）。
 * 事務事業評価ではなく交付金の効果検証。総合戦略の基本目標・KPI（施策単位）の評価は対象外。
 */
type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

const GRANT_NOTE = '事務事業評価ではなく交付金の効果検証。';
const num = (s: string) => Number(s.normalize('NFKC').replace(/,/g, ''));
const wareki = (s: string) => 2018 + num(s);
function amount(input: CachedInput, kind: EvaluationAmount['kind'], fiscalYear: number | null, rawValue: string, rawUnit: '円' | '千円', raw: string, start: number): EvaluationAmount {
  return { kind, fiscalYear, amountYen: num(rawValue) * (rawUnit === '千円' ? 1000 : 1), rawValue, rawUnit, evidence: evidence(input, raw, start) };
}
const joinName = (raw: string) => raw.split('\n').map(s => s.trim()).filter(Boolean).join('');

// ---------------------------------------------------------------- 01402 岩内町（電源立地地域対策交付金 事業評価個表）
const IWANAI_SOURCES = new Set(['621c74e7efce0bd052ab3411', '93376cccbb82ebb89c45523e']);
const IWANAI_SHEET = 'Ⅰ．事業評価総括表';

function extractIwanai(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01402' || !IWANAI_SOURCES.has(input.sourceId)) return [];
  const t = input.text;
  if (!t.startsWith('別紙\n' + IWANAI_SHEET)) return [];
  const starts = [...t.matchAll(new RegExp(IWANAI_SHEET, 'g'))].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const block = t.slice(s, starts[k + 1] ?? t.length), split = block.indexOf('Ⅱ．事業評価個表');
    if (split < 0 || block.indexOf('Ⅱ．事業評価個表', split + 1) >= 0) return;
    const summary = block.slice(0, split);
    const year = block.slice(split).match(/^Ⅱ．事業評価個表（令和([0-9０-９]+)年度）/);
    // Name: the line(s) of the summary table naming the grant project (a trailing 「事業」 may wrap to the next line).
    const nm = [...summary.matchAll(/\n((?:岩内町|岩内地方|いわない)[^\n]+?)(\n事業)?(?=\n)/g)].find(m => (m[1] + (m[2] ?? '')).endsWith('事業'));
    if (!year || !nm) return;
    const name = joinName(nm[1] + (nm[2] ?? '')), fy = wareki(year[1]);
    const p = project(input, name, name, null, nm[0].slice(1), s + nm.index! + 1);
    p.projectCode = null;
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, year[0], s + split));
    const dept = block.match(/交付金事業の担当課室\n(岩内町[^\n]+)/);
    if (dept) { p.department = dept[1]; p.evidence.push(evidence(input, dept[0], s + dept.index!)); }
    const cost = summary.includes('（単位：円）') ? summary.match(/交付金充当額\n\n(?:備\n\n)?岩内町\n\n([\d,]+)\n\n([\d,]+)/) : null;
    if (cost) p.amounts.push(amount(input, 'actual', fy, cost[1], '円', cost[0], s + cost.index!));
    p.warnings.push(`岩内町 事業評価個表（令和${year[1]}年度）の交付金事業1件。${GRANT_NOTE}事業名は事業評価総括表の「交付金事業の名称」欄（折り返しを連結）。評価年度欄は成果指標の表内にあり列対応が確定しないため evaluationYear は未設定、個表見出しの年度を評価対象年度とした。`);
    p.warnings.push(cost
      ? `金額は事業評価総括表（単位：円）の「交付金事業に要した経費」${cost[1]}円（右隣の${cost[2]}円は交付金充当額のため未収録）。備考欄の総事業費は列位置が資料ごとに揺れるため未収録。成果指標・活動指標は表の段組みが崩れ指標名と値の対応が確定しないため未収録。`
      : '事業評価総括表の金額欄は抽出テキストで列順が崩れており（事業者名と見出しの並びが他の表と異なる）、経費と充当額の対応が確定しないため未収録。成果指標・活動指標も未収録。');
    out.push(p);
  });
  const names = out.map(p => p.projectName);
  return out.filter(p => names.filter(n => n === p.projectName).length === 1);
}

// ---------------------------------------------------------------- 08223 潮来市（平成29年度 地方創生推進交付金・拠点整備交付金 事業実施結果 検証報告）
const ITAKO_SOURCE = '78be518c4bb7bd798b1ed4e1';
const ITAKO_TITLE = '地方創生推進交付金・拠点整備交付金に係る事業実施結果 検証報告';
const ITAKO_YEAR = '実績値（平成29年度）';
/** 交付金対象事業名（抽出テキストの折り返しのまま）と、潮来市事業費・充当先事業の総事業費（同額で同じ事業の記述に属することを確認済み）。 */
const ITAKO_PROJECTS: { raw: string; cost?: [string, string, string] }[] = [
  { raw: '第2のふるさと・いばらき\nプロジェクト 推進事業' },
  { raw: '水郷筑波･サイクリングによる\nまちづくりプロジェクト', cost: ['911,450', '潮来市事業費\n911,450円', '〇水郷筑波・サイクリングによるまちづくりプロジェクト事業\n【総事業費】 911,450円'] },
  { raw: '茨城版\n～持続可能な地域づくり～\n広域公共交通ネットワーク\nプラス「小さな拠点」', cost: ['8,399,323', '潮来市事業費\n8,399,323円', '【総事業費】\n\n8,399,323円'] },
  { raw: '鹿行広域DMOプロジェクト\n（アントラーズホームタウンDMO）', cost: ['2,730,229', '潮来市事業費\n2,730,229円', '【総事業費】\n\n2,730,229円'] },
  { raw: '水郷潮来プライド米\nプロジェクト', cost: ['10,374,629', '潮来市事業費\n10,374,629円', '〇地産地消販売促進強化事業 【総事業費】10,374,629円'] },
  { raw: '水の郷 石の蔵\nリノベーションプロジェクト' },
];

function extractItako(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '08223' || input.sourceId !== ITAKO_SOURCE) return [];
  const t = input.text, title = t.indexOf(ITAKO_TITLE), year = t.indexOf(ITAKO_YEAR);
  if (title < 0 || year < 0) return [];
  const once = (s: string) => t.indexOf(s) >= 0 && t.indexOf(s) === t.lastIndexOf(s);
  const out: ProjectEvaluation[] = [];
  for (const { raw, cost } of ITAKO_PROJECTS) {
    if (!once(raw)) continue;
    const name = joinName(raw);
    const p = project(input, name, name, null, raw);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2017;
    p.evidence.push(evidence(input, ITAKO_TITLE, title), evidence(input, ITAKO_YEAR, year));
    if (cost && once(cost[1]) && once(cost[2])) {
      p.amounts.push(amount(input, 'actual', 2017, cost[0], '円', cost[1], t.indexOf(cost[1])));
      p.evidence.push(evidence(input, cost[2]));
    }
    p.warnings.push(`潮来市 平成29年度 地方創生推進交付金・拠点整備交付金に係る事業実施結果 検証報告の交付対象事業1件。${GRANT_NOTE}評価対象年度2017は表の「実績値（平成29年度）」による。検証の実施年度は本文に明示がないため未設定。`);
    p.warnings.push(cost
      ? `金額は「潮来市事業費」${cost[0]}円。抽出テキストは段組みが崩れているため、同額の「【総事業費】」が当該交付対象事業の充当先事業の記述にあることを確認できたものだけ採用（根拠に併記）。KPI・事業の評価（効果の選択肢）は行の対応が確定しないため未収録。`
      : '潮来市事業費は段組みの崩れ（複数の充当先事業の合計・次年度繰越を含む等）で当該事業との対応・年度が確定しないため未収録。KPI・事業の評価（効果の選択肢）も未収録。');
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 04301 蔵王町（地方創生先行型 事業実施結果報告）
const ZAO_SOURCE = 'a5dce83b9ad1520d20f80104';
const ZAO_TITLE = '地域活性化・地域住民生活等緊急支援交付金（地方創生先行型）に係る事業実施結果報告';
const ZAO_ROWS: [string, string][] = [
  ['1 蔵王町総合戦略策定事業', '蔵王町総合戦略策定事業'],
  ['2 （仮称）蔵王町観光物産協会設立支援事業', '（仮称）蔵王町観光物産協会設立支援事業'],
  ['3 蔵王町観光誘客宣伝強化事業', '蔵王町観光誘客宣伝強化事業'],
  ['4 優良素牛導入支援事業', '優良素牛導入支援事業'],
  ['5 すこやか養育助成金', 'すこやか養育助成金'],
  ['6 子育て家庭健康応援プロジェクト', '子育て家庭健康応援プロジェクト'],
  ['7 特定不妊治療費助成', '特定不妊治療費助成'],
  ['8 多子世帯幼稚園保育料助成事業', '多子世帯幼稚園保育料助成事業'],
  ['9 遠刈田系伝統こけし後継者支援事業', '遠刈田系伝統こけし後継者支援事業'],
  ['みちのく真田ゆかりの地事業\n10 【上乗せ交付分】', 'みちのく真田ゆかりの地事業【上乗せ交付分】'],
];

function extractZao(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '04301' || input.sourceId !== ZAO_SOURCE || !input.text.startsWith(ZAO_TITLE)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  for (const [raw, name] of ZAO_ROWS) {
    const at = t.indexOf(raw);
    if (at < 0 || at !== t.lastIndexOf(raw)) continue;
    const p = project(input, name, name, null, raw, at);
    p.projectCode = null;
    p.evidence.push(evidence(input, ZAO_TITLE, 0));
    p.warnings.push(`蔵王町 地方創生先行型交付金 事業実施結果報告の交付対象事業1件（No.は原文）。${GRANT_NOTE}事業名と原文根拠のみの部分構造化。`);
    p.warnings.push('抽出テキストは表の段組みが崩れ、事業費・KPI・事業効果・外部有識者の評価・今後の方針の値が行と対応づけられないため未収録。対象年度・検証年度は本文に明示がないため未設定。');
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 08225 常陸大宮市（総合戦略評価書のうち交付金事業・応援税制活用事業の評価書）
const HITACHIOMIYA_SOURCES = new Set(['61635c558deefa4a4b881f64', '02f4d014ae59845cab4319fc', '2a0d60baf96cb47d33b132ec']);
const HO_SHEET = /令和([0-9]+)年度\n\n(地方創生交付金事業等に係る評価書|地方創生関係交付金(?:事業)?に係る事業計画書（評価書）|地方創生応援税制活用事業評価書)\n/g;
/** 事業名（1行目）と、ある場合の市事業名の括弧書き。 */
const HO_NAMES = ['いばらきサイクルツーリズム推進強化事業', 'つながる茨城チャレンジフィールドプロジェクト', '道の駅常陸大宮遊具設置', '乳児育児用品購入助成事業', '大宮運動公園市民球場整備事業', '御前山ダム周辺活性化事業'];
const HO_POLICY_SCALE = 'Ａ 拡充／Ｂ 現行どおり／Ｃ 見直し／Ｄ 縮小／Ｅ 休止・廃止／Ｆ 完了／Ｇ 統合';

function hitachiomiyaSheets(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '08225' || !HITACHIOMIYA_SOURCES.has(input.sourceId)) return [];
  const t = input.text, heads = [...t.matchAll(HO_SHEET)];
  const policyScale = t.includes('■表２（今後の方針区分）') ? HO_POLICY_SCALE : null;
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const s = h.index!, sheet = t.slice(s, heads[k + 1]?.index ?? t.length), fy = 2018 + Number(h[1]);
    const grant = !h[2].includes('応援税制');
    const found = HO_NAMES.map(n => ({ n, m: sheet.match(new RegExp(`\\n${n}(\\n（市事業名：[^\\n）]+）)?\\n`)) })).filter(x => x.m);
    if (found.length !== 1) return;
    const { n: name, m } = found[0];
    const p = project(input, name, name, null, m![0].trim(), s + m!.index! + 1);
    p.projectCode = null;
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, h[0].trim(), s));
    const dept = sheet.match(/担当部課等\n+(?:１\n+)?([^\n]+?)(?:\n\n([^\n]+?))?\n\n(?:１ )?事業概要/);
    if (dept) { p.department = [dept[1], dept[2]].filter(Boolean).join(' '); p.evidence.push(evidence(input, dept[0], s + dept.index!)); }
    if (grant) {
      const c = [...sheet.matchAll(/決算額([\d,]+)千円/g)];
      if (c.length === 1) p.amounts.push(amount(input, 'actual', fy, c[0][1], '千円', c[0][0], s + c[0].index!));
    } else {
      const b = [...sheet.matchAll(/予算額：([\d,]+)円/g)];
      if (b.length === 1) p.amounts.push(amount(input, 'budget', fy, b[0][1], '円', b[0][0], s + b[0].index!));
    }
    const ev = sheet.indexOf('（２）事業評価');
    if (ev >= 0) {
      const part = sheet.slice(ev), rate = (re: RegExp, label: string, scale: string | null) => {
        const r = [...part.matchAll(re)];
        if (r.length === 1) p.ratings.push({ kind: 'self', label, value: r[0][1], scale, evidence: evidence(input, r[0][0].replace(/^\n+/, '').trimEnd(), s + ev + r[0].index! + r[0][0].length - r[0][0].replace(/^\n+/, '').length) });
      };
      // R4・R5様式は「総合計画評価」「地方創生評価」の見出し付き、R3様式は見出しなし（同じ2欄）。
      rate(/\n([ＡＢＣＤ①②③④])(?:期待|概ね期待)[^\s]*/g, '事業の評価（成果・総合計画評価）', null);
      rate(/\n([ＡＢＣＤ①②③④])地方創生に[^\s]*/g, '事業の評価（地方創生評価）', null);
      rate(/\n方針\n\n(?:主な取組\n\n)?(拡充|現行どおり|見直し|縮小|休止・廃止|完了|統合)\n/g, '今後の方針', policyScale);
    }
    const cityName = m![1]?.trim();
    p.warnings.push(`常陸大宮市 第２期創生総合戦略評価書のうち「${h[2]}」（令和${h[1]}年度）の1事業。${GRANT_NOTE}${cityName ? `市の事業名は${cityName}。` : ''}評価書の実施年度は本文の年度表記が評価対象年度と区別できないため evaluationYear は未設定。`);
    p.warnings.push(`${grant ? '金額は「決算額」（千円）のみ収録し、概算事業費・交付金対象経費・交付額は未収録。' : '金額は「予算額」のみ予算として収録。「事業費」は前払・繰越の内訳が併記され決算額と確定しないため未収録。寄付額も未収録。'}評価は抽出テキストで理由欄と行が交互に並ぶため、評価欄の記号（Ａ～Ｄ／①～④）のみを値とし、文言は根拠テキストに残す。KPIの目標・実績は年度列の対応が確定しないため未収録。`);
    out.push(p);
  });
  // The same business evaluated on two forms in one year (交付金・応援税制): merge when no field disagrees, else drop.
  const byKey = new Map<string, ProjectEvaluation[]>();
  for (const p of out) byKey.set(`${p.projectName}|${p.evaluatedFiscalYear}`, [...(byKey.get(`${p.projectName}|${p.evaluatedFiscalYear}`) ?? []), p]);
  const result: ProjectEvaluation[] = [];
  for (const group of byKey.values()) {
    const [first, ...rest] = group;
    let ok = true;
    for (const q of rest) {
      const sameDept = !first.department || !q.department || first.department === q.department;
      const ratingClash = q.ratings.some(r => first.ratings.some(f => f.label === r.label && f.value !== r.value));
      const amountClash = q.amounts.some(a => first.amounts.some(f => f.kind === a.kind && f.amountYen !== a.amountYen));
      if (!sameDept || ratingClash || amountClash) { ok = false; break; }
      first.evidence.push(...q.evidence);
      first.amounts.push(...q.amounts.filter(a => !first.amounts.some(f => f.kind === a.kind)));
      first.ratings.push(...q.ratings.filter(r => !first.ratings.some(f => f.label === r.label)));
    }
    if (!ok) continue;
    if (rest.length) first.warnings.push('同じ年度・同じ事業の評価書が交付金事業と応援税制活用事業の2様式にあり、部課・評価・金額に食い違いがないことを確認して1件に統合（決算額は交付金様式、予算額は応援税制様式）。');
    result.push(first);
  }
  return result;
}

export const entries: Record<string, Entry> = {
  '01402': { extract: (input) => extractIwanai(input),
    scope: '岩内町 電源立地地域対策交付金の事業評価個表（令和2年度・令和3年度）の交付金事業ごとの事業名・担当課室・事業評価総括表の「交付金事業に要した経費」（列順が確定するもの）。交付金の効果検証であり事務事業評価ではない。成果指標・活動指標・総事業費・契約概要は対象外。' },
  '08223': { extract: (input) => extractItako(input),
    scope: '潮来市 平成29年度 地方創生推進交付金・拠点整備交付金に係る事業実施結果 検証報告の交付対象事業6件の名称と、充当先事業の総事業費と照合できた潮来市事業費。交付金の効果検証であり事務事業評価ではない。KPI・事業の評価・総合戦略の達成状況一覧・案内ページは対象外。' },
  '04301': { extract: (input) => extractZao(input),
    scope: '蔵王町 地方創生先行型交付金 事業実施結果報告の交付対象事業10件の名称のみ（部分構造化）。段組みが崩れた事業費・KPI・評価、加速化・推進交付金の結果報告（年度が本文で確定せず列対応も崩れる）、総合戦略の案内ページは対象外。' },
  '08225': { extract: (input) => hitachiomiyaSheets(input),
    scope: '常陸大宮市 第２期創生総合戦略評価書（令和3〜5年度分）のうち、地方創生関係交付金事業・地方創生応援税制活用事業の評価書（1事業1枚）の事業名・担当部課・決算額または予算額・評価記号・今後の方針。交付金の効果検証であり事務事業評価ではない。人口動向・基本目標・KPI一覧（戦略・施策単位）は対象外。' },
};
