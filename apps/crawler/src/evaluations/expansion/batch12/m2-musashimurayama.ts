import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import type { Entry } from '../batch9/i1-util';
import { municipality } from './m2-util';

// ---------------------------------------------------------------- 武蔵村山市 令和６年度事務事業評価調書・補助金等評価調書（分野別PDF）
// 行政評価報告書（全調書の合冊）は分野別PDFと同じ調書で、所管部署欄の改行が異なり再掲照合が崩れるため対象外。
const REPORT = '令和６年度 行政評価報告書\n';
const HEAD = /\n(事務事業名|補助金等名) ([^\n]+)\n(?:施策名称[^\n]*\n)?所管部署\n([^\n]*)\n([^\n]*)\n/g;

export function sheetsOf(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (t.startsWith(REPORT) || !t.startsWith('武蔵村山市')) return [];
  const heads = [...t.matchAll(HEAD)];
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const subsidy = h[1] === '補助金等名';
    // 調書の表題は事業名の直前（200字以内）か、事業名から次の調書の事業名までの間に出る。実績欄は事業名から次の事業名までで探す。
    const from = h.index!, to = heads[k + 1]?.index ?? t.length;
    const sheet = t.slice(from, to);
    const title = subsidy ? '令和６年度補助金等評価調書' : '令和６年度事務事業評価調書';
    const before = t.slice(Math.max(0, from - 200), from).lastIndexOf(title);
    const titleAt = before >= 0 ? Math.max(0, from - 200) + before : sheet.includes(title) ? from + sheet.indexOf(title) : -1;
    if (titleAt < 0) return;
    const name = h[2].trim(), nameRaw = `${h[1]} ${h[2]}`, at = h.index! + 1;
    const p = project(input, `${title}:${name}`, name, 2024, nameRaw, at);
    p.projectCode = null;
    p.evidence.push(evidence(input, title, titleAt));
    const dep = /^(\S+) 部$/.exec(h[3]), sec = /^(\S+) 課$/.exec(h[4]);
    const depRaw = h[0].slice(h[0].indexOf('所管部署'), -1);
    if (dep) p.department = sec ? `${dep[1]}部 ${sec[1]}課` : `${dep[1]}部`;
    else if (/^\S+(事務局|委員会)$/.test(h[3])) p.department = h[3];
    if (p.department) p.evidence.push(evidence(input, sec ? depRaw : depRaw.split('\n').slice(0, 2).join('\n'), h.index! + h[0].indexOf('所管部署')));
    const fy = sheet.indexOf('令和5年度の実績');
    if (!subsidy && fy >= 0) { p.evaluatedFiscalYear = 2023; p.evidence.push(evidence(input, '令和5年度の実績', from + fy)); }
    p.warnings.push(subsidy
      ? '補助金等評価調書（補助金・交付金ごとの評価）。事務事業評価調書とは別様式。評価年度は表題「令和６年度」による。評価対象年度は調書上で一意に明記されないため未設定。'
      : '令和６年度事務事業評価調書。評価年度は表題「令和６年度」、評価対象年度は「令和5年度の実績」欄による。');
    p.warnings.push('事業経費（令和4年度決算・令和5年度決算・令和6年度予算）は抽出テキストで列の順序が保たれない調書があり（補助金等評価調書で確認）、年度との対応を確定できないため未収録。評価指標・達成度・今後の方向性（○印の位置）も列対応が失われているため未収録。');
    out.push(p);
  });
  return out;
}

export const musashimurayamaEntries: Record<string, Entry> = {
  '13223': {
    extract: municipality(sheetsOf, p => `${p.evaluationYear}:${p.evidence[1].rawText}:${p.projectName}`),
    scope: '武蔵村山市 令和６年度事務事業評価調書・補助金等評価調書（分野別PDF）の調書ごとの事業名（補助金等名）・所管部署・評価年度（と事務事業評価調書の評価対象年度）のみの部分構造化。事業経費・評価指標・達成度・今後の方向性は列の対応が抽出テキストで失われているため対象外。全調書合冊の行政評価報告書は再掲のため対象外。',
  },
};
