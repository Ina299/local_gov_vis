/**
 * 11232 久喜市: 令和5年度 事務事業評価シート（令和4年度実施事業）。公開済みレコード（同じシート）の空欄の
 * 目的（「事務事業本来の目的・成果」欄）と事業内容（「令和４年度 事務事業実施内容」欄）を補う。
 * どちらの欄も見出しが2〜3行に分かれ、欄の文の行頭（または単独の行）に挟まって出力される。見出しの断片が決まった順に
 * ちょうど1回ずつ現れる場合だけ、断片を除いた行をつないで欄の文とする（根拠には見出しの断片を含む元の範囲を記録）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';

const SHEET = /^令和５年度 事務事業評価シート\n/gm;

/** 欄の範囲の行から見出しの断片（tokens の順に1回ずつ、行頭）を除いてつなぐ。断片の並びが合わなければ null。 */
function field(lines: string[], tokens: string[]): string | null {
  const parts: { text: string; raw: string }[] = [];
  let k = 0;
  for (const line of lines) {
    const tok = tokens.find(t => line === t || line.startsWith(`${t} `));
    if (tok) {
      if (tok !== tokens[k]) return null;
      k++;
      const rest = line.slice(tok.length).trim();
      if (rest) parts.push({ text: rest, raw: line });
    } else if (line.trim()) parts.push({ text: line.trim(), raw: line });
    else return null;
  }
  if (k !== tokens.length || !parts.length) return null;
  // 欄の幅いっぱいの行（見出しの断片を含む元の行の長さで判定）の後の改行は折り返しとして除く。
  const width = Math.max(...parts.map(p => p.raw.length));
  const value = parts.reduce((acc, p, i) => acc + (i === 0 ? '' : parts[i - 1].raw.length >= width - 4 && !/。$/.test(parts[i - 1].text) && !/^[・①-⑳〇○●◆■※【]/.test(p.text) ? '' : '\n') + p.text, '');
  return value.replace(/\s/g, '').length >= 4 ? value : null;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11232' || input.sourceId !== '9a1ae2fca89400f94992fd98') return [];
  const text = input.text, out: ProjectEvaluation[] = [];
  const heads = [...text.matchAll(SHEET)];
  heads.forEach((h, i) => {
    if (input.truncated && i === heads.length - 1) return;
    const s = h.index!, raw = text.slice(s, heads[i + 1]?.index ?? text.length);
    // 事業名・所管は公開済みレコードと同じ取り方（expansion/kuki.ts）。
    const identity = /^事務事業名 (.+?) 事務事業整理番号 (\d+)$/m.exec(raw);
    if (!identity || !raw.includes('１．事務事業概要 対象 令和４年度実施事業')) return;
    const pm = /\n(後期基本計画成果指標との関連 [^\n]*\n)((?:[^\n]*\n)+?)所管部課 /.exec(raw);
    const am = /\n２．事務事業の実施結果\n((?:[^\n]*\n)+?)令和３年度 令和４年度 令和５年度\n/.exec(raw);
    const pRaw = pm?.[2].slice(0, -1), aRaw = am?.[1].slice(0, -1);
    const purpose = pRaw ? field(pRaw.split('\n'), ['事務事業本来', 'の目的・成果']) : null;
    const activities = aRaw ? field(aRaw.split('\n'), ['令和４年度', '事務事業', '実施内容']) : null;
    if (!purpose && !activities) return;
    const p = project(input, `narrative-${identity[2]}`, identity[1], 2023, identity[0], s + identity.index!);
    p.id = stableId(input, `narrative-${identity[2]}`, 2023);
    p.projectCode = identity[2];
    p.evaluatedFiscalYear = 2022;
    p.department = /^所管部課 (.+?) 関係部課(?: |$)/m.exec(raw)?.[1] ?? null;
    if (purpose) { p.purpose = purpose; p.evidence.push(evidence(input, pRaw!, s + pm!.index! + 1 + pm![1].length)); }
    if (activities) { p.activities = activities; p.evidence.push(evidence(input, aRaw!, s + am!.index! + '\n２．事務事業の実施結果\n'.length)); }
    p.warnings.push('久喜市 令和5年度事務事業評価シートから、目的（「事務事業本来の目的・成果」欄）と事業内容（「令和４年度 事務事業実施内容」欄）を収録。'
      + '欄の見出しの断片が文の行頭に挟まって出力されるため、断片だけを除き、欄の幅で折り返した改行を除いてつないだ（根拠は断片を含む元の範囲）。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '久喜市 令和5年度 事務事業評価シート（令和4年度実施事業）の「事務事業本来の目的・成果」「事務事業実施内容」。実施結果一覧（PDF）は目的の列がない。',
};
