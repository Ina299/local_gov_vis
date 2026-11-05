import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 勝浦市（R6事業 実施計画事業調書・事業評価書）
// 公開済みレコード（年度なし）は同じPDFの調書の事業番号・事業名・所管課から作られている。調書には「目的」欄がなく、
// 「全体事業内容」（実施計画の記述、「〜します。」の文体）と「事業概要」（詳細）の2欄が左右に並ぶ。抽出テキストでは
// 両欄の行が交互に混ざることがあるため、全体事業内容の文が混ざらずに取り出せる次の形に限って事業内容（activities）に入れる。
//  - 「全体事業内容」と「事業概要」のラベルの間にある段落（ラベルの下に本文がある形）
//  - ラベルが続けて並び、本文の最初の1行（または全幅で折り返した2行）が「ます。」で終わる
//  - ラベルが続けて並び、本文の最後の段落（空行の後）が「ます。」で終わる1行
// どの形でも空白（他の欄の行が同じ行に連結された印）を含むもの、2行のうち2行目以降に別の「ます。」行が残るものは採らない。
const HEAD = /■実施計画事業調書\n事業番号\n\n(\d+)\n\n事業名\n/g;
const NAME = /\n会計区分\n\n[^\n]+\n\n([^\n]+)\n\n再掲区分\n\n所管課\n\n(?:-\n\n)?([^\n]+)\n\n全体事業内容\n/;
const clean = (lines: string[]) => lines.every(l => !/[ 　]/.test(l)) && lines.join('').endsWith('ます。');

/** 全体事業内容の本文の位置（region 内のオフセット）と生テキスト。確定できなければ null。 */
function overall(region: string): { at: number; raw: string } | null {
  // region は「全体事業内容\n」から「\n■事業評価書」の直前まで。
  const between = /^全体事業内容\n\n([^]+?)\n\n事業概要\n/.exec(region);
  if (between) {
    const lines = between[1].split('\n');
    return lines.length <= 2 && clean(lines) && (lines.length === 1 || lines[0].length >= 60) ? { at: '全体事業内容\n\n'.length, raw: between[1] } : null;
  }
  const head = '全体事業内容\n\n事業概要\n\n';
  if (!region.startsWith(head)) return null;
  const body = region.slice(head.length).replace(/\n+$/, ''), paras = body.split('\n\n');
  if (paras.length === 1) {
    const lines = body.split('\n');
    if (clean(lines.slice(0, 1))) return { at: head.length, raw: lines[0] };
    if (lines.length >= 2 && lines[0].length >= 60 && clean(lines.slice(0, 2)) && !lines.slice(2).some(l => l.endsWith('ます。')))
      return { at: head.length, raw: lines.slice(0, 2).join('\n') };
    return null;
  }
  const last = paras[paras.length - 1];
  if (paras.length === 2 && !last.includes('\n') && clean([last]) && !paras[0].split('\n').some(l => l.endsWith('ます。')))
    return { at: head.length + body.length - last.length, raw: last };
  return null;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '12218' || input.sourceId !== '92d0644d2e0102a0c6841a37') return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const h = heads[i], start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const nm = NAME.exec(seg), b = seg.indexOf('\n■事業評価書\n');
    if (!nm || b < 0) continue;
    const a = nm.index! + nm[0].length - '全体事業内容\n'.length, found = overall(seg.slice(a, b));
    if (!found) continue;
    // The ID key differs from the published record (same source, same number), which this record enriches.
    const p = project(input, `${h[1]}:activities`, nm[1].trim(), null, seg.slice(0, nm.index! + nm[0].length).trimEnd(), start);
    p.projectCode = h[1];
    p.department = nm[2].trim();
    p.activities = found.raw.replace(/\n/g, '');
    p.evidence.push(evidence(input, found.raw, start + a + found.at));
    p.warnings.push('勝浦市 R6事業 実施計画事業調書の「全体事業内容」を事業内容として収録（折り返しの改行のみ除去）。調書に目的欄はない。'
      + '「事業概要」欄と行が混ざる調書（空白で連結された行、折り返しの間に他欄の行が入るもの）は採らない。');
    out.push(p);
  }
  // 再掲の調書は同じ事業名で再び現れる。本文が同じなら最初の1件だけ残し、異なれば対応が決まらないので両方採らない。
  const byKey = new Map<string, ProjectEvaluation[]>();
  for (const p of out) byKey.set(`${p.projectName}\n${p.department}`, [...(byKey.get(`${p.projectName}\n${p.department}`) ?? []), p]);
  return [...byKey.values()].flatMap(ps => ps.every(p => p.activities === ps[0].activities) ? [ps[0]] : []);
}

export const entry = {
  extract,
  scope: '勝浦市 R6事業 実施計画事業調書（公開済みレコードと同じPDF、年度なし）: 「全体事業内容」を事業内容として。他欄と行が混ざるものは対象外。目的欄はない。',
};
