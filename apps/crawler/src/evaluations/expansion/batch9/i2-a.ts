import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { mergeReprints, sheets } from '../batch7/g1-util';

const OHTAWARA_SHEETS = new Set(['27a26c192f28e44acc6e0d80', '2c33443cdf2f87688072aec8', '376d3d790a722eba650c5378', '4120fc927183d8686b81fa0e',
  '4abf23c095bc6bb7862b0f51', '4ea46612c112556e64676a1f', '4f86aae0c6f404a6976464b9', '5a222a71911d77885cd78f29', '5e38395528ad3459a2400f08',
  '5f28fc64d9d358fd8c34b4af', '65110ce05041e769afa61647', '7236632bd4807e3168056d82', '74b337967d9048ac40a06f5f', '789852b2122d4ed0b614d39d',
  '7a0eaad833134e6262f5107a', '82d81bae595ab30e200828a5', '8628c9a63cdf393cec24ecb3', '86e030319c4be9f8d1a05a44', '92e8515adaba31387942c3b7',
  'c319015e3b373dd5d14399f9', 'effd97c19efb2ee25bfa246c', 'f11d77cc38ebfe75de48ca34', 'f36c2fbf5becf1e4ac593863']);

/** 大田原市 令和6年度事務事業評価シート（大田原市事務事業評価兼実施計画シート 令和8年度版）の各票。 */
export function extractOhtawara(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '09210' || !OHTAWARA_SHEETS.has(input.sourceId)) return [];
  const heading = '大田原市事務事業評価兼実施計画シート';
  const out: ProjectEvaluation[] = [];
  for (const sh of sheets(input.text, heading)) {
    const name = sh.text.match(/\n事務事業名 ([^\n]+)\n/);
    if (!name) continue;
    const p = project(input, name[1], name[1], null, name[0].slice(1, -1), sh.start + name.index! + 1);
    p.evidence.push(evidence(input, heading, sh.start));
    const head = sh.text.slice(0, 1500);
    const d1 = [...head.matchAll(/\n([^\n ]+部) ([^\n ]+課)\n/g)], d2 = [...head.matchAll(/\n部 名\n\n課 名\n\n係 名\n\n([^\n ]+部)\n\n([^\n ]+)\n/g)];
    const dm = d1.length === 1 && !d2.length ? d1[0] : d2.length === 1 && !d1.length ? d2[0] : null;
    if (dm) { p.department = `${dm[1]} ${dm[2]}`; p.evidence.push(evidence(input, dm[0].slice(1, -1), sh.start + dm.index! + 1)); }
    const r = sh.text.match(/評価表からの\n評価\n\n担当課\n評価\n\n(?:評価の理由等\n\n)?([ＡＢＣＤ])\n\n([ＡＢＣＤ])\n/);
    if (r) {
      const ev = evidence(input, r[0].slice(0, -1), sh.start + r.index!);
      p.ratings.push({ kind: 'self', label: '評価表からの評価', value: r[1], scale: null, evidence: ev });
      p.ratings.push({ kind: 'self', label: '担当課評価', value: r[2], scale: null, evidence: ev });
    }
    const f = sh.text.match(/６．部内評価会議の結果 ≪最終評価≫・・・行政評価\n実施日\n\n(?:令\d\d\.\d\d\.\d\d\n\n)?最終評価\n\n(?:今後の取組（修正・改善等）【最終結果】\n\n)?([A-DＡ-Ｄ])\n/);
    if (f) p.ratings.push({ kind: 'self', label: '部内評価会議の結果 最終評価', value: f[1], scale: null, evidence: evidence(input, f[0].slice(0, -1), sh.start + f.index!) });
    p.warnings.push('評価年度・対象年度は未設定（票の「評価年度 令和8年度事業」は実施計画の年度表記で、評価対象年度は票に明記がないため。公開ページでは令和6年度実施事業の評価と説明）。評価表からの評価・担当課評価・最終評価は、ラベル直後に値が並ぶ票だけ収録（段組みで位置が崩れた票は未収録）。コスト計算（決算額・予算額）は単位が票に記載されていないため未収録。活動・成果指標は列の対応が崩れているため未構造化。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectName);
}

const KUNITACHI_SHEETS = new Set(['320a1ca260cc8c2359887882', '4d35d0dc05b0f643c163f1bd', '5c175a584c0340f59a5d0585', '60ac457f707d8053b881d7c7',
  '81123c3cc26d51e29ae15593', '931c47dcf09c43e990e82924', 'a86d150bae5ad3a99621f606', 'a9407c4ce560ce4358b9643b', 'adae7e621f9959a55eb3623d',
  'cbe81c64d8494388a74554cc', 'ec22af273cc42cd5a936a147', 'f59c2a14d545378f356145aa', 'f985d161993b0681005eac44']);
const DIRECTIONS = ['拡充', '継続', '改善', '縮小', '統合', '休止', '廃止', '完了'], SCALES = ['増加', '減少', '現状維持'];

/** 国立市 令和6年度 事務事業マネジメントシート（1資料1事業）。 */
export function extractKunitachi(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13215' || !KUNITACHI_SHEETS.has(input.sourceId)) return [];
  const t = input.text;
  const hd = t.match(/^評価実施\n\n令和\n\n6\n\n事務事業マネジメントシート\n\n年度\n\n事務事業名\n\n([^\n]+)\n/);
  if (!hd) return [];
  const p = project(input, hd[1], hd[1], 2024, hd[0].slice(0, -1), 0);
  const fy = '令和６年度の実績（令和６年度に行った主な活動を具体的に記載）', fyAt = t.indexOf(fy);
  if (fyAt >= 0) { p.evaluatedFiscalYear = 2024; p.evidence.push(evidence(input, fy, fyAt)); }
  const dept = t.match(/\n主管課 ([^\n]+)\n/) ?? t.match(/\n主管課\n\n([^\n]+(?:課|室))\n/);
  if (dept) { p.department = dept[1]; p.evidence.push(evidence(input, dept[0].slice(1, -1), dept.index! + 1)); }
  const resAt = t.indexOf('(1) 評価結果\n');
  if (resAt >= 0) {
    const found = [...t.slice(resAt).matchAll(/(?<=\n)([①②③④]) (必要性|有効性|効率性|公平性)\n\n?((?:✔ )?適切)\n\n?((?:✔ )?見直し余地あり)(?=\n)/g)];
    const picks = found.map(m => ({ m, ok: m[3].startsWith('✔') !== m[4].startsWith('✔') }));
    if (picks.length === 4 && picks.every(x => x.ok) && new Set(found.map(m => m[2])).size === 4) {
      for (const { m } of picks) p.ratings.push({ kind: 'self', label: `評価結果 ${m[1]} ${m[2]}`, value: m[3].startsWith('✔') ? '適切' : '見直し余地あり', scale: '適切／見直し余地あり（✔印）',
        evidence: evidence(input, m[0], resAt + m.index!) });
    }
  }
  const dirAt = t.indexOf('【事業の方向性】 【取組方針】\n');
  if (dirAt >= 0) {
    const lines = [...t.slice(dirAt).matchAll(/(?<=\n)([^\n]+)(?=\n|$)/g)];
    const dirs = lines.filter(l => DIRECTIONS.includes(l[1])), scales = lines.filter(l => SCALES.includes(l[1]));
    if (dirs.length === 1) p.ratings.push({ kind: 'self', label: '令和8年度予算編成に向けて 事業の方向性', value: dirs[0][1], scale: null, evidence: evidence(input, dirs[0][1], dirAt + dirs[0].index!) });
    if (scales.length === 1) p.ratings.push({ kind: 'self', label: '令和8年度予算編成に向けて 予算の規模(R7比較)', value: scales[0][1], scale: null, evidence: evidence(input, scales[0][1], dirAt + scales[0].index!) });
    if (dirs.length === 1 || scales.length === 1) p.evidence.push(evidence(input, '【事業の方向性】 【取組方針】', dirAt));
  }
  p.warnings.push('評価年度は票冒頭の「評価実施 令和6年度」による。評価結果（必要性・有効性・効率性・公平性）は✔印が片方にだけ付いた場合のみ収録。事業の方向性・予算の規模は取組方針欄の中で単独行として現れる語を各1つだけ確認できた場合に収録。主管課は「主管課」ラベルと隣接して読める場合のみ。各指標等の推移・事務事業コストの推移は年度列の対応が崩れているため未収録。');
  return [p];
}
