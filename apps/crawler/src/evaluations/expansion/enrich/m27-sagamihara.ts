import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m17-util';

// ---------------------------------------------------------------- 相模原市（平成27年度 事務事業評価シート）
// 公開済みレコードは平成27年度 事務事業評価の概要（h27_hyouka.pdf）の「NO 事業名 １次評価 ２次評価」の表の行（evaluationYear 2015）。
// 同じ年度の事務事業評価シート（h27_sheet.pdf）は事業番号が表の NO と同じで、「事業目的」欄の直後から「根拠法令等」の手前までが
// 空行を含まない1段のシートだけ、その段を目的とする（事業概要の文が事業目的の見出しの後に回り込むシートは空行を挟むため採らない）。
// 事業名は概要の表の名称を使い、シートの所管課の欄の事業名と（中黒・空白を除いて）一致する場合のみ。事業概要の欄は見出しの前後に
// 本文が分かれて出力されるシートがあるため採らない。
const SHEET = /^平成２７年度 事務事業評価シート\n１ 事業の概要等\n事業番号\n事業名\n\n(?:事業概要\n\n)?(\d)\n\n所管局\n/gm;
const LIST = /^([１-９]) (\S+(?: \S+)*?) (現状を継続|見直し) (現状を継続|見直し)$/gm;
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
const norm = (s: string) => s.replace(/[・\s]/g, '');

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '14150' || !/\/001\/004\/263\/h27_sheet\.pdf$/.test(input.sourceUrl)) return [];
  const list = inputs.find(i => /\/001\/004\/263\/h27_hyouka\.pdf$/.test(i.sourceUrl));
  if (!list || !list.text.includes('\nNO 事業名 １次評価 ２次評価\n')) return [];
  const names = new Map<string, string>();
  for (const m of list.text.matchAll(LIST)) names.set(ascii(m[1]), m[2]);
  const t = input.text, heads = [...t.matchAll(SHEET)], out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    if (input.truncated && i === heads.length - 1) return;
    const start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length), name = names.get(h[1]);
    if (!name) return;
    // シートの事業名（所管局の欄から事業概要・事業目的の欄の手前まで）に概要の表の事業名があること。
    const rest = seg.slice(h[0].length), head = rest.slice(0, rest.search(/\n事業(概要|目的)\n/));
    if (!norm(head).includes(norm(name))) return;
    const m = /\n事業目的\n\n((?:[^\n]+\n)+)\n根拠法令等\n/.exec(seg);
    if (!m) return;
    const raw = m[1].slice(0, -1);
    if (/^【|根拠法令|計画等への位置付/.test(raw)) return;
    const p = project(input, `H27:${h[1]}:narrative`, name, 2015, h[0].trimEnd(), start);
    p.projectCode = h[1];
    p.purpose = unwrap(raw);
    p.evidence.push(evidence(list, `${[...list.text.matchAll(LIST)].find(x => ascii(x[1]) === h[1])![0]}`),
      evidence(input, raw, start + m.index! + '\n事業目的\n\n'.length));
    p.warnings.push('相模原市 平成27年度 事務事業評価シートの「事業目的」欄（根拠法令等の欄までが1段のシートのみ）を目的として収録。'
      + '事業名は同じ年度の事務事業評価の概要の表（事業番号＝NO）の名称。欄の幅での折り返しだけをつないだ。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '相模原市 平成27年度 事務事業評価シート: 事業目的（目的）。事業名は事務事業評価の概要の表から事業番号で対応付け。',
};
