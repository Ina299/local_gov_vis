import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 松本市（令和８年度行政評価 事務事業評価表）
// 公開済みレコードは同じ事務事業評価表（令和8年度、令和7年度継続事務事業）の事業名・担当所属・コストから作られ、目的は未収録だった。
// 取得済みテキストは各PDFの先頭120,000字だけ（約60事業ずつ）なので、その範囲の評価表に限る。
// 「【事 業 概 要 ・ 指 標】」欄の左列「趣旨・目的」の本文を目的とする。右列（対象指標・活動指標など）の指標名が同じ行に並んだ評価表
// （丸数字や半角空白を含む行がある）は列の対応が崩れているため除く。本文は「趣旨・目的」の行の次から、「活動指標」「内容」の行の前まで。
// 「内容」欄は右列の指標名が行末に並ぶことが多く、行ごとの切り分けが確定しないため未収録。
/** 令和８年度行政評価（事務事業評価表）の2分冊（215010_772727／215010_772728）。 */
const SOURCES = new Set(['57705f22190cb81477f68436', 'c7d01e8a289d13f1e52eff2e']);
const HEAD = /^令和 ?8年度 事務事業評価表 （ ?令和 ?7年度 ?継続事務事業 ?）\n事務事業名 ([^\n]+)\n担当所属 ([^\n]+?) 連絡先/gm;
const PURPOSE = /\n【事 業 概 要 ・ 指 標】\n事業概要 対象指標\n趣旨・目的\n((?:[^\n]+\n)*?)(?:活動指標|内容|内容 活動指標)\n/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '20202' || !SOURCES.has(input.sourceId)) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    if (input.truncated && k === heads.length - 1) return;
    const start = h.index!, seg = t.slice(start, heads[k + 1]?.index ?? t.length);
    const m = PURPOSE.exec(seg);
    if (!m || (seg.match(/趣旨・目的/g) ?? []).length !== 1) return;
    const raw = m[1].replace(/\n$/, '');
    if (!raw || /[ ①-⑳]|指標|趣旨|内容/.test(raw)) return;
    // 右列の「活動指標」の見出しが本文の途中に割り込むと、続きが見出しの後ろに出る。最後の行が欄の幅（約34字）に満たないか、
    // 文末（「。」「もの」）で終わる場合だけ本文が見出しの前で終わっているとみなす。
    const last = raw.slice(raw.lastIndexOf('\n') + 1);
    if (last.length >= 30 && !/(?:。|もの)$/.test(last)) return;
    const name = h[1].trim(), dept = h[2].trim();
    const p = project(input, `${name}|${dept}|narrative`, name, 2026, h[0].slice(0, h[0].indexOf('\n担当所属')), start);
    p.projectCode = null;
    p.department = dept;
    p.purpose = unwrap(raw);
    p.evidence.push(evidence(input, raw, start + m.index! + m[0].indexOf('趣旨・目的\n') + '趣旨・目的\n'.length));
    p.warnings.push('松本市 令和８年度行政評価（事務事業評価表）の「趣旨・目的」欄を目的に収録（折り返しの改行は除去）。評価年度は表題の令和8年度。'
      + '右列の指標名が同じ行に並んだ評価表は収録しない。「内容」欄は未収録。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '松本市 令和８年度行政評価 事務事業評価表（取得済みの各PDF先頭120,000字の範囲）の「趣旨・目的」（右列の指標名が混ざらないものだけ）。',
};
