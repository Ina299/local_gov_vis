/** 日田市 (44204): 平成26年度 施策（主要施策）評価シートの「主な事務事業」表の「事務事業の内容」。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// 公開済みレコードのうち2014年度分（hita-supplement）は、施策評価シートの「■主な事務事業」表の行から作られ、事業内容が空欄。
// 表は「事務事業名 開始年度 事務事業の内容 決算額 貢献度 今後の方向性」の1行で、名称・内容が折り返さずに1行に収まる行
// （hita-supplement の「開始年度が行内にある行」と同じ）に限り、開始年度と決算額の間を事業内容として採る。
// 令和5・6年度の事務事業評価（公開済みレコードの大半）は事業名・事業内容の列と活動実績の列が行ごとに混ざるため対象外。
const SOURCES = new Set(['1dff53df9f4ed971d2f49b2f', 'db9ddf7217f0f3f3276419a9']);
const ROW = /^([^\s]+(?:事業|費|補助金|負担金|助成金|相談会|事務)) H\d+ (\S.*?) [\d,]+ [ABCD] (?:拡 充|現行どおり|見直しが必要|廃 止)$/;
const ANY_ROW = /^\S+ H\d+ \S.* [\d,]+ [ABCD] (?:拡 充|現行どおり|見直しが必要|廃 止)$/;
const TABLE_HEAD = /^(■主な事務事業|開始 当該年度 施 策 今後の$|年度$|事務事業名 事務事業の内容 決 ?算 ?額 貢献度 方向性$)/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '44204' || input.format !== 'pdf' || !SOURCES.has(input.sourceId)) return [];
  const t = input.text, heads = [...t.matchAll(/^平成26年度 施策（主要施策） 評価シート$/gm)], out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    if (input.truncated && i === heads.length - 1) return;
    const begin = h.index!, sec = t.slice(begin, heads[i + 1]?.index ?? t.length);
    const dept = /^担当部課 (.+)$/m.exec(sec), start = sec.indexOf('■主な事務事業'), end = sec.indexOf('■コスト', start);
    if (!dept || start < 0 || end < 0) return;
    const lines = [...sec.slice(start, end).matchAll(/^.*$/gm)];
    // 前後の行が表の見出しか別の事業の行であること（内容が折り返した行は、続きが隣の行に出るため採らない）。
    const closed = (l: string | undefined) => l === undefined || !l.trim() || TABLE_HEAD.test(l) || ANY_ROW.test(l);
    for (const [k, line] of lines.entries()) {
      const m = ROW.exec(line[0]);
      if (!m || m[1] === '教育振興事業' || !closed(lines[k - 1]?.[0]) || !closed(lines[k + 1]?.[0])) continue;
      const at = begin + start + line.index!;
      const p = project(input, `2014:${dept[1]}:${m[1]}:content`, m[1], null, line[0], at);
      p.evaluatedFiscalYear = 2014;
      p.department = dept[1];
      p.activities = m[2];
      p.evidence.push(evidence(input, m[2], at + line[0].indexOf(` ${m[2]} `) + 1));
      p.warnings.push('平成26年度施策評価シートの「主な事務事業」表で、事務事業名・開始年度・事務事業の内容・決算額・評価が1行に収まる行の「事務事業の内容」を事業内容として収録。');
      out.push(p);
    }
  });
  return out;
}

export const entry = {
  extract,
  scope: '日田市 平成26年度 施策（主要施策）評価シートの「主な事務事業」表で1行に収まる行の「事務事業の内容」（事業内容として）。令和5・6年度の事務事業評価は事業内容と活動実績の列が混ざるため対象外。',
};
