import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m17-util';

// ---------------------------------------------------------------- 高鍋町（総合計画施策別実施計画及び事務事業評価表 平成26年度）
// 公開済みレコードは同じ評価表から作られ、事業の内容はあるが成果が空。「主要な成果」欄は縦書きの見出しの文字（主・要・な・成・果）が
// 欄の行頭に1字ずつ付いて、総合計画の縦書きの見出し（「…計画（／後／期）」）の直後から予算科目の行（「款 」）の手前まで出力される。
// 見出しの5字が順にすべて行頭にある場合に限り、その文字を除いた行を成果とする。シートに目的の欄はない。
const SHEET = /^評価表 高鍋町総合計画施策別実施計画及び事務事業評価表\n◎事務事業の概要 事務事業番号 \d+ 記入対象年度 (\d+) [^\n]*\n事務事業名 ([^\n]+)\n担当課\(局\)･係 (.+?) 記入者 /gm;
const FIELD = /\n画（\n後\n期）( [^\n]+)?\n((?:(?!款 )[^\n]*\n)+?)款 /;
const LABELS = ['主', '要', 'な', '成', '果'];

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '45401' || !/\/group\/4\/160210173522201603111439380f\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, sheets = [...t.matchAll(SHEET)], out: ProjectEvaluation[] = [];
  sheets.forEach((s, i) => {
    if (input.truncated && i === sheets.length - 1) return;
    if (s[1] !== '26') return;
    const start = s.index!, seg = t.slice(start, sheets[i + 1]?.index ?? t.length), f = FIELD.exec(seg);
    if (!f) return;
    const lines = [...(f[1] ? [f[1].slice(1)] : []), ...f[2].slice(0, -1).split('\n')];
    let k = 0;
    const body = lines.map(l => {
      if (k < LABELS.length && (l === LABELS[k] || l.startsWith(LABELS[k] + ' '))) return l.slice(LABELS[k++].length).trim();
      return l;
    }).filter(Boolean);
    if (k !== LABELS.length || !body.length || body.some(l => LABELS.includes(l))) return;
    const p = project(input, `H26:${s[2]}:narrative`, s[2].trim(), null, s[0].slice(0, s[0].indexOf('\n担当課')), start);
    p.evaluatedFiscalYear = 2014;
    p.department = s[3];
    p.outcomes = unwrap(body.join('\n'));
    const raw = (f[1] ? '期）' + f[1] + '\n' : '') + f[2].slice(0, -1);
    p.evidence.push(evidence(input, raw, start + f.index! + f[0].indexOf(f[1] ? '期）' + f[1] : f[2])));
    p.warnings.push('高鍋町 事務事業評価表の「主要な成果」欄。縦書きの見出しの文字（主・要・な・成・果）を行頭から除き、欄の幅での折り返しだけをつないだ。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '高鍋町 総合計画施策別実施計画及び事務事業評価表（平成26年度）: 主要な成果（成果）。目的の欄はなく、事業の内容は公開済み。',
};
