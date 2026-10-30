import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { acrossDocuments, nfkc, type Entry } from '../../evaluations/expansion/batch9/i1-util';

// ---------------------------------------------------------------- 長崎県（基本戦略別の事業群・事務事業一覧ページ HTML）
// 事業群評価調書（全体版 PDF）・事務事業評価結果一覧 PDF は表の列が抽出テキストで事業ごとに分離できず、事業費（R5・R6 実績、R7 計画）を
// どの事業の値か確定できないため対象外。HTML の一覧（番号／事務事業名／所管課の3行の繰り返し）から事業名と所管課だけを収録する。
const PAGE = /^戦略(\d)-(\d) [^\n]+ - 長崎県ホームページ\n/;
const DEPT = /(?:課|室|局|所|センター|本部|委員会|事務局)(?:[（(][^）)\n]+[）)])?$/;

function extractNagasaki(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '42000' || input.format !== 'html') return [];
  const t = input.text;
  const pg = PAGE.exec(t);
  if (!pg) return [];
  const out: ProjectEvaluation[] = [];
  // 事業群の見出しごとに区切り、その中の「番号／事業名／所管課」の繰り返しを、番号が1から連番になっている場合のみ収録。
  const groups = [...t.matchAll(/\n事業群(\d+) ([^\n]+)\n/g)];
  groups.forEach((g, gi) => {
    const start = g.index! + g[0].length;
    const endIdx = gi + 1 < groups.length ? groups[gi + 1].index! : t.indexOf('\n分類\n', start);
    if (endIdx < 0) return;
    const body = t.slice(start, endIdx).replace(/\n施策\d+ [^\n]+$/, '');
    const rows = [...body.matchAll(/(?:^|\n)(\d+)\n([^\n]+)\n([^\n]+)(?=\n|$)/g)];
    if (!rows.length) return;
    // 本文がすべて行で覆われ、番号が1からの連番で、所管課の欄が課・室等で終わる場合のみ。
    const covered = rows.map(r => r[0].replace(/^\n/, '')).join('\n');
    if (covered !== body.replace(/^\n/, '').replace(/\n$/, '') || rows.some((r, i) => Number(r[1]) !== i + 1 || !DEPT.test(r[3].trim()))) return;
    for (const r of rows) {
      const name = r[2].trim(), dept = r[3].trim();
      const raw = r[0].replace(/^\n/, '');
      const off = start + r.index! + (r[0].startsWith('\n') ? 1 : 0);
      const p = project(input, `${g[1]}-${r[1]}|${nfkc(name)}`, name, null, raw, off);
      p.department = dept;
      p.evidence.push(evidence(input, g[0].trim(), g.index! + 1));
      p.warnings.push('基本戦略別ページの事業群一覧（番号・事務事業名・所管課）から収録。事業費は事業群評価調書 PDF の表が抽出テキストで事業ごとに分離できないため未収録。');
      out.push(p);
    }
  });
  return out;
}

export const entries: Record<string, Entry> = {
  '42000': {
    // 同じ事業が複数の事業群・戦略ページに掲載されるため、事業名と所管課で1件に統合。
    extract: (input, inputs) => acrossDocuments(input, inputs, extractNagasaki, p => `${nfkc(p.projectName)}|${p.department}`),
    scope: '政策評価（事務事業評価）の基本戦略別ページ（戦略1-1〜3-3、HTML）に掲載された事業群ごとの事務事業名と所管課。事業費・評価結果・指標は、事業群評価調書（全体版 PDF）と評価結果一覧 PDF の表の列が抽出テキストで事業ごとに分離できないため対象外。',
  },
};
