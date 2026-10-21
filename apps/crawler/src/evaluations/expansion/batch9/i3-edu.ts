/** 教育委員会の点検・評価（事業別の調書・評価表）: 36405 上板町、02210 平川市、06321 河北町、06322 西川町、02301 平内町。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { BASE_WARNING, type Entry, acrossInputs, checked, digits, lines, reiwa, segments, toNum } from './i3-util';

// ---------------------------------------------------------------- 上板町（事業ごと1枚のPDF）
const KAMIITA = new Set(['13fcc5aab03959f133bd0b68', '19d3060ea2604c2869c3dd33', '33f93367ee19739c3f400d6a', '359deb93f0bb294a74e3ada8',
  '4a6a8424aa802c99dc72f806', '5a5678ac4a6ca75dd089071d', '5b33eaabbe697c7a934d3406', '803114299703056718ab7923', '92d90e37c661cadeb2c4f687',
  '973bcf115e401d4713891f2a', 'bbc613323fcd82354c28cacf', 'c6f1561af04c71058758e12a', 'd409e2c17628324444c3d361', 'f38138d699c12aae08377945']);
const KAMIITA_LABELS = new Set(['', '目的', '対象・内容等', '実績等', '成果等', '次年度以降の', '取組み']);
const KAMIITA_RESULT = ['達成', 'おおむね達成', 'やや不十分', '不十分'];
const KAMIITA_NEXT = ['さらに重点化する', '現状のまま継続する', '見直しのうえ継続する', '事業の縮小を検討する', '休止、廃止を検討する'];

function extractKamiita(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!KAMIITA.has(input.sourceId)) return [];
  const head = t.match(/^令和([０-９\d]+)年度（令和([０-９\d]+)年度決算）(上板町[^\n]+)\n事業名\n事業費\n（千円）\n/);
  if (!head) return [];
  const evalYear = reiwa(head[1]), fy = reiwa(head[2]);
  const ls = lines(t.slice(head[0].length), head[0].length);
  const i = ls.findIndex(l => !KAMIITA_LABELS.has(l.s.trim()));
  const j = ls.findIndex((l, k) => k > i && l.s.trim() !== '');
  if (i < 0 || j < 0 || !/^[\d,]+$/.test(ls[j].s) || ls[i].s.length > 40) return [];
  const name = ls[i].s, cost = ls[j].s;
  const p = project(input, `${fy}:${name}`, name, evalYear, name, ls[i].at);
  p.projectCode = null; p.department = head[3]; p.evaluatedFiscalYear = fy;
  p.evidence.push(evidence(input, head[0].trim(), 0));
  p.amounts.push({ kind: 'actual', fiscalYear: fy, amountYen: toNum(cost) * 1000, rawValue: cost, rawUnit: '千円',
    evidence: evidence(input, t.slice(ls[i].at, ls[j].at + cost.length), ls[i].at) });
  const warnings = [BASE_WARNING + `表題「令和${head[1]}年度（令和${head[2]}年度決算）」の事業別点検・評価シート。事業名の直後の「事業費（千円）」欄の値を令和${head[2]}年度決算（実績）として採用。財源内訳・実績の数値は構造化していません。担当は表題の組織名。`];
  const result = checked(t, KAMIITA_RESULT), next = checked(t, KAMIITA_NEXT);
  if (result) p.ratings.push({ kind: 'self', label: '成果等', value: result.value, scale: KAMIITA_RESULT.join('／'), evidence: evidence(input, result.raw, result.at) });
  if (next) p.ratings.push({ kind: 'self', label: '次年度以降の取組み', value: next.value, scale: KAMIITA_NEXT.join('／'), evidence: evidence(input, next.raw, next.at) });
  if (!result || !next) warnings.push('チェック（■）が1つに定まらない評価欄は構造化していません。');
  p.warnings = warnings;
  return [p];
}

// ---------------------------------------------------------------- 平川市（事務事業評価表）
const HIRAKAWA = '1d94eafb245c0cf1f239cb6d';
const HIRAKAWA_HEAD_LABELS = /^(?:担当|担当課|事務事業名|部署|担当部署|事業 No\.[０-９\d]+|)$/;

function extractHirakawa(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (input.sourceId !== HIRAKAWA) return [];
  const yr = t.match(/^教育に関する事務の管理及び執行の\n状況の点検及び評価結果報告書\n【令和([０-９\d]+)年度分】/);
  const scale = t.match(/評 価\n\nS\n\n大幅に達成している（１５０％以上）\n\nA\n\n達成している（１００％以上）\n\nB\n\nほぼ達成している（８０％以上）\n\nC\n\nおおむね達成している（６０％以上）\n\nD\n\n達成していない（６０％未満）/);
  if (!yr || !scale) return [];
  const fy = reiwa(yr[1]), out: ProjectEvaluation[] = [];
  for (const { start, end } of segments(t, /事務事業評価表\n/g)) {
    const seg = t.slice(start, end), headEnd = seg.indexOf('１．概要');
    if (headEnd < 0) continue;
    const ls = lines(seg.slice(0, headEnd), start).slice(1);
    const no = ls.find(l => /^事業 No\.[０-９\d]+$/.test(l.s));
    const content = ls.filter(l => !HIRAKAWA_HEAD_LABELS.test(l.s.trim()));
    if (!no || content.length !== 2 || content.some(l => l.s.length > 30)) continue;
    const [name, dept] = content;
    const code = `No.${digits(no.s.slice(no.s.indexOf('.') + 1))}`;
    const p = project(input, `${fy}:${code}`, name.s, null, name.s, name.at);
    p.projectCode = code; p.department = dept.s; p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, no.s, no.at), evidence(input, dept.s, dept.at), evidence(input, yr[0], 0));
    const warnings = [BASE_WARNING + `教育委員会 点検及び評価結果報告書【令和${yr[1]}年度分】の事務事業評価表。事業名・担当部署は表頭の2つの記入欄（ラベル以外の行）がそろう場合のみ採用。`];
    const cost = [...seg.matchAll(/【事業費】 ?事業費総額[ \n]*([０-９\d,，]+)千円/g)];
    if (cost.length === 1) {
      p.amounts.push({ kind: 'actual', fiscalYear: fy, amountYen: toNum(cost[0][1]) * 1000, rawValue: cost[0][1], rawUnit: '千円',
        evidence: evidence(input, cost[0][0], start + cost[0].index!) });
      warnings.push(`【実績】欄の後の「事業費総額」を令和${yr[1]}年度の実績額として採用（国・県補助の内訳は構造化していません）。`);
    }
    const evalAt = seg.indexOf('３．評価');
    const marks = evalAt < 0 ? [] : [...seg.slice(evalAt).matchAll(/\n([SABCDＳＡＢＣＤ])\n/g)];
    if (marks.length === 1) {
      p.ratings.push({ kind: 'self', label: '評価（達成度）', value: marks[0][1], scale: 'S 大幅に達成している（１５０％以上）／A 達成している（１００％以上）／B ほぼ達成している（８０％以上）／C おおむね達成している（６０％以上）／D 達成していない（６０％未満）',
        evidence: evidence(input, marks[0][1], start + evalAt + marks[0].index! + 1) });
      p.evidence.push(evidence(input, scale[0], scale.index!));
    } else warnings.push('「３．評価」欄の評価記号が1つに定まらないため評価は構造化していません。');
    p.warnings = warnings;
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 河北町（対象事業一覧＋事務事業点検及び評価調書）
const KAHOKU = '34dfa0190bce640f351fd12c';
const DIRECTIONS = ['拡充', '継続', '縮小', '見直し', '休廃止'];

function extractKahoku(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (input.sourceId !== KAHOKU) return [];
  const head = t.match(/^令和([０-９\d]+)年度\n\n河北町教育委員会事務事業点検及び評価報告書\n（令和([０-９\d]+)年度分）/);
  const listAt = t.indexOf('点検及び評価対象事業一覧\n\n番号\n\n事業名');
  if (!head || listAt < 0) return [];
  const evalYear = reiwa(head[1]), fy = reiwa(head[2]);
  const sheets = segments(t, /事務事業点検及び評価調書\n１\n\n事業名等\n/g);
  const listEnd = sheets[0]?.start ?? t.length;
  const out: ProjectEvaluation[] = [];
  for (const m of t.slice(listAt, listEnd).matchAll(/\n([０-９\d]+)\n\n([^\n]+)\n\n([^\n]+課)\n\n(拡充|継続|縮小|見直し|休廃止)\n/g)) {
    const no = digits(m[1]), name = m[2], at = listAt + m.index! + 1;
    const p = project(input, `${fy}:${no}`, name, evalYear, m[0].trim(), at);
    p.projectCode = String(no); p.department = m[3]; p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, head[0], 0));
    const warnings = [BASE_WARNING + `教育委員会 事務事業点検及び評価報告書（令和${head[2]}年度分）の対象事業一覧（番号・事業名・担当課・評価）。`];
    p.ratings.push({ kind: 'self', label: '評価（今後の方向性）', value: m[4], scale: DIRECTIONS.join('／'), evidence: evidence(input, m[0].trim(), at) });
    // 同じ番号の調書: 事業名が本文に含まれる場合のみ、予算額（合計）・決算額と方向性（■）を照合して採用。
    const sheet = sheets.find(s => {
      const n = t.slice(s.start, s.end).match(/^事務事業点検及び評価調書\n１\n\n事業名等\n(?:事業名\n\n)?([０-９\d]+)[ \n]/);
      return n && digits(n[1]) === no;
    });
    const seg = sheet ? t.slice(sheet.start, sheet.end) : '';
    if (sheet && seg.includes(name)) {
      const am = seg.match(/\n合計\n\n([\d,]+)\n\n決算額\n\n([\d,]+)\n/);
      if (am && /（単位：千円）/.test(seg.slice(seg.indexOf('予算額・決算額'), am.index!))) {
        const e = evidence(input, am[0].trim(), sheet.start + am.index! + 1);
        p.amounts.push({ kind: 'budget', fiscalYear: fy, amountYen: toNum(am[1]) * 1000, rawValue: am[1], rawUnit: '千円', evidence: e });
        p.amounts.push({ kind: 'actual', fiscalYear: fy, amountYen: toNum(am[2]) * 1000, rawValue: am[2], rawUnit: '千円', evidence: e });
        warnings.push(`調書の「予算額・決算額（単位：千円）」のうち「合計」（当初予算額＋補正額等）を予算、「決算額」を実績として令和${head[2]}年度に採用。当初予算額・補正額等は列位置が崩れるため構造化していません。`);
      }
      const dir = checked(seg, DIRECTIONS);
      if (dir && dir.value === m[4]) p.evidence.push(evidence(input, dir.raw, sheet.start + dir.at));
      else if (dir) { warnings.push('調書の方向性（■）が一覧の評価と一致しないため除外。'); continue; }
      p.evidence.push(evidence(input, name, sheet.start + seg.indexOf(name)));
    } else warnings.push('対応する調書を番号と事業名で特定できないため、金額は構造化していません。');
    p.warnings = warnings;
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 西川町（事務事業点検・評価調書）
const NISHIKAWA = new Set(['10edcc41310e543cd4201b14', '797cb2761d61162cee2c4c67']);
const NEED = ['適切に対応している', '概ね対応できている', 'ほとんど対応できていない'];
const EFFICIENCY = ['十分に効果が得られている', 'ある程度の効果が得られている', '効果があまり得られていない'];
const EFFECT = ['期待した成果が得られている', '概ね期待した成果が得られている', '期待した成果があまり得られていない'];
const NISHIKAWA_LABELS = /^(?:別記様式|１ 事業名等|事業名|所管課|・係|施策体系|)$/;
const DEPT = /(?:課|係|室|館|センター)$/;

function extractNishikawa(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!NISHIKAWA.has(input.sourceId)) return [];
  const head = t.match(/\n令和([０-９\d]+)年度\n西川町教育委員会事務事業点検・評価報告書\n/);
  if (!head) return [];
  const fy = reiwa(head[1]), out: ProjectEvaluation[] = [];
  for (const { start, end } of segments(t, /事務事業点検・評価調書\n/g)) {
    const seg = t.slice(start, end);
    // 表頭: 「２ 事業の概要」より前で、施策体系の記述（数字・〔 で始まる行）が始まるまで。
    const stop = seg.search(/\n(?:[1-9１-９]\d* (?!事業名等)|[1-9１-９]．|〔|予\n)/);
    if (stop < 0) continue;
    const ls = lines(seg.slice(0, stop), start).slice(1).filter(l => !NISHIKAWA_LABELS.test(l.s.trim()));
    const names = ls.filter(l => !DEPT.test(l.s)), depts = ls.filter(l => DEPT.test(l.s));
    if (names.length !== 1 || names[0].s.length > 50) continue;
    const name = names[0];
    const am = seg.match(/\n予算額\n(?:備 考\n)?\n（単位：千円 千円未満切上げ）\n\n([\d,]+)\n\n決算額\n\n([\d,]+)\n/)
      ?? (/予算額・決算額\n当初予算額\n[\s\S]{0,40}?（単位：千円 千円未満切上げ）/.test(seg) ? seg.match(/\n合計\n\n([\d,]+)\n\n決算額\n\n([\d,]+)\n/) : null);
    const p = project(input, `${fy}:${name.s}`, name.s, null, name.s, name.at);
    p.projectCode = null; p.department = depts.length ? depts.map(d => d.s).join('・') : null; p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, head[0].trim(), head.index! + 1), ...depts.map(d => evidence(input, d.s, d.at)));
    const warnings = [BASE_WARNING + `令和${head[1]}年度 教育委員会事務事業点検・評価報告書の事務事業点検・評価調書。事業名は表頭のラベル・所管課係以外の唯一の行のみ採用。`];
    if (am) {
      const e = evidence(input, am[0].trim(), start + am.index! + 1);
      p.amounts.push({ kind: 'budget', fiscalYear: fy, amountYen: toNum(am[1]) * 1000, rawValue: am[1], rawUnit: '千円', evidence: e });
      p.amounts.push({ kind: 'actual', fiscalYear: fy, amountYen: toNum(am[2]) * 1000, rawValue: am[2], rawUnit: '千円', evidence: e });
      warnings.push(`「予算額・決算額（単位：千円 千円未満切上げ）」の予算額（当初・補正の内訳がある様式は「合計」）と決算額を令和${head[1]}年度の予算・実績として採用（千円未満切上げの値）。`);
    }
    const evalAt = seg.indexOf('事業の評価'), evalSeg = evalAt < 0 ? '' : seg.slice(evalAt);
    for (const [label, opts] of [['必要性', NEED], ['効率性', EFFICIENCY], ['有効性', EFFECT], ['今後の対応等（方向性）', DIRECTIONS]] as const) {
      const c = checked(label === '今後の対応等（方向性）' ? seg : evalSeg, [...opts]);
      if (c) p.ratings.push({ kind: 'self', label, value: c.value, scale: opts.join('／'),
        evidence: evidence(input, c.raw, (label === '今後の対応等（方向性）' ? start : start + evalAt) + c.at) });
      else warnings.push(`${label}はチェック（■）が1つに定まらないため構造化していません。`);
    }
    p.warnings = warnings;
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 平内町（点検・評価報告書の事業別記述）
const HIRANAI = new Set(['11d1179d8cdf732a8e86fef0', '4003ed67989a09de4e083b68', '4d5fbae38d297237287acbca']);

function extractHiranai(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!HIRANAI.has(input.sourceId)) return [];
  const head = t.match(/^令和([０-９\d]+)年度\n\n平内町教育委員会の事務の\n点検及び評価に関する報告書\n\n―令和([０-９\d]+)年度の実績―/);
  if (!head) return [];
  const evalYear = reiwa(head[1]), fy = reiwa(head[2]), out: ProjectEvaluation[] = [];
  // 「①〇〇事業」の見出しの直後に「概」（概要欄）が続く項目のみ。
  for (const m of t.matchAll(/\n([①-⑳])([^\n]{2,40}事業)\n\n?概\n/g)) {
    const name = m[2];
    const p = project(input, `${fy}:${name}`, name, evalYear, `${m[1]}${name}`, m.index! + 1);
    p.projectCode = null; p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, head[0], 0));
    p.warnings = [BASE_WARNING + `教育委員会の点検及び評価に関する報告書（令和${head[1]}年度・令和${head[2]}年度の実績）のうち、名称が「事業」で終わる見出し（概要・実績・成果・課題等の記述あり）。記号評価・金額の記載はなく、事業名のみ構造化。`];
    out.push(p);
  }
  return out;
}

export const entries: Record<string, Entry> = {
  '36405': { extract: acrossInputs(extractKamiita), scope: '教育委員会の事業別点検・評価シート（令和８年度・令和７年度決算、14事業）の事業名・担当組織・事業費（決算・千円）と成果等・次年度以降の取組み（■）を構造化。財源内訳・実績の数値は対象外。' },
  '02210': { extract: acrossInputs(extractHirakawa), scope: '教育委員会 点検及び評価結果報告書【令和６年度分】の事務事業評価表の事業名・事業No.・担当部署・事業費総額（実績・千円）・評価（S〜D）を構造化。教育委員会の活動状況・シート１/２（事務の点検）は対象外。' },
  '06321': { extract: acrossInputs(extractKahoku), scope: '教育委員会 事務事業点検及び評価報告書（令和４年度分）の対象事業一覧（事業名・担当課・評価）と、番号・事業名で照合できた調書の予算額（合計）・決算額（千円）を構造化。評価委員の意見・活動状況は対象外。' },
  '06322': { extract: acrossInputs(extractNishikawa), scope: '教育委員会 事務事業点検・評価報告書（令和６・７年度）の事務事業点検・評価調書の事業名・所管課係・予算額/決算額（千円）・必要性/効率性/有効性/方向性（■）を構造化。令和４・５年度版（施策別シート）は対象外。' },
  '02301': { extract: acrossInputs(extractHiranai), scope: '教育委員会の点検及び評価に関する報告書（令和６〜８年度）で、名称が「事業」で終わる事業別記述の事業名と年度のみ構造化。記号評価・金額は記載がなく、施策・取組単位の項目と教育委員会の活動状況は対象外。' },
};
