import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { joinWrapped } from './m10-util';

// ---------------------------------------------------------------- 世田谷区（令和元年度 事務事業評価（平成30年度決算）評価票）
// 公開済みレコードは同じ評価票の事業（評価年度2019・事業年度2018）。評価票の「目的」欄の文は、抽出テキストでは事業名・所管課の行の後、
// 「目標」または「成果指標」の行の手前に来る（欄の見出し「目的」が文の前後や途中に1行で入ることがある）。
// ここでは「目標」「成果指標」の行から遡り、句点で終わる最後の行と、その前の欄の幅いっぱい（36字以上）の行だけを目的の文とする
// （途中の見出し「目的」の行だけを除く）。その前の行が別の文（句点で終わる行・幅いっぱいの行）なら欄の境が決まらないため採らない。
// 令和4年度の3年後再評価（評価票の形式が異なる）は対象外。
const ID = 'ef5df32a9a65d993cd068801';
const FULL = 36;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13112' || input.sourceId !== ID || !input.text.startsWith('令和元年度\n事務事業評価（平成30年度決算）評価票\n')) return [];
  const t = input.text, heads = [...t.matchAll(/^事務事業評価票\n/gm)], out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    if (input.truncated && i === heads.length - 1) return;
    const start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const name = /^\d+(?:[～、] ?\d+)? (.+)$/m.exec(seg.slice(0, 400));
    const stop = /\n(?:目標|成果指標)\n/.exec(seg);
    if (!name || !stop || stop.index < name.index!) return;
    const lines = seg.slice(0, stop.index + 1).split('\n');
    lines.pop();
    // 遡って文の行を集める。
    let k = lines.length - 1;
    while (k >= 0 && (!lines[k].trim() || lines[k] === '目的')) k--;
    if (k < 0 || !lines[k].endsWith('。')) return;
    const last = k;
    k--;
    while (k >= 0 && (lines[k] === '目的' || [...lines[k]].length >= FULL)) k--;
    const first = k + 1;
    let before = k;
    while (before >= 0 && !lines[before].trim()) before--;
    if (before < 0 || lines[before].endsWith('。') || [...lines[before]].length >= FULL || lines[first] === '目的') return;
    const block = lines.slice(first, last + 1), text = block.filter(l => l !== '目的');
    const raw = block.join('\n'), offset = start + lines.slice(0, first).reduce((n, l) => n + l.length + 1, 0);
    const projectName = name[1].trim();
    const p = project(input, `${projectName}:purpose`, projectName, 2019, name[0], start + name.index!);
    p.evaluatedFiscalYear = 2018;
    p.purpose = joinWrapped(text.join('\n'), FULL);
    p.evidence.push(evidence(input, raw, offset));
    p.warnings.push('事務事業評価票の「目的」欄（欄の見出し「目的」の行を除き、欄の幅での折り返しだけを除いてつないだ）。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '世田谷区 令和元年度 事務事業評価（平成30年度決算）評価票: 目的欄（文の前後の行で欄の境が決まる評価票のみ）。令和4年度の3年後再評価は対象外。',
};
