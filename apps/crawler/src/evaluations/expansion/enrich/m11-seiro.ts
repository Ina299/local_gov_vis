/**
 * 15307 聖籠町: 令和７年度 政策評価（令和６年度事業の政策評価シート）。公開済みレコードの空欄の事業内容を補う。
 * シートの Plan（企画）欄は「基本情報」の行と「事業内容」の行だけで、目的の欄はない。事業内容は「事業名」の行の次から
 * 「Do（実施） 事業の実施状況」の行の手前まで。欄の見出し「事業内容」は本文の行の途中（行頭）に重なって出るため除く。
 * 年度は公開済みレコードと同じく評価の実施年度（資料の表題「令和７年度 政策評価」）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';

const TITLE = '令和７年度 政策評価 目次';
const SHEET = /令和６年度事業の政策評価シート\nPlan（企画） 基本情報\n事業番号 (\d+) 担当課 ([^\n]*?)\n(事業名 (.+?) 運営方法(?: [^\n]*)?)\n([\s\S]*?)\nDo（実施） 事業の実施状況\n/g;
const LABEL = /^事業内容(?: |$)/;
/** 本文1行は全角52字前後。これ以上の長さの行の後の改行は折り返しとみなす。 */
const WRAP = 50;
const MARK = /^(・|･|※|【|［|〔|＜|<|◆|◇|■|□|●|○|◎|[①-⑳]|（[0-9０-９一二三四五六七八九十]+）|\([0-9]+\)|[0-9０-９]+[.．)）])/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '15307' || input.format !== 'pdf' || !input.text.startsWith(TITLE)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(SHEET)) {
    const lines = m[5].split('\n');
    if (lines.filter(l => LABEL.test(l)).length !== 1) continue;
    const body = lines.map(l => l.replace(LABEL, '')).filter((l, i) => l.trim() || !LABEL.test(lines[i]));
    if (!body.length || body.some(l => !l.trim())) continue;
    const value = body.reduce((acc, l, i) => acc + (i === 0 ? '' : body[i - 1].length >= WRAP && !/。$/.test(body[i - 1]) && !MARK.test(l) ? '' : '\n') + l, '');
    const name = m[4].trim(), at = m.index!;
    const nameAt = at + m[0].indexOf(m[3]);
    const p = project(input, `narrative|${m[1]}`, name, 2025, m[3], nameAt);
    p.id = stableId(input, `narrative|${m[1]}|${at}`, 2025); p.projectCode = null;
    if (m[2].trim()) p.department = m[2].trim();
    p.activities = value;
    p.evidence.push(evidence(input, TITLE, 0), evidence(input, m[5], nameAt + m[3].length + 1));
    p.warnings.push('聖籠町 令和６年度事業の政策評価シートの「事業内容」欄を収録。行頭に重なった欄の見出し（事業内容）とPDFの折り返しの改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '聖籠町 令和７年度 政策評価（令和６年度事業の政策評価シート）の「事業内容」欄。目的の欄はない様式。',
};
