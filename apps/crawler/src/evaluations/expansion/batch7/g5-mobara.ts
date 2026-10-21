import type { EvaluationRating, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project, stableId } from '../shared';

/** 茂原市 令和5年度 事務事業戦略シート（batch7 新規取得）。費用・指標表は空欄位置が失われており列対応が確定しないため数値は構造化しない。 */
const strategyIds = new Set(['1898ff2fca2a7ba165547286', '1a044c5461d1031ad1446045', '48d70dcc38d730452f71c23c', 'be6c5ecf057613973ab7c3b8',
  'bf47cf2dbc4c79c353368ebe', 'd2cc7d2d26be2e451bc8a7ef', 'fa0b17c8a168bcd6ba6498f3']);
const recurringId = '92aef49c9a3b22b49362b498';
const NOTE = '空欄セルが抽出テキストで失われ、計画・予算・決算の列と年度の対応が確定しないため金額・指標は未構造化。評価区分は原文ラベルのまま。';

/** A label matched exactly once inside [from, to); otherwise null (ambiguous or absent). */
function once(text: string, re: RegExp, from: number, to: number): { value: string; index: number } | null {
  const hits = [...text.slice(from, to).matchAll(re)];
  return hits.length === 1 ? { value: hits[0][0], index: from + hits[0].index! } : null;
}
function rating(input: CachedInput, label: string, hit: { value: string; index: number } | null, scale: string | null, value?: string): EvaluationRating[] {
  return hit ? [{ kind: 'self', label, value: value ?? hit.value.trim(), scale, evidence: evidence(input, hit.value, hit.index) }] : [];
}

function strategy(input: CachedInput): ProjectEvaluation[] {
  const text = input.text, heading = '令和5年度 3か年事務事業戦略シート';
  const starts: number[] = [];
  for (let i = text.indexOf(heading); i >= 0; i = text.indexOf(heading, i + 1)) starts.push(i);
  const out = new Map<string, ProjectEvaluation>(), conflicts = new Set<string>();
  for (let i = 0; i + 1 < starts.length; i++) {
    const s1 = starts[i], s2 = starts[i + 1], e2 = starts[i + 2] ?? text.length;
    const first = text.slice(s1, s2), second = text.slice(s2, e2);
    if (first.includes('A:妥当である') || !second.includes('A:妥当である')) continue;
    const id = first.match(/担当課・係等\n\n([^\n]+)\n\n([^\s]+(?:課|室|館|所|センター|局|園)(?: [^\s]+)?)\n/);
    const code = first.match(/\b\d{9}\b/)?.[0];
    if (!id || !code || !second.includes(code) || !second.replaceAll('\n', '').includes(id[1])) continue;
    const name = id[1], department = id[2];
    const p = project(input, code, name, 2023, text.slice(s1, e2), s1);
    p.id = stableId(input, `${code}\n${name}`, 2023);
    p.projectCode = null; // 実施計画整理番号 is shared by several businesses (e.g. 401010101), so it is not an identity
    p.department = department;
    const act = second.match(/活動内容と成果（具体的に何をしたか、どのような実績があったか）\n\n([\s\S]+?)\n\n課\n題\n/);
    if (act) p.outcomes = act[1].trim();
    p.ratings.push(
      ...rating(input, '必要性の評価', once(text, /^[A-D]：必要性[^\n]*$/gm, s2, e2), null),
      ...rating(input, '有効性の評価', once(text, /^[A-D]：有効性[^\n]*$/gm, s2, e2), null),
      ...rating(input, '効率性の評価', once(text, /^[A-D]：効率性[^\n]*$/gm, s2, e2), null),
      ...rating(input, '総合評価', once(text, /^[A-D]：(?:十分な成果|ある程度の成果|成果を挙げることができなかった|実施していない)[^\n]*$/gm, s2, e2), null),
      ...rating(input, '事業の方向性', once(text, /^[A-D]：(?:計画どおり事業を進めることが適当|事業の実施方法やコスト等について改善が必要|事業終了年度に達した)$/gm, s2, e2), null),
      ...rating(input, '改善・改革の手法', once(text, /^[①-⑩][^\n]+$/gm, s2, e2), null));
    const plan = once(text, /A：計画どおり事業継続が\n\n[ABCD]\n\n/g, s2, e2);
    p.ratings.push(...rating(input, '企画政策課の評価', plan, 'A：計画どおり事業継続が適当／B：事業改善の検討が必要／C：事業の休止・廃止の検討が必要／D：事業終了が適当',
      plan?.value.match(/\n\n([ABCD])\n\n$/)?.[1]));
    p.warnings.push(`3か年事務事業戦略シート（2頁1組）。${NOTE}実施計画整理番号（${code}）は複数事業で共有されるため事業コードとしては採用せず事業名で識別。評価年度は表題「令和5年度」、評価対象年度は本文に明記がなく未設定。活動内容と成果は原文の合体欄のまま。`);
    i++;
    const key = `${code}\n${name}`, old = out.get(key);
    if (old) {
      if (JSON.stringify(old.ratings.map(r => [r.label, r.value])) !== JSON.stringify(p.ratings.map(r => [r.label, r.value]))) conflicts.add(key);
      else old.evidence.push(...p.evidence);
    } else out.set(key, p);
  }
  return [...out].filter(([k]) => !conflicts.has(k)).map(([, p]) => p);
}

function recurring(input: CachedInput): ProjectEvaluation[] {
  const text = input.text, heading = '令和5年度 経常事務事業戦略シート';
  const starts: number[] = [];
  for (let i = text.indexOf(heading); i >= 0; i = text.indexOf(heading, i + 1)) starts.push(i);
  const out = new Map<string, ProjectEvaluation>(), conflicts = new Set<string>();
  starts.forEach((s, i) => {
    const e = starts[i + 1] ?? text.length, page = text.slice(s, e);
    const dept = page.match(/^令和5年度 経常事務事業戦略シート\n担当課・係等\n\n([^\n]+)\n/);
    const name = page.match(/\n予算科目\n事務事業名\n\n([^\n]+)\n事業事業の目標・目的/);
    if (!dept || !name) return;
    const p = project(input, `${dept[1]}:${name[1]}`, name[1], 2023, page, s);
    p.department = dept[1];
    p.ratings.push(...rating(input, '企画政策課評価結果', once(text, /企画政策課評価結果\n[A-D] [^\n]+/g, s, e), null),
      ...rating(input, '改善・改革の手法', once(text, /^[①-⑩][^\n]+$/gm, s, e), null));
    for (const r of p.ratings) if (r.label === '企画政策課評価結果') r.value = r.value.replace('企画政策課評価結果\n', '');
    p.warnings.push(`経常事務事業戦略シート。${NOTE}活動内容と成果・分析評価は2段組が行単位で混在するため未構造化。評価年度は表題「令和5年度」、評価対象年度は本文に明記がなく未設定。`);
    const key = p.projectCode!, old = out.get(key);
    if (old) {
      if (JSON.stringify(old.ratings.map(r => r.value)) !== JSON.stringify(p.ratings.map(r => r.value))) conflicts.add(key);
      else old.evidence.push(...p.evidence);
    } else out.set(key, p);
  });
  return [...out].filter(([k]) => !conflicts.has(k)).map(([, p]) => p);
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '12210' || input.format !== 'pdf' || input.truncated) return [];
  if (strategyIds.has(input.sourceId)) return strategy(input);
  if (input.sourceId === recurringId) return recurring(input);
  return [];
}

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '12210': { extract, scope: '令和5年度 3か年事務事業戦略シート・経常事務事業戦略シートの事業名・担当課・自己評価区分・企画政策課評価・活動内容と成果のみ。費用・指標は列崩れのため未構造化。R5対象事業一覧は列崩れのため対象外。' },
};
