import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, joinLines, municipality, normalize, rating } from './h4-util';

const at = (t: string, raw: string, from = 0) => t.indexOf(raw, from);

/** Eniwa 行政改革推進委員会資料: the three 令和7年度事務事業評価調書 (様式1). Cost table units (千円 header, yen-sized values) disagree, so no amounts. */
function eniwaSheets(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith('行政改革推進委員会\n令和 7 年度第 3 回')) return [];
  const sheets = [
    { name: '恵庭市FMCサービス導入事業（公用スマホ）', nameRaw: '事業名 恵庭市FMCサービス導入事業（公用スマホ）', dept: '総務部情報政策課', deptRaw: '担当部課名 総務部情報政策課' },
    { name: '交通安全運動推進委員会補助金・交通安全協会補助金・交通安全指導員会補助金', nameRaw: '事業名\n\n交通安全運動推進委員会補助金・交通安全\n協会補助金・交通安全指導員会補助金',
      dept: '生活環境部生活環境課', deptRaw: '担当部課名 生活環境部生活環境課' },
    { name: '市内消費拡大事業費', nameRaw: '担当部課名 経済部 花と緑・観光課\n\n市内消費拡大事業費\n\n事務事業名', dept: '経済部 花と緑・観光課', deptRaw: '担当部課名 経済部 花と緑・観光課' },
  ];
  const starts = [...t.matchAll(/№ ?[１２3]\n\n?令和 ７年度事務事業評価調書\n/g)].map(m => m.index!);
  if (starts.length !== 3) return [];
  return sheets.flatMap((s, i) => {
    const from = starts[i], to = starts[i + 1] ?? t.indexOf('資料1-4', from), seg = t.slice(from, to);
    const n = at(t, s.nameRaw, from), d = at(t, s.deptRaw, from);
    if (n < 0 || n >= to || d < 0 || d >= to || !normalize(joinLines(s.nameRaw))!.includes(normalize(s.name)!)) return [];
    const p = project(input, s.name, s.name, 2025, s.nameRaw, n);
    p.projectCode = null; p.department = s.dept;
    p.evidence.push(evidence(input, s.deptRaw, d), evidence(input, '令和 ７年度事務事業評価調書', from + t.slice(from).indexOf('令和 ７年度事務事業評価調書')));
    // ☑ marks survive only on sheet No.1; one tick per question there.
    for (const [label, re] of [['事業目的達成度（令和６年度実績）', /☑(大きな成果が得られた|概ね目的の成果が得られた|目的としていた成果が得られなかった)\n/g],
      ['事業継続の必要性', /☑(必要性が高い|必要性がある程度認められる|必要性が低い)\n/g], ['見直し余地', /☑(見直す余地がない|見直す余地がある程度認められる|見直す余地がある)\n/g]] as const) {
      const hits = [...seg.matchAll(re)];
      if (hits.length === 1) p.ratings.push(rating(input, 'self', label, hits[0][1], null, hits[0][0].trim(), from + hits[0].index!));
    }
    p.warnings.push('事務事業評価調書（様式1）の事務事業名・担当部課名と、チェック記号（☑）が抽出できた項目別評価のみ収録。年間経費の表は見出し単位（千円）と数値の桁が合わず単位が確定できないため未収録。2次評価（今後の推進方針）は選択記号の位置が崩れているため未収録。令和4年度評価事業の工程表は対象外。');
    return [p];
  });
}

/** Tokai 教育行政評価報告書 (令和5年度・令和4年度事業対象): 10 対象事業評価シート named in the table of contents. */
function tokaiSheets(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith('令和５年度（令和４年度事業対象）\n\n東海村教育行政評価報告書')) return [];
  const tocStart = t.indexOf('２ 対象事業評価シート\n');
  const toc = [...t.slice(tocStart, t.indexOf('Ⅳ 点検評価委員の総評', tocStart)).matchAll(/（([０-９\d]+)） ([^\n]+?)(?:\n\n| )・・・ /g)];
  const body = t.indexOf('１．対象事業評価シートの見方');
  const ends = [...t.slice(body).matchAll(/■(拡充|継続|一部改善|大幅改善|休止・廃止)/g)].map(m => ({ index: body + m.index!, text: m[0], value: m[1] }));
  if (toc.length !== 10 || ends.length !== 10) return [];
  return toc.flatMap((c, i) => {
    const from = i ? ends[i - 1].index + ends[i - 1].text.length : body, to = ends[i].index + ends[i].text.length, seg = t.slice(from, to);
    if (!normalize(joinLines(seg))!.includes(normalize(c[2])!)) return [];
    const p = project(input, c[2], c[2], 2023, c[0].replace(/(?:\n\n| )・・・ $/, ''), tocStart + c.index!);
    p.projectCode = null; p.evaluatedFiscalYear = 2022;
    const dept = [...seg.matchAll(/担当課(?:\n\n| )(\S+)\n/g)];
    if (dept.length === 1) { p.department = dept[0][1]; p.evidence.push(evidence(input, dept[0][0].trim(), from + dept[0].index!)); }
    const self = [...seg.matchAll(/\n自己評価\n\n([A-DＡ-Ｄ])\n/g)];
    if (self.length === 1) p.ratings.push(rating(input, 'self', '自己評価', self[0][1], 'Ａ:有効な業務・施策を順調に行っている。／Ｂ:概ね順調だが，何らかの改善を要する。／Ｃ:大幅な見直し，改善を要する。／Ｄ:休止・廃止の検討を要する。', self[0][0].trim(), from + self[0].index! + 1));
    p.ratings.push(rating(input, 'self', '今後の展開方針', ends[i].value, '拡充／継続／一部改善／大幅改善／休止・廃止', ends[i].text, ends[i].index));
    const cost = seg.match(/●数値資料\n事業規模\n(?:[^\n]+\n)*?●内容\n\n予算\n([\d,]+)千円\n(?:[^\n]+\n)*?\n決算\n([\d,]+)千円\n/);
    if (cost) {
      const base = from + cost.index!;
      p.amounts.push(amount(input, 'budget', 2022, cost[1], '千円', `予算\n${cost[1]}千円`, base + cost[0].indexOf(`予算\n${cost[1]}千円`)));
      p.amounts.push(amount(input, 'actual', 2022, cost[2], '千円', `決算\n${cost[2]}千円`, base + cost[0].indexOf(`決算\n${cost[2]}千円`)));
    }
    p.warnings.push('目次の項目名を事業名として、各評価シートの担当課・自己評価・今後の展開方針（■の選択）を収録。金額は「数値資料」の事業規模欄が予算・決算の順に並ぶシートのみ。外部評価（委員意見）・実績評価の文章・別紙の教育プラン点検評価シートは対象外。項目名には分掌事務（〜に関すること）も含まれる。');
    return [p];
  });
}

const CIRCLED = '[❶-❿⓫-⓴㉑-㉟㊱-㊿]';
/** Takashima 総合戦略 評価検証報告書 (令和6年度): 個別事業 blocks where the number, name and 事業費 label run in order. */
function takashimaRows(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith('表紙\n\n第２期\n高島市まち・ひと・しごと創生総合戦略') || !t.includes('令和６年度(2024 年度)\n評価検証報告書')) return [];
  const legend = t.match(/✓ 事業評価（A・B・C・D）は、以下の評価を示しています。\n(Ａ:[^\n]+\nＢ:[^\n]+\nＣ:[^\n]+\nＤ:[^\n]+)\n/);
  const heads = [...t.matchAll(/\n事業名\n\n?概要\n/g)];
  // 施策一覧 rows「❶ 事業名 / 担当課 / 頁」; a department is taken only for names listed exactly once.
  const owners = new Map<string, { dept: string; raw: string; at: number }[]>();
  for (const m of t.matchAll(new RegExp(String.raw`\n${CIRCLED} ([^\n]+)\n\n([^\n]+課)\n\n\d+\n`, 'g')))
    owners.set(m[1], [...(owners.get(m[1]) ?? []), { dept: m[2], raw: m[0].trim(), at: m.index! + 1 }]);
  return heads.flatMap((h, k) => {
    const from = h.index!, seg = t.slice(from, heads[k + 1]?.index ?? t.length);
    const named = [...seg.matchAll(new RegExp(String.raw`\n(${CIRCLED})\n\n([^\n]+)\n\n事業費\n`, 'g'))];
    // One numbered business per table: a second 事業費 label means another (unnumbered) business shares the block.
    if (named.length !== 1 || (seg.match(/\n事業費\n/g) ?? []).length !== 1 || new RegExp(String.raw`\n${CIRCLED}`, 'g').exec(seg.slice(named[0].index! + 2)) !== null) return [];
    const name = named[0][2].replace(/^[◎△◇]/, '');
    if (!/事業|推進|整備|導入|運営|ルート|連携|充実/.test(name)) return [];
    const p = project(input, name, name, null, named[0][0].trim(), from + named[0].index! + 1);
    p.projectCode = null; p.evaluatedFiscalYear = 2024;
    const listed = owners.get(named[0][2]);
    if (listed?.length === 1) { p.department = listed[0].dept; p.evidence.push(evidence(input, listed[0].raw, listed[0].at)); }
    const marks = [...seg.matchAll(/\n([ＡＢＣＤA-D])\n/g)], grade = [...seg.matchAll(/\n評価\n\n([ＡＢＣＤA-D])\n/g)];
    if (legend && marks.length === 1 && grade.length === 1)
      p.ratings.push(rating(input, 'self', '事業評価', grade[0][1], legend[1].replace(/\n/g, '／'), grade[0][0].trim(), from + grade[0].index! + 1));
    p.warnings.push('総合戦略の「個別事業についての検証結果」のうち、番号・事業名・事業費の見出しが順に並ぶ1事業だけの表のみ収録（事業名頭の交付金記号◎△◇は除去）。評価（A〜D）は表内に評価記号が1つだけの場合のみ。担当課は施策一覧に同名事業が1件だけ載る場合のみ。事業費は予算・決算の別が本文で明示されないため未収録。施策・KPIの評価は対象外。');
    return [p];
  });
}

/** Mimasaka 教育委員会事務の点検及び評価 (令和4年度・令和3年度事業対象): 事業別点検評価 sheets. */
function mimasakaSheets(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith('令和４年度\n\n美作市教育委員会事務の点検及び評価の報告書\n\n（令和３年度事業対象）')) return [];
  const heads = [...t.matchAll(/\n番号\n\n(\d+)\n\n/g)];
  return heads.flatMap((h, k) => {
    const from = h.index!, seg = t.slice(from, heads[k + 1]?.index ?? t.length);
    const stop = seg.search(/\n(区分|事業の目的)\n/);
    const head = seg.slice(0, seg.indexOf('\n継続\n') >= 0 ? Math.max(stop, seg.indexOf('\n継続\n')) : stop);
    const names = [...head.matchAll(/\n\n([^\n]+事業)\n/g)].filter(m => m[1] !== '事業名');
    const dept = head.match(/\n主管課\n\n([^\n]+(?:課|室))\n/);
    if (names.length !== 1 || !dept || !head.includes('\n事業名\n')) return [];
    const p = project(input, names[0][1], names[0][1], 2022, names[0][1], from + names[0].index! + 2);
    p.projectCode = h[1]; p.department = dept[1]; p.evaluatedFiscalYear = 2021;
    p.evidence.push(evidence(input, dept[0].trim(), from + dept.index! + 1));
    p.warnings.push('令和3年度事業別点検評価シートの番号・事業名・主管課のみの部分レコード。事業費（年度別）は見出しと数値の並びが崩れているため未収録。目的・内容・成果・課題は文章のため未構造化。');
    return [p];
  });
}

/** Tsurugi 教育委員会の事務に関する点検評価 (令和5年度事務事業評価). */
function tsurugiSheets(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith('令和５年度つるぎ町教育委員会の事務に関する')) return [];
  const heads = [...t.matchAll(/(?:事業名：|事業名\n\n：|\n\n：)([^\n]+)\n/g)];
  return heads.flatMap((h, k) => {
    const from = h.index!, seg = t.slice(from, heads[k + 1]?.index ?? t.length);
    if (!/事業の目|目的/.test(seg.slice(0, 200))) return [];
    const name = h[1].trim();
    const p = project(input, name, name, 2023, h[0].trim(), from + h[0].indexOf(h[0].trim()));
    p.projectCode = null;
    const values = [...seg.matchAll(/\n([A-EＡ-Ｅ][：:](?:拡充|継続|見直し|廃止|完了)|評価対象外)\n/g)];
    if (values.length === 2 && values[0][1] === values[1][1] && seg.includes('\n自己評価\n') && seg.includes('\n総合点\n')) {
      p.ratings.push(rating(input, 'self', '自己評価', values[0][1], 'Ａ：拡充／Ｂ：継続／Ｃ：見直し／Ｄ：廃止／Ｅ：完了', values[0][1], from + values[0].index! + 1));
      p.ratings.push(rating(input, 'self', '総合点', values[1][1], 'Ａ：拡充／Ｂ：継続／Ｃ：見直し／Ｄ：廃止／Ｅ：完了', values[1][1], from + values[1].index! + 1));
    }
    p.warnings.push('令和５年度事務事業評価の事業名を収録。自己評価・総合点は、事業の区間内に評価値がちょうど2つあり同じ値の場合のみ（列位置が抽出で崩れており、値が異なる・個数が合わない場合は未収録）。目的・目標・状況・成果は文章のため未構造化。金額は未収録。評価年度は見出し（令和５年度事務事業評価）による。');
    return [p];
  });
}

/** Usuki 事務事業評価シート（令和3年度）: name, 課, 番号 and the 課長評価 option when its text sits right after the label. */
function usukiSheets(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  const heads = [...t.matchAll(/臼杵市 事務事業評価シート\n（ 令和3年度）\n/g)];
  return heads.flatMap((h, k) => {
    const from = h.index!, seg = t.slice(from, heads[k + 1]?.index ?? t.length);
    const n = seg.match(/\n\n([^\n]+)\n\n事務事業名\n/);
    if (!n) return [];
    const head = seg.slice(0, n.index!), depts = [...new Set([...head.matchAll(/\n([^\n]+課)\n/g)].map(m => m[1]))];
    const p = project(input, n[1], n[1], 2021, n[0].trim(), from + n.index! + 2);
    const no = seg.match(/\n番号\n([AＡ] - [\d０-９]+)\n/);
    p.projectCode = no ? no[1] : null;
    if (depts.length === 1) p.department = depts[0];
    p.evidence.unshift(evidence(input, h[0].trim(), from));
    const boss = seg.match(/\n課長評価\n\n([^\n]+（[^）\n]{1,6}）)\n/);
    if (boss) p.ratings.push(rating(input, 'self', '課長評価', boss[1], null, boss[1], from + boss.index! + boss[0].indexOf(boss[1])));
    p.warnings.push('事務事業評価シート（令和3年度）の事務事業名・課名・番号と、課長評価の選択肢が見出し直後に抽出できた場合のみ課長評価を収録。必要性・有効性・効率性のA〜Cは3つの評価が列見出しと離れて抽出されるため未収録。指標・コスト表は列が崩れているため未収録。評価年度はシート表題（令和3年度）による。');
    return [p];
  });
}

export const eniwa = municipality('01231', ['f216bf15cf12cde64dfd5373'], eniwaSheets);
export const tokai = municipality('08341', ['880b8398f3fbf8996bdec56e'], tokaiSheets);
export const takashima = municipality('25212', ['0f24d3651eac9bdf33a7dd16'], takashimaRows);
export const mimasaka = municipality('33215', ['4b232871f8b7ad8ca58e7590'], mimasakaSheets);
export const tsurugi = municipality('36468', ['0f1e215e7bcbb33b4fa373df'], tsurugiSheets);
export const usuki = municipality('44206', ['a2af7df8deeea7e0451446ef'], usukiSheets);
