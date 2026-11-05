import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 浜松市（行政経営計画の平成28年度上半期進捗状況・HTML）
// 公開済みレコードは同じページの取組事項の表の【事業名】から作られ、評価年度・対象年度とも2016。
// 表の列は「取組番号・取組事項【事業名】・枝番・目的及び取組内容・実施部・実施課・…」で、抽出テキストでは1セル1行以上で並ぶ。
// 【事業名】の行の後から、実施部（〜部）・実施課（〜課）の2行の手前までを「目的及び取組内容」欄として目的に取る
// （枝番だけの数字行が先頭にあれば除く）。上半期進捗状況・成果と下半期への展開は行の境目が本文で決まらないため取らない。
// 同じ【事業名】が複数の取組事項にある事業（下水道事業など）は対応が決まらないため採らない。
const PAGE = 'https://www.city.hamamatsu.shizuoka.jp/houmu/gyoukei/h28kamihyoka.html';
const ROW = /\n(\d{4})\n[^\n【]*【([^】]+)】\n((?:[^\n]+\n)+?)([^\n]+部)\n([^\n]+課)\n/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '22130' || input.sourceUrl !== PAGE) return [];
  const t = input.text, all: ProjectEvaluation[] = [];
  for (const m of t.matchAll(ROW)) {
    const name = m[2].trim();
    let body = m[3].replace(/\n$/, ''), at = m.index! + m[0].indexOf(m[3]);
    const branch = /^\d+\n/.exec(body);
    if (branch) { body = body.slice(branch[0].length); at += branch[0].length; }
    if (!body.trim() || !/。|）$/.test(body)) continue;
    const head = m[0].slice(1, m[0].indexOf('\n', m[1].length + 2));
    const p = project(input, `narrative:${m[1]}`, name, 2016, head, m.index! + 1);
    p.projectCode = m[1];
    p.evaluatedFiscalYear = 2016;
    p.purpose = body;
    p.evidence.push(evidence(input, body, at));
    p.warnings.push('浜松市行政経営計画の平成28年度上半期進捗状況の取組事項の表の「目的及び取組内容」欄を目的として収録（目的と取組内容を合わせた欄）。');
    all.push(p);
  }
  return all.filter(p => all.filter(q => q.projectName === p.projectName).length === 1);
}

export const entry = {
  extract,
  scope: '浜松市 行政経営計画 平成28年度上半期進捗状況（HTML）: 取組事項の表の「目的及び取組内容」（目的）。同じ【事業名】が複数の取組にある事業は除く。',
};
