import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, mergeReprints } from '../batch7/g1-util';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** 野辺地町 令和2年度 事務事業外部評価報告書（令和元年度事務事業5件）の外部評価結果表と各事業シート。 */
function extractNoheji(input: CachedInput): ProjectEvaluation[] {
  const title = '令和２年度\n第５次野辺地町まちづくり総合計画後期基本計画\nに係る事務事業 外部評価報告書\n\n評価対象：①令和元年度事務事業';
  if (input.municipalityCode !== '02401' || input.sourceId !== 'b155407758b025cc7e886bfa' || !input.text.startsWith(title)) return [];
  const t = input.text;
  const tableStart = t.indexOf('外部評価対象事業５事業の事業別の評価結果は下記のとおりです。'), tableEnd = t.indexOf('【②重点戦略プロジェクト】', tableStart);
  const legend = '※Ａ－事業内容が概ね適切である。\nＢ－課題があると思われるため、事業内容や手法等に一部見直しが必要である。\nＣ－課題が多くあると思われるため、事業内容や手法等に大幅な見直しが必要である。\nＤ－事業の休止・廃止、抜本的な見直しが必要である。';
  if (tableStart < 0 || tableEnd < 0 || !t.includes(legend)) return [];
  const scale = legend.slice(1).replaceAll('\n', ' ');
  const out: ProjectEvaluation[] = [];
  const row = /\n([^\n]+)\n\n([^\n]+課)\n\n([０-９]+)\n\n([０-９]+)\n\n([０-９]+)\n\n([０-９]+)\n\n([０-９]+)(?=\n)/g;
  for (const m of t.slice(tableStart, tableEnd).matchAll(row)) {
    const [name, dept] = [m[1], m[2]], raw = m[0].slice(1), s = tableStart + m.index! + 1;
    // The matching 事業シート: 「（n）事業名\n①事業の概要\n担当課名」 with the same 担当課.
    const sheetHead = new RegExp(`（[１-５]）${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n①事業の概要\\n`, 'g');
    const heads = [...t.matchAll(sheetHead)];
    if (heads.length !== 1) continue;
    const hs = heads[0].index!, he = t.indexOf('③外部評価', hs);
    if (he < 0) continue;
    const sheet = t.slice(hs, he);
    if (!sheet.includes(`\n${dept}\n`)) continue;
    const p = project(input, `${dept}:${name}`, name, 2020, raw, s);
    p.department = dept; p.evaluatedFiscalYear = 2019;
    p.evidence.push(evidence(input, title, 0), evidence(input, heads[0][0], hs));
    ['Ａ', 'Ｂ', 'Ｃ', 'Ｄ', 'その他'].forEach((k, i) =>
      p.ratings.push({ kind: 'external', label: `外部評価 ${k}（人数）`, value: m[3 + i], scale: `${scale}（評価した委員の人数・単位：人）`, evidence: evidence(input, raw, s) }));
    p.evidence.push(evidence(input, legend));
    // 内部評価: 評価項目ごとの選択肢（原文の4段階）。選択肢と完全一致する行だけを採る。
    const options: Record<string, string[]> = {
      進捗度: ['事業が進捗している', '一定の進捗がある', 'あまり進捗していない', '進捗していない'],
      必要性: ['必要性が高い', '一定の必要性がある', 'あまり必要性がない', '必要性が低い'],
      効率性: ['効率的である', 'やや効率的である', 'あまり効率的でない', '効率的ではない'],
      公平性: ['公平である', 'やや公平である', 'あまり公平ではない', '公平ではない'],
      協働性: ['協働の取組みがある', '協働になじまない'],
    };
    const inner = sheet.indexOf('②内部評価');
    for (const [label, opts] of Object.entries(options)) {
      const r = new RegExp(`\\n${label}\\n\\n([^\\n]+)\\n`).exec(sheet.slice(inner));
      if (inner < 0 || !r || !opts.includes(r[1])) continue;
      const rs = hs + inner + r.index + 1, rr = r[0].slice(1, -1);
      p.ratings.push({ kind: 'self', label: `内部評価 ${label}`, value: r[1], scale: opts.join('／'), evidence: evidence(input, rr, rs) });
    }
    const dirs = ['事業拡大が必要', '事業改善が必要', '現状維持が適当', '事業縮小が必要', '休止・廃止が必要'];
    const found = dirs.flatMap(d => [...sheet.slice(inner).matchAll(new RegExp(`(?<=\\n)${d}(?=\\n)`, 'g'))].map(x => ({ d, i: x.index! })));
    if (inner >= 0 && found.length === 1) {
      p.ratings.push({ kind: 'self', label: '内部評価 今後の方向性（改善点）', value: found[0].d, scale: dirs.join('／'), evidence: evidence(input, found[0].d, hs + inner + found[0].i) });
    }
    // 令和元年度決算額: 財源内訳の前に印字された最初の額（千円）だけを採る。
    const a = /令和元年度決算額\n事業の財源\n\n([\d,]+)\n\n千円\n\n国・県支出金/.exec(sheet);
    if (a) p.amounts.push(amount(input, 'actual', 2019, a[1], '千円', a[0], hs + a.index));
    p.warnings.push('令和2年度外部評価報告書（評価対象：令和元年度事務事業）の外部評価結果表（委員の評価別人数）と事業シートから収録。内部評価は原文の選択肢と完全一致する行のみ、今後の方向性は内部評価欄に選択肢が1つだけ印字されている場合のみ。令和元年度決算額は「事業の財源」より前に印字された額のみ（財源内訳との列対応が崩れたシートは未収録）。重点戦略プロジェクト（指標）の評価は事務事業でないため対象外。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

/** 竹富町 令和7年度 事務事業評価シート（竹富町女性議会、1事業）。 */
function extractTaketomi(input: CachedInput): ProjectEvaluation[] {
  const head = '令和７年度\n事務事業名\n\n事務事業評価シート（令和８年５月公表）\n\n竹富町女性議会\n';
  if (input.municipalityCode !== '47381' || input.sourceId !== '6dc54e38e3066cd889bbe9c3' || !input.text.startsWith(head)) return [];
  const t = input.text, name = '竹富町女性議会';
  const p = project(input, name, name, 2025, head.trimEnd(), 0);
  const dept = /\n担当所属\n\n課名\n\n(議会事務局)\n/.exec(t);
  if (dept) { p.department = dept[1]; p.evidence.push(evidence(input, dept[0].trim(), dept.index + 1)); }
  // 予算額等の推移（円）: 令和６年度「-（－）」、令和７年度の額と「皆増」。
  const yrs = '【目標指数と推移】\n年度\n\n令和６年度\n\n令和７年度\n\n令和８年度\n\n予算額等の推移';
  const bud = /\n予算\n\n-\n\n（－）\n\n([\d,]+)\n\n皆増\n\n（円）\n\n決算\n\n-\n\n（－）\n\n([\d,]+)\n\n皆増\n/.exec(t);
  if (t.includes(yrs) && bud) {
    const raw = bud[0].slice(1, -1), s = bud.index + 1;
    p.amounts.push(amount(input, 'budget', 2025, bud[1], '円', raw, s), amount(input, 'actual', 2025, bud[2], '円', raw, s));
    p.evidence.push(evidence(input, yrs));
  }
  // 【事業評価】6項目: 各項目の選択肢C.の直後に印字された評価（A〜C）。
  const block = t.indexOf('【事業評価】'), end = t.indexOf('【総合評価（課題・改善点等）】');
  if (block > 0 && end > block) {
    const qs = [...t.slice(block, end).matchAll(/([１-６])．([^\n]+)/g)];
    const rs = [...t.slice(block, end).matchAll(/\nC\. [^\n]+\n\n([ABC])(?=\n)/g)];
    if (qs.length === 6 && rs.length === 6 && qs.every((q, i) => q.index! < rs[i].index! && (i === 5 || rs[i].index! < qs[i + 1].index!))) {
      qs.forEach((q, i) => {
        const r = rs[i], rr = r[0].slice(1), s = block + r.index! + 1;
        p.ratings.push({ kind: 'self', label: `${q[1]}．${q[2]}`, value: r[1], scale: null, evidence: evidence(input, rr, s) });
        p.evidence.push(evidence(input, q[0], block + q.index!));
      });
    }
  }
  p.warnings.push('令和7年度事務事業評価シート（令和8年5月公表）1件。予算・決算は「予算額等の推移（円）」の令和6〜8年度の列のうち、令和6年度が「-（－）」、次の列が「皆増」の並びから令和7年度の額として収録。評価は6項目の選択欄（A〜C）を原文の記号のまま収録し、項目ごとの選択肢の定義は根拠テキストを参照。目標指数（目標値・実績）は列対応が崩れているため未収録。評価対象年度は明記がなく未設定。');
  return [p];
}

/** 白岡市 令和3年度 行政評価委員会 外部評価報告書（2事業）。 */
function extractShiraoka(input: CachedInput): ProjectEvaluation[] {
  const title = '白岡市行政評価委員会\n\n令和３年度\n\n外部評価報告書\n\n令和４年３月';
  if (input.municipalityCode !== '11246' || input.sourceId !== 'b0460531227843ccda2a5ca3' || !input.text.includes(title)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const bodyEnd = t.indexOf('附属資料（全意見）');
  for (const m of t.slice(0, bodyEnd).matchAll(/\n([１２])\n\n([^\n]+事業)\n\n[^\n]+万円\n\n（([^\n）]+(?:部)[^\n）]+課)）\n/g)) {
    const s = m.index! + 1, raw = m[0].slice(1, -1), name = m[2];
    const evalStart = t.indexOf('事務事業に対する評価', s), evalEnd = t.indexOf('事務事業に対する意見・提案等', evalStart);
    if (evalStart < 0 || evalEnd < 0) continue;
    const p = project(input, `外部評価No${m[1]}`, name, 2021, raw, s);
    p.department = m[3];
    p.evidence.push(evidence(input, title));
    // 5つの視点のうち、問いと評価が1行ずつ並んで印字された項目のみ（②は問いが重複印字されて崩れているため除外）。
    for (const r of t.slice(evalStart, evalEnd).matchAll(/\n([①③④⑤]) ([^\n]+？)\n([^\n]+。)(?=\n)/g)) {
      const rs = evalStart + r.index! + 1, rr = r[0].slice(1);
      p.ratings.push({ kind: 'external', label: r[2], value: r[3], scale: null, evidence: evidence(input, rr, rs) });
    }
    p.warnings.push('令和3年度外部評価報告書の対象2事業の見出し（事業名・所管）と、白岡市行政評価委員会による「事務事業に対する評価」の視点別の評価文を原文のまま収録。「効率的に事業を進めているか？」の項目は抽出テキストで問いが重複・入替して印字されているため未収録。見出しの金額（万円）は予算・決算の別と年度が明記されないため未収録。評価対象年度は明記がなく未設定。');
    out.push(p);
  }
  return out;
}

/** 喬木村 令和6年度（第9次）施策評価シートの「施策を構成する事務事業」表（事務事業名・担当所属・令和6年度決算額・今後の方向性）。 */
function extractTakagi(input: CachedInput): ProjectEvaluation[] {
  const title = '第５次 喬木村 総合計画\n（後期：Ｒ３年度→Ｒ８年度）\n\n施策評価シート\n（令和６年度（第９次）評価）';
  if (input.municipalityCode !== '20415' || input.sourceId !== '729b979bbe64f3f822ebd991' || !input.text.startsWith(title)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const header = '＜＜施策を構成する事務事業＞＞\n\n(単位:千円)\n\n事務事業評価結果\nNo\n\n事務事業名\n\n担当所属\n\n総事業費\n令和6年度決算額\n\n';
  let from = 0;
  while (true) {
    const hs = t.indexOf(header, from);
    if (hs < 0) break;
    from = hs + header.length;
    // 列ごとに縦に並ぶ5つの段落（No・事務事業名・担当所属・決算額・今後の方向性）。件数がそろう表のみ採用。
    const segs: { start: number; lines: string[] }[] = [];
    let pos = from;
    for (let k = 0; k < 5; k++) {
      const end = t.indexOf('\n\n', pos);
      if (end < 0) break;
      segs.push({ start: pos, lines: t.slice(pos, end).split('\n') });
      pos = end + 2;
    }
    if (segs.length < 5) continue;
    const [nos, names, depts, costs, dirs] = segs;
    if (dirs.lines[0] !== '今後の方向性') continue;
    const dirLines = dirs.lines.slice(1), dirStart = dirs.start + '今後の方向性\n'.length;
    const n = nos.lines.length;
    if (![names.lines.length, depts.lines.length, costs.lines.length, dirLines.length].every(x => x === n)) continue;
    if (!nos.lines.every((x, i) => x === String(i + 1))) continue;
    if (!depts.lines.every(d => /^\S+係$/.test(d)) || !costs.lines.every(c => /^[\d,]+$/.test(c)) || !dirLines.every(d => /^\S{1,6}$/.test(d))) continue;
    if (names.lines.some(x => /係$|\s/.test(x))) continue;
    const off = (seg: { start: number; lines: string[] }, i: number) => seg.start + seg.lines.slice(0, i).reduce((a, l) => a + l.length + 1, 0);
    const block = t.slice(hs, dirStart + dirLines.join('\n').length);
    // 施策名: 直前の「施策\n\n番号\n\n施策名」。
    const sheetStart = t.lastIndexOf('令和6年度 施策評価シート', hs);
    const policy = sheetStart >= 0 ? /\n施策\n\n(\d+)\n\n([^\n]+)\n/.exec(t.slice(sheetStart, hs)) : null;
    for (let i = 0; i < n; i++) {
      const name = names.lines[i];
      const p = project(input, `${policy ? `施策${policy[1]}:${policy[2]}` : `表${hs}`}:${name}`, name, 2024, block, hs);
      p.department = depts.lines[i];
      p.evidence.push(evidence(input, title, 0), evidence(input, name, off(names, i)), evidence(input, depts.lines[i], off(depts, i)));
      if (policy) p.evidence.push(evidence(input, policy[0].trim(), sheetStart + policy.index + 1));
      p.amounts.push(amount(input, 'actual', 2024, costs.lines[i], '千円', costs.lines[i], off(costs, i)));
      const dl = dirLines[i], ds = dirStart + dirLines.slice(0, i).reduce((a, l) => a + l.length + 1, 0);
      p.ratings.push({ kind: 'self', label: '事務事業評価結果 今後の方向性', value: dl, scale: null, evidence: evidence(input, dl, ds) });
      p.warnings.push('令和6年度（第9次）施策評価シートの「施策を構成する事務事業」表から収録。表は列ごとに縦に印字されているため、No・事務事業名・担当所属・総事業費・今後の方向性の件数がすべて一致し、Noが1から連番の表のみ行の順で対応付け（事業名と担当所属が同じ行に混在する表・2ページ目の続きは未収録）。総事業費は表頭「総事業費 令和6年度決算額」（単位:千円）による。施策の総合評価・指標・投入コストは施策単位のため対象外。評価対象年度は明記がなく未設定。');
      out.push(p);
    }
  }
  return mergeReprints(out, p => p.projectCode!);
}

/** 中島村 2025年度（令和7年度）総合振興計画事業評価の評価一覧表のうち、個別事業の行（個別番号・個別事業・担当課・個別評価）。 */
function extractNakajima(input: CachedInput): ProjectEvaluation[] {
  const title = '中島村\n第６次総合振興計画\n２０２５年度（令和７年度）\n事業評価';
  const listTitle = '中島村第 6 次総合振興計画 2025 年度（令和 7 年度）評価一覧表';
  if (input.municipalityCode !== '07465' || input.sourceId !== '56c0a2fe4420959bf04055ad' || !input.text.startsWith(title)) return [];
  const t = input.text, ls = t.indexOf(listTitle), le = t.indexOf('\n基本目標\n\n1\n\n心豊かな子どもを育み自己を磨き続けるむら\n\n施 策 名');
  const legend = '◎評価は A～C の三段階です。';
  if (ls < 0 || le < ls || !t.includes(legend)) return [];
  const out: ProjectEvaluation[] = [];
  // 個別番号・事業名・担当課・個別評価が1行ずつ並ぶ行のみ。名称が折り返した行（段組み崩れ）は一致しない。
  const row = /\n([①②③④⑤⑥⑦⑧⑨])(-\d)?\n\n([^\n]+)\n\n(\S+(?:課|保育所|幼稚園|児童館))\n\n([ABC])(?=\n)/g;
  for (const m of t.slice(ls, le).matchAll(row)) {
    const s = ls + m.index! + 1, raw = m[0].slice(1), name = m[3];
    if (/。|(?:課|保育所|幼稚園|児童館)$/.test(name) || name.length > 12) continue;
    // 直前が空行か担当課の行であること（折り返した事業名の続きが個別番号の前後に散る行を除外）。
    const prev = t.slice(t.lastIndexOf('\n', s - 2) + 1, s - 1);
    if (prev !== '' && !/(?:課|保育所|幼稚園|児童館)$/.test(prev)) continue;
    const p = project(input, `${m[4]}:${name}`, name, 2025, raw, s);
    p.department = m[4]; p.evaluatedFiscalYear = 2025;
    p.ratings.push({ kind: 'self', label: '個別評価', value: m[5], scale: null, evidence: evidence(input, raw, s) });
    p.evidence.push(evidence(input, title, 0), evidence(input, legend), evidence(input, '◎本事業評価は、2026 年度（令和 8 年度）に実施しました。'));
    p.warnings.push('2025年度（令和7年度）事業評価の評価一覧表から、個別番号・個別事業名・担当課・個別評価（A〜C）が連続して印字された行のみ収録。施策番号・施策名は段組みが崩れて行との対応が確定できないため未設定。1次〜3次評価は施策単位の評価のため個別事業には付与していない。名称が折り返して印字された個別事業は未収録。施策別の評価シート（事業費・KPI）は施策単位のため対象外。評価は2026年度（令和8年度）に実施と明記。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

export const entries: Record<string, Entry> = {
  '02401': { extract: extractNoheji, scope: '令和2年度事務事業外部評価報告書（評価対象：令和元年度事務事業5件）の外部評価結果表（評価別人数）と事業シートの担当課・内部評価（選択肢と一致する項目）・今後の方向性・令和元年度決算額を構造化。重点戦略プロジェクトの指標評価、委員コメントは対象外。' },
  '47381': { extract: extractTaketomi, scope: '令和7年度事務事業評価シート（竹富町女性議会）1件の事業名・担当所属・令和7年度の予算額と決算額（円）・評価6項目の選択（A〜C）を構造化。目標指数、総合評価の文章、外部評価は対象外。' },
  '11246': { extract: extractShiraoka, scope: '令和3年度外部評価報告書の対象2事業（ふるさと納税事業・環境基本計画策定事業）の事業名・所管と、行政評価委員会の視点別評価文を構造化。問いが崩れて印字された効率性の項目、見出しの金額、意見・提案、附属資料の委員全意見は対象外。' },
  '20415': { extract: extractTakagi, scope: '令和6年度（第9次）施策評価シートの「施策を構成する事務事業」表から、件数が列ごとに一致する表の事務事業名・担当所属・令和6年度決算額（千円）・今後の方向性を構造化。施策の総合評価・指標・投入コスト、列の崩れた表は対象外。' },
  '07465': { extract: extractNakajima, scope: '2025年度（令和7年度）総合振興計画事業評価の評価一覧表から、個別事業名・担当課・個別評価（A〜C）が崩れずに並ぶ行を構造化。施策単位の1次〜3次評価・施策別評価シートの事業費やKPI、折り返した事業名の行は対象外。' },
};
