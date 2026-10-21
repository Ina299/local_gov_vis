import type { EvaluationAmount, EvaluationIndicator, EvaluationRating, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

/**
 * 海陽町 令和6年度 教育委員会事務事業点検・評価報告書（令和7年度実施）。
 * - 「令和７年度（令和６年度決算）事務事業評価シート」1枚1事業。事業名・事業費（Ｒ４〜Ｒ６、千円）・成果指標（Ｒ３〜Ｒ７の目標／実績）。
 * - 「（２）抽出した１１事業の一次評価と二次評価と意見」の評価・取組の方向性（外部評価対象の11事業のみ）。
 * シート上の一次評価・方向性の○印は抽出テキストで選択肢との対応が崩れているため転記しない。
 * 鬼北町（38488）の点検・評価報告書は基本施策単位で複数事業をまとめて判定しており、事務事業単位ではないため対象外。
 */
const KAIYO = '351573c2f052934af6522a86';
const SHEET = /令和[7７]年度（令和[6６]年度決算）事務事業評価シート/g;
const EXTERNAL = '４．外部評価委員会の意見';
const NUM = /^(?:\d{1,3}(?:,\d{3})+|\d+)$/;
const CELL = /^(?:\d+(?:\.\d+)?%?|[-―])$/;
const BLANK = /^[-―]$/;
const LABEL = (y: string) => new RegExp(`^[ＲR][${y}]$`);
const LABEL_R = { r4: LABEL('４4'), r5: LABEL('５5'), r6: LABEL('６6') };
const INDICATOR_HEAD = 'Ｒ３\n\nＲ４\n\nＲ５\n\nＲ６\n\nＲ７\n\n';
const INDICATOR_NAME = '成\n\n果\n\n指\n\n標\n\n名\n\n';
const LEGEND = '\n\n※各年度の\n数値は\n上段が目標値\n下段が実績値\n\n';

type Para = { text: string; start: number };
function paragraphs(text: string, from: number, to: number): Para[] {
  const out: Para[] = [];
  const re = /[^\n]+(?:\n[^\n]+)*/g;
  re.lastIndex = from;
  for (let m = re.exec(text); m && m.index < to; m = re.exec(text)) out.push({ text: m[0], start: m.index });
  return out;
}

/** 事業費の欄: Ｒ４・Ｒ５・Ｒ６の各ラベルに数値が一つずつ対応する並びだけ採用する。 */
function costs(input: CachedInput, from: number, to: number): { amounts: EvaluationAmount[]; note: string | null } {
  const t = input.text, head = t.indexOf('事業費\n（千円）', from);
  if (head < 0 || head > to) return { amounts: [], note: '事業費の欄が見つからないため金額を転記していません。' };
  const ps = paragraphs(t, head, to);
  const i4 = ps.findIndex(p => LABEL_R.r4.test(p.text)), i5 = ps.findIndex(p => LABEL_R.r5.test(p.text)), i6 = ps.findIndex(p => LABEL_R.r6.test(p.text));
  const fail = { amounts: [], note: '事業費の欄は抽出テキストで年度ラベルと数値の対応が確定できないため金額を転記していません。' };
  if (i4 < 0 || i5 < 0 || i6 < 0 || !(i4 < i5 && i5 < i6)) return fail;
  // Ｒ４とＲ５の間: 数値はちょうど1つ（事業目的の文章は可、指標欄の混入は不可）。
  const between = ps.slice(i4 + 1, i5), n4 = between.filter(p => NUM.test(p.text) || BLANK.test(p.text));
  if (n4.length !== 1 || between.some(p => /成果指標|評価番号|^\d+$/.test(p.text) && p !== n4[0])) return fail;
  if (i5 + 1 >= ps.length) return fail;
  const v5 = ps[i5 + 1];
  if (!(NUM.test(v5.text) || BLANK.test(v5.text))) return fail;
  let v6: Para | null = null, v6raw: string;
  const after5 = ps[i5 + 2], combined = after5?.text.match(/^([\d,]+|[-―]) 所管種別/);
  if (combined && i6 === i5 + 3) { v6 = { text: combined[1], start: after5.start }; }
  else if (i6 === i5 + 2) {
    const a = ps[i6 + 1], b = ps[i6 + 2];
    if (a && (NUM.test(a.text) || BLANK.test(a.text)) && b && /^所管種別/.test(b.text)) v6 = a;
    else if (a && /^所管種別$/.test(a.text) && b && (NUM.test(b.text) || BLANK.test(b.text))) v6 = b;
  }
  if (!v6 || !NUM.test(v6.text.replaceAll(',', '')) && !BLANK.test(v6.text)) return fail;
  const last = Math.max(v6.start + v6.text.length, ps[i6].start + ps[i6].text.length);
  v6raw = t.slice(ps[i4].start, last);
  const amounts: EvaluationAmount[] = [];
  for (const [fy, p] of [[2022, n4[0]], [2023, v5], [2024, v6]] as const) {
    if (BLANK.test(p.text)) continue;
    amounts.push({ kind: 'actual', fiscalYear: fy, amountYen: Number(p.text.replaceAll(',', '')) * 1000, rawValue: p.text, rawUnit: '千円',
      evidence: evidence(input, v6raw, ps[i4].start) });
  }
  return { amounts, note: '事業費（千円）は表題「令和６年度決算」の事務事業評価シートのＲ４〜Ｒ６欄を決算額として転記。' };
}

/** 成果指標: 指標名欄の直後に凡例が来る並びで、Ｒ３〜Ｒ７見出しの後に目標5値・実績4値が連続する場合のみ。 */
function indicators(input: CachedInput, from: number, to: number): EvaluationIndicator[] {
  const t = input.text, slice = t.slice(from, to);
  if (slice.split(INDICATOR_HEAD).length !== 2 || slice.split(INDICATOR_NAME).length !== 2) return [];
  const nameAt = from + slice.indexOf(INDICATOR_NAME) + INDICATOR_NAME.length;
  const nameEnd = t.indexOf(LEGEND, nameAt);
  if (nameEnd < 0) return [];
  const name = t.slice(nameAt, nameEnd);
  if (!name || name.includes('\n')) return [];
  const head = from + slice.indexOf(INDICATOR_HEAD);
  if (head < nameEnd) return [];
  const ps = paragraphs(t, head + INDICATOR_HEAD.length, to);
  if (ps.length < 10 || !ps.slice(0, 9).every(p => CELL.test(p.text)) || CELL.test(ps[9].text)) return [];
  const raw = t.slice(nameAt, ps[8].start + ps[8].text.length);
  const unit = name.match(/[（(]([^（()）]+)[）)]$/)?.[1] ?? null;
  const cell = (p: Para | undefined) => (!p || BLANK.test(p.text) ? null : p.text);
  const out: EvaluationIndicator[] = [];
  for (let k = 0; k < 5; k++) {
    const target = cell(ps[k]), actual = k < 4 ? cell(ps[5 + k]) : null;
    if (target === null && actual === null) continue;
    out.push({ name, fiscalYear: 2021 + k, target, actual, unit, evidence: evidence(input, raw, nameAt) });
  }
  return out;
}

const EXT_ROW = /\n\n([^\n]+)\n\n一次評価（自己評価）二次評価（外部評価）\n評価\n([ＡＢＣＤ])\n\n取組の方向性 評価\n([^\n]+)\n\n([ＡＢＣＤ])\n\n取組の方向性\n([^\n]+)\n/g;
const GRADE_SCALE = 'Ａ 目標達成率100%超／Ｂ 80%以上～100%／Ｃ 60%以上～80%未満／Ｄ 60%未満';
const DIRECTION_SCALE = '拡充／継続／縮小／見直し／休廃止';

function externalRatings(input: CachedInput): Map<string, EvaluationRating[]> {
  const t = input.text, at = t.indexOf(EXTERNAL), out = new Map<string, EvaluationRating[]>();
  if (at < 0) return out;
  EXT_ROW.lastIndex = at;
  for (let m = EXT_ROW.exec(t); m; m = EXT_ROW.exec(t)) {
    const start = m.index + 2, raw = m[0].slice(2, -1);
    const key = m[1].normalize('NFKC');
    if (out.has(key)) { out.delete(key); continue; }
    out.set(key, [
      { kind: 'self', label: '一次評価（自己評価） 評価', value: m[2], scale: GRADE_SCALE, evidence: evidence(input, raw, start) },
      { kind: 'self', label: '一次評価（自己評価） 取組の方向性', value: m[3], scale: DIRECTION_SCALE, evidence: evidence(input, raw, start) },
      { kind: 'external', label: '二次評価（外部評価） 評価', value: m[4], scale: GRADE_SCALE, evidence: evidence(input, raw, start) },
      { kind: 'external', label: '二次評価（外部評価） 取組の方向性', value: m[5], scale: DIRECTION_SCALE, evidence: evidence(input, raw, start) },
    ]);
  }
  return out;
}

function kaiyo(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== KAIYO) return [];
  const t = input.text, end = t.indexOf(EXTERNAL);
  if (end < 0) return [];
  const starts = [...t.matchAll(SHEET)].map(m => m.index!).filter(i => i < end);
  const ext = externalRatings(input), records: ProjectEvaluation[] = [];
  starts.forEach((from, k) => {
    const to = starts[k + 1] ?? end, slice = t.slice(from, to);
    const names = [...slice.matchAll(/\n事業名\n\n([^\n]+)\n/g)];
    if (names.length !== 1) return;
    const name = names[0][1], nameEnd = from + names[0].index! + names[0][0].length - 1;
    const code = slice.match(/^[^\n]+\n(\d+)\n\n評価番号\n/)?.[1] ?? null;
    // 評価番号が取れないシートもあるため、ID は事業名で安定化する（projectCode には原文の番号だけを入れる）。
    const p = project(input, `sheet:${name}`, name, 2025, t.slice(from, nameEnd), from);
    p.projectCode = code;
    p.evaluatedFiscalYear = 2024;
    if (!code) p.warnings.push('評価番号の位置が抽出テキストで崩れているため、番号は転記していません。');
    const cost = costs(input, from, to);
    p.amounts.push(...cost.amounts);
    if (cost.note) p.warnings.push(cost.note);
    p.indicators.push(...indicators(input, from, to));
    if (!p.indicators.length) p.warnings.push('成果指標は指標名・年度欄の対応が抽出テキストで確定できないため転記していません。');
    const r = ext.get(name.normalize('NFKC'));
    if (r) p.ratings.push(...r);
    p.warnings.push('シート上の一次評価（Ａ〜Ｄ）・取組の方向性の○印は抽出テキストで選択肢との対応が確定できないため転記していません（外部評価対象事業は「外部評価委員会の意見」の表から転記）。');
    p.extractionStatus = p.amounts.length && p.indicators.length ? 'extracted' : 'partial';
    records.push(p);
  });
  // 同名事業（評価番号違い）は同一年度の識別が衝突するため除外する。
  const count = new Map<string, number>();
  for (const r of records) count.set(r.projectName, (count.get(r.projectName) ?? 0) + 1);
  return records.filter(r => count.get(r.projectName) === 1);
}

export const kaiyoKihokuEntries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '36388': { extract: kaiyo, scope: '海陽町教育委員会 令和6年度事務事業点検・評価報告書の事務事業評価シート（事業名・事業費Ｒ４〜Ｒ６決算・成果指標の目標／実績）と、外部評価対象11事業の一次・二次評価と取組の方向性。シート上の○印による一次評価・方向性、事業目的等の文章、同名で2件ある「子どもあゆみ活用事業」は構造化しない。' },
};
export const entries = kaiyoKihokuEntries;
