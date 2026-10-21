/** 01229 富良野市（教育委員会事務事業点検・評価シート）と 01397 留寿都村（総合計画実施計画事業評価調書）。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { BASE_WARNING, type Entry, acrossInputs, reiwa, segments, toNum } from './h3-util';

// ---------------------------------------------------------------- 富良野市
const FURANO_SOURCE = 'dfd28d5c2809fe39cf6f58a0';
const FURANO_TITLE = '令和７年度\n富良野市教育行政評価報告書\n\n教育委員会事務事業点検・評価';
const FURANO_SCALE_ACHIEVE = 'A：実践が進み成果を上げている。 B：実践が進み、達成度は比較的高いと判断される。 C：実践に努めているが、達成度は低いと判断される。 D：ほとんど（全く）実践されず、努力を要する、又は評価できず。';
const FURANO_SCALE_EFFECT = 'A：期待どおりの効果が得られたと判断される。 B：やや期待どおりの効果が得られ、効果度が比較的高いと判断される。 C：期待どおりの効果には達せず、効果度が低いと判断される。 D：期待した効果がほとんど（全く）得られなかったと判断される、又は評価できず。';
const RANK = /^[ABCDＡＢＣＤ]$/;

function extractFurano(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== FURANO_SOURCE || !input.text.startsWith(FURANO_TITLE)) return [];
  const t = input.text, defAt = t.indexOf('①達成度の評価'), defEnd = t.indexOf('２）学校第三者評価', defAt);
  if (defAt < 0 || defEnd < 0) return [];
  const out: ProjectEvaluation[] = [];
  for (const { m, start, end } of segments(t, /富良野市教育委員会事務事業点検・評価シート\n/g)) {
    // 1シート1ページ: 次のページ番号行までに限定。
    const foot = t.slice(start, end).search(/\n- \d+ -\n/), seg = t.slice(start, foot >= 0 ? start + foot : end);
    if (!t.slice(Math.max(0, start - 200), start).includes('令和７年度教育委員会事務事業点検・評価')) continue;
    const nm = seg.match(/\n事 ?務 ?事 ?業 ?名 ?([^\n]+)\n/), dm = seg.match(/\n課\s+([^\n]+)\n\n事 ?務 ?事 ?業 ?名/);
    if (!nm || !dm) continue;
    const name = nm[1].trim(), nameAt = start + nm.index! + nm[0].indexOf(nm[1]);
    const p = project(input, `2025:${name}`, name, null, nm[1], nameAt);
    p.projectCode = null; p.department = dm[1].trim(); p.evaluatedFiscalYear = 2025;
    const years = ['R3', 'R4', 'R5', 'R6', 'R7'].every(y => seg.includes(`\n${y}\n`));
    p.evidence.push(evidence(input, m[0].trimEnd(), start), evidence(input, dm[1], start + dm.index! + dm[0].indexOf(dm[1])), evidence(input, FURANO_TITLE, 0));
    // 事業費（決算・千円）: 見出し直後の1行に年度列R3〜R7の5値が並ぶ場合のみ（左から年度順）。
    const am = seg.match(/\n事 業 費 \(決 算 \)\n\( ?単 ?位 ?: ?千 ?円 ?\) ((?:[\d,]+ ){4}[\d,]+)\n/);
    if (am && years) {
      const e = evidence(input, am[0].trim(), start + am.index! + 1);
      am[1].split(' ').forEach((v, i) => p.amounts.push({ kind: 'actual', fiscalYear: 2021 + i, amountYen: toNum(v) * 1000, rawValue: v, rawUnit: '千円', evidence: e }));
    }
    // 達成度・効果度: R3〜R7の5値が揃う場合のR7（当該年度）の値。
    if (years) {
      for (const [label, scale] of [['達成度', FURANO_SCALE_ACHIEVE], ['効果度', FURANO_SCALE_EFFECT]]) {
        const rm = seg.match(new RegExp(`\\n${label}\\n\\n((?:\\S+\\n\\n){4}\\S+)\\n`));
        const vals = rm?.[1].split('\n\n');
        if (!rm || !vals!.every(v => RANK.test(v))) continue;
        p.ratings.push({ kind: 'self', label: `${label}（令和７年度）`, value: vals![4].normalize('NFKC'), scale, evidence: evidence(input, rm[0].trim(), start + rm.index! + 1) });
      }
    }
    p.evidence.push(evidence(input, t.slice(defAt, defEnd).trimEnd(), defAt));
    p.warnings = [BASE_WARNING + '令和７年度 事務事業点検・評価シートの事務事業名・担当課・達成度/効果度（R3〜R7の5列が揃う場合のR7値のみ）・事業費（決算、千円。R3〜R7の5値が1行に揃う場合のみ）。評価年度は本文に明示がないため未設定（評価対象年度は令和７年度）。成果・課題の記述は構造化していません。'];
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 留寿都村
const RUSUTSU_SOURCE = '086c705eff9c92d667d51e2f';
const RUSUTSU_TITLE = '第６次留寿都村総合計画実施計画\n令和７年度事業評価結果';

function extractRusutsu(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== RUSUTSU_SOURCE || !input.text.startsWith(RUSUTSU_TITLE)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const sheets = segments(t, /総合計画実施計画事業評価調書\n/g), listAt = t.indexOf('事業番号一覧');
  if (!sheets.length || listAt < 0 || listAt > sheets[0].start) return [];
  // 事業番号一覧（事業No. 事業名 / 担当課）。調書側の並びは崩れているため、一覧の名称・担当課が調書内にも現れる場合だけ採用。
  const list = new Map<string, { name: string; dept: string; raw: string; at: number }>();
  for (const r of t.slice(listAt, sheets[0].start).matchAll(/(?<=\n)(\d+(?:-\d+)?) ([^\n]+)\n\n([^\n]+)(?=\n)/g)) {
    if (!/^(?:\S+課|消防|診療所|教育委員会)$/.test(r[3])) continue;
    list.set(r[1], { name: r[2].trim(), dept: r[3], raw: r[0], at: listAt + r.index! });
  }
  for (const { m, start, end } of sheets) {
    const seg = t.slice(start, end);
    if (!seg.includes('【令和７年度事業】')) continue;
    const cm = seg.match(/^総合計画実施計画事業評価調書\n(?:事業Ｎｏ．\n\n)?(\d{3})(-\d+)?\n/), dm = seg.match(/\n([^\n]+)\n\n担当部署\n/);
    if (!cm || !dm) continue;
    const code = `${Number(cm[1])}${cm[2] ?? ''}`, row = list.get(code);
    if (!row || row.dept !== dm[1]) continue;
    const nameAt = seg.indexOf(`\n${row.name}\n`);
    if (nameAt < 0) continue;
    const name = row.name, dept = row.dept;
    const p = project(input, code, name, null, name, start + nameAt + 1);
    p.projectCode = code; p.department = dept; p.evaluatedFiscalYear = 2025;
    p.evidence.push(evidence(input, `${cm[1]}${cm[2] ?? ''}`, start + m[0].length + cm[0].slice(m[0].length).indexOf(cm[1])), evidence(input, dept, start + dm.index! + 1),
      evidence(input, row.raw, row.at), evidence(input, '【令和７年度事業】', start + seg.indexOf('【令和７年度事業】')), evidence(input, RUSUTSU_TITLE, 0));
    // 事業費（千円）: 「当初予算額」「決算額」の各行に2値（事業費計＝単一財源）だけ並ぶ場合のみ、先頭の事業費計を採用。
    const am = seg.match(/\n当初予算額\n\n([\d,]+)\n\n([\d,]+)\n\n決算額\n\n([\d,]+)\n\n([\d,]+)\n/);
    if (am && am[1] === am[2] && am[3] === am[4] && seg.includes('事業費（千円）')) {
      const e = evidence(input, am[0].slice(1, -1), start + am.index! + 1);
      p.amounts.push({ kind: 'budget', fiscalYear: 2025, amountYen: toNum(am[1]) * 1000, rawValue: am[1], rawUnit: '千円', evidence: e });
      p.amounts.push({ kind: 'actual', fiscalYear: 2025, amountYen: toNum(am[3]) * 1000, rawValue: am[3], rawUnit: '千円', evidence: e });
    }
    p.warnings = [BASE_WARNING + '令和７年度事業の事業評価調書から事業No.・事業名・担当部署、事業費（千円、当初予算額・決算額の各行が事業費計と単一財源の2値だけで一致する場合のみ）を採用。必要性・有効性・効率性のチェック項目と回答は並びが崩れているため構造化していません。評価年度は本文に明示がないため未設定。'];
    out.push(p);
  }
  return out;
}

export const entries: Record<string, Entry> = {
  '01229': { extract: acrossInputs(extractFurano), scope: '令和７年度 教育委員会事務事業点検・評価シートから事務事業名・担当課・達成度/効果度（令和７年度値）・事業費（決算R3〜R7、千円）を構造化。学校第三者評価・教育委員会活動・成果や課題の記述は対象外。' },
  '01397': { extract: acrossInputs(extractRusutsu), scope: '第６次総合計画実施計画 令和７年度事業評価調書から事業No.・事業名・担当部署・事業費（当初予算額・決算額、千円）を構造化。必要性等のチェック項目回答・総評の文章・事業番号一覧は対象外。' },
};
