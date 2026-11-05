import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 二本松市（行政評価シート。所管課別PDF、年度の記載なし）
// 公開済みレコード（年度なし。事業内容は「取組内容」から収録済み）は同じPDFの評価シートから作られている。
// ここでは「２．事業の目標と成果【ＰＬＡＮ（計画）】」の「事務事業の目標と見込まれる成果」欄の文を目的として足す。
// 欄の見出しは抽出テキストでは「事務事業の目標」「と見込まれる成（果）」「果」に分かれて文の行の間に単独の行として、または
// 行頭に見出し＋空白として挟まるため、見出しがこの順にちょうど1回ずつ現れる欄に限り、見出しを除いた行を
// 折り返し（行末が句点でない改行）だけつないで収録する（根拠には見出しを含む欄全体の原文を記録）。
// 事業名はシート冒頭の「（手法）」の後の段落のうち、最後の行（担当部）を除いた行。年度はシートに記載がないため付けない。
const SHEET = /^行政評価シート\n事務事業名\n担当部\n１．事業概要\n基本目標\n（方策の柱）\n政策\n（方策）\n施策\n（手法）\n\n((?:[^\n]+\n)+?)[^\n]+\n\n/gm;
const PLAN = /２．事業の目標と成果【ＰＬＡＮ（計画）】\n\n?([\s\S]*?)\n\n?３．実施内容【ＤＯ（実行）】/;
const LABELS = [/^事務事業の目標(?: |$)/, /^と見込まれる成果?(?: |$)/, /^果(?: |$)/];

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '07210' || !/^https:\/\/www\.city\.nihonmatsu\.lg\.jp\/data\/doc\/\d+_doc_\d+_0\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(SHEET)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const h = heads[i], start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const name = h[1].slice(0, -1).replaceAll('\n', '');
    const plan = PLAN.exec(seg);
    if (!plan) continue;
    const raw = plan[1];
    let next = 0;
    const body: string[] = [];
    for (const l of raw.split('\n')) {
      if (!l) continue;
      const k = LABELS.findIndex(re => re.test(l));
      if (k < 0) { body.push(l); continue; }
      // 「と見込まれる成果」と1行にまとまったときは「果」の見出しはない。
      if (k !== next) { next = -1; break; }
      next = k === 1 && l.startsWith('と見込まれる成果') ? 3 : k + 1;
      const rest = l.replace(LABELS[k], '');
      if (rest) body.push(rest);
    }
    if (next !== 3 || !body.length || !/。$/.test(body[body.length - 1])) continue;
    const p = project(input, `${name}:purpose`, name, null, h[0].slice(0, -2), start);
    p.purpose = body.reduce((acc, l, j) => j === 0 ? l : acc + (/。$/.test(body[j - 1]) ? '\n' : '') + l, '');
    p.evidence.push(evidence(input, raw, start + plan.index! + plan[0].indexOf(raw)));
    p.warnings.push('二本松市 行政評価シートの「事務事業の目標と見込まれる成果」欄（行の間に挟まる欄の見出しを除き、折り返しだけをつないだ）。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '二本松市 行政評価シート（所管課別PDF）: 「事務事業の目標と見込まれる成果」欄（目的）。見出しの断片がそろわない欄、句点で終わらない欄は対象外。取組内容は公開済み。',
};
