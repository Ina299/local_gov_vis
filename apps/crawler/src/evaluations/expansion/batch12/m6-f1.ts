/** Batch-12 (m6) extractor for 09204 佐野市: 「仕事の振り返りシート（令和7年度実施分）」（事務事業ごとの振り返りシート）. */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';
import { amount, nfkc } from '../batch9/i1-util';
import { municipalityRecords } from '../batch11/k0-util';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

const TITLE = '仕事の振り返りシート（令和7年度実施分）\n';
/** The sheet's own heading opens every sheet; the 施策 sheets (総合計画の進行管理及び課題管理シート) never start with it. */
const NAME = [/^事業名 ([^\n]+)\n/, /^事業名\n\n([^\n]+)\n\n/, /^実施計画事業or一般事業[^\n]*\n事業名 ([^\n]+)\n/];
const DEPT = /\n([^\n]*(?:部|本部|局|委員会))\n部\n担当組織 課\n([^\n]+)\n/;
const V = '(-?[\\d,.]+|-)';
// 事業費計 R4〜R7 printed as one row immediately followed by the 一般財源 label; any other arrangement is left out.
const COST = /\n事業費計\n\n千円\n\n((?:[\d,]+|-)(?:\s+(?:[\d,]+|-)){3})\n\n一般財源\n/;
// Single-indicator effect table only: name, unit, R4, R5, R6, R7 with its 過去比較 and 目標達成 marks, then (５).
const INDICATOR = new RegExp(`（４）事業効果を説明する数値データの推移\\n効果指標\\n単位\\nR4\\n([^\\n]+)\\n([^\\n]+)\\n${V}\\n\\nR5\\n${V}\\n\\nR6\\n${V}\\n\\n過去比較 目標達成\\nR7\\n${V} (効果が上がった|効果は変わらない|効果が下がった)\\n([〇×])\\n+（５）`);
const JUDGED = /\n\d+指標\n\d+指標\n\d+指標\n\d+指標\n\d+指標\n+(効果が上がった|効果は変わらない|効果が下がった)\n+(?:費用（R7とR6の事業費計増減）\n+)?(費用が増加した|費用は下がった|費用の増減無し)\n/g;
const EFFECT_SCALE = '効果が上がった／効果は変わらない／効果が下がった（R7と過去3年平均の指標値増減による自動判定）';
const COST_SCALE = '費用が増加した／費用の増減無し／費用は下がった（R7とR6の事業費計増減、１０万円以上の増減により判断する自動判定）';

function sheets(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '09204' || !input.text.startsWith(TITLE)) return [];
  const t = input.text, starts: number[] = [];
  for (let i = t.indexOf(TITLE); i >= 0; i = t.indexOf(TITLE, i + 1)) starts.push(i);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const body = s + TITLE.length, sheet = t.slice(body, starts[k + 1] ?? t.length);
    const m = NAME.map(re => sheet.match(re)).find(Boolean);
    if (!m) return;
    const name = m[1].trim();
    if (!name || /実施計画事業or一般事業|市長公約|基本情報/.test(name)) return;
    const p = project(input, '', name, null, t.slice(s, body + m[0].trimEnd().length), s);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2025;
    const d = sheet.match(DEPT);
    if (d) {
      p.department = d[2].trim();
      p.evidence.push(evidence(input, d[0].slice(1, -1), body + d.index! + 1));
    }
    // The sheets carry no project code; the identity is the business name and its 担当課 within this PDF.
    p.id = stableId(input, `${name}
${p.department ?? ''}`, null);
    const c = sheet.match(COST);
    if (c) {
      const values = c[1].split(/\s+/), off = body + c.index! + 1, raw = c[0].slice(1, -1);
      values.forEach((v, i) => { if (v !== '-' && nfkc(v) !== '0') p.amounts.push(amount(input, 'actual', 2022 + i, v, '千円', raw, off)); });
    }
    const ind = sheet.match(INDICATOR);
    if (ind) {
      const e = evidence(input, ind[0].replace(/\n+（５）$/, ''), body + ind.index!);
      [ind[3], ind[4], ind[5], ind[6]].forEach((v, i) => {
        if (v !== '-') p.indicators.push({ name: ind[1], fiscalYear: 2022 + i, target: null, actual: v, unit: ind[2], evidence: e });
      });
      p.ratings.push({ kind: 'self', label: `目標達成（${ind[1]}・R7）`, value: ind[8], scale: '〇／×（シートの「目標達成」欄の記号）', evidence: e });
    }
    const judged = [...sheet.matchAll(JUDGED)];
    if (judged.length === 1) {
      const j = judged[0], e = evidence(input, j[0].slice(1, -1), body + j.index! + 1);
      p.ratings.push({ kind: 'self', label: '効果（指標全体・自動判定）', value: j[1], scale: EFFECT_SCALE, evidence: e });
      p.ratings.push({ kind: 'self', label: '費用（R7とR6の事業費計増減・自動判定）', value: j[2], scale: COST_SCALE, evidence: e });
    }
    p.warnings.push('佐野市「仕事の振り返りシート（令和7年度実施分）」の1シート。評価対象年度はシート見出しの令和7年度。評価実施年度は本文に明記がないため未設定。');
    p.warnings.push(d ? '担当課はシートの「担当組織 課」欄の値。' : '担当組織の部・課の並びが抽出テキストで崩れているため担当課は未設定。');
    p.warnings.push(c
      ? '金額は「３．前年度の実績」の「事業費計」（千円）R4〜R7を令和4〜7年度の実績として採用。0と「-」は未収録。一般財源・特定財源の内訳は列の対応が確定できないため未収録。'
      : '「事業費計」の行がR4〜R7の4値として崩れずに出力されていないため金額は未収録。');
    p.warnings.push(ind
      ? '効果指標は（４）の表が1指標だけで崩れずに出力されたもののみ、R4〜R7の値を実績として収録（目標値の表は列が崩れるため未収録）。'
      : '効果指標は表の列の並びが抽出テキストで崩れているか複数指標のため未収録。');
    out.push(p);
  });
  return out;
}

const key = (p: ProjectEvaluation) => JSON.stringify([nfkc(p.projectName), p.department]);

export const entries: Record<string, Entry> = {
  '09204': {
    extract: (input, inputs) => municipalityRecords(input, inputs, sheets, key),
    scope: '仕事の振り返りシート（令和7年度実施分）の事務事業ごとの事業名・担当課・事業費計（R4〜R7の実績、千円、崩れていない行のみ）・単一効果指標のR4〜R7実績と目標達成記号・効果と費用の自動判定。総合計画の進行管理及び課題管理シート（施策単位）、目標値、財源内訳、検討課題の文章は対象外。',
  },
};
