import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m6-util';

// ---------------------------------------------------------------- 小松島市（令和7年度 主要施策の成果・事務事業評価等に関する説明書）
// 公開済みレコード（説明書の事業ごとの「N 事業名」）の「事業の目的内容・施策の成果・今後の課題」欄。欄は
// 「（事業の目的・内容）」「（施策の成果）」「（今後の課題）」の小見出しで分かれ、前の2つをそれぞれ目的・成果とする
// （様式の小見出しが「事業の目的・内容」のため、目的には事業内容の文も含まれる）。欄の先頭の数行は左の事業費の内訳の
// 金額（「2,921,072 」など）が行頭に並ぶため、その金額だけを外す（金額だけの行が残る事業は採らない）。
// 事業名は小見出しの直前にある「N 事業名」の行（次の行が「・ 」の内訳か空行で、名前が折り返していないもの）。
const BODY = /\n((?:[\d,]+ )?)（事業の目的・内容）\n((?:[^\n]+\n)+?)(?:[\d,]+ )?（施策の成果）\n((?:[^\n]+\n)+?)(?:[\d,]+ )?（今後の課題）\n/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '36203' || input.truncated || !input.sourceUrl.includes('%E4%BB%A4%E5%92%8C7%E5%B9%B4%E5%BA%A6%E4%B8%BB%E8%A6%81%E6%96%BD%E7%AD%96')) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  if (!t.slice(0, 2000).includes('令和７年度') && !t.slice(0, 2000).includes('令和7年度')) return [];
  let prev = 0;
  for (const m of t.matchAll(BODY)) {
    const from = prev, before = t.slice(from, m.index);
    prev = m.index! + m[0].length;
    const names = [...before.matchAll(/\n(\d+) ([^\n]+)\n(?=・ |\n)/g)];
    if (names.length !== 1) continue;
    const name = names[0];
    // 欄の行頭の事業費の金額を外す。金額だけの行（内訳の行数が文章の行数より多い）があれば採らない。
    const strip = (s: string) => s.trimEnd().split('\n').map(l => l.replace(/^[\d,]+ (?=\S)/, ''));
    const purpose = strip(m[2]), outcomes = strip(m[3]);
    if ([...purpose, ...outcomes].some(l => /^[\d,]+$/.test(l) || !l.trim())) continue;
    const at = from + name.index! + 1;
    const p = project(input, `${name[2]}:narrative`, name[2].trim(), 2025, name[0].slice(1, -1), at);
    p.evaluatedFiscalYear = 2025;
    p.purpose = unwrap(purpose.join('\n'), 18, 2);
    p.outcomes = unwrap(outcomes.join('\n'), 18, 2);
    p.evidence.push(evidence(input, m[0].slice(1, -1), m.index! + 1));
    p.warnings.push('主要施策の成果・事務事業評価等に関する説明書（令和7年度）の「（事業の目的・内容）」を目的、「（施策の成果）」を成果として収録（目的には事業内容の文も含む）。'
      + '欄の行頭に並ぶ事業費の内訳の金額を除き、欄の幅いっぱいで折り返した改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '小松島市 令和7年度 主要施策の成果・事務事業評価等に関する説明書: （事業の目的・内容）（目的）・（施策の成果）（成果）。事業名の行が確定し、行頭の金額だけを外せる事業のみ。',
};
