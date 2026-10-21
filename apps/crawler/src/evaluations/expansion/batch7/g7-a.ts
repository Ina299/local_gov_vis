import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, dedupe, num } from './g7-util';

const SHIROI_DOCS = new Set(['ac37e3186a1d78d361e285ca', '888618edf5bafc77311212e1', '96ee62ae03edfa9281645060', 'f2742f357ca53e7051b63d6b',
  '112907b58dcfb875ee518de0', '10f1d23f994c76bda431d205']);

/** 白井市（後期）第2次実施計画事業（平成27年度事業）事後評価シート。評価対象事業一覧は対象外。 */
export function extractShiroi(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '12232' || !SHIROI_DOCS.has(input.sourceId)) return [];
  const t = input.text, heads = [...t.matchAll(/（平成27年度事業）事後評価シート/g)];
  const starts = heads.map(h => t.lastIndexOf('評価基準日', h.index!)).filter(s => s >= 0);
  const out: ProjectEvaluation[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i], end = starts[i + 1] ?? t.length;
    if (input.truncated && i === starts.length - 1) continue;
    const seg = t.slice(start, end);
    const name = seg.match(/\n事務事業名\n([^\n]+)\n実施期間\n/), code = seg.match(/\n事業コード ([\d ]+- [\d ]+- [\d ]+)\n/);
    if (!name || !code) continue;
    const projectCode = code[1].replace(/ /g, '');
    const p = project(input, projectCode, name[1].trim(), 2016, name[0].slice(1, -1), start + name.index! + 1);
    p.evaluatedFiscalYear = 2015;
    const head = seg.match(/（平成27年度事業）事後評価シート/)!;
    p.evidence.push(evidence(input, head[0], start + head.index!), evidence(input, code[0].trim(), start + code.index! + 1));
    const dept = seg.match(/\n担当部 ([^\n]+)\n課・室\n([^\n]+)\n/);
    if (dept) { p.department = `${dept[1].trim()} ${dept[2].trim()}`; p.evidence.push(evidence(input, dept[0].slice(1, -1), start + dept.index! + 1)); }
    // 決算 columns carry staff rows; keep only blocks where 財源合計=小計 and 小計+人件費合計=事業費合計.
    const fs = seg.indexOf('４．事業費'), fe = seg.indexOf('５．事業の評価指標', fs);
    if (fs >= 0 && fe > fs) {
      const blocks = [...seg.slice(fs, fe).matchAll(/\n([\d,]+)\n([\d,]+)\n([\d,]+)\n([\d,]+)\n([\d,]+)\n([\d,]+)\n(\d+\.\d+)\n([\d,]+)\n([\d,]+)\n([\d,]+)\n/g)]
        .filter(b => { const n = b.slice(1).map(num); return n[0] + n[1] + n[2] + n[3] + n[4] === n[5] && n[5] + n[8] === n[9]; });
      // Every sheet prints the per-staff cost 8,328 (H26) before 7,942 (H27); require that order so columns cannot swap silently.
      if (blocks.length === 2 && blocks[0][8] === '8,328' && blocks[1][8] === '7,942') blocks.forEach((b, k) => {
        const raw = b[0].slice(1, -1), at = start + fs + b.index! + 1, fy = 2014 + k;
        p.amounts.push(amount(input, 'actual', fy, b[6], '千円', raw, at), amount(input, 'personnel', fy, b[9], '千円', raw, at), amount(input, 'fullCost', fy, b[10], '千円', raw, at));
      });
    }
    const sections: [string, string, RegExp][] = [
      ['平成28年度の方向性（主管課等長の判断）', '１０．平成２８年度の方向性', /＜平成２８年度の事業説明＞/],
      ['平成29年度の方向性（主管課等長の判断）', '１１．平成２９年度の方向性', /＜平成２９年度の事業説明＞/],
      ['平成28年度の方向性（評価委員会による評価）', '１３．平成２８年度の方向性', /＜意見記入欄＞/],
      ['平成29年度の方向性（評価委員会による評価）', '１４．平成２９年度の方向性', /＜意見記入欄＞/]];
    for (const [label, from, until] of sections) {
      const a = seg.indexOf(from); if (a < 0) continue;
      const b = seg.slice(a).search(until); if (b < 0) continue;
      const body = seg.slice(a, a + b), marks = [...body.matchAll(/^● ([ア-カ])：([^\n]+)$/gm)], subs = [...body.matchAll(/^● ([ａ-ｆ]) ?：([^\n]+)$/gm)];
      if (marks.length !== 1 || subs.length > 1) continue;
      const value = marks[0][1] + '：' + marks[0][2] + (subs.length ? ` ${subs[0][1]}：${subs[0][2]}` : '');
      p.ratings.push({ kind: label.includes('評価委員会') ? 'external' : 'self', label, value, scale: null, evidence: evidence(input, body.trimEnd(), start + a) });
    }
    p.warnings.push('白井市 平成27年度事業 事後評価シート（平成28年5月31日評価基準日）。事業費は「４．事業費」のうち財源内訳の合計＝小計、小計＋人件費合計＝事業費合計が成り立つ決算列ブロックが2つある場合のみ、出現順（従事職員1人当たり人件費8,328→7,942の順を確認）に平成26・27年度決算として採用。事業費＝小計、人件費＝人件費合計、総コスト＝事業費合計（予算・要求予定額は列対応が崩れるため不採用）。');
    p.warnings.push('評価指標・自己評価（●印の位置が選択肢と行ずれ）は抽出テキスト上で対応が確定できないため未収録。方向性は「● ア：…」のように同一行に●がある場合のみ収録。');
    out.push(p);
  }
  // Already structured for 2016 from the 評価概要 PDF: the new sheet records are excluded rather than merged.
  return dedupe(out, p => p.projectName).filter(p => !SHIROI_EXISTING.has(p.projectName));
}
const SHIROI_EXISTING = new Set(['私立保育園補助等事業', '一時保育事業', '家庭的保育事業', '学童保育所事業', '補助教員配置事業', '学校運営支援事業', '外部人材活用事業',
  '私立幼稚園振興事業', '建築物耐震化支援事業', '道路環境整備事業', '地域福祉計画推進事業', '保育園食育推進事業']);

/** 古河市 成果説明書兼事業評価書（令和6年度実施計画における重点事業）。重点事業一覧表は対象外。 */
export function extractKoga(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '08204' || input.sourceId !== '4d27bd1866433c93d9985348') return [];
  const t = input.text, heads = [...t.matchAll(/^事業名称\n\n([^\n]+)\n\n/gm)];
  const out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i], start = h.index!, end = heads[i + 1]?.index ?? t.length;
    if (input.truncated && i === heads.length - 1) continue;
    const seg = t.slice(start, end), code = seg.match(/事業ｺｰﾄﾞ (\d+)\n/);
    if (!code || !seg.includes('■事業費')) continue;
    const p = project(input, code[1], h[1].trim(), null, h[0].trimEnd(), start);
    p.evidence.push(evidence(input, code[0].trimEnd(), start + code.index!));
    // 所属課 sits right after the name on most sheets but drifts below the narrative on others.
    const dept = seg.slice(0, 1200).match(/\n\n所属課\n\n([^\n]+課)\n/);
    if (dept) { p.department = dept[1]; p.evidence.push(evidence(input, dept[0].trim(), start + dept.index! + 2)); }
    p.evaluatedFiscalYear = 2024;
    const r6 = seg.match(/令和 6年度（実績）\n令和 7年度（予算）\n国庫支出金\n千円\n([\d,]+)\n県支出金\n千円\n([\d,]+)\n地方債\n千円\n([\d,]+)\nその他\n千円\n([\d,]+)\n一般財源\n千円\n([\d,]+)\n事業費計\n千円\n([\d,]+)\n/);
    if (r6) {
      const n = r6.slice(1).map(num);
      if (n[0] + n[1] + n[2] + n[3] + n[4] === n[5]) {
        p.amounts.push(amount(input, 'actual', 2024, r6[6], '千円', r6[0].trimEnd(), start + r6.index!));
        const rest = seg.slice(r6.index! + r6[0].length, seg.indexOf('■指標', r6.index!) >= 0 ? seg.indexOf('■指標', r6.index!) : undefined);
        const b7 = [...rest.matchAll(/\n([\d,]+)\n([\d,]+)\n([\d,]+)\n([\d,]+)\n([\d,]+)\n([\d,]+)\n(\d+\.\d\d)\n/g)]
          .filter(b => { const m = b.slice(1, 7).map(num); return m[0] + m[1] + m[2] + m[3] + m[4] === m[5]; });
        if (b7.length === 1) p.amounts.push(amount(input, 'budget', 2025, b7[0][6], '千円', b7[0][0].slice(1, -1), start + r6.index! + r6[0].length + b7[0].index! + 1));
      }
    }
    const res = seg.match(/■評価結果\n①妥当性\n②有効性\n③効率性\n④公平性\n\n([■□]) 適切\n([■□]) 適切\n([■□]) 適切\n([■□]) 適切\n\n([■□]) 見直し余地あり\n([■□]) 見直し余地あり\n([■□]) 見直し余地あり\n([■□]) 見直し余地あり\n/);
    if (res) {
      const ev = evidence(input, res[0].trimEnd(), start + res.index!);
      ['①妥当性', '②有効性', '③効率性', '④公平性'].forEach((label, k) => {
        const ok = res[1 + k], review = res[5 + k];
        if (ok === review) return;
        p.ratings.push({ kind: 'self', label: `評価結果 ${label}`, value: ok === '■' ? '適切' : '見直し余地あり', scale: '適切／見直し余地あり', evidence: ev });
      });
      const after = seg.slice(res.index! + res[0].length, res.index! + res[0].length + 120);
      const dir = after.match(/^\n?([■□]) 終了\n\n([■□]) 継続\n\n([■□]) 改革改善を行う\n\n([■□]) 廃止\n\n([■□]) 休止\n\n([■□]) 現状維持\n/);
      if (dir) {
        const g1 = [['終了', dir[1]], ['継続', dir[2]]].filter(([, m]) => m === '■'), g2 = [['改革改善を行う', dir[3]], ['廃止', dir[4]], ['休止', dir[5]], ['現状維持', dir[6]]].filter(([, m]) => m === '■');
        if (g1.length === 1 && g2.length === 1) p.ratings.push({ kind: 'self', label: '評価結果（今後の方向性）', value: `${g1[0][0]}／${g2[0][0]}`, scale: null,
          evidence: evidence(input, dir[0].replace(/^\n/, '').trimEnd(), start + res.index! + res[0].length + (dir[0].startsWith('\n') ? 1 : 0)) });
      }
    }
    p.warnings.push('古河市 成果説明書兼事業評価書（令和6年度実施計画の重点事業）。評価実施年度は本文に明示がないため未設定。令和6年度実績事業費は財源内訳の合計＝事業費計を確認して採用、令和7年度予算は財源内訳＋従事人数の数値列が合計整合し一意に特定できる場合のみ採用。');
    p.warnings.push('指標表（目標・見込／実績の列）は抽出テキスト上で列の対応が確定できないため未収録。目的評価の○印も位置対応が確定できないため未収録。');
    out.push(p);
  }
  return dedupe(out, p => p.projectName);
}

/** 勝浦市 実施計画事業調書・事業評価書（R6事業）。施策評価（参考指標・二次評価）は対象外。 */
export function extractKatsuura(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '12218' || input.sourceId !== '92d0644d2e0102a0c6841a37') return [];
  const t = input.text, heads = [...t.matchAll(/■実施計画事業調書\n事業番号\n\n(\d+)\n\n事業名\n/g)];
  const out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i], start = h.index!, end = heads[i + 1]?.index ?? t.length;
    if (input.truncated && i === heads.length - 1) continue;
    const seg = t.slice(start, end);
    const nm = seg.match(/\n会計区分\n\n[^\n]+\n\n([^\n]+)\n\n再掲区分\n\n所管課\n\n(?:-\n\n)?([^\n]+)\n\n全体事業内容\n/);
    if (!nm || !seg.includes('■事業評価書')) continue;
    const p = project(input, h[1], nm[1].trim(), null, seg.slice(0, nm.index! + nm[0].length).trimEnd(), start);
    p.department = nm[2].trim();
    for (const [fy, label] of [[2023, '５'], [2024, '６']] as const) {
      for (const [kind, word] of [['budget', '予算額'], ['actual', '決算額']] as const) {
        const m = seg.match(new RegExp(`\\nＲ${label}${word}\\n([\\d,]+)\\n`));
        if (m) p.amounts.push(amount(input, kind, fy, m[1], '千円', m[0].slice(1, -1), start + m.index! + 1));
      }
    }
    if (p.amounts.length) p.evidence.push(evidence(input, '（単位：千円）', start + seg.indexOf('（単位：千円）')));
    p.warnings.push('勝浦市 R6事業 実施計画事業調書・事業評価書。R5・R6の予算額・決算額は、ラベル「ＲＮ予算額／ＲＮ決算額」の直後の行に単独の数値がある場合のみ採用（単位：千円）。列が崩れてラベルと数値が離れている欄は不採用。');
    p.warnings.push('主な目標・目標数値・結果・達成度・今後の方向性はR5〜R8の列が抽出テキスト上で混在し年度対応が確定できないため未収録。評価実施年度・評価対象年度は本文で特定できないため未設定。');
    out.push(p);
  }
  return dedupe(out, p => `${p.projectCode}\n${p.projectName}`);
}

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '12232': { extract: extractShiroi, scope: '白井市（後期）第2次実施計画事業（平成27年度事業）事後評価シートの事業名・事業コード・担当・合計整合した平成26/27年度決算事業費・方向性（●が同一行のもの）。評価対象事業一覧・指標・自己評価は対象外' },
  '08204': { extract: extractKoga, scope: '古河市 成果説明書兼事業評価書（令和6年度重点事業）の事業名・事業コード・所属課・令和6年度実績事業費・令和7年度予算・評価結果（妥当性等4観点と方向性）。重点事業一覧・指標表は対象外' },
  '12218': { extract: extractKatsuura, scope: '勝浦市 R6事業 実施計画事業調書・事業評価書の事業番号・事業名・所管課とラベル直後のR5/R6予算額・決算額。施策評価（参考指標・二次評価）・目標・達成度・方向性は対象外' },
};
