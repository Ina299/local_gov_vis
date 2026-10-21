import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, dedupe } from '../batch7/g7-util';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** 砥部町 令和４年度【令和３年度事業】教育委員会点検評価報告書: 目次の事業別評価一覧行＋事業別評価表の決算額。 */
function extractTobe(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== '0afdb651405d90ff3b117db5' || !input.text.startsWith('令和４年度【令和３年度事業】\n\n砥部町教育委員会点検評価報告書')) return [];
  const head = input.text.match(/注 1）評価欄には、各施策別評価の「自己評価」を掲載しています。/);
  if (!head) return [];
  const listEnd = input.text.indexOf('－事業別評価表－');
  // Sheet headers: 事業№ N / name / 事業名, with 決算額 label adjacent to the yen value on either side.
  const sheets = new Map<string, { name: string; value: string; raw: string; start: number }>();
  for (const m of input.text.matchAll(/事業№\n\n(\d+)\n\n([^\n]+)\n\n事業名\n\n(?:決算額\n\n([\d,]+)円|([\d,]+)円\n\n決算額)\n/g)) {
    sheets.set(m[1], { name: m[2], value: m[3] ?? m[4], raw: m[0].trimEnd(), start: m.index! });
  }
  const out: ProjectEvaluation[] = [];
  const row = /(?<=\n)(\d+)\n\n([^\n]+)\n\n([^\n]*係[^\n]*)\n\n([A-DＡ-Ｄ])\n\n(維持|拡大|縮小|廃止|改善|完了)\n\n(\d+)\n/g;
  row.lastIndex = head.index!;
  for (const m of input.text.matchAll(row)) {
    if (m.index! > listEnd) break;
    const raw = m[0].trimEnd(), name = m[2];
    const p = project(input, `R3:${m[1]}:${name}`, name, 2022, raw, m.index!);
    p.projectCode = m[1];
    p.department = m[3];
    p.evaluatedFiscalYear = 2021;
    p.evidence.push(evidence(input, head[0], head.index!));
    p.ratings.push({ kind: 'self', label: '自己評価', value: m[4], scale: null, evidence: evidence(input, raw, m.index!) });
    p.ratings.push({ kind: 'self', label: '方向性', value: m[5], scale: null, evidence: evidence(input, raw, m.index!) });
    const s = sheets.get(m[1]);
    // A 3-digit yen total (奨学資金貸与事業「782円」 against 1,680,000円 lent) is a source typo or truncation; keep evidence, not the amount.
    const plausible = s && s.name === name && s.value.replace(/,/g, '').length >= 4;
    if (s && s.name === name) p.evidence.push(evidence(input, s.raw, s.start));
    if (plausible) p.amounts.push(amount(input, 'actual', 2021, s!.value, '円', s!.raw, s!.start));
    p.warnings.push('目次の事業別評価一覧（施策№・事業名・担当係・自己評価・方向性が連続する行のみ）を構造化。行の並びが崩れた事業（№28〜30・33〜35・38〜39等）は列対応を確定できないため除外。評価記号A〜Dの定義は本文にないため scale は未設定。');
    if (plausible) p.warnings.push('決算額は事業別評価表の「決算額」欄（円）に隣接する値のみ採用。表見出しが崩れた事業の決算額は未収録。');
    else if (s && s.name === name) p.warnings.push(`事業別評価表の決算額欄が「${s.value}円」で取組内容の貸与額等と桁が合わないため、金額は未収録（原文根拠のみ保持）。`);
    out.push(p);
  }
  return dedupe(out, p => p.projectCode ?? p.projectName);
}

/** 大刀洗町 令和6年度一般会計主要施策報告書の「施策の実現手段となる事務事業の実施状況・評価」表。 */
const GRADE = '[A-DＡ-Ｄ]';
const NEXT = '継続|拡充|縮小|完了|廃止|統合|休止';
function extractTachiarai(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== '87451904a56d64b323d3a6e1' || !input.text.startsWith('令和6年度\n一般会計に係る主要施策報告書')) return [];
  const H = '施策の実現手段となる事務事業の実施状況・評価';
  const heads = [...input.text.matchAll(new RegExp(H, 'g'))].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  const add = (name: string, nameRaw: string, nameStart: number, g: RegExpMatchArray, gStart: number, r5?: string, r6?: string) => {
    if (/[●▲■△□]/.test(name)) return; // 記入例
    const p = project(input, name, name, null, nameRaw, nameStart);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2024;
    if (nameStart !== gStart) p.evidence.push(evidence(input, g[0], gStart));
    for (const [label, v] of [['必要性', g[1]], ['有効性', g[2]], ['効率性', g[3]], ['次年度', g[4]]] as const) {
      p.ratings.push({ kind: 'self', label, value: v, scale: null, evidence: evidence(input, g[0], gStart) });
    }
    if (r5 && r6) {
      p.amounts.push(amount(input, 'actual', 2023, r5, '円', g[0], gStart));
      p.amounts.push(amount(input, 'actual', 2024, r6, '円', g[0], gStart));
    }
    p.warnings.push('令和6年度主要施策報告書（決算）の事務事業評価表から、事業名と評価（必要性・有効性・効率性・次年度）の対応が確定できる行のみ構造化。評価年度の明記がないため evaluationYear は未設定。所属課は表内で列が崩れるため未設定。');
    p.warnings.push(r5 && r6 ? '決算額は令和5年度・令和6年度の2値が評価欄に連続して並ぶ行のみ採用。' : '決算額は列（令和5年度／令和6年度）の対応が確定できないため未収録。');
    out.push(p);
  };
  for (let k = 0; k < heads.length; k++) {
    const start = heads[k], endMark = input.text.indexOf('次年度の状況', start);
    const end = Math.min(endMark < 0 ? input.text.length : endMark, heads[k + 1] ?? input.text.length);
    const blk = input.text.slice(start, end);
    // A: name, amounts and grades contiguous on consecutive cells.
    const contiguous = new RegExp(`(?<=\\n\\n)([^\\n\\d][^\\n]*)\\n\\n(?:〇\\n\\n)?([\\d,]+)\\n\\n([\\d,]+)\\n\\n(${GRADE})\\n\\n(${GRADE})\\n\\n(${GRADE})\\n\\n(${NEXT})`, 'g');
    const used = new Set<number>();
    for (const m of blk.matchAll(contiguous)) {
      if (new RegExp(`^(${NEXT}|${GRADE}|次年度|効率性|有効性|必要性|令和[56]年度|事務事業|主要|施策|容|－)$`).test(m[1])) continue;
      const g = m[0].slice(m[0].indexOf(m[2] + '\n\n' + m[3]));
      const gStart = start + m.index! + m[0].length - g.length;
      const gm = g.match(new RegExp(`(${GRADE})\\n\\n(${GRADE})\\n\\n(${GRADE})\\n\\n(${NEXT})$`))!;
      used.add(gStart + g.length - gm[0].length);
      add(m[1], m[0], start + m.index!, [m[0], gm[1], gm[2], gm[3], gm[4]] as unknown as RegExpMatchArray, start + m.index!, m[2], m[3]);
    }
    // B: numbered names 1..n paired in order with n grade groups (only when counts agree and nothing was taken by A).
    if (used.size) continue;
    const names = [...blk.matchAll(/(?<=\n\n)(\d)\n\n([^\n\d〇][^\n]*(?:\n[^\n\d〇][^\n]*)?)(?=\n\n)/g)];
    const groups = [...blk.matchAll(new RegExp(`(?:([\\d,]+)\\n\\n)?(?:([\\d,]+)\\n\\n)?(${GRADE})\\n\\n(${GRADE})\\n\\n(${GRADE})\\n\\n(${NEXT})`, 'g'))];
    if (!names.length || names.length !== groups.length || names.some((n, i) => Number(n[1]) !== i + 1)) continue;
    if (names.some(n => /評価|必要性|決算額|事務事業|主要|施策/.test(n[2]))) continue;
    names.forEach((n, i) => {
      const g = groups[i], two = g[1] !== undefined && g[2] !== undefined;
      const gg = [g[0], g[3], g[4], g[5], g[6]] as unknown as RegExpMatchArray;
      add(n[2].replace(/\n/g, ''), n[0], start + n.index!, gg, start + g.index!, two ? g[1] : undefined, two ? g[2] : undefined);
    });
  }
  return dedupe(out, p => p.projectName);
}

export const entries: Record<string, Entry> = {
  '38402': { extract: extractTobe, scope: '令和４年度砥部町教育委員会点検評価報告書（令和３年度事業）の事業別評価一覧（事業名・担当係・自己評価・方向性）と事業別評価表の決算額（円）。行の崩れた事業・取組内容の数値・教育委員会活動状況は対象外' },
  '40503': { extract: extractTachiarai, scope: '令和6年度大刀洗町一般会計主要施策報告書の「事務事業の実施状況・評価」表のうち事業名と評価（必要性・有効性・効率性・次年度）の対応が確定できる行（決算額は2年度分が連続する行のみ）。施策単位の予算・決算、成果指標、決算概要は対象外' },
};
