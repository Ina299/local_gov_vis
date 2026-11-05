import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 奥尻町（教育委員会 点検及び評価報告書（令和5年度）、事務・事業評価対象事業リスト）
// 公開済みレコードは同じ報告書（20250226124917.pdf）の「令和5年度事務・事業評価対象事業リスト」の行（対象年度＝令和５年度）。
// 同じ行の「事業内容」列を事業内容として取る。番号・事業名・事業内容・事業費（備考）・自己評価・外部評価が空行で区切られた
// 行だけを読み、列が混ざった行（事業名と事業内容が同じ行に出力されたもの）は採らない。
// 後半の事務事業評価シートの「目的」欄は、事業名が一覧と違う・欄の位置が崩れているものが多く、一覧の事業と対応が本文で確定しないため取らない。
const ROW = /(?<=\n\n)(\d+)\n\n((?:[^\n]+\n){1,3})\n((?:[^\n]+\n){1,8})\n([\d,]+)(?: [^\n]*)?\n\n([A-EＡ-Ｅ])\n\n([A-EＡ-Ｅ])(?=\n\n)/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01367' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/20250226124917.pdf')) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const s = t.indexOf('令和5年度事務・事業評価対象事業リスト\n'), e = t.indexOf('事務事業評価シート', s);
  if (s < 0 || e < 0) return [];
  const list = t.slice(s, e);
  for (const m of list.matchAll(ROW)) {
    const nameLines = m[2].trim().split('\n'), body = m[3].trim();
    // 事業内容の列は句点で終わる文章（「〜を行う」で終わる短い行も含む）。数字・評価記号だけの行が混ざれば採らない。
    if (body.split('\n').some(l => /^([\d,]+|[A-EＡ-Ｅ])$/.test(l.trim())) || nameLines.some(l => /^[\d,]+$/.test(l.trim()))) continue;
    const name = nameLines.join('');
    const at = s + m.index!;
    const p = project(input, `narrative:${m[1]}`, name, null, m[0], at);
    p.projectCode = null; p.evaluatedFiscalYear = 2023;
    p.activities = body.split('\n').join('');
    p.evidence.push(evidence(input, m[3].trimEnd(), at + m[0].indexOf(`\n\n${m[3]}`) + 2));
    p.warnings.push('奥尻町 教育委員会 点検及び評価報告書（令和5年度）の事務・事業評価対象事業リストの「事業内容」列を事業内容として収録（折り返しの改行は除いた）。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '奥尻町 教育委員会 点検及び評価報告書（令和5年度、20250226124917.pdf）の事務・事業評価対象事業リスト: 「事業内容」列。',
};
