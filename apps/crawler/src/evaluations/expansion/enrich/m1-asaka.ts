import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 朝霞市（事務事業評価シート（対象：R7年度実施事務事業））
// 公開済みレコードは同じシートの事業名・課名・人件費・総コストから作られ、文章の欄は未収録だった。
// 目的: 「2 事業概要・実施結果」の「目指す目的成果」欄。抽出テキストでは見出しの後に総合計画コード（数字の段落）、
//   目的の段落、事業類型の縦書きラベル（事／業／類）の順に並ぶ。コードの段落と目的の段落のちょうど2段落のときだけ採る。
// 事業内容: 「事 業 内 容」欄。見出しの直後（実施形態の縦書きラベルの断片「態」か継続区分「【 継続 】」の1行を挟むことがある）の
//   1段落で、その後に事業類型・実施形態の選択肢（ソフト事業／委託等など）が続くもの。
// 実施状況の説明は、選択肢やラベルとの並びがシートごとに崩れるため未収録。
const SHEETS = new Set(['55a2e24904aca55f509d8226', '6b3d0da78afc8f95f0eb8744', '75fc28a0179e98da19d37f4e', '88b2cdebcd7dc33cc82cdedb', '962d5f4499bc37134e63c695', 'ec3ea71e361e56ed697705f9']);
const HEAD = /事務事業評価シート（対象：R7年度実施事務事業）\n\n([^\n]+)\n部名\/課名\/係名\n\n([^\n]+)\n\n／ ([^\n]+)\n/g;
const PURPOSE = /\n目指す目的成果\n\n([\d・,，、/／\s]+?)\n\n((?:[^\n]+\n)*?[^\n]+)\n\n事\n\n業\n\n類\n/;
const CONTENT = /\n事 業 内 容\n\n(?:(?:態|【 ?[^】\n]+ ?】)\n\n)?((?:[^\n]+\n)*?[^\n]+)\n\n(?=ソフト事業|ハード事業|委託等|実\n|【)/;
const NOISE = /事 業 内 容|目指す目的成果|部名\/課名|総合計画コード|^(?:事|業|類|型|実|施|形|態|ソフト事業|ハード事業|委託等|連携・協働|補助・助成)$/m;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11227' || !SHEETS.has(input.sourceId)) return [];
  const text = input.text, heads = [...text.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  heads.forEach((m, k) => {
    if (input.truncated && k === heads.length - 1) return;
    const start = m.index!, seg = text.slice(start, heads[k + 1]?.index ?? text.length);
    const name = m[1].trim(), dept = m[3].split(' ／ ')[0].trim();
    const pm = PURPOSE.exec(seg), cm = CONTENT.exec(seg);
    const purpose = pm && !NOISE.test(pm[2]) ? { raw: pm[2], at: pm.index! + '\n目指す目的成果\n\n'.length + pm[1].length + 2 } : null;
    const content = cm && !NOISE.test(cm[1]) ? { raw: cm[1], at: cm.index! + cm[0].length - 2 - cm[1].length } : null;
    if (!purpose && !content) return;
    const p = project(input, `${name}|narrative`, name, null, m[0], start);
    p.projectCode = null;
    p.department = dept;
    p.evaluatedFiscalYear = 2025;
    if (purpose) { p.purpose = unwrap(purpose.raw); p.evidence.push(evidence(input, purpose.raw, start + purpose.at)); }
    if (content) { p.activities = unwrap(content.raw); p.evidence.push(evidence(input, content.raw, start + content.at)); }
    p.warnings.push('朝霞市事務事業評価シート（対象：R7年度実施事務事業）の「目指す目的成果」を目的に、「事業内容」を事業内容に収録（折り返しの改行は除去）。'
      + '欄の前後の並びが崩れたシートは収録しない。実施状況の説明は未収録。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '朝霞市 事務事業評価シート（対象：R7年度実施事務事業）の「目指す目的成果」「事業内容」の文章（欄の並びが崩れていないものだけ）。',
};
