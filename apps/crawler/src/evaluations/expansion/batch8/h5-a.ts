import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { mergeReprints } from '../batch7/g1-util';

/** 上天草市 平成25年度行政評価 事務事業評価シート（平成26年7月 総務企画部財政課）の各シート見出し。 */
function extractKamiamakusa(input: CachedInput): ProjectEvaluation[] {
  const title = '平成 25 年度行政評価事務事業評価シート';
  if (input.municipalityCode !== '43212' || input.sourceId !== '0ff90970f4dbea910db8c8af' || !input.text.startsWith(title)) return [];
  const text = input.text, starts = [...text.matchAll(/平成25年度 事務事業評価シート\n事務事業評価シート\n基本情報\n/g)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    const sheet = text.slice(s, starts[i + 1] ?? text.length);
    const name = sheet.match(/\n([^\n]+)\n\n\(予算事業名\)/);
    if (!name || /事業コード|予算科目|事務事業名|基本情報/.test(name[1])) return;
    // The 所属 lines are printed just above the sheet title, after the previous page's blank-line break.
    const before = text.slice(Math.max(0, s - 120), s), cut = before.lastIndexOf('\n\n\n');
    if (cut < 0) return;
    const deptRaw = before.slice(cut + 3).replace(/\n+$/, ''), deptStart = s - 120 < 0 ? cut + 3 : s - 120 + cut + 3;
    if (!deptRaw || !/^\S+部/.test(deptRaw) || deptRaw.length > 60) return;
    const raw = deptRaw + text.slice(deptStart + deptRaw.length, s) + sheet.slice(0, name.index! + name[0].length);
    const p = project(input, name[1], name[1], 2013, raw, deptStart);
    p.projectCode = null;
    p.department = deptRaw.split(/\s+/).join(' ');
    p.evidence.push(evidence(input, title, 0));
    p.warnings.push('平成25年度行政評価 事務事業評価シートの見出し（事務事業名・所属）のみ収録。指標表・総投入量（決算・予算・人件費）は抽出テキストで空欄が詰まり列（年度）との対応を確定できないため未収録。事業コード欄は異なる事業に同じ値が並ぶ箇所があり事業固有の番号と確認できないため未収録。シートに評価（Check）欄はなく評価結果は未収録。評価対象年度は本文に明記がなく未設定。保存済み本文は約12万字で打ち切られており、総務企画部の一部シートのみが対象。');
    out.push(p);
  });
  return mergeReprints(out, p => `${p.department}:${p.projectName}`);
}

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '43212': { extract: extractKamiamakusa, scope: '平成25年度行政評価 事務事業評価シート（平成26年7月公表）の保存済み本文（約12万字・総務企画部の一部）から、各シートの事務事業名と所属のみを構造化。指標・総投入量（列の年度対応が確定しないため）、事業コード、目的等の記述欄は対象外。' },
};
