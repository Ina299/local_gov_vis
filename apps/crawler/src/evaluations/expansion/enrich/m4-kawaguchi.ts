/** 川口市 (11203): 実施計画事業評価調書（令和5・7年度内部評価）の「事業の目的・背景」「①アクション」「③アウトカム」。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { sheets } from '../batch9/i1-util';

// 公開済みレコード（batch9/i1-kawaguchi＝令和6年度実施事業、batch12/m2-kawaguchi＝令和4年度実施事業）は同じ調書から作られ、
// 目的・事業内容・成果が空欄。調書の「２ 事業概要」は左右2列（左: 目的・背景／①アクション／③アウトカム、
// 右: めざす姿／②アウトプット／進捗状況及び課題）で、抽出テキストでは左右の行が1行ずつ交互に混ざる票が多い。
// 左列の見出しの直後に本文の塊があり、空行を挟んで右列の見出しが続く（間には実施形態などの欄名・選択肢だけがある）
// 票に限って、その塊を左列の本文として採る。左右の見出しが連続する票（行が混ざっている）は採らない。
const FIELDS = [
  { key: 'purpose', head: '事業の目的・背景（誰に・何をしたいのか・実施の背景）\n', right: '事業のめざす姿（事業が目指す最終的な成果）\n' },
  { key: 'activities', head: '①アクション（当該年度に何を実施したか）\n', right: '②アウトプット（①を実施した結果・実績）\n' },
  { key: 'outcomes', head: '③アウトカム（①②をしたことにより対象はどうなったか）\n', right: '①～③を踏まえ、めざす姿から見た現在の進捗状況及び課題\n' },
] as const;
// 左列の本文と右列の見出しの間に挟まってよい塊（事業概要の欄名と実施形態の選択肢）。
const BETWEEN = new Set(['実施形態', '直営', '一部委託', '全部委託', '補助金・負担金', '一部補助金・負担金', '指定管理', '当該年度の\n実施内容及び\n成果', '事業の概要']);
const HEADINGS = /^(事業の目的・背景|事業のめざす姿|①アクション|②アウトプット|③アウトカム|①～③を踏まえ|当該年度の|実施内容及び|事業の概要|実施形態|事務分類|３ 事業活動)/;

/** 左列の見出しの直後から右列の見出しまで。本文の塊が1つで、残りが欄名・選択肢だけなら本文と位置を返す。 */
function leftColumn(sheet: string, head: string, right: string): { text: string; at: number } | null {
  const a = sheet.indexOf(head);
  if (a < 0 || sheet.indexOf(head, a + 1) >= 0) return null;
  const from = a + head.length, b = sheet.indexOf(right, from);
  if (b < 0 || sheet.indexOf(right, b + 1) >= 0) return null;
  const region = sheet.slice(from, b);
  const end = region.indexOf('\n\n');
  if (end <= 0) return null;
  const text = region.slice(0, end);
  if (!text.trim() || text.split('\n').some(l => !l.trim() || HEADINGS.test(l))) return null;
  const rest = region.slice(end).split(/\n\n+/).map(s => s.trim()).filter(Boolean);
  if (!rest.every(s => BETWEEN.has(s))) return null;
  return { text, at: from };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11203' || input.format !== 'pdf') return [];
  const t = input.text;
  const r7 = /\/R7-\d-\d\.pdf$/.test(input.sourceUrl), r5 = t.startsWith('施策評価調書（１）\n\n令和4年度\n\n評価対象年度\n');
  if (!r7 && !r5) return [];
  const out: ProjectEvaluation[] = [];
  const all = sheets(t, '実施計画事業評価調書\n');
  all.forEach((sh, i) => {
    if (input.truncated && i === all.length - 1) return;
    const headEnd = sh.text.indexOf('１ 事業期間');
    if (headEnd < 0) return;
    const head = sh.text.slice(0, headEnd);
    // 事業名・年度は公開済みレコードと同じ読み方（見出し部の年度表記が評価対象年度の1つだけの票）。
    let name: string, nameAt: number, department: string | null = null, year: number;
    if (r7) {
      const nm = /\n([^\n]+)\n\n担当\n\n([^\n]+)\n/.exec(head);
      if (!nm || !/\n令和6年度\n/.test(head) || !/\n評価対象年度\n/.test(head) || (head.match(/令和\d+年度/g) ?? []).length !== 1) return;
      name = nm[2].trim(); nameAt = nm.index! + nm[0].lastIndexOf(nm[2]); department = nm[1]; year = 2024;
    } else {
      const lines = head.split('\n').filter(l => l.trim()), years = head.match(/令和\d+年度/g) ?? [];
      if (lines[1] !== '事業名称' || years.length !== 1 || years[0] !== '令和4年度') return;
      const n = lines[2] === '評価対象年度' ? lines[3] : lines[2];
      if (!n || /^(事業区分|評価対象年度|問い合わせ先|担当|新規・継続|通常事業|主要事業)$/.test(n) || /(部|局|市長室)$/.test(n)) return;
      name = n.trim(); nameAt = head.indexOf(`\n${n}\n`) + 1; year = 2022;
    }
    const found = FIELDS.map(f => ({ key: f.key, v: leftColumn(sh.text, f.head, f.right) }));
    if (!found.some(f => f.v)) return;
    const p = project(input, `${year}:${department ?? ''}:${name}:narrative`, name, null, name, sh.start + nameAt);
    p.evaluatedFiscalYear = year;
    p.department = department;
    for (const { key, v } of found) {
      if (!v) continue;
      p[key] = v.text;
      p.evidence.push(evidence(input, v.text, sh.start + v.at));
    }
    p.warnings.push('実施計画事業評価調書の「事業の目的・背景」を目的、「①アクション（当該年度に何を実施したか）」を事業内容、「③アウトカム（①②をしたことにより対象はどうなったか）」を成果として原文のまま収録。'
      + '左右2列の行が混ざらず、左列の本文が1つの塊として抽出されている欄に限る。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '川口市 実施計画事業評価調書（令和7年度内部評価＝令和6年度実施事業、令和5年度内部評価＝令和4年度実施事業）の「事業の目的・背景」（目的）、「①アクション」（事業内容）、「③アウトカム」（成果）。左右2列の行が混ざる欄は対象外。',
};
