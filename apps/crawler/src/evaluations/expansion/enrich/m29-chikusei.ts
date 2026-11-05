import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 筑西市（行政評価 外部評価の参考資料、重点プロジェクト事業の説明資料）
// 公開済みレコードは「令和8年度外部評価結果」（1781072888_doc_42_0.pdf、年度の記載なし）と「令和７年度行政評価に係る外部評価結果」
// （1753243030_doc_41_0.pdf、対象年度＝令和６年度）の評価対象事業。同じページに【参考N】として掲載された事業ごとの説明資料の
// 目的の欄（「事業目的」「目 的」「背景・目的」「目的・事業概要」）を目的として取る。欄は見出しから次の見出し（資料ごとに固定）までで、
// 折り返しの改行を除く（句点で終わる行の後・箇条の前は改行を残す）。年度の記載がない外部評価結果のレコードは、同じページに掲載された資料どうしの照合（p0、2026-11-06 以降）で補う。
// 「１ 背景」だけの資料・事業名が結果と違う資料（筑西市20周年記念事業）は対象外。
interface Spec { file: string; name: string; start: string; end: string; result?: string; fiscalYear?: number }
const SPECS: Spec[] = [
  { file: '1781072867_doc_42_0.pdf', name: '玉戸・一本松線整備事業', start: '\n１．事業目的\n', end: '\n2\n\n\n２．事業概要\n', result: '1781072888_doc_42_0.pdf' },
  { file: '1781072871_doc_42_0.pdf', name: '移住定住促進事業', start: '\n事業目的\n', end: '\n\n移住・定住情報発信\n', result: '1781072888_doc_42_0.pdf' },
  { file: '1781072875_doc_42_0.pdf', name: '小中一貫教育推進事業', start: '\n２ 目 的\n', end: '\n\n３ 概\n', result: '1781072888_doc_42_0.pdf' },
  { file: '1781072879_doc_42_0.pdf', name: '地域産品活性化戦略事業', start: '\n１ 背景・目的\n', end: '\n\n① 筑西市産業振興条例の推進', result: '1781072888_doc_42_0.pdf' },
  { file: '1781072883_doc_42_0.pdf', name: '教育情報化整備事業', start: '\n目的・事業概要\n\n', end: '\n【令和７年度予算額】', result: '1781072888_doc_42_0.pdf' },
  { file: '1753243054_doc_41_0.pdf', name: '筑西市DX推進事業', start: '\n【事業目的】\n', end: '\n【事業費】\n', fiscalYear: 2024 },
];

/** 句点で終わる行の後・箇条（➢・●）の前・短い箇条見出しの後は改行を残し、それ以外の行末（折り返し）の改行を除く。 */
function join(raw: string): string {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.reduce((acc, l, i) => {
    if (i === 0) return l;
    const prev = lines[i - 1];
    return acc + (/。$/.test(prev) || /^[➢●]/.test(l) || (/^[➢●]/.test(prev) && prev.length < 25) ? '\n' : '') + l;
  }, '');
}

/** 説明資料の目的の欄を取る。pageMatched: 年度の記載がない結果資料の事業（同じページに掲載。2026-11-06 以降の補強）だけを対象にする。 */
function narrative(input: CachedInput, pageMatched: boolean): ProjectEvaluation[] {
  const spec = SPECS.find(s => input.municipalityCode === '08227' && input.format === 'pdf' && input.sourceUrl.endsWith(`/${s.file}`));
  // 年度の記載がない結果資料の事業は、説明資料が別の PDF のため「同じ資料」の照合ルールに当たらない。同じページの照合（p0）で扱う。
  if (!spec || !!spec.result !== pageMatched) return [];
  const t = input.text, head = t.slice(0, 200).split('\n');
  if (!head.includes(spec.name) || t.split(spec.start).length !== 2) return [];
  const at = t.indexOf(spec.start) + spec.start.length, end = t.indexOf(spec.end, at);
  if (end < 0 || end - at > 1200) return [];
  const raw = t.slice(at, end);
  const p = project(input, `narrative:${spec.name}`, spec.name, null, t.slice(0, t.indexOf(spec.name) + spec.name.length), 0);
  p.projectCode = null; p.evaluatedFiscalYear = spec.fiscalYear ?? null;
  p.purpose = join(raw);
  p.evidence.push(evidence(input, raw, at));
  p.warnings.push(`筑西市 外部評価の参考資料（${spec.name}の説明資料）の目的の欄を目的として収録（折り返しの改行を除いた）。`);
  return [p];
}

export const entry = {
  extract: (input: CachedInput) => narrative(input, false),
  scope: '筑西市 行政評価 外部評価の参考資料（重点プロジェクト事業の説明資料6件）: 目的の欄（事業目的・目的・背景・目的・目的・事業概要）。',
};

/** 年度の記載がない「令和8年度外部評価結果」の事業: 同じページに【参考N】として掲載された説明資料の目的の欄（同じページの照合）。 */
export const pageEntry = {
  extract: (input: CachedInput) => narrative(input, true),
  scope: '筑西市 令和8年度外部評価の参考資料（重点プロジェクト事業の説明資料5件）: 目的の欄。結果資料と同じページに掲載された資料として照合。',
};
