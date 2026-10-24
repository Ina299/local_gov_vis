import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { sheets, type Entry } from '../batch9/i1-util';
import { municipalityRecords } from '../batch11/k0-util';

// ---------------------------------------------------------------- 花巻市「令和6年度 事務事業評価シート【事後評価】」
// 第5回取得分の評価シート（1資料に複数シート）。事業コード・事業名・評価区分（○印）・成果指標（単一指標の定型のみ）を構造化。
// 同じ取得分の「事業説明資料」は評価欄がなく、財源表の列が段組み崩れで確定しないため対象外。

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../..');
let round5: Set<string> | null = null;
function isRound5(input: CachedInput): boolean {
  round5 ??= new Set(JSON.parse(readFileSync(join(root, 'data/evaluations/collected-sources-batch11.json'), 'utf8')).sources.map((s: { sourceId: string }) => s.sourceId));
  return round5.has(input.sourceId);
}

/** 既存の構造化レコード（evaluations-municipal/03205.json: 広報活動事業費 令和6年度）と衝突するため新規側を除外。 */
const EXISTING = new Set(['124040']);

const HEAD = /令和6年度\n事務事業評価シート\n\n【事後評価】\n/;

/** 評価区分の選択肢（原文ラベル）。exclusive は単独でのみ選ばれる選択肢。 */
const AXES: { label: string; options: string[]; single: boolean; exclusive: string[] }[] = [
  { label: '目的妥当性（公共関与の妥当性）', options: ['妥当である', '見直し余地がある', '妥当でない'], single: true, exclusive: [] },
  { label: '有効性（成果の向上余地）', options: ['向上余地がある', '向上余地がない'], single: true, exclusive: [] },
  { label: '効率性（事業費・人件費の削減余地）', options: ['事業費の削減余地がある', '人件費の削減余地がある', 'どちらも削減余地がない'], single: false, exclusive: ['どちらも削減余地がない'] },
  { label: '公平性（受益と負担の適正化余地）', options: ['受益機会の見直し余地がある', '費用負担の見直し余地がある', '適正である'], single: false, exclusive: ['適正である'] },
  { label: '成果指標の達成度', options: ['目標値より高い', '概ね目標値どおり', '目標値より低い'], single: true, exclusive: [] },
];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function one(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '03205' || !isRound5(input) || !HEAD.test(input.text.slice(0, 60))) return [];
  const out: ProjectEvaluation[] = [];
  for (const { start, text: sh } of sheets(input.text, HEAD)) {
    const code = /^令和6年度\n事務事業評価シート\n\n【事後評価】\n\n会計\n\n款\n\n項\n\n目\n\n事業コード\n\n\d\d\n\n\d\d\n\n\d\d\n\n\d\d\n\n([0-9A-Z]{6})\n/.exec(sh);
    // 末尾の「<事業名> 事務事業評価シート」（または改行区切り）を事業名とし、本文の事業名欄（単独行）と一致するものだけ採用。
    const foot = /\n([^\n]+?)(?: |\n\n)事務事業評価シート\s*$/.exec(sh);
    if (!code || !foot) continue;
    const name = foot[1].trim();
    if (!name || EXISTING.has(code[1])) continue;
    const nameLine = sh.indexOf(`\n${name}\n`);
    if (nameLine < 0 || nameLine > foot.index) continue;
    const p = project(input, code[1], name, null, code[0], start);
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, foot[0].trim(), start + foot.index + foot[0].indexOf(foot[0].trim())));
    // 評価区分: 「○ 選択肢」が同じ行に印字された（行頭は縦書き見出し1字まで）ものだけ採用。
    for (const ax of AXES) {
      const hits = ax.options.map(o => ({ o, m: new RegExp(`^(?:[^\\s○] )?○ ${esc(o)}$`, 'm').exec(sh) })).filter(h => h.m);
      const dupOk = ax.options.every(o => (sh.match(new RegExp(`^(?:[^\\s○] )?○ ${esc(o)}$`, 'gm')) ?? []).length <= 1);
      if (!hits.length || !dupOk) continue;
      if (ax.single && hits.length !== 1) continue;
      if (hits.some(h => ax.exclusive.includes(h.o)) && hits.length !== 1) continue;
      const h0 = hits[0].m!;
      const raw = h0[0];
      p.ratings.push({ kind: 'self', label: ax.label, value: hits.map(h => h.o).join('、'), scale: ax.options.join('／'),
        evidence: evidence(input, raw, start + h0.index) });
      for (const h of hits.slice(1)) p.evidence.push(evidence(input, h.m![0], start + h.m!.index));
    }
    // 成果指標: 1指標のみ（2・3行目と R07 列が空欄）の定型だけ。R05/R06 の目標・実績を転記。
    const ind = /\n成果指標\n\n単位\n\n([^\n]+)\n([^\n\d]{1,6})\n\n1\n\n区分\n\nR05\n\n(?:R06\n\n)?目標\n\n([\d,.]+)\n\n(?:R06\n)?([\d,.]+)\n\n実績\n\n([\d,.]+)\n\n([\d,.]+)\n\nR07\n\n目標\n2\n\n実績\n目標\n\n3\n\n実績\n/.exec(sh);
    if (ind && !/単位|区分|目標|実績|R0\d/.test(ind[1])) {
      const ev = evidence(input, ind[0].slice(1), start + ind.index + 1);
      p.indicators.push({ name: ind[1], unit: ind[2], fiscalYear: 2023, target: ind[3], actual: ind[5], evidence: ev });
      p.indicators.push({ name: ind[1], unit: ind[2], fiscalYear: 2024, target: ind[4], actual: ind[6], evidence: ev });
      p.warnings.push('成果指標は、指標が1つで2・3行目とR07列が空欄の定型に限り、R05（令和5年度）・R06（令和6年度）の目標・実績を原文の数値表記のまま転記。');
    }
    p.warnings.push('表題「令和6年度 事務事業評価シート【事後評価】」から評価対象年度を令和6年度とし、評価実施年度は本文に明記がないため未設定。担当部署は評価シートに記載がないため未設定。事業概要欄の内訳金額は予算・決算の区別が明記されないため未収録。評価区分は「○」が選択肢と同じ行に印字されたものだけを原文ラベルで収録（段組みで○が離れた項目は未収録）。活動指標は列対応が確定しないため未収録。');
    out.push(p);
  }
  return out;
}

export const hanamakiEntries: Record<string, Entry> = {
  '03205': {
    extract: (input, inputs) => municipalityRecords(input, inputs, one, p => p.projectCode ?? p.projectName),
    scope: '第5回取得の「令和6年度 事務事業評価シート【事後評価】」各シートの事業コード・事業名・評価区分（○印の原文ラベル）・単一成果指標の目標/実績を構造化。施策評価シート・事業説明資料（評価欄なし・財源表の列不確定）と既存収録済みの広報活動事業費は対象外。',
  },
};
