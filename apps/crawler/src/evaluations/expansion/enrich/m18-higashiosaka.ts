import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { higashiosakaEntries } from '../batch12/m3-higashiosaka';
import { joinWrapped } from './m10-util';

// ---------------------------------------------------------------- 東大阪市（令和6年度 教育委員会 点検及び評価票、1事業1枚）
// 公開済みレコードは batch12 の抽出（事業名・関係所属・事業年度2024）で作られた。事業名・所管はその抽出をそのまま使い、
// 同じ評価票（事業名の位置から次の「No.」まで）の「事業概要」欄（見出しの次の段落、「主な取組」の手前まで）を事業内容、
// 「令和６年度の事業実績」欄（「次年度に向けた取組・課題」の手前まで）を成果として足す。目的だけの欄はない（事業概要に含まれる）。
const ID = '78b0a634b31aad81d72d0935';

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '27227' || input.sourceId !== ID) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  for (const base of higashiosakaEntries['27227'].extract(input, inputs)) {
    const at = Number(/^extracted-text:chars:(\d+)-/.exec(base.evidence[0].cell ?? '')?.[1]);
    if (!Number.isFinite(at)) continue;
    const head = t.lastIndexOf('\nNo.\n\n', at), next = t.indexOf('\nNo.\n\n', at);
    if (head < 0) continue;
    const seg = t.slice(head, next < 0 ? t.length : next);
    const p = project(input, `${base.projectName}:narrative`, base.projectName, null, base.evidence[0].rawText, at);
    p.evaluatedFiscalYear = base.evaluatedFiscalYear;
    p.department = base.department;
    const a = /\n事業概要\n\n((?:[^\n]+\n)+)\n主な取組\n/.exec(seg);
    if (a) {
      const raw = a[1].slice(0, -1);
      p.activities = joinWrapped(raw, 45);
      p.evidence.push(evidence(input, raw, head + a.index! + a[0].indexOf(a[1])));
    }
    const o = /\n令和６年度の事業実績\n((?:[^\n]+\n)+)\n次年度に向けた取組・課題\n/.exec(seg);
    if (o && !/^(?:事業総括|指標達成状況評価|[A-D])$/m.test(o[1])) {
      const raw = o[1].slice(0, -1);
      p.outcomes = joinWrapped(raw, 45);
      p.evidence.push(evidence(input, raw, head + o.index! + o[0].indexOf(o[1])));
    }
    if (!p.activities && !p.outcomes) continue;
    p.warnings.push('点検及び評価票の「事業概要」欄（事業内容）と「令和６年度の事業実績」欄（成果）。欄の幅での折り返しだけを除いてつないだ。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '東大阪市 令和6年度 教育委員会 点検及び評価票: 事業概要欄（事業内容）・令和6年度の事業実績欄（成果）。目的だけの欄はない。',
};
