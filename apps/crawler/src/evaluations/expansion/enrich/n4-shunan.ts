import type { EvaluationAmount, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 周南市 事務事業評価表（令和６年度・令和７年度、1事業1枚）
// 令和７年度の公開済みレコードは評価結果一覧表から、令和６年度の公開済みレコードは同じ評価表から事業名・所管・決算/予算だけを取ったもの。
// ここでは評価表のコスト表（各年度決算・予算の事業費、人件費合計、トータルコスト）と評価項目・総合評価・今後の実施方向性を補う。
const SOURCES = new Set(['a83edbe393eb739a775b8285', 'fd5ff89b4aef4bd763204a6a', 'b0344c66ef6c1f4e47fd39aa']);
const KANJI: Record<string, number> = { '元': 1, '０': 0, '１': 1, '２': 2, '３': 3, '４': 4, '５': 5, '６': 6, '７': 7, '８': 8, '９': 9 };
const reiwa = (s: string) => 2018 + Number([...s].map(c => KANJI[c] ?? c).join(''));
const HEAD = /(?:^|\n)(令和(\S+)年度 事務事業評価表 （ 令和(\S+)年度実績 ）)\n事務事業名 (.+?) 担当所属 (\S+)\n/g;
const ROW = (label: string) => new RegExp(`\\n${label} (-?[\\d,]+) (-?[\\d,]+) (-?[\\d,]+) (-?[\\d,]+) (-?[\\d,]+)\\n`);
const num = (s: string) => Number(s.replace(/,/g, ''));
const DIRECTION = /^(拡充|維持|現状維持|手段変更|改善|縮小|統合|休止|廃止|完了|終了)$/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '35215' || !SOURCES.has(input.sourceId) || input.truncated) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)];
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const from = h.index! + (h[0].startsWith('\n') ? 1 : 0), to = heads[k + 1]?.index ?? t.length, sheet = t.slice(from, to);
    const year = reiwa(h[2]), target = reiwa(h[3]);
    if (target !== year - 1) return;
    const at = (raw: string, i: number) => evidence(input, raw, from + i);
    const p = project(input, `補強:${h[4]}`, h[4], year, h[0].replace(/^\n/, '').trimEnd(), from);
    p.projectCode = null;
    p.department = h[5]; p.evaluatedFiscalYear = target;

    // コスト表: 見出しの5列（決算4年度＋予算1年度）。トータルコスト＝事業費＋人件費合計、人件費合計＝正職員＋正職員以外−事業費集計済分、
    // 事業費＝特定財源5行＋一般財源 が全列で成り立つ場合だけ収録。
    const head = sheet.match(/\n（単位：千円） 令和(\S+)年度 決算 令和(\S+)年度 決算 令和(\S+)年度 決算 令和(\S+)年度 決算 令和(\S+)年度 予算\n/);
    const years = head?.slice(1, 6).map(reiwa);
    const total = sheet.match(ROW('トータルコスト')), cost = sheet.match(ROW('事業費')), general = sheet.match(ROW('一般財源'));
    const staff = sheet.match(ROW('人件費合計')), regular = sheet.match(ROW('正職員')), other = sheet.match(ROW('正職員以外'));
    const counted = sheet.match(/\n（事業費集計済分） \((-?[\d,]+) \) \((-?[\d,]+) \) \((-?[\d,]+) \) \((-?[\d,]+) \) \((-?[\d,]+) \)\n/);
    if (head && years && years.every((y, i) => y === target - 3 + i) && total && cost && general && staff && regular && other && counted
      && head.index! < total.index! && total.index! < cost.index! && cost.index! < general.index! && general.index! < staff.index!) {
      const between = sheet.slice(cost.index! + cost[0].length - 1, general.index! + 1);
      const rows = [...between.matchAll(/\n(?:[^\n\d-]*) ?(-?[\d,]+) (-?[\d,]+) (-?[\d,]+) (-?[\d,]+) (-?[\d,]+)(?=\n)/g)];
      const ok = rows.length === 5 && [0, 1, 2, 3, 4].every(i => {
        const c = num(cost[i + 1]);
        return num(total[i + 1]) === c + num(staff[i + 1]) && num(staff[i + 1]) === num(regular[i + 1]) + num(other[i + 1]) - num(counted[i + 1])
          && c === rows.reduce((s, r) => s + num(r[i + 1]), 0) + num(general[i + 1]);
      });
      if (ok) {
        const ev = at(sheet.slice(head.index! + 1, staff.index! + staff[0].length - 1), head.index! + 1);
        const add = (kind: EvaluationAmount['kind'], fiscalYear: number, rawValue: string) =>
          p.amounts.push({ kind, fiscalYear, amountYen: num(rawValue) * 1000, rawValue, rawUnit: '千円', evidence: ev });
        years.forEach((y, i) => {
          if (i < 4) { add('actual', y, cost[i + 1]); add('personnel', y, staff[i + 1]); add('fullCost', y, total[i + 1]); }
          else add('budget', y, cost[i + 1]);
        });
      }
    }

    // 評価項目（１〜１０）と総合評価・今後の実施方向性。行頭の縦書き見出しの1字を除いた「番号．項目 評語」の行。
    const lines = sheet.split('\n');
    let offset = 0;
    const pos = lines.map(l => { const o = offset; offset += l.length + 1; return o; });
    const items = lines.flatMap((l, i) => {
      const m = l.match(/^(?:\S )?((?:１０|[１-９])．[^ ]+) ([ＡＢＣＤ])(?= |$)/);
      return m ? [{ label: m[1], value: m[2], raw: m[0], at: pos[i] }] : [];
    });
    if (items.length === 10 && new Set(items.map(x => x.label)).size === 10)
      for (const x of items) p.ratings.push({ kind: 'self', label: x.label, value: x.value, scale: 'Ａ／Ｂ／Ｃ／Ｄ', evidence: at(x.raw, x.at) });
    const sum = lines.findIndex(l => l.startsWith('総 '));
    const grade = sum >= 0 ? lines.slice(sum + 1, sum + 5).findIndex(l => /^評 [ＡＢＣＤ](?: |$)/.test(l)) : -1;
    if (grade >= 0 && lines.slice(sum + 1, sum + 1 + grade).every(l => !/^評 /.test(l))) {
      const i = sum + 1 + grade;
      p.ratings.push({ kind: 'self', label: '総合評価', value: lines[i][2], scale: 'Ａ／Ｂ／Ｃ／Ｄ', evidence: at(lines[i].slice(0, 3), pos[i]) });
    }
    const dirs = lines.flatMap((l, i) => l.startsWith('今後の実施方向性 ') ? [i] : []);
    if (dirs.length === 1) {
      const i = dirs[0], v = lines[i].split(' ')[1];
      if (DIRECTION.test(v)) p.ratings.push({ kind: 'self', label: '今後の実施方向性', value: v, scale: null, evidence: at(`今後の実施方向性 ${v}`, pos[i]) });
    }
    if (!p.amounts.length && !p.ratings.length) return;
    p.warnings.push(`${h[1]}の評価表から補強。金額はコスト表（単位：千円）の各列で、トータルコスト＝事業費＋人件費合計、人件費合計＝正職員＋正職員以外−事業費集計済分、事業費＝特定財源＋一般財源が成り立つ場合のみ、決算年度は事業費・人件費合計・トータルコスト、予算年度は事業費を収録。評価は評価項目１〜１０がそろう票の評語、総合評価、今後の実施方向性（区分の語のみ）。指標は行の折り返しで指標名が分割されるため未収録。`);
    out.push(p);
  });
  return out;
}

export const shunan = {
  extract,
  scope: '周南市 令和６年度・令和７年度 事務事業評価表（1事業1枚）のコスト表（決算4年度の事業費・人件費合計・トータルコストと予算年度の事業費、検算一致時のみ）、評価項目１〜１０・総合評価・今後の実施方向性。公開済みレコードの補強用。',
};
