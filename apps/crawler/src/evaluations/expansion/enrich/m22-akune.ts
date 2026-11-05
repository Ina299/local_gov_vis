import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 阿久根市（電源立地地域対策交付金 事業評価個表 令和６年度）
// 公開済みレコードは同じ資料（dengen_r06kohyo.pdf）の事業評価個表から作られ、成果はあるが事業内容がない。
// 「補助金事業の概要」欄は見出しが欄の縦の中央にあり、抽出テキストでは欄の前半（文章）が見出しの前、後半（事業量・事業費）が
// 見出しの後に分かれる。前半は事業実施場所の値の行の直後から見出しまで、後半は見出しの後から次の欄「【主要政策・施策】」までとし、
// 前半が句点で終わる場合に前後をつないで事業内容とする（前半がなく、見出しの後に文章が続く個表は後半だけ）。
// 目的の欄はない。年度は個表の見出し（令和6年度）。繰越分（令和5，6年度（繰越））は公開済みレコードと同じく年度なし。
const SHEET = /Ⅱ．事業評価個表（([^）\n]+(?:）)?)）\n/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '46206' || !input.sourceUrl.endsWith('/dengen_r06kohyo.pdf')) return [];
  const t = input.text, out: ProjectEvaluation[] = [], heads = [...t.matchAll(SHEET)];
  heads.forEach((h, i) => {
    const from = h.index!, end = Math.min(...[heads[i + 1]?.index ?? t.length, t.indexOf('Ⅰ．事業評価総括表', from + 1)].filter(x => x >= 0));
    const seg = t.slice(from, end), name = /\n公共用施設に係る整備，維持補修又は維\n([^\n]+)\n持運営等措置\n/.exec(seg);
    const label = seg.indexOf('\n補助金事業の概要\n'), next = seg.indexOf('\n【主要政策・施策】\n', label);
    if (!name || label < 0 || seg.indexOf('\n補助金事業の概要\n', label + 1) >= 0 || next < 0) return;
    const year = /^令和(\d+)年度$/.exec(h[1]), fy = year ? 2018 + Number(year[1]) : null;
    if (!year && h[1] !== '令和5，6年度（繰越）') return;
    // 前半: 事業実施場所の値の行（1行）の後、見出しの直前まで。
    const place = /\n補助金事業者名又は間接補助金事業者名\n補助金事業実施場所\n\n阿久根市\n[^\n]+\n\n?/.exec(seg);
    // 見出しの直前は空行（前半の最後の行の改行と空行）。
    const pre = place && place.index! + place[0].length < label ? seg.slice(place.index! + place[0].length, label - 1) : null;
    if (pre !== null && (seg[label - 1] !== '\n' || pre.split('\n').some(l => !l.trim()) || !/。$/.test(pre))) return;
    const postAt = label + '\n補助金事業の概要\n'.length + (seg.slice(label + '\n補助金事業の概要\n'.length).match(/^\n*/)![0].length);
    const post = seg.slice(postAt, next);
    if (!post.trim() || /[：:]$/.test(post)) return;
    const parts = [...(pre ? [unwrap(pre)] : []), ...post.split(/\n\n+/).map(unwrap)];
    const p = project(input, `${name[1]}:activities`, name[1], fy, name[0].slice(1, -1), from + name.index! + 1);
    p.projectCode = null;
    p.evaluatedFiscalYear = fy;
    p.activities = parts.join('\n');
    if (pre) p.evidence.push(evidence(input, pre, from + place!.index! + place![0].length));
    p.evidence.push(evidence(input, post, from + postAt));
    p.warnings.push('阿久根市 電源立地地域対策交付金 事業評価個表の「補助金事業の概要」欄（見出しの前の文章と、見出しの後から【主要政策・施策】までの事業量・事業費等をつないだ）。欄の幅での折り返しは改行を除いた。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '阿久根市 電源立地地域対策交付金 事業評価個表（令和６年度・繰越分）: 補助金事業の概要欄（事業内容）。目的の欄はない。',
};
