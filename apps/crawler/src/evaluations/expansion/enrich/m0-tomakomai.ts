/** 苫小牧市 (01213): 事務事業評価（主要事業レビュー）シートの「事業の目的」欄。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// 公開済みレコードは同じシートの見出し（事業名・担当部署・事務事業番号、評価対象年度は予算・決算表の決算列の年度）。
// 「事業の目的」の欄名は欄の縦方向の中央に1行で印字され、抽出テキストでは本文の行の間に挟まる（事業費計(A+B)の行の後、「事業の内容」の欄の手前）。
// 欄名がちょうど1回、その前後に本文の行が1行以上あり、最後の行が句点で終わるシートだけを採り、欄名の行だけを除いて改行でつなぐ。
// 欄名が本文の前後にずれて出るシート（欄名が事業費計の行より前など）は、どこまでが目的か確定しないため採らない。
// 事業の内容の欄は「SDGs17の目標」の欄名などが本文の行に混ざるため採らない。
const SHEET = '事務事業評価（主要事業レビュー）\n';
const HEAD = /^款 [^\n]* 事務事業番号 (\d{8})\n事業名 (.+?) 担当部署 ([^\n]+)\n/;
const FY = /区 分 R(\d+)年度予算 R(\d+)年度決算 /;
const BLOCK = /\n事業費計\(A\+B\)[^\n]*\n((?:(?!事業の内容)[^\n]+\n){2,8}?)事業の内容[ \n]/;
const FOREIGN = /^(?:事業の目的|事業の内容|SDGs|根拠法令|担当部署|有効性|公平性|効率性|[A-D]|[（）()]|千|円|訳)/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01213' || !input.sourceUrl.includes('/files/00067300/00067340/')) return [];
  const t = input.text, starts: number[] = [];
  for (let i = t.indexOf(SHEET); i >= 0; i = t.indexOf(SHEET, i + 1)) starts.push(i + SHEET.length);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    if (input.truncated && k === starts.length - 1) return;
    const sheet = t.slice(s, starts[k + 1] ?? t.length);
    const h = HEAD.exec(sheet), fy = FY.exec(sheet), b = BLOCK.exec(sheet);
    if (!h || !fy || fy[1] !== fy[2] || !b) return;
    const lines = b[1].split('\n').slice(0, -1), at = lines.indexOf('事業の目的');
    if (at < 1 || at === lines.length - 1 || lines.filter(l => l === '事業の目的').length !== 1) return;
    const body = lines.filter((_, i) => i !== at);
    if (body.some(l => FOREIGN.test(l)) || !body.at(-1)!.endsWith('。') || body[0].length < 20) return;
    const name = h[2].trim();
    const p = project(input, `補強:${h[1]}`, name, null, h[0].slice(0, -1), s);
    p.projectCode = h[1];
    p.department = h[3].trim();
    p.evaluatedFiscalYear = 2018 + Number(fy[2]);
    p.evidence.push(evidence(input, fy[0], s + fy.index));
    p.purpose = body.join('\n');
    p.evidence.push(evidence(input, b[1].slice(0, -1), s + b.index + b[0].indexOf(b[1])));
    p.warnings.push('事務事業評価（主要事業レビュー）の「事業の目的」欄。欄名が本文の行の間に1行で挟まるため、その行だけを除いてつないだ（出典は欄名を含む原文）。欄名の位置が本文とずれるシートは対象外。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '苫小牧市 事務事業評価（主要事業レビュー）から、事業の目的の欄（欄名が本文の行の間に挟まるシートのみ）。事業の内容は他の欄名が混ざるため対象外。',
};
