import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m17-util';

// ---------------------------------------------------------------- 今治市（教育委員会の点検及び評価報告書 令和7年度（令和6年度対象））
// 公開済みレコードは同じ報告書の「重点方針0X／取組事業NN／〇事業名」から作られ（evaluationYear 2025・evaluatedFiscalYear 2024）、
// 《事業概要》が事業内容に入っている（概要の途中にページ番号が入る2事業は空。2026-11-05 の訂正までは目的に入っていた）。
// ここでは《令和６年度の主な取組・実績》の「（１）事業の実施状況」を事業内容（概要が入っていない事業だけ埋まる）、
// 「（２）事業の成果」を成果とする（次の見出しの手前まで。ページ番号の行が混ざる欄は採らない）。《事業概要》は目的の欄ではないため、目的には入れない。
const TITLE = '令和７年度（令和６年度対象）\n\n教育に関する事務の管理及び執行の状況の\n点検及び評価報告書';
const HEAD = /(重点方針0[1-5])\n\n(取組事業(\d\d))\n\n〇 ?([^\n]+)\n/g;
const PAGE = /^- \d+ -$/m;

function field(seg: string, head: string, next: string): { raw: string; at: number } | null {
  const a = seg.indexOf(head);
  if (a < 0) return null;
  const at = a + head.length, b = seg.indexOf(next, at);
  if (b < 0) return null;
  const raw = seg.slice(at, b);
  if (!raw.trim() || raw.includes('\n\n') || PAGE.test(raw)) return null;
  return { raw, at };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '38202' || !/\/kyouikut\/houkoku\/R7\.pdf/.test(input.sourceUrl) || !input.text.startsWith(TITLE)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const heads = [...t.matchAll(HEAD)].filter(m => m.index! >= 3000); // 目次は対象外
  heads.forEach((m, i) => {
    if (input.truncated && i === heads.length - 1) return;
    const start = m.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length), name = m[4].trim();
    const ac = field(seg, '\n（１）事業の実施状況\n', '\n（２）事業の成果\n');
    const oc = field(seg, '\n（２）事業の成果\n', '\n（３）教育大綱推進実施計画に掲げている指標の現状\n');
    if (!ac && !oc) return;
    const p = project(input, `取組事業${m[3]}:narrative`, name, 2025, m[0].trimEnd(), start);
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, TITLE, 0));
    if (ac) { p.activities = unwrap(ac.raw); p.evidence.push(evidence(input, ac.raw, start + ac.at)); }
    if (oc) { p.outcomes = unwrap(oc.raw); p.evidence.push(evidence(input, oc.raw, start + oc.at)); }
    p.warnings.push('今治市教育委員会 点検及び評価報告書の取組事業の「（１）事業の実施状況」を事業内容、「（２）事業の成果」を成果として収録'
      + '（ページ番号の行が混ざらない欄のみ）。欄の幅での折り返しだけをつないだ。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '今治市 教育委員会の点検及び評価報告書（令和7年度・令和6年度対象）の取組事業: 事業の実施状況（事業内容）・事業の成果（成果）。',
};
