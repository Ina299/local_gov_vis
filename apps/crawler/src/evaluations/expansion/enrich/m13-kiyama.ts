import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 基山町（令和２〜６年度 事務事業評価シート、事業の概要）
// 公開済みレコードは同じ評価シート（年度別PDF）の事業名・担当課・評価年度（令和N年度）。様式に「目的」欄はなく、
// 「１．事業の概要（Plan）」の「事業の概要」欄を事業内容として足す。欄の本文は施策体系（①〜の具体的な施策）の直後、
// 「２．事業の実績（Do）」の直前の段落で、見出し「事業の概要」が本文の後に出力される版もある。段落に別の見出し
// （根拠法令等など）が混ざる場合は対応が決まらないため採らない。
const SHEET_HEAD = /^令和([２-６])年度事務事業評価シート\n１．事業の概要（Plan）\n/gm;
const DO = '\n\n２．事業の実績（Do）\n';
const LABEL = /根拠法令|事業名|担当課|担当係|基本計画|施策体系|具体的な施策|業務開始年度|位置付け/;
const DEPT = /^[^\s]+(課|室|局|センター)$/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '41341' || input.format !== 'pdf') return [];
  const t = input.text, heads = [...t.matchAll(SHEET_HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const start = heads[i].index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const year = 2018 + '０１２３４５６'.indexOf(heads[i][1]);
    // 事業名と担当課: 「事業の概要」見出しの後に事業名が来る版と、担当課の見出しの後に事業名・担当課が続く版。
    const a = /\n担当課\n\n([^\n]+)\n\n総合計画基本計画の\n/.exec(seg), an = /\n事業の概要\n\n([^\n]+)\n担当係\n/.exec(seg);
    const b = /\n担当課\n\n([^\n]+)\n([^\n]+)\n\n総合計画基本計画の\n/.exec(seg);
    const [name, dept, nameRaw, nameAt] = a && an ? [an[1], a[1], an[0], an.index] : b && !an ? [b[1], b[2], b[0], b.index] : [];
    if (!name || !dept || !nameRaw || !DEPT.test(dept) || DEPT.test(name)) continue;
    const e = seg.indexOf(DO);
    if (e < 0 || seg.indexOf(DO, e + 1) >= 0) continue;
    const paras = seg.slice(0, e).split('\n\n');
    let body = paras[paras.length - 1];
    // 見出しが本文の後に出力される版では見出しを除く（a の版では見出しは事業名の前にある）。
    if (b && !an) { if (!body.endsWith('\n事業の概要')) continue; body = body.slice(0, -'\n事業の概要'.length); }
    else if (body.includes('事業の概要')) continue;
    if (!/^[①-⑳]/.test(paras[paras.length - 2] ?? '') || !body.trim() || LABEL.test(body)) continue;
    const bodyAt = start + e - paras[paras.length - 1].length;
    const p = project(input, `narrative:${name}`, name.trim(), null, nameRaw.slice(1, -1), start + nameAt! + 1);
    p.projectCode = null; p.evaluatedFiscalYear = year; p.department = dept.trim();
    p.activities = unwrap(body);
    p.evidence.push(evidence(input, heads[i][0].trimEnd(), start), evidence(input, body, bodyAt));
    p.warnings.push('基山町 事務事業評価シート「１．事業の概要（Plan）」の「事業の概要」欄を事業内容として収録（様式に目的欄はない）。'
      + '施策体系の直後で「２．事業の実績（Do）」の直前の段落に限り、別の見出しが混ざる場合は対象外。欄の幅での折り返しの改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '基山町 令和２〜６年度 事務事業評価シート（年度別PDF）: 「事業の概要」欄（事業内容）。目的欄は様式にない。',
};
