import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m6-util';

// ---------------------------------------------------------------- 長門市（令和7年度 事務事業評価結果の概要）
// 公開済みレコード（令和7年度評価・令和6年度実施の事業別評価結果）の「【事業の概要】」「【事業の成果・課題】」欄。
// 様式の見出しは「事業の概要」で目的の欄はないため、事業の概要は事業内容（activities）、事業の成果・課題は成果（outcomes）とする。
// 成果・課題の欄の左には縦書きのラベル「事業の概要・成果と課題」が1字ずつ行頭（「事 」）か単独の行で混ざるため、
// その並びの順に限って外し、11字すべてを外せた欄だけを採る。保存テキストは先頭12万字までで、後半の事業は対象外。
const LABEL = [...'事業の概要・成果と課題'];
const HEAD = /\n具体施策 \d{8}\n主管課・班名 ([^\n]+?) 決算額（円）\n予算費目\(目\) [^\n]+\n事 業 名 ([^\n]+)\n主要施策名 [^\n]+\n施 策 名 [^\n]+\n具体施策名 [^\n]+\n【事業の概要】\n/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '35211' || !input.sourceUrl.endsWith('/uploaded/attachment/36821.pdf')) return [];
  const t = input.text;
  if (!t.startsWith('令和７年度\n事務事業評価結果の概要\n') || !t.includes('令和７年度の評価対象事業は、総合計画に掲げる具体施策を構成する事務事業のうち、\n令和６年度に実施した')) return [];
  const heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i], start = h.index! + 1, end = heads[i + 1]?.index ?? t.length;
    const seg = t.slice(start, end);
    // 次の事業の見出しの手前で「事業の\n必要性 … 総合評価 …\n評価」まで揃った事業だけ（末尾の切れた事業は除く）。
    const tail = /\n事業の\n必要性 [^\n]+ 総合評価 [^\n]+\n評価\n/.exec(seg);
    const a = seg.indexOf('\n【事業の成果・課題】\n');
    if (!tail || a < 0 || a > tail.index) continue;
    const p = project(input, `${h[2]}:narrative`, h[2], 2025, h[0].slice(1, -1), start);
    p.evaluatedFiscalYear = 2024;
    p.department = h[1];
    const overview = seg.slice(h[0].length - 1, a);
    const body = a + '\n【事業の成果・課題】\n'.length, raw = seg.slice(body, tail.index);
    let k = 0;
    const lines = raw.split('\n').flatMap(l => {
      if (k < LABEL.length && l === LABEL[k]) { k++; return []; }
      if (k < LABEL.length && l.startsWith(LABEL[k] + ' ')) return [l.slice(LABEL[k++].length + 1)];
      return [l];
    });
    // ラベルの一部が事業の概要の欄（行の途中）に混ざる事業があるため、11字すべてが成果・課題の欄にある事業に限る。
    if (k !== LABEL.length || !lines.length || !lines.every(l => l.trim()) || !overview.trim() || overview.includes('【')) continue;
    p.activities = unwrap(overview);
    p.outcomes = unwrap(lines.join('\n'));
    p.evidence.push(evidence(input, overview, start + h[0].length - 1), evidence(input, raw, start + body));
    p.warnings.push('令和7年度 事務事業評価結果の概要の「【事業の概要】」を事業内容、「【事業の成果・課題】」を成果として収録（様式に目的の欄はない）。'
      + '成果・課題の欄は行頭に混ざる縦書きのラベル「事業の概要・成果と課題」の各字を外し、欄の幅いっぱいで折り返した改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '長門市 令和7年度 事務事業評価結果の概要: 事業の概要（事業内容）・事業の成果・課題（成果）。保存テキスト（先頭12万字）に収まる事業のみ。目的の欄はない。',
};
