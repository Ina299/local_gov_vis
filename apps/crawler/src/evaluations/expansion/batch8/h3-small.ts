/** 32201 松江市（教育委員会 点検・評価報告書 平成20・21年度）と 11383 神川町（電源立地地域対策交付金 事業評価個表）。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { BASE_WARNING, type Entry, acrossInputs, toNum } from './h3-util';

// ---------------------------------------------------------------- 松江市
const MATSUE: Record<string, { year: number; title: string }> = {
  '6ab5323cc6d3469b3d8ea012': { year: 2008, title: '平成２０年度\n松江市教育委員会\n点検・評価報告書' },
  'd24a0538bf9608d515cbf1b0': { year: 2009, title: '平成２１年度\n松江市教育委員会\n点検・評価報告書' },
};
const MATSUE_SCALE = 'A 概ね適切に執行 B 事業の進め方の改善 C 事業の実施主体やコストの改善 D 事業の廃止・休止を検討';
const DEPT = /(?:課|館|室|センター|所)$/;
const NOT_NAME = /^(?:事務事業名|概要|実績|事業費|評価|担当課|計画|総合評価|特記事項)$|[。、]|点$|^[\d,]+千円$|^[・※（(]/;

function extractMatsue(input: CachedInput): ProjectEvaluation[] {
  const cfg = MATSUE[input.sourceId], t = input.text;
  if (!cfg || !t.startsWith(cfg.title)) return [];
  const scaleRe = /A 概ね適切に執行\nC 事業の実施主体やコストの改善\nB 事業の進め方の改善\nD 事業の廃止・休止を検討/, scale = t.match(scaleRe);
  const out: ProjectEvaluation[] = [];
  if (cfg.year === 2009) {
    // 平成21年度版: 「事務事業名 / 事業名 / 担当課 / 課名」の並び。区間は次の「事務事業名」まで。
    const starts = [...t.matchAll(/\n事務事業名\n/g)].map(x => x.index!);
    for (const m of t.matchAll(/\n事務事業名\n\n([^\n]+)\n\n担当課\n\n([^\n]+)\n/g)) {
      const [, name, dept] = m;
      if (NOT_NAME.test(name) || /^目標指標名$/.test(name) || !DEPT.test(dept) || name.length > 40) continue;
      const end = starts.find(x => x > m.index!) ?? t.length, seg = t.slice(m.index!, end);
      const p = project(input, `2009:${name}`, name, null, name, m.index! + '\n事務事業名\n\n'.length);
      p.projectCode = null; p.department = dept; p.evaluatedFiscalYear = 2009;
      p.evidence.push(evidence(input, dept, m.index! + m[0].lastIndexOf(dept)), evidence(input, cfg.title, 0));
      // 事業費（千円）の「計画」「決算額」が値と交互に並ぶ場合のみ。
      const am = seg.match(/\n計画\n([\d,]+)\n決算額\n([\d,]+)\n/);
      if (am && seg.slice(0, am.index!).includes('事業費（千円）')) {
        const e = evidence(input, am[0].trim(), m.index! + am.index! + 1);
        p.amounts.push({ kind: 'budget', fiscalYear: 2009, amountYen: toNum(am[1]) * 1000, rawValue: am[1], rawUnit: '千円', evidence: e });
        p.amounts.push({ kind: 'actual', fiscalYear: 2009, amountYen: toNum(am[2]) * 1000, rawValue: am[2], rawUnit: '千円', evidence: e });
      }
      p.warnings = [BASE_WARNING + '教育委員会 点検・評価報告書（平成21年度）の事務事業名・担当課。評価は文章のみ（記号評価なし）。事業費は「事業費（千円）」の後に「計画」「決算額」と値が交互に並ぶ場合のみ平成21年度の計画（予算）・決算額として採用。目標指標の表は年度列の対応が崩れているため構造化していません。評価年度は本文に明示がないため未設定。'];
      out.push(p);
    }
    return out;
  }
  const heads = [...t.matchAll(/\n担当課\n/g)];
  for (let i = 0; i < heads.length; i++) {
    const at = heads[i].index!, next = heads[i + 1]?.index ?? t.length;
    // 「担当課」の直前1〜2行: 「事業名\n担当課名\n担当課」または「事業名\n担当課」（担当課名は別位置）。
    const lines = t.slice(Math.max(0, at - 300), at).split('\n'), l1 = lines.at(-1)!, l0 = lines.at(-2) ?? '';
    let name: string, dept: string | null;
    if (DEPT.test(l1) && !DEPT.test(l0)) { name = l0; dept = l1; } else { name = l1; dept = null; }
    if (!name || NOT_NAME.test(name) || name.length > 40 || !/(?:事業|運営|管理|整備|推進|活動|充実|調査|派遣|支援|研修|教室|講座|費)/.test(name)) continue;
    const nameAt = at - (dept ? dept.length + 1 : 0) - name.length;
    if (t.slice(nameAt, nameAt + name.length) !== name) continue;
    const seg = t.slice(at, next);
    const p = project(input, `${cfg.year}:${name}`, name, null, name, nameAt);
    p.projectCode = null; p.department = dept; p.evaluatedFiscalYear = cfg.year;
    p.evidence.push(evidence(input, cfg.title, 0));
    if (dept) p.evidence.push(evidence(input, dept, at - dept.length));
    const rm = [...seg.matchAll(/総合評価\n(?:\n?\d点\n)?([A-D])\n/g)];
    if (rm.length === 1 && scale) {
      p.ratings.push({ kind: 'self', label: '総合評価', value: rm[0][1], scale: MATSUE_SCALE, evidence: evidence(input, rm[0][0].trim(), at + rm[0].index!) });
      p.evidence.push(evidence(input, scale[0], scale.index!));
    }
    p.warnings = [BASE_WARNING + '教育委員会 点検・評価報告書（平成20年度）の事務事業ごとの事業名・担当課（事業名の直後にある場合のみ）・総合評価（A〜D。当該事業の区間に1つだけある場合のみ）。必要性・効率性・達成度・有効性の点数と計画・実績の事業費は並びが崩れているため構造化していません。評価年度は本文に明示がないため未設定。'];
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 神川町
const KAMIKAWA: Record<string, number> = { '7526eb613d075d8cb2cd93c6': 2023, '9098a26d3385da71145577b2': 2020 };

function extractKamikawa(input: CachedInput): ProjectEvaluation[] {
  const year = KAMIKAWA[input.sourceId], t = input.text;
  if (!year) return [];
  const era = `令和${String.fromCharCode(0xff10 + year - 2018)}年度`;
  const head = t.match(new RegExp(`Ⅱ．事業評価個表（${era}）\\n番号\\n措置名\\n[^\\n]+\\n1\\n([^\\n]+)\\n`));
  const dept = t.match(/\n交付金事業の担当課室\n([^\n]+)\n交付金事業の評価課室\n([^\n]+)\n/);
  if (!head || !dept) return [];
  const name = head[1].trim();
  const p = project(input, `${year}:${name}`, name, null, head[0].trim(), head.index!);
  p.projectCode = '1'; p.department = dept[1]; p.evaluationYear = null; p.evaluatedFiscalYear = year;
  p.evidence.push(evidence(input, dept[0].trim(), dept.index! + 1));
  const warnings = [BASE_WARNING + `電源立地地域対策交付金 事業評価個表（${era}）の交付金事業名・担当課室。金額は総括表の「交付金事業に要した経費」と個表の総事業費が一致しない様式のため採用していません。`];
  // 成果指標（令和５年度版のみ並びが確定）: 評価年度の2行に続く「成果実績・目標値・達成度」の3値。
  if (year === 2023) {
    const im = t.match(/\n成果目標 成果指標\n単位 評価年度\n成果実績\n人\n([\d,]+)人 来園者数 目標値\n人\n達成度\n％\n[\s\S]{0,80}?\n令和５年度\n令和５年度\n([\d,]+)\n([\d,]+)\n([\d.]+%)\n/);
    if (im && im[1] === im[3]) {
      p.indicators.push({ name: '来園者数', fiscalYear: 2023, target: im[3], actual: im[2], unit: '人', evidence: evidence(input, im[0].trim(), im.index! + 1) });
      warnings.push(`成果指標「来園者数」は評価年度（令和５年度）の成果実績・目標値・達成度（${im[4]}）の並びで採用（目標値は成果目標欄の値と一致を確認）。`);
    }
  } else warnings.push('令和２年度版の成果指標は指標名が複数行に分断されているため構造化していません。');
  p.warnings = warnings;
  return [p];
}

export const entries: Record<string, Entry> = {
  '32201': { extract: acrossInputs(extractMatsue), scope: '教育委員会 点検・評価報告書（平成20・21年度）の事務事業ごとに事業名・担当課、平成20年度は総合評価（A〜D）、平成21年度は事業費（計画・決算額）を構造化。教育委員会の活動・有識者意見・目標指標表・平成19年度版（テキストなし）は対象外。' },
  '11383': { extract: acrossInputs(extractKamikawa), scope: '電源立地地域対策交付金 事業評価個表（令和２・５年度）の交付金事業名・担当課室と令和５年度の成果指標（来園者数）を構造化。金額（総括表と個表で不一致の様式）・契約概要・記入要領は対象外。' },
};
