/** 川越市 (11201): 令和6年度 事務事業評価シート（二次評価）8事業、令和7年度 事務事業整理表。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

const SECOND_SHEETS = new Set(['863bd49fa1e51250d2f933a9', '49150cdbe775d03fe68860d3', '7331a522d98dd317da5af5ee', '77c5eb7ffcef101b8e7a4337',
  '81557f636b85bc525fab0180', '02e5a75c8a837e6a62b4a61c', '1a6a2ff87ce306e7c7755a6e', 'b948e359fb3ca7ba28a7a67e']);
const SEIRIHYO_R7 = 'f5e22b019aad7eefe11b18ac', ICHIRAN_R7 = '54ad9c8e6ec8a911e6ceba6b';
const SCORE_SCALE = 'Ａ 計画どおり事業を進めることが適当又は一部見直しの検討／Ｂ 事業の進め方の改善の検討／Ｃ 事業の必要性・規模・内容の定期的な見直し／Ｄ 事業の抜本的見直し、休・廃止の検討';
const DIRECTION_SCALE = '継続／改善／拡充／縮小／廃止';
const num = (s: string) => Number(s.replaceAll(',', ''));
// 事業区分の列（ソフト事業・内部管理事務・経常的事務事業・施設の建設／整備／管理運営）が改行で切れた断片。
const CATEGORY = /^(?:ソフト事|内部管理|経常的事|施設の[建整管])/;

/**
 * 二次評価シート: 実施にかかるコスト（千円）の人件費(A)・事業費(B)・総事業費合計(A)+(B)。列は令和3〜5年度決算額・令和6年度見込額で、
 * 財源合計と総事業費合計が一致し A+B＝合計となる令和4・5年度の決算額のみ（令和3年度は全シートで0、令和6年度は見込額のため除外）。
 */
function secondSheet(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  const head = t.match(/^令和６年度\n\n事務事業評価シート（二次評価）\n※令和5年度に実施した事業を評価しています\n/);
  const nameM = t.match(/\n課名\n\n１\n\n((?:[^\n]+\n)*?[^\n]+)\n(?:０|\n予 算 事 業 名)/);
  if (!head || !nameM) return [];
  const name = nameM[1].replaceAll('\n', '');
  const at = nameM.index! + nameM[0].indexOf(nameM[1]);
  const p = project(input, name, name, 2024, nameM[1], at);
  p.evaluatedFiscalYear = 2023;
  p.evidence.push(evidence(input, head[0].trim(), 0));
  const cost = t.match(/令和３年度\(決算額\) 令和４年度\(決算額\) 令和５年度\(決算額\) 令和６年度\(見込額\)\n((?:[\d,]+\n){36})\n人件費\n\(A\)\n正規職員\(1年間の従事人数\)\n会計年度職員\(1年間の従事人数\)\n事業費\n\(B\)\n(?:[^\n\d][^\n]*\n)*((?:\n(?:[\d.,]+\n)+){4})\nその他\n総事業費合計\n((?:\n(?:[\d,]+\n)+){4})/);
  if (cost) {
    const funds = cost[1].trim().split('\n').map(num);
    const cols = cost[2].trim().split('\n\n').map(g => g.split('\n').map(num));
    const totals = cost[3].trim().split('\n\n').map(g => num(g.split('\n').at(-1)!));
    const ev = evidence(input, cost[0], cost.index!);
    const ok = [1, 2].every(c => cols[c][0] + cols[c][3] === totals[c] && funds[32 + c] === totals[c]);
    if (ok && funds.length === 36) for (const [c, fy] of [[1, 2022], [2, 2023]] as const) {
      p.amounts.push({ kind: 'personnel', fiscalYear: fy, amountYen: cols[c][0] * 1000, rawValue: cost[2].trim().split('\n\n')[c].split('\n')[0], rawUnit: '千円（人件費(A)・決算額）', evidence: ev });
      p.amounts.push({ kind: 'actual', fiscalYear: fy, amountYen: cols[c][3] * 1000, rawValue: cost[2].trim().split('\n\n')[c].split('\n')[3], rawUnit: '千円（事業費(B)・決算額）', evidence: ev });
      p.amounts.push({ kind: 'fullCost', fiscalYear: fy, amountYen: totals[c] * 1000, rawValue: cost[3].trim().split('\n\n')[c].split('\n').at(-1)!, rawUnit: '千円（総事業費合計(A)＋(B)・決算額）', evidence: ev });
    }
  }
  for (const [label, re] of [['効率性', /\n効率性\n\n([ＡＢＣＤ])\n/], ['達成度', /\n達成度\n\n７\n\n([ＡＢＣＤ])\n/], ['総合評価', /\n総合評価\n\n([ＡＢＣＤ])\n/]] as const) {
    const m = t.match(re);
    if (m) p.ratings.push({ kind: 'self', label: `${label}（二次評価）`, value: m[1], scale: label === '総合評価' ? SCORE_SCALE : null, evidence: evidence(input, m[0].trim(), m.index! + 1) });
  }
  const dir = t.match(/\n今後の\n方向性\n\n(継続|改善|拡充|縮小|廃止)\n/);
  if (dir) p.ratings.push({ kind: 'self', label: '今後の方向性（二次評価）', value: dir[1], scale: DIRECTION_SCALE, evidence: evidence(input, dir[0].trim(), dir.index! + 1) });
  p.warnings.push('事務事業評価シート（二次評価）から、令和4・5年度決算額（人件費・事業費・総事業費、財源合計と一致を確認）と二次評価の効率性・達成度・総合評価・今後の方向性を取得。必要性・有効性は列崩れのため未取得。');
  return [p];
}

/** 一覧で事務事業名が行末の語として現れる行の、直後の数値行（事業費 正規職員 任用職員 総事業費 前年度総事業費）の総事業費。 */
function listTotals(list: string): Map<string, number[]> {
  const lines = list.split('\n'), out = new Map<string, number[]>();
  lines.forEach((l, i) => {
    const name = l.split(' ').at(-1)!;
    for (const next of lines.slice(i + 1, i + 6)) {
      const m = next.match(/^(?:\d+ )?[\d,]+ [\d.]+ [\d.]+ ([\d,]+) [\d,]+/);
      if (m) { out.set(name, [...out.get(name) ?? [], num(m[1])]); break; }
    }
  });
  return out;
}

/**
 * 事務事業整理表（令和7年度、令和6年度実施分）: 各行の「総事業費 総合評価 今後の方向性」の行を行の終わりとし、その前の行のうち
 * 同年度の事務事業評価一覧にも語として現れる語を事務事業名とする（行頭に最も近い行の最後の語）。一覧で同名の行の総事業費が
 * 整理表の総事業費と一致する行だけを採り、総合評価・今後の方向性を取得（総事業費は内訳がなく検算できないため金額は取らない）。
 */
function seirihyo(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  const t = input.text, list = inputs.find(i => i.sourceId === ICHIRAN_R7)?.text;
  const head = t.match(/令和７年度 事務事業整理表 ※令和6年度に実施した事業を評価しています/);
  if (!list || !head || !list.includes('令和７年度 事務事業評価一覧 （一般会計） ※令和6年度に実施した事業を評価しています')) return [];
  const vocab = new Set(list.split(/[ \n]/)), totals = listTotals(list);
  const out: ProjectEvaluation[] = [];
  let from = head.index! + head[0].length;
  for (const m of t.matchAll(/\n([\d,]+)[ \n](?:([ＡＢＣＤ]) )?(継続|改善|拡充|縮小|廃止)(?=\n)/g)) {
    const window = t.slice(from, m.index!), base = from;
    from = m.index! + m[0].length;
    let pick: { name: string; at: number } | null = null, pos = base;
    for (const line of window.split('\n')) {
      const words = line.split(' ');
      const hits = words.map((w, i) => ({ w, i })).filter(({ w }) => w.length >= 2 && vocab.has(w) && !CATEGORY.test(w) && !/^[\d,.（）()]+$/.test(w));
      if (hits.length) {
        const last = hits.at(-1)!;
        pick = { name: last.w, at: pos + words.slice(0, last.i).join(' ').length + (last.i ? 1 : 0) };
        break;
      }
      pos += line.length + 1;
    }
    if (!pick || !totals.get(pick.name)?.includes(num(m[1]))) continue;
    const p = project(input, pick.name, pick.name, 2025, pick.name, pick.at);
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, head[0], head.index!));
    const row = evidence(input, m[0].slice(1), m.index! + 1);
    p.evidence.push(row);
    if (m[2]) p.ratings.push({ kind: 'self', label: '総合評価', value: m[2], scale: SCORE_SCALE, evidence: row });
    p.ratings.push({ kind: 'self', label: '今後の方向性', value: m[3], scale: DIRECTION_SCALE, evidence: row });
    p.warnings.push('事務事業整理表の行から総合評価・今後の方向性を取得。事務事業名は列が混在する行頭から、同年度の事務事業評価一覧と総事業費が一致する名称に限る。総事業費は内訳がなく検算できないため未取得。');
    out.push(p);
  }
  return out;
}

export function extractKawagoeSheets(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '11201') return [];
  if (SECOND_SHEETS.has(input.sourceId)) return secondSheet(input);
  if (input.sourceId === SEIRIHYO_R7) return seirihyo(input, inputs);
  return [];
}
