import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

const FUJISAKI_DOC = '23572a2220afbb254fab1a07';
/**
 * Pages of the 施策パッケージ that carry exactly one project (one 事業区分 header) and exactly one R6 row.
 * Other pages hold 2〜3 projects whose name / KPI rows are interleaved by pdftotext, so rows cannot be tied to names.
 */
const FUJISAKI_NAMES = ['中学生国際交流事業', 'ひろさき広域婚活支援事業', '子ども食堂運営事業', '人口ビジョン及び総合戦略事業'];
const FUJISAKI_POLICY = '1.事業をさらに発展させる／2.事業を継続する／3.事業内容を見直す／4.予定通り事業終了／5.事業を中止する';
const FUJISAKI_ACHIEVE = 'A 地方創生に非常に効果的であった／B 相当程度効果があった／C 効果があった／D あまり効果がなかった／E 効果がなかった';
const FUJISAKI_COUNCIL = 'A 総合戦略の推進に有効である／B 効果は小さいが有効であると言える／C 有効とは言えない';

/** 藤崎町まち・ひと・しごと創生総合戦略 施策パッケージ【令和6年度実績および令和7年度目標】。 */
export function extractFujisaki(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '02361' || input.sourceId !== FUJISAKI_DOC) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const title = '施策パッケージ【令和6年度実績および令和7年度目標】';
  const titleAt = t.indexOf(title);
  if (titleAt < 0) return [];
  let pos = 0;
  for (const page of t.split('\n\n\n')) {
    const start = pos; pos += page.length + 3;
    if (page.split('事業区分').length !== 2) continue;
    const names = FUJISAKI_NAMES.filter(n => page.includes(`\n${n}\n`));
    if (names.length !== 1) continue;
    const rows = [...page.matchAll(/\nR6(?: [^\n]*)?\n\n([^\n]+)\n\n([^\n]+)\n\n([^\n]+)\n\n([A-E])\n\n([1-5])\n\n([A-C\-])\n/g)];
    if (rows.length !== 1) continue;
    const name = names[0], nameAt = start + page.indexOf(`\n${name}\n`) + 1, r = rows[0];
    const p = project(input, name, name, null, name, nameAt);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, title, titleAt));
    const dept = page.match(/\n([^\n]+係)\n\n?事業費（千円）/);
    if (dept) { p.department = dept[1]; p.evidence.push(evidence(input, dept[0].slice(1), start + dept.index! + 1)); }
    const raw = r[0].slice(1, -1), at = start + r.index! + 1, ev = evidence(input, raw, at);
    p.indicators.push({ name: r[1], fiscalYear: 2024, target: r[2], actual: r[3], unit: null, evidence: ev });
    p.ratings.push({ kind: 'self', label: 'R6 達成度（事業効果）', value: r[4], scale: FUJISAKI_ACHIEVE, evidence: ev });
    p.ratings.push({ kind: 'self', label: 'R6 今後の方針', value: r[5], scale: FUJISAKI_POLICY, evidence: ev });
    if (r[6] !== '-') p.ratings.push({ kind: 'external', label: 'R6 総合戦略会議事業評価', value: r[6], scale: FUJISAKI_COUNCIL, evidence: ev });
    p.warnings.push('藤崎町 総合戦略 施策パッケージ（令和6年度実績）。1ページに1事業だけが載り、R6行（KPI・目標値・実績値・達成度・今後の方針・総合戦略会議事業評価）が1行だけ読み取れるページのみ収録。複数事業が同じページに載るページは抽出テキスト上で事業名とKPI行が混在し対応が確定できないため除外。');
    p.warnings.push('事業費（千円）の年度列は予算・決算の別が本文で確定できないため未収録。R3〜R5・R7の行は未収録。評価実施年度は本文に明示がないため未設定。今後の方針は原文の番号のまま。');
    out.push(p);
  }
  return out;
}

const KORA_DOC = '1c7c4b40a7daf88ac1ee70e8';
/** 甲良町まち・ひと・しごと創生総合戦略 平成27年度進捗状況報告書の「４．総合戦略に位置づけた事業の進捗状況」（1事業1ページ）。 */
export function extractKora(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '25442' || input.sourceId !== KORA_DOC) return [];
  const t = input.text, title = '平成 27 年度 進捗状況報告書', titleAt = t.indexOf(title);
  const sec = t.indexOf('４．総合戦略に位置づけた事業の進捗状況\n基本目標');
  if (titleAt < 0 || sec < 0) return [];
  const out: ProjectEvaluation[] = [], seen = new Set<string>();
  for (const m of t.slice(sec).matchAll(/\n([^\n]+)\n\n?担当課\n/g)) {
    const lineAt = sec + m.index! + 1, end = lineAt + m[0].length - 2;
    // A merged sheet wraps its name note over two lines: "<name> （←…\n…一本化）\n担当課".
    const prevAt = t.lastIndexOf('\n', lineAt - 2) + 1, prev = t.slice(prevAt, lineAt - 1);
    const wrapped = prev.includes(' （←') && !m[1].includes(' （←');
    const at = wrapped ? prevAt : lineAt, line = wrapped ? prev : m[1];
    const name = line.includes(' （←') ? line.slice(0, line.indexOf(' （←')) : line;
    if (!name.endsWith('事業') && !/事業（[^）]+）$/.test(name) && !['保育料の減額', 'まちの元気づくり交付金'].includes(name)) continue;
    if (seen.has(name)) return []; // duplicate sheet names would mean the page split is not what we expect
    seen.add(name);
    const p = project(input, name, name, null, t.slice(at, end), at);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2015;
    p.evidence.push(evidence(input, title, titleAt));
    const after = t.slice(end + 1);
    const dept = after.match(/^\n(?:事\n業\n概\n要\n実\n施\n戦\n略\n\n)?([^\n]+)\n\n記入者名/);
    if (dept) { p.department = dept[1]; p.evidence.push(evidence(input, dept[0].slice(1), end + 2)); }
    p.warnings.push('甲良町 総合戦略 平成27年度進捗状況報告書の事業別ページ。事業名と担当課のみ収録（担当課は「担当課」欄の直後に読み取れる場合のみ）。');
    p.warnings.push('事業実施計画・事業実施状況のKPIと事業費（単位：千円）は抽出テキスト上で列（KPI／事業費）の対応と予算・実績の別が確定できないため未収録。評価・課題は文章のみで評価区分がないため未収録。評価実施年度は本文に明示がないため未設定。');
    out.push(p);
  }
  return out;
}

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '02361': { extract: extractFujisaki, scope: '藤崎町 総合戦略 施策パッケージ（令和6年度実績）のうち1ページ1事業でR6行が確定できる事業の事業名・担当係・R6のKPI目標/実績・達成度・今後の方針・総合戦略会議事業評価。複数事業が混在するページ・事業費は対象外' },
  '25442': { extract: extractKora, scope: '甲良町 総合戦略 平成27年度進捗状況報告書の事業別ページの事業名・担当課（部分構造化）。KPI・事業費（列対応が崩れる）・施策KPI・総括は対象外' },
};
