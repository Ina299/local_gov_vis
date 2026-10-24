import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, type Entry } from '../batch9/i1-util';
import { municipality } from './m2-util';

// ---------------------------------------------------------------- 南九州市 教育委員会の事務の点検・評価報告書（事務事業評価シート）
const TITLE = /^((?:平成|令和)\s*[\d０-９]+\s*年度|令和元年度)\n教育委員会の事務の点検・評価報告書\n（((?:平成|令和)\s*(?:[\d０-９]+|元)\s*年度)事務事業対象）\n/;
const SHEET = '≪事務事業評価シート≫\n◎ 事務事業の位置付け\n';
const OPTIONS: Record<string, string[]> = { 妥当性: ['妥当', '概ね妥当', '課題有り'], 効率性: ['効率的', '概ね効率的', '課題有り'], 有効性: ['有効', '概ね有効', '課題有り'] };

/** 「令和６年度」「平成 30 年度」「令和元年度」→ 西暦。 */
export function eraYear(raw: string): number | null {
  const m = /^(平成|令和)(元|\d+)年度$/.exec(raw.normalize('NFKC').replace(/\s/g, ''));
  if (!m) return null;
  return (m[1] === '平成' ? 1988 : 2018) + (m[2] === '元' ? 1 : Number(m[2]));
}

export function minamikyushuSheets(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, title = TITLE.exec(t);
  if (!title) return [];
  const evaluationYear = eraYear(title[1]), evaluated = eraYear(title[2]);
  if (!evaluationYear || !evaluated || evaluationYear !== evaluated + 1) return [];
  const starts: number[] = [];
  for (let i = t.indexOf(SHEET); i >= 0; i = t.indexOf(SHEET, i + 1)) starts.push(i);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const body = t.slice(s, starts[k + 1] ?? t.length);
    // 事業名欄: 「事 業 項 目／（事務事業名）」の間の1行（直後に折返しの残りがある票は名称が確定しないため除外）、または旧様式の「事 務 事 業 名 …」。
    const nm = /\n事 業 項 目\n([^\n]+)\n（事務事業名）\n(?=\n|作成部署)/.exec(body) ?? /\n事 務 事 業 名 ([^\n]+)\n/.exec(body);
    if (!nm || nm.index > 400) return;
    const name = nm[1].trim();
    const p = project(input, `${evaluated}:${name}`, name, evaluationYear, nm[0].slice(1, -1), s + nm.index + 1);
    p.projectCode = null;
    p.evaluatedFiscalYear = evaluated;
    p.evidence.push(evidence(input, title[0].slice(0, -1), 0));
    const dep = /\n作成部署 (\S+)\n/.exec(body.slice(0, 600));
    if (dep) { p.department = dep[1]; p.evidence.push(evidence(input, dep[0].slice(1, -1), s + dep.index + 1)); }
    // 事業費（千円）欄: 年度見出し・「（決算額）」「（当初予算額 繰越含む）」・金額が隣接して読めるものだけ。
    if (/\n事業費\n（千円）\n/.test(body)) {
      for (const m of body.matchAll(/\n((?:平成|令和)(?:[\d０-９]+|元)年度)\n（(決算額|当初予算額 繰越含む)）\n([\d,]+)\n/g)) {
        const fy = eraYear(m[1]);
        if (!fy) continue;
        const kind = m[2] === '決算額' ? 'actual' : 'budget';
        if (kind === 'actual' && fy > evaluated || kind === 'budget' && fy !== evaluated + 1) continue;
        if (p.amounts.some(a => a.kind === kind && a.fiscalYear === fy)) continue;
        p.amounts.push(amount(input, kind, fy, m[3], '千円', m[0].slice(1, -1), s + m.index! + 1));
      }
    }
    // 二次評価（教育委員会）の観点別評価: 観点名と同じ行で ☑ の直後に様式の選択肢が読めるものだけ。
    const second = body.indexOf('①二次評価の結果');
    if (second >= 0) {
      for (const m of body.slice(second).matchAll(/（[１２３]）(妥当性|効率性|有効性)： ?☑ ?([^\s□☑]+)/g)) {
        if (!OPTIONS[m[1]].includes(m[2]) || p.ratings.some(r => r.label.endsWith(m[1]))) continue;
        p.ratings.push({ kind: 'self', label: `二次評価（教育委員会） ${m[1]}`, value: m[2], scale: OPTIONS[m[1]].join('／'), evidence: evidence(input, m[0], s + second + m.index!) });
      }
    }
    p.warnings.push('教育委員会の事務の点検・評価報告書の事務事業評価シート。評価年度は表紙の報告書年度、評価対象年度は「（○○年度事務事業対象）」による。事業費は「（決算額）」を実績、翌年度の「（当初予算額 繰越含む）」を予算として、年度見出しと金額が隣接して読めるもののみ収録（千円）。二次評価は観点名と同じ行で選択肢が読めるもののみ。一次評価の☑・今後の方向性・指標は抽出テキストで列が混在するため未収録。');
    out.push(p);
  });
  return out;
}

export const minamikyushuEntries: Record<string, Entry> = {
  '46223': {
    extract: municipality(minamikyushuSheets, p => `${p.evaluatedFiscalYear}:${p.projectName}`),
    scope: '南九州市 教育委員会の事務の点検・評価報告書（平成26年度〜令和7年度版）の事務事業評価シートごとの事業項目（事務事業名）・作成部署・評価年度/評価対象年度、隣接して読める事業費（決算額・当初予算額、千円）、同じ行で読める二次評価の観点別評価。一次評価・今後の方向性・指標、評価委員の意見、施策単位のまとめは対象外。',
  },
};
