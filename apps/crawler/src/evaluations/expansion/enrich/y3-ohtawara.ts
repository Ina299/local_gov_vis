import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { sheets } from '../batch7/g1-util';

// ---------------------------------------------------------------- 大田原市（事務事業評価兼実施計画シート 令和8年度版）
// 公開済みレコードは部課別PDF（docs/2024101800039/file_contents/NN_.pdf）の各票から作られ、年度を持たない（票の「評価年度」は
// 実施計画の年度表記で、評価対象年度の明記がないため）。同じPDFの同じ票の「２．計画」の目的・手段の欄を取る。
// 「成果」の欄は計画時に記入する見込みの成果・効果で、実際の成果ではないため取らない（手段の欄の終わりの区切りにだけ使う）。
// 各欄は記入要領の一文（「何のためにこの事業を行うかを記入します。」等）で区切られ、欄名の2文字（目／的、手／段、成／果）が
// 本文の行頭に割り込んで出力される。欄名の文字だけの行・行頭の「欄名＋空白」と、左列の見出し（（１）・計画内容）を除いた行を本文とする。
const HEADING = '大田原市事務事業評価兼実施計画シート';
const HINT_PURPOSE = '何のためにこの事業を行うかを記入します。';
const HINT_MEANS = 'この事業のためどのような行政活動を行うかを記入し、この行政活動の結果からつくり出すものを活動指標欄（下記）に記入します。';
const HINT_OUTCOME = 'この事業を行うことによって、どのような成果・効果があるか記入し、その最終的な成果を成果指標欄（下記）に記入します。';
const END = '\n指 標 内 容\n';
const FILES = /^https:\/\/www\.city\.ohtawara\.tochigi\.jp\/docs\/2024101800039\/file_contents\/\d\d_\.pdf$/;

/** 区間の本文（欄名の文字と左列の見出しを除き、行を連結）。欄名の文字が想定どおりに出ない区間・ほかの欄の見出しが混じる区間は null。 */
function body(raw: string, labels: [string, string], extra: string[]): string | null {
  const lines: string[] = [];
  let seen = 0;
  for (const l of raw.split('\n')) {
    const s = l.trim();
    if (!s || extra.includes(s)) continue;
    if (s === labels[0] || s === labels[1]) { seen++; continue; }
    const m = labels.find(c => s.startsWith(`${c} `));
    if (m) { seen++; const rest = s.slice(2).trim(); if (rest) lines.push(rest); continue; }
    lines.push(s);
  }
  if (seen !== 2 || !lines.length || lines.some(l => /指標|^（[１-９]）$|記入します。$/.test(l))) return null;
  // 欄の幅での折り返しの改行を除く（欄幅近くまで埋まった行の後だけ。句点で終わる行・短い行の後と箇条の行頭の前の改行は残す）
  return lines.reduce((acc, l, i) => acc + (i === 0 ? '' : /。$/.test(lines[i - 1]) || lines[i - 1].length < 40 || /^[・①-⑳]/.test(l) ? '\n' : '') + l, '');
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '09210' || input.format !== 'pdf' || !FILES.test(input.sourceUrl)) return [];
  const all: ProjectEvaluation[] = [];
  for (const sh of sheets(input.text, HEADING)) {
    const name = /\n事務事業名 ([^\n]+)\n/.exec(sh.text);
    const a = sh.text.indexOf(HINT_PURPOSE), b = sh.text.indexOf(HINT_MEANS), c = sh.text.indexOf(HINT_OUTCOME), d = sh.text.indexOf(END);
    if (!name || a < 0 || !(a < b && b < c && c < d)) continue;
    if ([HINT_PURPOSE, HINT_MEANS, HINT_OUTCOME, END].some(h => sh.text.indexOf(h, sh.text.indexOf(h) + 1) >= 0)) continue;
    const p = project(input, `narrative:${name[1]}`, name[1], null, name[0].slice(1, -1), sh.start + name.index + 1);
    p.projectCode = null;
    const fields: [keyof Pick<ProjectEvaluation, 'purpose' | 'activities'>, number, number, [string, string], string[]][] = [
      ['purpose', a + HINT_PURPOSE.length, b, ['目', '的'], ['（１）', '計画内容']],
      ['activities', b + HINT_MEANS.length, c, ['手', '段'], []],
    ];
    for (const [key, from, to, labels, extra] of fields) {
      const raw = sh.text.slice(from, to).replace(/^\n+/, '').trimEnd();
      const text = body(raw, labels, extra);
      if (!text) continue;
      p[key] = text;
      p.evidence.push(evidence(input, raw, sh.start + sh.text.indexOf(raw, from)));
    }
    if (!p.purpose && !p.activities) continue;
    p.warnings.push('大田原市事務事業評価兼実施計画シートの「２．計画」の目的・手段の欄を、目的・事業内容として収録（成果の欄は計画時の見込みのため収録しない）。'
      + '欄名の文字（目的・手段）が本文の行頭に割り込んで出力されるため除き、欄の幅での折り返しの改行を除いた。年度は公開済みレコードと同じく未設定。');
    all.push(p);
  }
  // 同じ資料に同名の票が複数あれば対応が決まらないため採らない
  return all.filter(p => all.filter(q => q.projectName === p.projectName).length === 1);
}

export const entry = {
  extract,
  scope: '大田原市 事務事業評価兼実施計画シート（令和8年度版、部課別PDF）: 「２．計画」の目的・手段の欄（目的・事業内容。成果の欄は計画時の見込みのため対象外）。年度なしの公開済みレコードと同じPDFの票に限る。',
};
