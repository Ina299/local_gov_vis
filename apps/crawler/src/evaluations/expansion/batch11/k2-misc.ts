import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, ascii, eraYear, normalize, rating } from '../batch8/h6-util';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** 同じ事業名・同じ年度が複数ある場合は同一事業か別事業か確定できないため、すべて除外する。 */
function uniqueByName(records: ProjectEvaluation[]): ProjectEvaluation[] {
  const count = new Map<string, number>();
  const key = (p: ProjectEvaluation) => `${p.projectName}:${p.evaluatedFiscalYear}`;
  for (const p of records) count.set(key(p), (count.get(key(p)) ?? 0) + 1);
  return records.filter(p => count.get(key(p)) === 1);
}

/* ---------- 09211 矢板市 地方創生臨時交付金 個別事業の評価報告 ---------- */

const YAITA_SHEETS: Record<string, string> = {
  'bef4d1192bc0c19ed3269ed7': '令和 3 年度新型コロナウイルス感染症対応地方創生臨時交付金\n個別事業の評価報告',
  'b96cff30591136d60b614b05': '令和５年度新型コロナウイルス感染症対応地方創生臨時交付金\n個別事業の評価報告',
  '35defc049114e6bd409dcfae': '令和５年度物価高騰対応重点支援地方創生臨時交付金\n個別事業の評価報告',
};
const YAITA_R2 = '764d3c3c9eb61838cf8c19c3';
const YAITA_DEPT = /^[^\s\d,]+(?:課|室|センター)(?: 他)?$/;

/** 「R3.4.19」形式の日付の会計年度（4月始まり）。 */
function fiscalOf(d: string): number | null {
  const m = /^R\.?(\d+)\.(\d+)\.(\d+)$/.exec(d.trim());
  if (!m) return null;
  const y = 2018 + Number(m[1]), mo = Number(m[2]);
  return mo >= 4 ? y : y - 1;
}

function yaitaSheets(input: CachedInput): ProjectEvaluation[] {
  const title = YAITA_SHEETS[input.sourceId];
  if (!title || !input.text.startsWith(title)) return [];
  const t = input.text, starts = [...t.matchAll(/\n事業年度\n\n(令和 ?([\d０-９]+) ?年度)\n\n(?:事業番号\n\n)?事業名\n\n([^\n]+)\n\n総事業費\n/g)];
  const out: ProjectEvaluation[] = [];
  starts.forEach((m, i) => {
    const s = m.index! + 1, end = starts[i + 1]?.index ?? t.length, sheet = t.slice(s, end);
    if (!sheet.includes('\n成果及び評価\n')) return;
    const fy = eraYear('令和', m[2]), name = m[3];
    const p = project(input, name, name, null, m[0].slice(1, -1), s);
    p.projectCode = null; p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, title, 0));
    // 総事業費・事業期間・所管課が表の順に並ぶシートだけ。事業期間が事業年度の会計年度内に収まる場合だけ金額を記録。
    const overview = sheet.indexOf('\n事業概要\n');
    const head = overview < 0 ? null : /総事業費\n\n(?:事業番号\n\n)?([\d,]+) 円\n[\s\S]*?\n事業期間\n\n(R[^\n～]+)～\s?(R[^\n]+)\n\n([^\n]+)\n\n事業概要\n$/.exec(sheet.slice(0, overview + '\n事業概要\n'.length));
    let note = '総事業費・事業期間・所管課の欄の並びが崩れているため金額・所管課は未収録。';
    if (head) {
      const [raw, cost, from, to, dept] = head;
      if (YAITA_DEPT.test(dept)) { p.department = dept; }
      if (fy !== null && fiscalOf(from) === fy && fiscalOf(to) === fy) {
        p.amounts.push(amount(input, 'actual', fy, cost, '円', raw.slice(0, raw.indexOf(' 円') + 2), s + head.index));
        note = '総事業費は事業期間（本文）が事業年度の会計年度内に収まるため、その年度の実績として記録。';
      } else note = '事業期間が事業年度の会計年度に収まらない（繰越・年度またぎ）か読めないため、総事業費は未収録。';
      if (!p.department) note += '所管課の欄が読めないため未設定。';
      p.evidence.push(evidence(input, raw.trimEnd(), s + head.index));
    }
    p.warnings.push(`矢板市 ${title.replace('\n', ' ')}の個別事業シート。シートの「事業年度」を評価対象年度とし、評価実施年度は明示がないため未設定。`,
      `${note}交付金充当額・成果の数値・評価の文章は未構造化。`);
    out.push(p);
  });
  return out;
}

/** 新型コロナ交付金【事業評価結果】（年度の明示なし）: 所属名・事業番号・事業名。 */
function yaitaR2(input: CachedInput): ProjectEvaluation[] {
  const title = '新型コロナウイルス感染症対応地方創生臨時交付金【事業評価結果】';
  if (input.sourceId !== YAITA_R2 || !input.text.startsWith(title)) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of input.text.matchAll(/所属名\n\n([^\n]+)\n\n事業番号\n\n([\d０-９]+)\n\n事業名\n\n([^\n]+)\n\n事業の実施状況又は経過\n/g)) {
    const [raw, dept, no, name] = m;
    const p = project(input, `事業番号${ascii(no)}`, name, null, raw.trimEnd(), m.index);
    p.department = dept;
    p.evidence.push(evidence(input, title, 0));
    p.warnings.push('矢板市 新型コロナウイルス感染症対応地方創生臨時交付金【事業評価結果】の各シートの所属名・事業番号・事業名。資料に年度の記載がないため評価年度・評価対象年度は未設定。',
      '事業費の記載はなく、成果・評価・課題は文章のため未構造化。同名の事業（事業番号違い）が複数ある場合と、年度のある個別事業評価報告に同名の事業がある場合は同一事業か確定できないため除外。');
    out.push(p);
  }
  return out;
}

function yaita(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '09211') return [];
  // 同じ年度・同名の事業が他の報告書にもある場合（交付金の種類が異なる給付金など）は除外。
  const all = uniqueByName(inputs.flatMap(i => i.sourceId === YAITA_R2 ? yaitaR2(i) : yaitaSheets(i)));
  // 年度記載のない【事業評価結果】の事業は、年度のある報告書に同名の事業がある場合も同一事業か確定できないため除外。
  const dated = new Set(inputs.flatMap(yaitaSheets).map(p => normalize(p.projectName)));
  const ids = new Set(all.filter(p => p.evaluatedFiscalYear !== null || !dated.has(normalize(p.projectName))).map(p => p.id));
  return (input.sourceId === YAITA_R2 ? yaitaR2(input) : yaitaSheets(input)).filter(p => ids.has(p.id));
}

/* ---------- 06461 遊佐町 第２期総合戦略 事業チェックシート（令和6年度事業） ---------- */

const YUZA: Record<string, string> = {
  'd0002c7435b4d369f449d3d5': '令和６年度\n\n第２期遊佐町総合戦略\n外部評価事業チェックシート',
  'e4db77590ab1bcd0022d2f62': '令和6年度\n\n第２期遊佐町総合戦略\n事業評価シート',
};

function yuza(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '06461') return [];
  const all = uniqueByName(inputs.flatMap(yuzaSheets));
  const ids = new Set(all.map(p => p.id));
  return yuzaSheets(input).filter(p => ids.has(p.id));
}

function yuzaSheets(input: CachedInput): ProjectEvaluation[] {
  const title = YUZA[input.sourceId];
  if (!title || !input.text.startsWith(title)) return [];
  const t = input.text, head = '遊佐町総合戦略 事業チェックシート\n令和6年度事業\n';
  const starts = [...t.matchAll(new RegExp(head, 'g'))].map(m => m.index!);
  const external = input.sourceId === 'd0002c7435b4d369f449d3d5';
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    const sheet = t.slice(s, starts[i + 1] ?? t.length);
    const names = [...sheet.matchAll(/\n事業名\n\n(事業[①-⑳]) ([^\n]+)\n\n(?=事業区分\n|事業目的\n)/g)];
    if (names.length !== 1) return;
    const m = names[0], name = m[2];
    const p = project(input, name, name, null, `${m[1]} ${m[2]}`, s + m.index! + '\n事業名\n\n'.length);
    p.projectCode = null; p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, head.trimEnd(), s), evidence(input, title, 0));
    p.warnings.push(`遊佐町 第２期まち・ひと・しごと創生総合戦略の事業チェックシート（${external ? '外部評価対象12事業' : '内部評価47事業'}）。シート見出しの「令和6年度事業」を評価対象年度とし、評価実施年度は明示がないため未設定。施策内の事業番号（${m[1]}）は施策ごとの通し番号のため projectCode には記録しない。`,
      '担当課係は施策名・事業区分の欄と混在するため未設定。指標の目標・成果数値は見込値や備考が同じ欄に混在するため未収録。事業成果を上げるための工夫・改善点・外部評価委員会の意見は文章のため未構造化。事業名が「事業番号＋名称」の形で一意に読めないシートは対象外。');
    out.push(p);
  });
  return out;
}

/* ---------- 09361 壬生町 地方創生関連交付金事業 効果検証シート（令和7年度第2回企画委員会） ---------- */

const MIBU = '82dfbe3ab387a051ffd81aaf';
const MIBU_VALUES = new Set(['順調に推移', '達成見込', '努力が必要', '未評価']);

function mibu(input: CachedInput): ProjectEvaluation[] {
  const title = '【第２期壬生町創生総合戦略効果検証シート（令和６年度事業）】';
  if (input.municipalityCode !== '09361' || input.sourceId !== MIBU || !input.text.startsWith(title)) return [];
  const t = input.text, starts = [...t.matchAll(/【(?:地方創生拠点整備|デジタル田園都市国家構想推進)交付金事業効果検証シート】\n/g)];
  const out: ProjectEvaluation[] = [];
  starts.forEach((m, i) => {
    const s = m.index!, sheet = t.slice(s, starts[i + 1]?.index ?? t.length);
    const nm = /\n事業名：([^\n]+)\n/.exec(sheet);
    if (!nm) return;
    const name = nm[1].trim();
    const p = project(input, name, name, null, nm[0].trim(), s + nm.index + 1);
    p.projectCode = null;
    p.evidence.push(evidence(input, m[0].trimEnd(), s));
    // KPIごとの「R7進捗度」。値が欄の直後に読めないKPIが1つでもあるシートは評価なし（対応が確定できない）。
    const marks = [...sheet.matchAll(/\nR7進捗度\n([^\n]*)\n/g)];
    const ok = marks.length > 0 && marks.every(k => MIBU_VALUES.has(k[1]));
    if (ok) marks.forEach((k, n) => p.ratings.push(rating(input, 'self', `KPI${n + 1}のR7進捗度`, k[1], null, k[0].slice(1, -1), s + k.index! + 1)));
    p.warnings.push('壬生町 令和7年度第2回企画委員会の効果検証シートのうち地方創生関連交付金事業（地方創生拠点整備交付金・デジタル田園都市国家構想推進交付金）の事業別シート。交付金事業の実施年度・評価年度はシート上に明示がないため未設定。',
      `R7進捗度はシート内のKPIの掲載順に「KPIn」として記録（進捗度の区分の定義は本文になく scale 未設定）${ok ? '' : '。このシートは進捗度の値が欄から離れて抽出されているため未収録'}。KPIの目標値・実績値は年度列の対応が崩れているため未収録。担当課はKPIごとに異なるため未設定。同名のシートが複数ある事業は同一事業か確定できないため除外。`);
    out.push(p);
  });
  return uniqueByName(out);
}

export const entries: Record<string, Entry> = {
  '09211': { extract: yaita, scope: '矢板市 地方創生臨時交付金の個別事業評価報告（令和3年度・令和5年度コロナ交付金・令和5年度物価高騰交付金）の事業名・事業年度・所管課・年度内に完結した総事業費と、事業評価結果（年度記載なし）の所属名・事業番号・事業名。成果の数値・評価の文章・交付金充当額・公表ページ（html）は対象外。' },
  '06461': { extract: yuza, scope: '遊佐町 第２期総合戦略 事業チェックシート（令和6年度事業、外部評価12事業・内部評価47事業）のうち事業名が一意に読めるシートの事業名と評価対象年度。指標の目標/成果数値・担当課・外部評価意見とヒアリング調書・公表ページは対象外。' },
  '09361': { extract: mibu, scope: '壬生町 令和7年度効果検証シートの地方創生関連交付金事業（拠点整備・デジ田交付金）の事業名とKPI別のR7進捗度。総合戦略・国土強靭化の施策KPI、KPIの数値、令和6年度の効果検証シート（年度表記が食い違う）、公表ページは対象外。' },
};
