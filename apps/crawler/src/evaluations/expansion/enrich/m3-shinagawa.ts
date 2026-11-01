/**
 * 13109 品川区: 全庁版の事務事業評価シート（令和7年度＝令和6年度実施事業、令和6年度＝令和5年度実施事業）と
 * 令和4年度 行政評価シート（小事業評価）。公開済みレコード（同じシート・最終評価一覧の行）の空欄の
 * 目的（「目的・概要」欄の【目的】）、事業内容（「取組内容・実績」欄）、成果（「指標の達成状況」欄）を補う。
 * 部局別PDFは全庁版の再掲なので使わない。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';
import { block, blockEvidence } from './m3-narrative';

const DOCS = new Set(['9eb90ec1fb385e036522db72', 'f2f5d70c8fda693de8b66d25', 'd4437b658bdd151b330e4187']);
const NOT_NAME = /^(会計|目|款|項|事業|予算科目|担当部署|担当課|担当係|一般会計|.*特別会計|[０-９\d]+|（.*）)$/;
const reiwa = (s: string) => 2018 + Number(s.normalize('NFKC'));
/** 欄の内容を打ち切る見出し（隣の欄の見出し）。 */
const STOP = /^(指標の達成状況|取組内容・実績|効率性|必要性・有効性|事業の実績・課題|予算・決算（概要）|財務情報|目的・概要|[０-９\d]+|評|価|\(1\)所管評価|\(2\)最終評価)$/;
const STOP_PURPOSE = new RegExp(`${STOP.source.slice(0, -2)}|[【［〔][^】］〕]*[】］〕])$`);
/** 本文1行は60字余り。これより短い行で終わる行の次は折り返しではない。 */
const WRAP = { minWrap: 56 };
const PURPOSE = /\n目的・概要\n([【［〔])目的([】］〕])\n/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13109' || !DOCS.has(input.sourceId) || input.truncated) return [];
  const text = input.text, out: ProjectEvaluation[] = [];
  const heads = [...text.matchAll(/令和 ?(\d+)年度 (事務事業|行政)評価シート\n小事業名\n/g)];
  heads.forEach((h, i) => {
    const start = h.index!, seg = text.slice(start, heads[i + 1]?.index ?? text.length);
    const isNew = h[2] === '事務事業';
    const implemented = [...seg.matchAll(/（令和 ?(\d+)年度実施事業）/g)];
    if (isNew && (!implemented.length || implemented.some(m => m[1] !== implemented[0][1]))) return;
    if (!isNew && (implemented.length || !seg.includes('（小事業評価）'))) return;
    const fy = isNew ? reiwa(implemented[0][1]) : reiwa(h[1]);
    // 事業名は公開済みレコードと同じ取り方（小事業名の直後の行、なければ「（令和N年度実施事業）」の直後の行）。
    let nameAt = -1, name = '';
    const first = /^小事業名\n\n([^\n]+)\n/.exec(seg.slice(h[0].length - '小事業名\n'.length));
    if (first && !NOT_NAME.test(first[1].trim())) { name = first[1].trim(); nameAt = start + h[0].length + 1; }
    else if (implemented.length) {
      const m = /（令和 ?\d+年度実施事業）\n\n([^\n]+)\n/.exec(seg);
      if (m && !NOT_NAME.test(m[1].trim())) { name = m[1].trim(); nameAt = start + m.index! + m[0].indexOf('\n\n') + 2; }
    }
    if (!name) return;
    const one = (re: RegExp) => { const ms = [...seg.matchAll(re)]; return ms.length === 1 ? ms[0] : null; };
    // 目的: 「目的・概要」欄の【目的】から次の見出し（【概要】【内容】等）まで。見出しで終わらないものは採らない。
    const pm = one(PURPOSE);
    let purpose = null;
    if (pm) {
      const b = block(text, start + pm.index! + pm[0].length, STOP_PURPOSE, WRAP);
      const after = b && text.slice(b.at + b.raw.length + 1, b.at + b.raw.length + 40);
      if (b && after && /^[【［〔][^】］〕\n]*(概要|内容)[】］〕]\n/.test(after)) purpose = b;
    }
    const am = one(/\n取組内容・実績\n/g), om = one(/\n指標の達成状況\n/g);
    const activities = am ? block(text, start + am.index! + am[0].length, STOP, WRAP) : null;
    const outcomes = om ? block(text, start + om.index! + om[0].length, STOP, WRAP) : null;
    if (!purpose && !activities && !outcomes) return;
    const headRaw = isNew ? h[0].trimEnd() : h[0].slice(0, h[0].indexOf('\n'));
    const p = project(input, `narrative-${start}`, name, isNew ? reiwa(h[1]) : null, headRaw, start);
    p.id = stableId(input, `narrative-${start}`, p.evaluationYear);
    p.projectCode = null;
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, name, nameAt));
    if (isNew) p.evidence.push(evidence(input, implemented[0][0], start + implemented[0].index!));
    if (purpose) { p.purpose = purpose.value; p.evidence.push(blockEvidence(input, purpose)); }
    if (activities) { p.activities = activities.value; p.evidence.push(blockEvidence(input, activities)); }
    if (outcomes) { p.outcomes = outcomes.value; p.evidence.push(blockEvidence(input, outcomes)); }
    p.warnings.push('品川区 全庁版評価シートの文章欄から、目的（「目的・概要」の【目的】）、事業内容（「取組内容・実績」）、成果（「指標の達成状況」）を原文のまま収録。'
      + '空行・隣の欄の見出し・表の数値が現れた所で打ち切り、PDFの折り返しの改行だけを除いた。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '品川区 全庁版の事務事業評価シート（令和7・6年度）・行政評価シート（令和4年度）の文章欄: 目的（【目的】）、取組内容・実績、指標の達成状況。部局別PDF（再掲）は対象外。',
};
