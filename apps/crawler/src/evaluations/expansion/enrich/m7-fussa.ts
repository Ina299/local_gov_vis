/**
 * 13218 福生市: 令和７年度行政評価 評価調書（令和６年度実施事業、r7tyousyo.pdf）。公開済みレコード（同年度の評価対象事業一覧）の空欄の
 * 事業内容に、調書の「事業概要」欄を補う。調書の見出し欄（部名・課名・予算科目など）は順序が崩れて出力されるが、事業名の行の直後に
 * 事業概要の本文が続く。事業名が一覧の事業名と完全に一致する行で、その直後の行が欄の幅いっぱいで折り返し、句点で終わる短い行で
 * 閉じる場合だけ採る（本文の途中に見出し「事業概要」が割り込む調書は採らない）。目的・成果の欄はない。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';

const SHEETS = 'f9fd10c2611d902da0bbc2a1', LIST = 'bf0a98bc9eebcddc6ffa3c8a';
const LIST_TITLE = '令和７年度行政評価対象事業（令和６年度実施事業）一覧';
/** 本文1行は全角45字前後。 */
const WIDTH = 42;

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '13218' || input.sourceId !== SHEETS || input.truncated) return [];
  const list = inputs.find(i => i.sourceId === LIST);
  if (!list || !list.text.startsWith(LIST_TITLE)) return [];
  const names = new Map<string, number>();
  for (const m of list.text.matchAll(/^\d+ \S+_\S+ \S+_\S+ (.+?) \S+長 [ＳＡＢＣＤ] /gm)) names.set(m[1], (names.get(m[1]) ?? 0) + 1);
  const t = input.text, starts = [...t.matchAll(/(?:^|\n)（１）実施計画決算\n/g)].map(m => m.index! + (m[0].startsWith('\n') ? 1 : 0));
  const out: ProjectEvaluation[] = [];
  starts.forEach((start, i) => {
    const end = starts[i + 1] ?? t.length, head = t.slice(start, end), stop = head.indexOf('支出済額');
    if (stop < 0 || !head.includes('令和６年度実績値')) return;
    const lines = head.slice(0, stop).split('\n');
    const hits = lines.map((l, k) => ({ l, k })).filter(x => names.get(x.l) === 1);
    if (hits.length !== 1) return;
    const k = hits[0].k, body: string[] = [];
    for (let j = k + 1; j < lines.length; j++) {
      const l = lines[j];
      if (!l.trim() || /事業概要/.test(l)) return;
      body.push(l);
      if (l.length < WIDTH) break;
    }
    if (!body.length || !body.at(-1)!.endsWith('。') || body.slice(0, -1).some(l => l.length < WIDTH)) return;
    const nameAt = start + lines.slice(0, k).reduce((n, l) => n + l.length + 1, 0), raw = body.join('\n'), at = nameAt + lines[k].length + 1;
    const p = project(input, `narrative-${start}`, lines[k], null, lines[k], nameAt);
    p.evaluatedFiscalYear = 2024;
    p.activities = body.join('');
    p.evidence.push(evidence(input, raw, at), evidence(list, LIST_TITLE, 0));
    p.warnings.push('福生市 令和７年度行政評価 評価調書（令和６年度実施事業）の「事業概要」欄を事業内容として収録。事業名が評価対象事業一覧と一致する行の直後の本文に限る。PDFの折り返しの改行を除いた。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '福生市 令和７年度行政評価 評価調書（令和６年度実施事業）の「事業概要」（事業名の行の直後に本文が続くもの）。担当課長の総括・評点は対象外。',
};
