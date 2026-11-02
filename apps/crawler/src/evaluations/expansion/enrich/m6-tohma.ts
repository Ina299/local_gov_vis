import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m6-util';

// ---------------------------------------------------------------- 当麻町（令和3年度 教育委員会の点検・評価 点検評価表）
// 公開済みレコード（令和3年度の事務・事業点検・評価）の点検評価表の「事業目的又は内容」欄。欄の左の縦書きのラベル
// 「事業目的又は内容」が1字ずつ行頭（「事 」など）か単独の行で並ぶ。財源内訳の「一般財源」（とその金額の行）の後から
// ラベルの最後の字「容」までを欄とし、ラベルの8字がこの順に1回ずつ現れ、ラベルが単独の行になってから後は
// ラベルの行だけが続く（事業実績など他の欄の行が挟まらない）票に限る。単独のラベルの行の直前の空行は許す。
// 様式の見出しが「事業目的又は内容」のため目的とする（事業内容の文を含むことがある）。
const HEAD = /\n担当部署\n/g;
const LABEL = [...'事業目的又は内容'];
const BODY = /\n一般財源\n(?:[\d,]+ 円\n)?((?:[^\n]*\n)+?)容\n/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01454' || !input.sourceUrl.endsWith('/kyoiku/pdf/tennkenhyouka.pdf') || !input.text.startsWith('令和３年度\n当麻町教育委員会の権限に属する事務の管理')) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].index! + 1, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const name = /\n事業名\n\n([^\n]+)\n\n決算科目\n/.exec(seg), m = BODY.exec(seg);
    if (!name || !m || seg.split('\n一般財源\n').length !== 2) continue;
    const content: string[] = [];
    // 空行は単独のラベルの直前だけ許す（内容の途中の空行の後は別の欄の行が混ざったおそれがある）。
    let k = 0, labelsOnly = false, blank = false, ok = true;
    for (const l of [...m[1].split('\n').slice(0, -1), '容']) {
      if (l === LABEL[k]) { labelsOnly = true; k++; continue; }
      if (labelsOnly || k >= LABEL.length || (blank && l)) { ok = false; break; }
      if (!l) { blank = true; continue; }
      if (l.startsWith(LABEL[k] + ' ')) { content.push(l.slice(LABEL[k].length + 1)); k++; } else content.push(l);
    }
    if (!ok || k !== LABEL.length || !content.length) continue;
    if (content.some(l => /^[\d,]+ ?円$|^(地方債|その他)$/.test(l))) continue;
    const p = project(input, `${name[1]}:narrative`, name[1], null, name[0].slice(1, -1), start + name.index! + 1);
    p.evaluatedFiscalYear = 2021;
    p.purpose = unwrap(content.join('\n'), 36);
    p.evidence.push(evidence(input, m[0].slice(1, -1), start + m.index! + 1));
    p.warnings.push('令和3年度 教育委員会の点検評価表の「事業目的又は内容」欄（目的として収録。事業内容の文を含むことがある）。縦書きのラベルの字を除き、欄の幅いっぱいで折り返した改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '当麻町 令和3年度 教育委員会 点検評価表: 事業目的又は内容（目的）。ラベルの行の間に他の欄の行が挟まらない票のみ。',
};
