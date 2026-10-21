import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, eraYear, normalize } from '../batch8/h6-util';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

const at = (input: CachedInput, raw: string) => {
  const i = input.text.indexOf(raw);
  return i >= 0 && input.text.indexOf(raw, i + 1) < 0 ? i : -1;
};

/* ---------- 21505 八百津町 電源立地地域対策交付金 事業評価個表（平成30年度・令和元年度） ---------- */

/** 1資料1事業。値はすべて本文の完全一致文字列で、1か所にしか現れないことを確認して使う。 */
const YAOTSU: Record<string, { name: string; nameRaw: string; header: string; era: string; year: string; dept: string; deptRaw: string; costRaw: string; cost: string; sheetCost: string }> = {
  '0f60fced44a90bcc81291898': { name: '小型動力ポンプ付積載車購入事業', nameRaw: '1\n小型動力ポンプ付積載車購入事業\n', header: 'Ⅱ．事業評価個表（ 平成 30 年度）', era: '平成', year: '30',
    dept: '八百津町役場 防災安全室', deptRaw: '交付金事業の担当課室\n八百津町役場 防災安全室\n', costRaw: '八百津町\n\n8,856,000\n\n交付金充当額', cost: '8,856,000', sheetCost: '平成30年度\n8,856,000\n7,000,000' },
  '263687c746d3d0fdf2c9acae': { name: '保育所運営事業', nameRaw: '1 地域活性化措置\n\n保育所運営事業\n', header: 'Ⅱ．事業評価個表（平成30年度）', era: '平成', year: '30',
    dept: '秘書室', deptRaw: '交付金事業の担当課室\n\n秘書室\n', costRaw: '八百津町\n\n62,056,287\n\n交付金充当額', cost: '62,056,287', sheetCost: '総事業費\n\n68,062,128\n\n60,033,504\n\n62,056,287' },
  'a0a5ffeec9dfe436b927aeab': { name: '谷・洞線 舗装補修工事', nameRaw: '1\n谷・洞線 舗装補修工事\n', header: 'Ⅱ．事業評価個表（平成30年度）', era: '平成', year: '30',
    dept: '建設課', deptRaw: '交付金事業の担当課室\n建設課\n', costRaw: '八百津町\n\n32,181,840\n\n交付金充当額', cost: '32,181,840', sheetCost: '30年度\n32,181,840\n28,067,000' },
  '57c80d0cc953fb95ae389bad': { name: '小型動力ポンプ付積載車購入事業', nameRaw: '1 公共用施設に係る整備、維持補修又は維持運営等措置\n小型動力ポンプ付積載車購入事業\n', header: 'Ⅱ．事業評価個表（ 令和 元 年度）', era: '令和', year: '元',
    dept: '八百津町役場 防災安全室', deptRaw: '八百津町役場 防災安全室\n八百津町役場 防災安全室\n', costRaw: '八百津町\n\n9,130,000\n\n交付金充当額', cost: '9,130,000', sheetCost: '令和元年度\n9,130,000\n7,000,000' },
  '34f1d912d3829d6b275899b5': { name: '町道 谷・洞線 外１路線 舗装補修工事', nameRaw: '1\n町道 谷・洞線 外１路線 舗装補修工事\n', header: 'Ⅱ．事業評価個表（令和元年度）', era: '令和', year: '元',
    dept: '建設課', deptRaw: '交付金事業の担当課室\n交付金事業の評価課室\n\n建設課\n建設課\n', costRaw: '八百津町\n\n28,700,100\n\n交付金充当額', cost: '28,700,100', sheetCost: '令和元年度\n28,700,100\n28,067,000' },
  'bdef3f8f4924f5666aebe72f': { name: '保育所運営事業', nameRaw: '1\n\n地域活性化措置\n\n保育所運営事業\n', header: 'Ⅱ．事業評価個表（平成３１年度）', era: '平成', year: '31',
    dept: '秘書室', deptRaw: '交付金事業の担当課室 秘書室\n', costRaw: '交付金充当額\n\n65,829,967\n\n60,352,484', cost: '65,829,967', sheetCost: '総事業費\n\n60,033,504\n\n62,056,287\n\n65,829,967' },
};

function yaotsu(input: CachedInput): ProjectEvaluation[] {
  const s = YAOTSU[input.sourceId];
  if (input.municipalityCode !== '21505' || !s || !input.text.startsWith('別紙\nⅠ．事業評価総括表')) return [];
  const pos = [s.nameRaw, s.header, s.deptRaw, s.costRaw, s.sheetCost].map(r => at(input, r));
  if (pos.some(p => p < 0)) return [];
  const fy = eraYear(s.era, s.year)!;
  const nameAt = pos[0] + s.nameRaw.indexOf(s.name);
  const p = project(input, s.name, s.name, null, s.name, nameAt);
  p.projectCode = null; p.evaluatedFiscalYear = fy; p.department = s.dept;
  p.evidence.push(evidence(input, s.header, pos[1]), evidence(input, s.deptRaw.trimEnd(), pos[2]));
  // 総括表の「交付金事業に要した経費」が個表の総事業費（同じ年度の列）と一致する場合だけ、その年度の決算（実績）として記録。
  p.amounts.push(amount(input, 'actual', fy, s.cost, '円', s.costRaw, pos[3]));
  p.evidence.push(evidence(input, s.sheetCost, pos[4]));
  p.warnings.push(`八百津町 電源立地地域対策交付金 事業評価報告書の事業評価個表（${s.header.replace(/^Ⅱ．事業評価個表/, '')}）。個表見出しの年度を評価対象年度とし、評価実施年度は明示がないため未設定。`,
    '金額は事業評価総括表（単位：円）の「交付金事業に要した経費」で、個表の総事業費の同年度欄と一致することを確認して決算（実績）として記録。交付金充当額・過年度の総事業費・成果指標・活動指標は列の対応が崩れているため未収録。');
  return [p];
}

/* ---------- 01401 共和町 電源立地地域対策交付金・広報調査等交付金 事業評価個表 ---------- */

const KYOWA_SHEETS = new Set(['3c4c289316d61857c9f7a824', '3f076df4df1943bb8b1459ff', '6f89495274a0aeb364a1f44c']);
const KYOWA_PR = '8840fe190009ccbf7c65d586';
const DEPT = /^[^\n\d]*(?:課|室|係|センター|委員会)[^\n\d]*$/;

/** 総括表（単位：円）と個表の組ごとに、総括表の事業名を個表の本文で照合して事業名・個表見出しの年度・担当課室を収録。 */
function kyowa(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01401') return [];
  const t = input.text;
  if (input.sourceId === KYOWA_PR) return kyowaPr(input);
  if (!KYOWA_SHEETS.has(input.sourceId) || !t.startsWith('別紙\nⅠ．事業評価総括表')) return [];
  const starts = [...t.matchAll(/別紙\nⅠ．事業評価総括表/g)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    const block = t.slice(s, starts[i + 1] ?? t.length), k = block.indexOf('Ⅱ．事業評価個表');
    if (k < 0) return;
    const head = /^Ⅱ．事業評価個表（(平成|令和) ?([元\d０-９]+) ?年度）/.exec(block.slice(k));
    if (!head) return;
    const sheet = normalize(block.slice(k));
    // 総括表の事業名（1〜2行に折返し）。結合した名称が個表の本文に現れるものだけ採用。
    const cands = [/交付金充当額\n\n((?:[^\n]+\n){1,2})\n共和町\n\n/, /間接交付金事業者名\n\n((?:[^\n]+\n){1,2})\n共和町\n\n/, /交付金事業の名称\n\n地域活性化措置\n\n((?:[^\n]+\n){1,2})\n（備考）/,
      /交付金事業の名称\n\n((?:[^\n]+\n){1,2})\n交付金事業者名又は\n/]
      .map(re => re.exec(block.slice(0, k))).filter((m): m is RegExpExecArray => !!m);
    const m = cands.find(c => sheet.includes(normalize(c[1])));
    if (!m) return;
    const nameRaw = m[1].trimEnd(), name = nameRaw.replace(/\n/g, '');
    const nameAt = s + m.index + m[0].indexOf(m[1]);
    const fy = eraYear(head[1], head[2]);
    const p = project(input, name, name, null, nameRaw, nameAt);
    p.projectCode = null; p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, head[0], s + k));
    // 担当課室: 「担当課室\nX\n評価課室\nY」か、ラベル2行の直後に同じ課室名が2行続く場合だけ。
    const tail = block.slice(k);
    const d1 = /交付金事業の担当課室\n([^\n]+)\n交付金事業の評価課室\n([^\n]+)\n/.exec(tail);
    const d2 = /交付金事業の担当課室\n交付金事業の評価課室\n\n([^\n]+)\n([^\n]+)\n/.exec(tail);
    const d = d1 && DEPT.test(d1[1]) ? d1 : d2 && d2[1] === d2[2] && DEPT.test(d2[1]) ? d2 : null;
    if (d) { p.department = d[1]; p.evidence.push(evidence(input, d[0].trimEnd(), s + k + d.index)); }
    p.warnings.push('共和町 電源立地地域対策交付金 事業評価報告書の事業評価総括表と事業評価個表の組。事業名は総括表の名称（折返しを結合）が個表本文と一致するものだけ収録し、個表見出しの年度を評価対象年度とした。評価実施年度は明示がないため未設定。',
      `担当課室は個表の担当課室欄が一意に読める場合だけ記録${d ? '' : '（この事業は担当課室と評価課室の列が混在しているため未設定）'}。総括表の「交付金事業に要した経費」と個表の総事業費が一致しない事業があるため金額は未収録。成果指標・活動指標・定性的評価は段組みが崩れているため未収録。`);
    out.push(p);
  });
  const count = new Map<string, number>();
  for (const p of out) count.set(`${p.projectName}:${p.evaluatedFiscalYear}`, (count.get(`${p.projectName}:${p.evaluatedFiscalYear}`) ?? 0) + 1);
  return out.filter(p => count.get(`${p.projectName}:${p.evaluatedFiscalYear}`) === 1);
}

/** 広報・調査等交付金 事業評価個表（年度の明示なし）。 */
function kyowaPr(input: CachedInput): ProjectEvaluation[] {
  const head = '別紙\nⅡ．事業評価個表\n番号\n\n交付金事業の名称\n泊発電所に係る広報・調査等交付金事業\n';
  if (!input.text.startsWith(head) || !input.text.includes('交付金事業の成果及び評価')) return [];
  const name = '泊発電所に係る広報・調査等交付金事業';
  const p = project(input, name, name, null, head.trimEnd(), 0);
  p.projectCode = null;
  p.evidence.push(evidence(input, '交付金事業の成果及び評価'));
  p.warnings.push('共和町 広報・調査等交付金 事業評価個表。本文に年度の記載がないため評価年度・評価対象年度は未設定。',
    '総事業費と契約金額の合計の配置が崩れており（総事業費欄に交付金充当額と契約合計が並ぶ）、金額は未収録。成果指標は文章のみ。担当課室の記載なし。');
  return [p];
}

export const entries: Record<string, Entry> = {
  '21505': { extract: yaotsu, scope: '八百津町 電源立地地域対策交付金 事業評価個表（平成30年度・令和元年度の6事業）の事業名・担当課室・個表見出しの年度と、個表の総事業費と一致した総括表の「交付金事業に要した経費」。交付金充当額・成果/活動指標・定性的評価の文章と公表ページ（html）は対象外。' },
  '01401': { extract: kyowa, scope: '共和町 電源立地地域対策交付金 事業評価個表（平成30年度・令和元年度・令和3年度）と広報・調査等交付金 事業評価個表の事業名・個表見出しの年度・一意に読める担当課室。金額（要した経費と総事業費が食い違う）・成果/活動指標・定性的評価と公表ページ（html）は対象外。' },
};
