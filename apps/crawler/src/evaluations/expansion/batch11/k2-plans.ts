import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, normalize, num, rating } from '../batch8/h6-util';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/* ---------- 13120 練馬区 平成25年度 行政評価委員会報告書（資料編）事務事業評価表（第三者評価対象） ---------- */

const NERIMA = 'fffdfed2413a7060be4554c7';
const NERIMA_SCALES: [string, string, string, string][] = [
  ['①成果', '②効率性', '成果', 'AA 目標を大幅に上回る著しい成果があった／A 目標を達成し充分な成果があった／B 目標を達成していないが一定の成果があった／C 目標を達成できず成果があまりなかった／D 目標を大幅に下回り成果は限られる'],
  ['②効率性', '③必要性', '効率性', 'AA コストが非常に低く成果が極めて高い／A コストが低く成果が高い／B1 コスト・成果ともに高い／B2 コスト・成果ともに低い／C コストが高く成果が低い'],
  ['③必要性', '④総合評価', '必要性', 'A 事業の必要性・区が実施する必要性がともに高い／B1 事業の必要性は高いが区が実施する必要性は低い／B2 行政需要は小さいが区が実施する必要性は高い／C 事業の必要性・区が実施する必要性がともに低い'],
  ['④総合評価', '区民等からの意見', '総合評価', 'AA 極めて良好に進んでいる／A 良好に進んでいる／B 概ね良好に進んでいる／C あまり良好に進んでいない／D 良好に進んでいない'],
];
const NERIMA_DIRECTION = 'Ａ 拡大／Ｂ 継続／Ｃ 縮小／Ｄ 廃止／Ｅ 休止／Ｆ 完了';

function nerima(input: CachedInput): ProjectEvaluation[] {
  const title = '平成 25 年度\n\n（資料編）\n平成 26 年（2014 年）５月\n練馬区行政評価委員会';
  if (input.municipalityCode !== '13120' || input.sourceId !== NERIMA || !input.text.startsWith(title)) return [];
  const t = input.text, a = t.indexOf('３ 事務事業評価表（第三者評価対象）'), b = t.indexOf('４ 施策評価表（第三者評価対象）', a);
  if (a < 0 || b < 0) return [];
  // 目次の行（上位施策番号＋事務事業名＋掲載頁）。事業名の折返しは結合する。
  const toc = [...t.slice(a, b).matchAll(/\n(\d{3}) ((?:[^\n·]+\n)*?[^\n·]+?) ·+ (\d+)(?=\n)/g)];
  const head = '平成25年度 事務事業評価表\n';
  const starts = [...t.matchAll(new RegExp(head, 'g'))].map(m => m.index!);
  if (toc.length !== 12 || starts.length !== 12) return [];
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1] : t.indexOf('施策評価表', s);
    const sheet = t.slice(s, end < 0 ? t.length : end), m = toc[i];
    const name = m[2].replace(/\n/g, ''), tocAt = a + m.index! + 1;
    // 目次の順と評価表の順が一致し、評価表の本文に同じ事業名があることを確認。
    if (!normalize(sheet).includes(normalize(name)) || !sheet.includes('平成24年度の主な')) return;
    const p = project(input, m[1], name, 2013, m[0].slice(1), tocAt);
    // 目次の3桁は上位施策の番号で事業コードではないため projectCode には記録しない（ID生成にのみ使用）。
    p.projectCode = null; p.evaluatedFiscalYear = 2013 - 1;
    p.evidence.push(evidence(input, head.trimEnd(), s), evidence(input, title, 0));
    const exact = sheet.indexOf(name);
    if (exact >= 0) p.evidence.push(evidence(input, name, s + exact));
    // 経費: 24年度（実績）の列。決算額＋人件費＝投入経費の検算が合う場合だけ（単位千円）。
    const cost = /２４年度\n（実績）\n([\d,]+)\n([\d,]+)\n([\d.]+)\n([\d,]+)\n([\d,]+)\n/.exec(sheet);
    const unit = /経費および特定財源\n決算額\n当初予算額\n②従事職員数[^\n]*\n③人件費\n④投入経費（①（決算額、25年度は予算額）＋③）\n①事業費\n/.exec(sheet);
    if (cost && unit && num(cost[1]) + num(cost[4]) === num(cost[5]) && /\n千円\n/.test(sheet)) {
      const raw = cost[0].trimEnd(), at = s + cost.index;
      p.amounts.push(amount(input, 'actual', 2012, cost[1], '千円', raw, at), amount(input, 'budget', 2012, cost[2], '千円', raw, at),
        amount(input, 'personnel', 2012, cost[4], '千円', raw, at), amount(input, 'fullCost', 2012, cost[5], '千円', raw, at));
      p.evidence.push(evidence(input, unit[0].trimEnd(), s + unit.index));
    }
    // 評価項目: 各区分の■が1つだけの場合。
    for (const [from, to, label, scale] of NERIMA_SCALES) {
      const x = sheet.indexOf(`\n${from}\n`), y = sheet.indexOf(to, x + 1);
      if (x < 0 || y < 0) continue;
      const marks = [...sheet.slice(x, y).matchAll(/■(AA|A|B1|B2|B|C|D)(?=\s)/g)];
      if (marks.length === 1) p.ratings.push(rating(input, 'self', label, marks[0][1], scale, marks[0][0], s + x + marks[0].index!));
    }
    const d = sheet.lastIndexOf('事業の方向性\n');
    const dirs = d < 0 ? [] : [...sheet.slice(d).matchAll(/■([Ａ-Ｆ]) (拡大|継続|縮小|廃止|休止|完了)/g)];
    if (dirs.length === 1) p.ratings.push(rating(input, 'self', '事業の方向性', `${dirs[0][1]} ${dirs[0][2]}`, NERIMA_DIRECTION, dirs[0][0], s + d + dirs[0].index!));
    p.warnings.push('練馬区行政評価委員会 平成25年度報告書（資料編）に収録された第三者評価対象の事務事業評価表（区の内部評価）。評価年度は表題の「平成25年度 事務事業評価表」、評価対象年度は「平成24年度の主な取組・実績」による。目次の上位施策番号は事業コードではないため projectCode は未設定。',
      `事業名は資料編目次の行（折返しを結合）で、評価表本文に同名があることを確認。${p.amounts.length ? '経費は24年度（実績）列の決算額・当初予算額・人件費・投入経費で、決算額＋人件費＝投入経費の検算一致を確認（単位千円）。' : '経費は列の検算が一致しないため未収録。'}評価区分（成果・効率性・必要性・総合評価）と事業の方向性は■が1つだけの場合に記録。成果指標・担当部署（予算科目の欄と混在）・行政評価委員会の第三者評価（本編）は未収録。`);
    out.push(p);
  });
  return out;
}

/* ---------- 30428 串本町 まちづくり３ヵ年計画 第１次実施計画 成果目標達成状況（平成29〜31年度） ---------- */

const KUSHIMOTO = '7a671df43f5f533910c9f767';
const KUSHIMOTO_SCALE = '0％ 目標達成に向けた検討を行うことができなかった／25％ 目標達成に向けた検討は行ったが、具体的な取組みに至らなかった／50％ 目標達成に向け、一部、具体的な取組みを行った／75％ 目標達成に向け具体的な取組みを行い、概ね目標を達成したが、諸条件により一部については達成できなかった／100％ 目標通り達成できた';

function kushimoto(input: CachedInput): ProjectEvaluation[] {
  const title = 'まちづくり３ヵ年計画\n\n第１次実施計画\n成果目標達成状況\n平成 29 年度～平成 31 年度';
  const basis = '「達成状況」及び「達成度」については、平成 31 年度の終了見込みで評価し記入してい\nます。';
  if (input.municipalityCode !== '30428' || input.sourceId !== KUSHIMOTO || !input.text.startsWith(title) || !input.text.includes(basis)) return [];
  const t = input.text, starts = [...t.matchAll(/事業年度\n/g)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    const sheet = t.slice(s, starts[i + 1] ?? t.length);
    const nm = /事 業 名\n\n([^\n]+)\n\n所\n\n([^\n]+)\n\n管\n/.exec(sheet) ?? /事 業 名 ([^\n]+)\n所\n\n管\n\n([^\n]+)\n/.exec(sheet);
    const legend = sheet.indexOf('0％・・・・・目標達成');
    if (!nm || legend < 0) return;
    const [raw, name, dept] = nm;
    const p = project(input, name, name, null, raw.trimEnd(), s + nm.index);
    p.projectCode = null; p.department = dept;
    p.evidence.push(evidence(input, title, 0), evidence(input, basis));
    // 達成度: 凡例より前にある「0/25/50/75/100%」の行が1つだけの場合（欄の位置は崩れても値が一意）。
    const vals = [...sheet.slice(0, legend).matchAll(/\n(0|25|50|75|100)[%％]\n/g)];
    if (vals.length === 1) p.ratings.push(rating(input, 'self', '成果目標達成度', `${vals[0][1]}%`, KUSHIMOTO_SCALE, vals[0][0].slice(1, -1), s + vals[0].index! + 1));
    p.warnings.push('串本町 第１次実施計画（平成29〜31年度）成果目標達成状況の事業別シート。達成状況・達成度は本文の注記どおり平成31年度の終了見込みで評価したもので、評価年度・評価対象年度の年度欄はないため未設定。担当課名は平成29年度の名称（本文注記）。',
      '成果目標達成度はシート内で凡例より前に現れる達成度の値が1つだけの場合に記録。事業費は平成31年度が見込み額で、財源内訳と列の対応も崩れているため未収録。成果目標・達成状況・総合戦略の指標は文章のため未構造化。');
    out.push(p);
  });
  const count = new Map<string, number>();
  for (const p of out) count.set(p.projectName, (count.get(p.projectName) ?? 0) + 1);
  return out.filter(p => count.get(p.projectName) === 1);
}

export const entries: Record<string, Entry> = {
  '13120': { extract: nerima, scope: '練馬区 行政評価委員会 平成25年度報告書（資料編）の第三者評価対象12事業の事務事業評価表（区の内部評価）の事業名・上位施策番号・検算一致した24年度経費（決算・当初予算・人件費・投入経費）・評価区分と事業の方向性。成果指標・本編の委員会評価・施策評価表・選定候補一覧・評点一覧は対象外。' },
  '30428': { extract: kushimoto, scope: '串本町 第１次実施計画（平成29〜31年度）成果目標達成状況の事業別シートの事業名・所管課・成果目標達成度（平成31年度終了見込みでの評価）。事業費（見込み額を含む）・成果目標の文章・総合戦略の指標と、第３次実施計画（平成25〜27年度、段組み崩れ）は対象外。' },
};
