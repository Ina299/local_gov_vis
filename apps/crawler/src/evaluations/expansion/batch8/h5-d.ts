import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, mergeReprints, nfkc } from '../batch7/g1-util';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** First occurrence of a heading that must exist verbatim, as evidence. */
function must(input: CachedInput, raw: string) {
  return input.text.includes(raw) ? evidence(input, raw) : null;
}

/** 士別市 令和6(2024)年度 点検・評価報告書【令和5(2023)年度対象】の事務事業点検・評価調書。 */
function extractShibetsu(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== '4faba1cac3ced96071b56ffe') return [];
  const title = '令和６(2024)年度\n教育に関する事務の管理及び執行状況の点検・評価に関する報告書\n【令和５(2023)年度対象】';
  const scaleRaw = '① 評価方法については、Ａ・Ｂ・Ｃ・Ｄ・Ｅの５段階評価としており、';
  const titleEv = must(input, title), scaleEv = must(input, scaleRaw);
  if (!titleEv || !scaleEv) return [];
  const t = input.text, heading = '事務事業点検・評価調書', listStart = t.indexOf('個別の事務の点検・評価一覧表');
  const starts = [...t.matchAll(/事務事業点検・評価調書\n\n/g)].map(m => m.index!);
  const list = listStart >= 0 && starts.length ? t.slice(listStart, starts[0]) : '';
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    const block = t.slice(s, starts[i + 1] ?? t.length);
    const dm = block.slice(heading.length + 2).match(/^([^\n]+(?:\n[^\n]+)*?)\n\n?(?:施 策|事務事業\n)/);
    const dept = dm ? dm[1].replaceAll('\n', '') : '';
    const m = block.match(/事業費（千円）\n\n((?:[^\n]*\n)*?)([^\n]+(?:\n[^\n]+)*)\n\n決算額\n\n([\d０-９,]+)\n\n事務事業の概要/);
    const r = block.match(/\n評\n\n価\n([A-EＡ-Ｅ])\n\n【事務事業の必要性】\n((?:[■□](?:継続|見直し|廃止)(?:\n\n| )){2}[■□](?:継続|見直し|廃止))/);
    if (!m || !r || !/(?:課|センター|館|高校)$/.test(dept.split(/[・･]/).pop()!)) return;
    const name = m[2].replaceAll('\n', '');
    const need = [...r[2].matchAll(/■(継続|見直し|廃止)/g)];
    if (need.length !== 1) return;
    // 一覧表の同名行の評価と調書の評価が食い違う場合は除外。
    const listed = nfkc(list).match(new RegExp(nfkc(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([A-E])'));
    if (listed && listed[1] !== nfkc(r[1])) return;
    const nameStart = s + m.index! + m[0].indexOf(m[2]);
    const p = project(input, `${dept}:${name}`, name, 2024, m[2], nameStart);
    p.department = dept; p.evaluatedFiscalYear = 2023;
    const amtRaw = `決算額\n\n${m[3]}`, amtStart = s + m.index! + m[0].indexOf(amtRaw);
    p.amounts.push({ ...amount(input, 'actual', 2023, m[3].normalize('NFKC'), '千円', amtRaw, amtStart), rawValue: m[3] });
    const rStart = s + r.index! + 1;
    p.ratings.push({ kind: 'self', label: '評価', value: r[1], scale: 'Ａ：想定どおりの成果が得られたもの／Ｂ：想定した成果は得られたが、引き続き充実を図ることを期待するもの／Ｃ：想定した成果はほぼ得られたが、さらなる改善が必要と考えられるもの／Ｄ：想定した成果が十分には得られず、見直しなどの検討が必要なもの／Ｅ：想定した成果が得られず、早急に見直しなどの検討を進めるべきもの', evidence: evidence(input, r[0].slice(1), rStart) });
    p.ratings.push({ kind: 'self', label: '事務事業の必要性', value: need[0][1], scale: '継続／見直し／廃止', evidence: evidence(input, r[0].slice(1), rStart) });
    p.evidence.push(evidence(input, block.slice(0, heading.length), s), titleEv, scaleEv);
    p.warnings.push('令和5年度事務事業点検・評価調書の1枚から、事務事業名・所管課・事業費（千円）の決算額・評価（A〜E）・事務事業の必要性（■印）を収録。報告書表紙の【令和５(2023)年度対象】により評価対象年度を2023、決算額を令和5年度決算として扱った。一覧表に同名行がある場合は評価の一致を確認。目的・成果の文章は未構造化。');
    out.push(p);
  });
  return mergeReprints(out, p => p.projectCode!);
}

const OKUSHIRI_SCALE = 'A 事業の拡充／B 現状のまま維持（外部評価は現状のまま継続）／C 改善の上継続／D 事業の縮小／E 休廃止の検討';

/** 奥尻町 令和5年度事務・事業評価対象事業リストの行（番号・事業名・自己評価・外部評価）。 */
function extractOkushiri(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== 'e9112a77e40debba73dbbd0b') return [];
  const heading = '令和5年度事務・事業評価対象事業リスト\n（単位：千円）', legend = 'A 事業の拡充\n\nB 現状のまま維持\n\nC 改善の上継続\n\nD 事業の縮小\n\nE 休廃止の検討';
  const hEv = must(input, heading), lEv = must(input, legend);
  if (!hEv || !lEv) return [];
  const t = input.text, end = t.indexOf('事務事業評価シート\n\n1.基本項目'), table = t.slice(0, end < 0 ? t.length : end), out: ProjectEvaluation[] = [];
  const row = /\n\n(\d{1,2})\n\n((?:[^\n]+\n)*?[^\n]+)\n\n((?:[^\n]+\n)*?[^\n]+)\n\n([\d,]+)(?: [^\n]+)?\n\n([A-EＡ-Ｅ])\n\n([A-EＡ-Ｅ])(?=\n)/g;
  for (const m of table.matchAll(row)) {
    const nameLines = m[2].split('\n');
    if (nameLines.some(l => /[。、]/.test(l) || l.length > 22) || /^\d/.test(m[2])) continue;
    // 改行位置で事業名が分かれた行は連結し、名詞で終わる行の後は別名として空白で区切る。
    const name = nameLines.reduce((a, l) => a ? a + (/(?:会|議|業|）)$/.test(a) ? ' ' : '') + l : l, '');
    const raw = m[0].slice(2), s = m.index! + 2;
    const p = project(input, `番号${m[1]}`, name, null, raw, s);
    p.evaluatedFiscalYear = 2023;
    p.ratings.push({ kind: 'self', label: '自己評価', value: m[5], scale: OKUSHIRI_SCALE, evidence: evidence(input, raw, s) });
    p.ratings.push({ kind: 'external', label: '外部評価', value: m[6], scale: OKUSHIRI_SCALE, evidence: evidence(input, raw, s) });
    p.evidence.push(hEv, lEv);
    p.warnings.push('令和5年度事務・事業評価対象事業リストの1行から番号・事業名・自己評価・外部評価を収録（評価区分の定義は同資料の事務事業評価シートの凡例）。事業費（千円）は予算・決算の別が表に明記されないため金額として収録していない。列の順序が崩れて番号と事業名の対応が確定しない行（4・7・12〜25・40番等）は除外。評価年度は資料に明記がなく未設定。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

/** 当麻町 令和3年度 事務・事業点検・評価総括表の行（事業番号・事務事業名・自己評価・予算科目）。 */
function extractTohma(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== '245af1f5eacd15c1e753be91') return [];
  const title = '令和３年度\n当麻町教育委員会の権限に属する事務の管理\n及び執行状況の点検・評価';
  const legend = 'Ａ\n\n特に良好\n\n（達成率：９０％以上）\n\nＢ\n\n良好\n\n（達成率：７０％～９０％未満）\n\nＣ\n\n妥当\n\n（達成率：５０％～７０％未満）\n\nＤ\n\n要改善\n\n（達成率：５０％未満）';
  const tEv = must(input, title), lEv = must(input, legend);
  if (!tEv || !lEv) return [];
  const t = input.text, end = t.indexOf('\n点検評価表\n'), table = t.slice(0, end < 0 ? t.length : end), out: ProjectEvaluation[] = [];
  const row = /(?<=\n)([^\s\d－]{1,2}(?: [^\s\d－])?)(?: |\n\n)－(?: |\n\n)(\d+) ([^\n]+)\n\n([A-DＡ-Ｄ])\n\n([^\n]+費[^\n]*)(?=\n)/g;
  for (const m of table.matchAll(row)) {
    const code = `${m[1].replaceAll(' ', '')}－${m[2]}`, raw = m[0], s = m.index!;
    const p = project(input, code, m[3].trim(), null, raw, s);
    p.evaluatedFiscalYear = 2021;
    p.ratings.push({ kind: 'self', label: '自己評価(事業評価)', value: m[4], scale: 'Ａ 特に良好（達成率：９０％以上）／Ｂ 良好（７０％～９０％未満）／Ｃ 妥当（５０％～７０％未満）／Ｄ 要改善（５０％未満）', evidence: evidence(input, raw, s) });
    p.evidence.push(tEv, lEv);
    p.warnings.push(`令和３年度 事務・事業点検・評価総括表の1行から事業番号・事務事業名・自己評価を収録（予算科目（目名）は「${m[5]}」）。評価対象年度は総括表・点検評価表の令和３年度による。個別の点検評価表の決算額は財源内訳との列対応が確定しないため未収録。担当部署・事業実績は未構造化。`);
    out.push(p);
  }
  // 小学校・中学校で同名の事業（別の事業番号）は同一年度で識別できないため除外。
  const count = new Map<string, number>();
  for (const p of out) count.set(p.projectName, (count.get(p.projectName) ?? 0) + 1);
  return mergeReprints(out.filter(p => count.get(p.projectName) === 1), p => p.projectCode!);
}

/** 尾花沢市 令和7年度 点検及び評価報告書（令和6年度事業分）の事業別評価表の行。 */
function extractObanazawa(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== 'e1b96b5af3677c82b3d71dab') return [];
  const title = '令和７年度\n教育委員会事務の点検及び評価報告書\n（令和６年度事業分）';
  const legend = '継続・拡大 （１２点～９点）\n\nＡ\n\n見直し・改善 （８点～５点）\n\nＢ\n\n縮小・廃止\n\nＣ\n\n（４点～３点）';
  const tEv = must(input, title), lEv = must(input, legend);
  const start = input.text.indexOf('Ⅳ．令和６年度尾花沢市教育委員会事務の点検・評価\n４');
  if (!tEv || !lEv || start < 0) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const row = /\n\n((?:[^\n]+\n)*?[^\n]+)\n\n((?:[^\n]+\n)*?[^\n]+)\n\n([1-4])\n\n([1-4])\n\n([1-4])\n\n([ABC])(?=\n)/g;
  row.lastIndex = start;
  for (const m of t.matchAll(row)) {
    if (m.index! < start) continue;
    const lines = m[1].split('\n');
    if (lines.some(l => l.length > 12 || /[。、 ]/.test(l) || /^[\dA-C]$/.test(l) || /^(?:事業名|事業内容|必要性|効率性|有効性|総合|評 価)$/.test(l))) continue;
    if (/^(?:事業名|事業内容|必要性|効率性|有効性|総合)$/.test(m[2])) continue;
    const sum = Number(m[3]) + Number(m[4]) + Number(m[5]);
    if ((sum >= 9 ? 'A' : sum >= 5 ? 'B' : 'C') !== m[6]) continue;
    const name = lines.join(''), raw = m[0].slice(2), s = m.index! + 2;
    const p = project(input, name, name, 2025, raw, s);
    p.evaluatedFiscalYear = 2024;
    p.ratings.push({ kind: 'self', label: '総合', value: m[6], scale: '必要性＋効率性＋有効性の合計点数による評価：A 継続・拡大（12点〜9点）／B 見直し・改善（8点〜5点）／C 縮小・廃止（4点〜3点）', evidence: evidence(input, raw, s) });
    p.evidence.push(tEv, lEv);
    p.warnings.push('事業別評価表の1行から事業名・総合評価（A〜C）を収録。3項目の点数の合計が評価基準の総合評価と一致する行のみ。表頭の段組みが崩れており必要性・効率性・有効性の各点数と列の対応が確定しないため、個別点数は未収録。段組みが崩れて事業名と行の対応が確定しない行は除外。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

const MISAKI_CODE = /(学校|指導|生涯|淡公|文セ|青セ|給食|淡幼)([０-９]+)/;
const MISAKI_SCALE = 'Ａ 継続（現行どおり継続する。又は拡充を図る。）／Ｂ 要検討／Ｃ 要改善／Ｄ 廃止';

/** 岬町 教育委員会の点検・評価報告書：点検・評価事業一覧表の行と、整理番号が一致する点検・評価票の総合評価・前年度決算額。 */
function misaki(input: CachedInput, title: string, evaluatedFiscalYear: number, sheetYear: string): ProjectEvaluation[] {
  const tEv = must(input, title);
  const t = input.text, listStart = t.indexOf('点検・評価事業一覧表\n\n担当部署');
  if (!tEv || listStart < 0) return [];
  const sheetStarts = [...t.matchAll(/\n令和[^\n]{1,6}実施事業/g)].map(m => m.index! + 1).filter(s => s > listStart);
  const listEnd = sheetStarts[0] ?? t.length, list = t.slice(listStart, listEnd);
  const sheets = sheetStarts.map((s, i) => ({ s, text: t.slice(s, sheetStarts[i + 1] ?? t.length) })).filter(b => b.text.includes('点検・評価票'));
  const out: ProjectEvaluation[] = [];
  const rowRe = new RegExp(`(?<=^|\\n|\\s)${MISAKI_CODE.source} (?:【[^】]+】)?([^\\n]+?)(?: (Ａ 継 続|Ｂ 要検討|Ｃ 要改善|Ｄ 廃 止|完了)(?: [^\\n]*)?)?(?=\\n)`, 'g');
  for (const m of list.matchAll(rowRe)) {
    const code = m[1] + m[2], name = m[3].trim();
    if ((name.match(/（/g) ?? []).length !== (name.match(/）/g) ?? []).length || !/(?:事業|授業|設置|委員会|試食会|）)$/.test(name)) continue;
    const raw = m[0], s = listStart + m.index!;
    const p = project(input, code, name, null, raw, s);
    p.evaluatedFiscalYear = evaluatedFiscalYear;
    let rating: { value: string; raw: string; start: number } | null = m[4] ? { value: m[4], raw, start: s } : null;
    const sheet = sheets.find(b => b.text.match(MISAKI_CODE)?.[0] === code);
    if (sheet && nfkc(sheet.text).includes(nfkc(name))) {
      const r = sheet.text.match(/総合評価\n\n([ＡＢＣＤ][ ．]?(?:継続|要検討|要改善|廃止)|完了)(?=\n)/);
      if (r) {
        if (rating && nfkc(rating.value).replace('．', '') !== nfkc(r[1]).replace('．', '')) continue;
        rating = { value: r[1], raw: r[0], start: sheet.s + r.index! };
      }
      const a = sheet.text.match(new RegExp(`前年度決算額\\n+${sheetYear}決算見込額\\n+備\\n+考\\n+事\\s?業\\s?費\\n+([\\d,]+) 千円\\n\\n([\\d,]+) 千円\\n`));
      if (a) p.amounts.push(amount(input, 'actual', evaluatedFiscalYear - 1, a[1], '千円', a[0].slice(0, a[0].indexOf(' 千円') + 3), sheet.s + a.index!));
      const d = sheet.text.match(/担当部署\n\n([^\n]+?(?:課|館|センター|園))\n/);
      if (d) { p.department = d[1]; p.evidence.push(evidence(input, d[0].trim(), sheet.s + d.index!)); }
      const head = sheet.text.match(MISAKI_CODE)!;
      p.evidence.push(evidence(input, head[0], sheet.s + head.index!));
    }
    if (rating) p.ratings.push({ kind: 'self', label: '総合評価（内部評価）', value: rating.value, scale: MISAKI_SCALE, evidence: evidence(input, rating.raw, rating.start) });
    p.evidence.push(tEv);
    p.warnings.push(`点検・評価事業一覧表の1行から整理番号・事務事業名・内部評価を、整理番号と事業名が一致する点検・評価票から担当部署・総合評価・事業費の前年度決算額（${evaluatedFiscalYear - 1}年度として収録）を収録。一覧表と評価票の評価が食い違う事業は除外。${sheetYear}決算見込額は見込値のため未収録。4つの視点の3段階評価（○印の位置）は列の対応が確定しないため未収録。一覧表で事業名が改行で分断された行は除外。評価年度は資料に明記がなく未設定。`);
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

function extractMisaki(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId === '350053aa880c89704cb0c333') return misaki(input, '令和２年度（2020年度）実施事業\n教育委員会の事務の管理及び\n執行状況の点検・評価報告書', 2020, '令和２年');
  if (input.sourceId === 'c2cfdc889ee4c70fb43a24af') return misaki(input, '令和5年度（2023年度）実施事業\n教育委員会の事務の管理及び\n執行状況の点検・評価報告書', 2023, '令和５年');
  return [];
}

/** 古座川町 令和6年度 事務点検評価報告書（令和5年度事務事業分）の事務点検評価書。 */
function extractKozagawa(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== '2187727a68028f73d513c819') return [];
  const title = '令和６年度\n\n古座川町教育委員会事務点検評価報告書\n（令和５年度事務事業分）';
  const tEv = must(input, title);
  if (!tEv) return [];
  const t = input.text, heading = '事務点検評価書（令和５年度事業）', out: ProjectEvaluation[] = [];
  const starts = [...t.matchAll(/事務点検評価書（令和５年度事業）/g)].map(m => m.index!);
  starts.forEach((s, i) => {
    const block = t.slice(s, starts[i + 1] ?? t.length);
    const m = block.match(/^事務点検評価書（令和５年度事業）\n事\n\n業\n\n名\n\n([^\n]+)\n\n担\n\n当\n\n課\n\n([^\n]+)\n/);
    if (!m) return;
    const prog = [...block.matchAll(/■ ?(全て達成|概ね達成|半分達成|部分達成|達成せず)/g)], dir = [...block.matchAll(/■ ?(拡充|継続|縮小|改善|終了)/g)];
    const p = project(input, m[1], m[1], 2024, m[0], s);
    p.department = m[2]; p.evaluatedFiscalYear = 2023;
    if (prog.length === 1) p.ratings.push({ kind: 'self', label: '評価（進捗）', value: prog[0][1], scale: '全て達成／概ね達成／半分達成／部分達成／達成せず', evidence: evidence(input, prog[0][0], s + prog[0].index!) });
    if (dir.length === 1) p.ratings.push({ kind: 'self', label: '今後の方向性', value: dir[0][1], scale: '拡充／継続／縮小／改善／終了', evidence: evidence(input, dir[0][0], s + dir[0].index!) });
    p.evidence.push(tEv);
    p.warnings.push('事務点検評価書1枚から事業名・担当課・評価（進捗の■印）・今後の方向性（■印）を収録。予算額・決算額の表は段組みが崩れ、年度列との対応が票によって確定しないため金額は未収録。評価員評価・成果の文章は未構造化。');
    out.push(p);
  });
  return mergeReprints(out, p => p.projectCode!);
}

export const entries: Record<string, Entry> = {
  '01220': { extract: extractShibetsu, scope: '令和6(2024)年度 教育に関する事務の点検・評価報告書（令和5年度対象・社会教育委員会議議案に所収）の事務事業点検・評価調書から事務事業名・所管課・決算額（千円）・評価（A〜E）・事務事業の必要性を構造化。一覧表の施策別集計、評価委員の意見、会議議案部分は対象外。' },
  '01367': { extract: extractOkushiri, scope: '令和5年度事務・事業評価対象事業リストのうち列の対応が崩れていない行から番号・事業名・自己評価・外部評価を構造化。区分不明の事業費、列が崩れた行、個別の事務事業評価シートの決算額・指標は対象外。' },
  '01454': { extract: extractTohma, scope: '令和3年度 事務・事業点検・評価総括表（学校教育・社会教育）の各行から事業番号・事務事業名・自己評価（A〜D）を構造化。個別点検評価表の決算額・財源内訳・事業実績、補助金等一覧、教育委員会の開催状況は対象外。' },
  '06212': { extract: extractObanazawa, scope: '令和7年度 教育委員会事務の点検及び評価報告書（令和6年度事業分）の事業別評価表のうち、段組みが崩れず点数合計と総合評価が一致する行から事業名・総合評価（A〜C）を構造化。項目別点数、学識経験者の知見、施策体系・活動状況は対象外。' },
  '27366': { extract: extractMisaki, scope: '令和2年度・令和5年度実施事業の点検・評価報告書の点検・評価事業一覧表から整理番号・事務事業名・内部評価を、整理番号の一致する点検・評価票から担当部署・総合評価・前年度決算額を構造化。決算見込額、視点別評価、活動評価委員の意見、文字の読めないPDFは対象外。' },
  '30424': { extract: extractKozagawa, scope: '令和6年度 教育委員会事務点検評価報告書（令和5年度事務事業分）の事務点検評価書15枚から事業名・担当課・進捗評価・今後の方向性を構造化。列の対応が確定しない予算額・決算額、評価員評価の文章、教育委員会の活動状況は対象外。' },
};
