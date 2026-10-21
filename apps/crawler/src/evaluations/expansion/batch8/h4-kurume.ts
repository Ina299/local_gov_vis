import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, ascii, eraYear, municipality } from './h4-util';

/** Kurume 教育委員会 点検評価報告書 (batch 8). R3–R5 and H28 reports are stored with a broken font map (no readable text). */
const IDS = ['7a4d52bf42dc241eb48b40fe', 'f493421e7cd5ddfd67b39541', '1f08a86fb5845fd73d32370e', 'ec39346106006c8af0a55456',
  'c8ab0fd23f2b9bdd0f5c0952', 'feda6107458023a8ad0f6f73'];

const LABEL = /^(重点事業.*|事 業 名|事業種別|※以下から選択|担当課?|課|事業費|（新規・拡充・継続）|\S+ 決算|.*千円|新規|拡充|継続|[―－])$/;
const DEPT = /^[(（]?([^()（）]{2,14}(課|センター|図書館))[)）]?$/;
const isDept = (l: string) => !LABEL.test(l) && DEPT.test(l);
const NAME = /事業(（[^）]+）)?$/;
const YEAR = (label: string) => {
  const m = label.match(/^(H|R)(\d+)$/);
  return m ? eraYear(m[1] === 'R' ? '令和' : '平成', m[2]) : null;
};

/** 重点事業シート (H29–R6): name and 担当課 from the header, 決算 for 3 years only when labels and values run in table order. */
function sheets(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, out: ProjectEvaluation[] = [];
  const starts = [...t.matchAll(/(令和|平成)(\S+)年度重点事業シート\n/g)];
  starts.forEach((m, k) => {
    const fy = eraYear(m[1], ascii(m[2]));
    const end = starts[k + 1]?.index ?? t.length;
    const stop = t.slice(m.index!, end).search(/\n(事業目的|事業内容|事業目標)\n/);
    if (stop < 0) return;
    const head = t.slice(m.index!, m.index! + stop + 1);
    const lines = [...head.matchAll(/[^\n]+/g)].slice(1).map(l => ({ text: l[0], at: m.index! + l.index! }));
    // The first free line is the name; a following short line is either its wrapped tail (adjacent) or an unplaced fragment (reject).
    const rest = lines.filter(l => !LABEL.test(l.text) && !isDept(l.text)), [first, second] = rest;
    let name: string | null = null, raw = '', at = -1;
    if (first && (!second || second.text.length >= 25)) { name = first.text; raw = name; at = first.at; }
    else if (first && second.at === first.at + first.text.length + 1) { name = first.text + second.text; raw = `${first.text}\n${second.text}`; at = first.at; }
    if (!name || !NAME.test(name)) return;
    const p = project(input, name, name, null, raw, at);
    p.projectCode = null; p.evaluatedFiscalYear = fy;
    p.evidence.unshift(evidence(input, m[0].trim(), m.index!));
    const depts = [...new Set(lines.filter(l => isDept(l.text)).map(l => l.text.match(DEPT)![1]))];
    if (depts.length === 1) p.department = depts[0];
    const cost = head.match(/\n(\S+) 決算\n\n(\S+) 決算\n\n(\S+) 決算\n\n([\d,]+ 千円|[―－])\n\n([\d,]+ 千円|[―－])\n\n([\d,]+ 千円|[―－])\n/);
    const years = cost ? [cost[1], cost[2], cost[3]].map(YEAR) : [];
    if (cost && years.every(y => y !== null) && years[2] === fy && years[1] === fy - 1 && years[0] === fy - 2) {
      [cost[4], cost[5], cost[6]].forEach((v, i) => {
        const value = v.match(/^([\d,]+) 千円$/);
        if (value) p.amounts.push(amount(input, 'actual', years[i], value[1], '千円', cost[0].slice(1), m.index! + cost.index! + 1));
      });
    }
    p.warnings.push('重点事業シートの事業名・担当課と、年度見出しと金額が表の順に並ぶ場合のみ事業費（決算）を収録。成果指標・評価（◎○×）・事業種別・次年度以降の事業方針は列の対応が抽出で崩れるため未収録。評価対象年度はシート見出し（○年度重点事業シート）の年度。');
    if (!p.amounts.length) p.warnings.push('事業費（決算）は見出しと金額の並びが崩れている（または学校種別の内訳表記）ため未収録。');
    out.push(p);
  });
  return out;
}

/** H27 report: 重点事業シート with name, (担当課) and a single H27 決算 line in full-width digits. */
function sheetsH27(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!/^教育委員会の権限に属する事務の管理及び\n執行状況に関する点検及び評価報告書\n（ 平成２ ７ 年度分）/.test(t)) return [];
  return [...t.matchAll(/\n重点事業シート\n\n(?:重点事業\S+\n)?(?:事業名\n\(担当課\)\n\n)?([^\n]+事業)\n\((\S+課)\)\n\nH27 決算\n\n([０-９，]+)千円\n/g)].map(m => {
    const p = project(input, m[1], m[1], null, m[0].slice(1), m.index! + 1);
    p.projectCode = null; p.department = m[2]; p.evaluatedFiscalYear = 2015;
    const raw = `H27 決算\n\n${m[3]}千円`;
    p.amounts.push(amount(input, 'actual', 2015, m[3], '千円', raw, m.index! + m[0].indexOf(raw)));
    p.warnings.push('平成27年度分報告書の重点事業シート冒頭（事業名・担当課・H27決算）が連続する様式のみ収録。目的・成果・課題・評価は未構造化。評価対象年度は報告書表題（平成27年度分）による。');
    return p;
  });
}

export const kurume = municipality('40203', IDS, input => [...sheets(input), ...sheetsH27(input)]);
