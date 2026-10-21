import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, ascii, dedupe, eraYear, isNum } from './g7-util';

const SCALE = '５：「極めて高い」、４：「高い」、３：「普通」、２：「低い」、１：「極めて低い」';

/** 港区 平成29年度 事務事業評価シート（所管課別PDF）。評価結果一覧・三次評価・名簿・案内は対象外。 */
export function extractMinato(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13103' || !/\/documents\/78804\/h29[a-z]+\.pdf$/.test(input.sourceUrl)) return [];
  const heads = [...input.text.matchAll(/Ｎｏ\n\n(平成([２-３０-９0-9]+)年度)\n\n(\d+)\n\n港区事務事業評価シート\n/g)];
  const out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i], start = h.index!, end = heads[i + 1]?.index ?? input.text.length;
    if (input.truncated && i === heads.length - 1) continue;
    const seg = input.text.slice(start, end);
    const name = seg.match(/\n事 務 事 業 名 ([^\n]+)\n/);
    const dept = seg.match(/\n属 ([^\n]+)\n/);
    const year = eraYear('平成', h[2]);
    if (!name || !year) continue;
    // Evidence: sheet header through the project-name line (exact substring).
    const p = project(input, `No${h[3]}`, name[1].trim(), year, seg.slice(0, name.index! + name[0].length - 1), start);
    if (dept) { p.department = dept[1].trim(); p.evidence.push(evidence(input, dept[0].slice(1, -1), start + dept.index! + 1)); }
    // 事業費の状況(単位：千円): keep only rows whose 11 columns pass the sheet's own arithmetic.
    const tbl = seg.indexOf('事業費の状況(単位：千円)'), tblEnd = seg.indexOf('予算・決算に関', tbl);
    if (tbl >= 0 && tblEnd > tbl) {
      const body = seg.slice(tbl, tblEnd);
      const rows = [...body.matchAll(/平成([２-３０-９]+)年度((?:\s+(?:\d+%|[-\d,]+|－))+)/g)];
      for (const r of rows) {
        const toks = r[2].trim().split(/\s+/), fy = eraYear('平成', r[1]);
        if (!fy) continue;
        const rawRow = r[0], rowStart = start + tbl + r.index!;
        if (toks.length === 11 && toks.slice(0, 10).every(isNum) && /^\d+%$/.test(toks[10])) {
          const n = toks.map(t => Number(ascii(t).replaceAll(',', '')));
          if (n[0] !== n[1] + n[2] + n[3] + n[4] + n[5] || n[0] + n[6] + n[7] !== n[8]) continue;
          p.amounts.push(amount(input, 'budget', fy, toks[0], '千円', rawRow, rowStart));
          p.amounts.push(amount(input, 'actual', fy, toks[9], '千円', rawRow, rowStart));
        } else if (toks.length === 9 && toks.slice(0, 6).every(isNum) && toks.slice(6).every(t => t === '－')) {
          const n = toks.slice(0, 6).map(t => Number(ascii(t).replaceAll(',', '')));
          if (n[0] !== n[1] + n[2] + n[3] + n[4] + n[5]) continue;
          p.amounts.push(amount(input, 'budget', fy, toks[0], '千円', rawRow, rowStart));
        }
      }
      if (p.amounts.length) p.evidence.push(evidence(input, '事業費の状況(単位：千円)', start + tbl));
    }
    // 一次評価: the three 1-5 scores appear as standalone lines in row order (①必要性, ②効果性, ③効率性) even when labels are split.
    const rs = seg.indexOf('(付帯意見への対応等)'), re = seg.indexOf('※評価は、５', rs);
    if (rs >= 0 && re > rs) {
      const region = seg.slice(rs, re), scores = [...region.matchAll(/\n([1-5])\n/g)];
      if (scores.length === 3 && region.includes('一次評価（所管課による自己評価）')) {
        const ev = evidence(input, region.trimEnd(), start + rs);
        ['①必要性', '②効果性', '③効率性'].forEach((label, k) => p.ratings.push({ kind: 'self', label: `一次評価（所管課による自己評価）${label}`, value: scores[k][1], scale: SCALE, evidence: ev }));
      }
    }
    p.warnings.push('港区事務事業評価シート（平成29年度）。予算額・決算額は「事業費の状況(単位：千円)」の行のうち、当初予算額＝財源内訳の合計、予算現額＝当初＋流用＋補正が成り立つ行だけを採用（列崩れ行は不採用）。評価対象年度は本文で明示されないため未設定。');
    p.warnings.push('指標は指標1〜3の列が抽出テキスト上で混在するため構造化せず。総合評価（拡充・継続等）は選択肢が全て列記され選択結果が本文から判別できないため未収録。');
    out.push(p);
  }
  return dedupe(out, p => `${p.evaluationYear}\n${p.projectName}`);
}
