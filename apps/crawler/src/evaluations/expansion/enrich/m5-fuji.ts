import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 富士市（令和5〜7年度 事務事業評価調書）
// 公開済みレコードは同じ事務事業評価調書から作られ、目的・取組内容が空欄。目的は「目的志向型事務分掌」欄で、ラベルが
// 「目的志向型」「事務分掌」の2行に分かれて欄の文を挟む。その間がちょうど1行（句点で終わる）の場合だけ採る。
// 事業内容は評価年度の「取組内容（実績）」欄で、ラベル「令和N年度」「取組内容（実績）」が欄の文を挟むか行頭に付く。
// 財源内訳の表（一般財源の行）の直後に始まり、欄の文が1行（ラベルの間）か2行（それぞれの行頭にラベル）の場合だけ採る。
const ZEN = '０１２３４５６７８９';
const zen = (n: number) => String(n).split('').map(d => ZEN[Number(d)]).join('');

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '22210' || !/\/documents\/5093\/[^/]+\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, doc = /^令和([５-７])年度 事務事業評価調書\n/.exec(t);
  if (!doc) return [];
  const reiwa = ZEN.indexOf(doc[1]), fy = 2018 + reiwa;
  const heads = [...t.matchAll(/\n事務事業評価調書\n【総合計画】\n/g)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const start = heads[i].index! + 1, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const name = /\n事務事業名 (\S+) 担当課 (\S+)\n/.exec(seg);
    if (!name) continue;
    const purpose = /\n目的志向型\n([^\n]+。)\n事務分掌\n/.exec(seg);
    const label = `令和${zen(reiwa)}年度`;
    const act = new RegExp(`\\n一般財源(?: [\\d,]+)+\\n(?:${label}\\n([^\\n]+。)\\n取組内容（実績）|${label} ([^\\n]+)\\n取組内容（実績） ([^\\n]+。))\\n`).exec(seg);
    if (!purpose && !act) continue;
    // IDは公開済みレコード（同じ資料）と別にする（同じIDのシートは補強の対象外になるため）。
    const p = project(input, `${name[1]}:narrative`, name[1], fy === 2025 ? 2025 : null, name[0].trim(), start + name.index! + 1);
    p.projectCode = null;
    p.evaluatedFiscalYear = fy === 2025 ? null : fy;
    p.department = name[2];
    if (purpose) {
      p.purpose = purpose[1];
      p.evidence.push(evidence(input, purpose[0].trim(), start + purpose.index! + 1));
    }
    if (act) {
      p.activities = act[1] ?? act[2] + act[3];
      const raw = act[0].slice(act[0].indexOf(label), -1);
      p.evidence.push(evidence(input, raw, start + act.index! + act[0].indexOf(label)));
    }
    p.warnings.push(`事務事業評価調書の「目的志向型事務分掌」欄（1行のもの）と、令和${reiwa}年度の「取組内容（実績）」欄（1〜2行でラベルと行が対応するもの）。`);
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '富士市 令和5〜7年度 事務事業評価調書: 目的志向型事務分掌（目的）・取組内容（実績）（事業内容）。令和4年度は評価結果一覧のみのため対象外。',
};
