import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 遊佐町（第２期遊佐町総合戦略 事業チェックシート 令和6年度事業）
// 公開済みレコードは同じ事業チェックシート（内部評価・外部評価の2資料）の事業名・指標から作られ、文章の欄は未収録だった。
// 目的: 「事業目的」の見出しの直後の1段落。次の段落が「事業概要」の見出しか、担当課係・事業区分の欄（〜課／〜係／継続・新規など）
//   である場合だけ採る（段組みの都合で事業概要の本文が先に来る票があるため、それ以外の並びは採らない）。
// 事業内容: 空行の後に単独で置かれた「事業概要」の見出しの直後の1段落の次が「指標項目」の見出しである票だけ、その段落を事業内容とする。
// 事業成果を上げるための工夫・改善点は成果の欄ではないため収録しない。
const SOURCES = /\/archive_0000002951_00\/20250331_(naibu|gaibu)hyouka\.pdf$/;
const HEAD = /遊佐町総合戦略 事業チェックシート\n令和6年度事業\n/g;
const NAME = /\n(事業名\n\n事業[①-⑳] ([^\n]+))\n\n(?:事業区分\n\n)?事業目的\n\n((?:[^\n]+\n)*?[^\n]+)\n\n((?:[^\n]+\n)*?[^\n]+)\n\n/;
const SIDE = /^(?:[^\n]*(?:課|係)|継続|新規|拡充|縮小|廃止)$/;
const OVERVIEW = /\n\n事業概要\n\n((?:[^\n]+\n)*?[^\n]+)\n\n指標項目\n/;

const join = (s: string) => {
  const lines = s.split('\n'), width = Math.max(...lines.map(l => l.length));
  return lines.reduce((acc, l, i) => acc + (i === 0 ? '' : lines[i - 1].length >= width - 3 && !/^[・※○〇①-⑳⇒]/.test(l) ? '' : '\n') + l, '');
};

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '06461' || !SOURCES.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const start = h.index!, seg = t.slice(start, heads[k + 1]?.index ?? t.length), m = NAME.exec(seg);
    if (!m) return;
    const purposeRaw = m[3], next = m[4];
    if (purposeRaw.split('\n').some(l => SIDE.test(l) || l === '事業概要') || !(next === '事業概要' || next.split('\n').every(l => SIDE.test(l)))) return;
    const name = m[2].trim();
    const p = project(input, `${name}|narrative`, name, null, m[1], start + m.index! + 1);
    p.evaluatedFiscalYear = 2024;
    p.purpose = join(purposeRaw);
    p.evidence.push(evidence(input, purposeRaw, start + m.index! + m[0].length - 2 - next.length - 2 - purposeRaw.length));
    const o = OVERVIEW.exec(seg);
    if (o && !o[1].split('\n').some(l => SIDE.test(l) || /^(事業目的|事業区分|担当課係)$/.test(l))) {
      p.activities = join(o[1]);
      p.evidence.push(evidence(input, o[1], start + o.index! + '\n\n事業概要\n\n'.length));
    }
    p.warnings.push('遊佐町総合戦略 事業チェックシート（令和6年度事業）の「事業目的」を目的に、「事業概要」を事業内容に収録（折り返しの改行は除去）。'
      + '欄の並びが崩れて本文と見出しの対応が確定しない票は収録しない。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '遊佐町 第２期遊佐町総合戦略 事業チェックシート（令和6年度事業、内部評価・外部評価）: 「事業目的」「事業概要」の文章（欄の並びが確定するものだけ）。',
};
