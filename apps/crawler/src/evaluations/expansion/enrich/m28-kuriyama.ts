import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m28-util';

// ---------------------------------------------------------------- 栗山町（令和５年度 栗山町政策評価委員会報告書）
// 公開済みレコード（令和5年度の3事業）は政策評価結果のページの外部評価の表から作られ、評価年度・対象年度とも2023。
// 報告書の「評価結果（総合判定及び総合コメント）」の各票は、事業名（文で書かれた計画事業名）・事業期間・担当課所・政策体系・
// 「事業概要」「R5 計画」の欄を持つ。重点・充実・新規のチェック欄の直後の段落（「…等」で終わる短い要約）を事業概要として事業内容に取る。
// その次の段落（R5 計画の箇条）は計画のため取らない。目的の欄はない。令和4年度分（年度の記載なし）の公開済みレコードは対象外。
const FILE = 'https://www.town.kuriyama.hokkaido.jp/uploaded/attachment/14165.pdf';
const SUMMARY = /\n事業概要\nR5 計画\n\n[☑□] 充実\n\n[☑□] 新規\n\n((?:[^\n]+\n)+?)\n/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01429' || input.sourceUrl !== FILE || !/^令和５年度\n\n栗山町政策評価委員会報告書\n/.test(input.text)) return [];
  const t = input.text, starts = [...t.matchAll(/\n事 業 名\n/g)].map(m => m.index! + 1), out: ProjectEvaluation[] = [];
  for (const [i, s] of starts.entries()) {
    const sh = t.slice(s, starts[i + 1] ?? t.length);
    // 事業名: 見出し（事 業 名・事業期間）と空行を除いた最初の行から、句点で終わる行まで
    const nm = /^事 業 名\n(?:事業期間\n)?\n((?:[^\n]+\n)*?[^\n]+。)\n/.exec(sh);
    const sm = SUMMARY.exec(sh);
    if (!nm || !sm || !sm[1].trimEnd().endsWith('等')) continue;
    const name = nm[1].split('\n').join('');
    const raw = sm[1].replace(/\n$/, '');
    const p = project(input, `narrative:${i + 1}`, name, 2023, nm[0].replace(/\n$/, ''), s);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2023;
    p.activities = unwrap(raw);
    p.evidence.push(evidence(input, raw, s + sm.index + sm[0].indexOf(sm[1])));
    p.warnings.push('栗山町政策評価委員会報告書（令和５年度）の評価結果の票の「事業概要」欄（重点・充実・新規の欄の直後の要約）を事業内容として収録。欄の幅での折り返しの改行を除いた。目的の欄はない。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '栗山町 令和５年度 政策評価委員会報告書: 評価結果の各票の「事業概要」（事業内容）。目的の欄はない。令和4年度分の公開済みレコードは対応する票の資料が未取得。',
};
