import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { joinWrapped } from './m10-util';

// ---------------------------------------------------------------- つるぎ町（令和5年度 教育委員会の事務事業評価）
// 公開済みレコードは同じ報告書の「事業名：…」（または「：…」）ごとの事業（評価年度2023）。各事業の表は「目的」「目標」「状況」「成果」の欄だが、
// 抽出テキストでは多くの事業で見出しが先にまとめて並び、内容がその後に続くため欄の境が決まらない。
// ここでは「目的」の見出しの直後（空行の後）に内容が来て、続いて「目標」の見出しとその内容が来る事業（行ごとに欄が並んでいる事業）に限り、
// 目的の欄を足す。欄の見出し語が内容に混ざるものは採らない。同じ報告書に同名の事業が2回出る場合も採らない。
const ID = '0f1e215e7bcbb33b4fa373df';
const LABEL = /^(目的|事業の目的|目標|状況|成果|事業の成果|補助対象事|業及び財源|自己評価|総合点)$/m;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '36468' || input.sourceId !== ID || !/^令和５年度事務事業評価$/m.test(input.text)) return [];
  const t = input.text, names = [...t.matchAll(/^(?:事業名)?\s*：(.+)$/gm)];
  const count = new Map<string, number>();
  for (const n of names) count.set(n[1].trim(), (count.get(n[1].trim()) ?? 0) + 1);
  const out: ProjectEvaluation[] = [];
  names.forEach((n, i) => {
    const name = n[1].trim(), start = n.index! + n[0].length, seg = t.slice(start, names[i + 1]?.index ?? t.length);
    if (count.get(name) !== 1 || (input.truncated && i === names.length - 1)) return;
    const m = /\n目的\n\n((?:[^\n]+\n)+)\n目標\n\n([^\n]+)\n/.exec(seg);
    if (!m || LABEL.test(m[1]) || LABEL.test(m[2])) return;
    const raw = m[1].slice(0, -1);
    const p = project(input, `${name}:purpose`, name, 2023, n[0], n.index!);
    p.purpose = joinWrapped(raw, 30);
    p.evidence.push(evidence(input, raw, start + m.index! + '\n目的\n\n'.length));
    p.warnings.push('令和5年度事務事業評価の「目的」欄（欄の幅での折り返しだけを除いてつないだ）。見出しの後に内容が続き、次に「目標」の見出しと内容が並ぶ事業に限る。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: 'つるぎ町 令和5年度 教育委員会 事務事業評価: 目的欄（見出しと内容が行ごとに並ぶ事業のみ）。見出しがまとめて並び内容が後に続く事業は欄の境が決まらないため対象外。',
};
