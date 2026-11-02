import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 生駒市（令和6年度アクションプラン 事業評価シート）
// 公開済みレコードは同じ個票から作られ（成果は収録済み）、目的・概要が空欄。「２ 事業の概要・実施内容」の欄は、2行の見出し
// 「事 業 目 的 ・」「事業実施効果」と「事 業 概 要」「（ 全 体 計 画 ）」が欄の文の行頭に付くか、単独の行として文を挟む。
//  目的: 「２ 事業の概要・実施内容」の直後の見出し行から「事業実施効果」の見出し（単独の行または行頭）までの文。見出しより前に
//        文の行がない（表の見出しの直後に見出しがある）こと、文が句点で終わるか直後が「事 業 概 要」の行であることを確かめる。
//  概要: その後から「（ 全 体 計 画 ）」の単独の行（直後が「事 業 の 対 象」）までの文で、行頭に「事 業 概 要」が1回だけ付くもの。
// 行頭の見出しは除き、欄の幅での折り返しはつなぐ（箇条の記号で始まる行の前の改行は残す）。
const HEAD = /^令和([６７])年度アクションプラン 事業評価シート[^\n]*\n/gm;
const MARK = /^[・●○■◆▶①-⑳※]/;
const join = (ls: string[]) => ls.reduce((s, l, i) => s + (i && MARK.test(l) ? '\n' : '') + l, '');

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '29209' || input.format !== 'pdf') return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    if (input.truncated && k === heads.length - 1) return;
    const start = h.index!, raw = t.slice(start, heads[k + 1]?.index ?? t.length);
    const identity = /^事 業 名 No\. (\d+(?:-\d+)?) ([^\n]+)\n事 業 区 分/m.exec(raw);
    const at = raw.indexOf('\n２ 事業の概要・実施内容\n');
    if (!identity || at < 0) return;
    const body = at + '\n２ 事業の概要・実施内容\n'.length, ls = raw.slice(body).split('\n');
    if (!ls[0].startsWith('事 業 目 的 ・')) return;
    // 目的
    const parts: string[] = [];
    let i = 0;
    if (ls[0] === '事 業 目 的 ・') {
      for (i = 1; i < ls.length && ls[i] !== '事業実施効果'; i++) parts.push(ls[i]);
      if (i >= 6) return;
    } else {
      parts.push(ls[0].slice('事 業 目 的 ・ '.length));
      for (i = 1; i < 6 && !ls[i].startsWith('事 業 実 施 効 果 '); i++) parts.push(ls[i]);
      if (i >= 6) return;
      parts.push(ls[i].slice('事 業 実 施 効 果 '.length));
    }
    if (!parts.length || parts.some(p => !p.trim() || /^事 業/.test(p))) return;
    if (!parts.at(-1)!.endsWith('。') && !ls[i + 1]?.startsWith('事 業 概 要 ')) return;
    const name = identity[2].trim();
    const p = project(input, `${identity[1]}:${name}:narrative`, name, null, identity[0].slice(0, identity[0].indexOf('\n')), start + identity.index!);
    p.evaluatedFiscalYear = 2018 + Number(h[1].normalize('NFKC'));
    p.department = /担 当 課 (.+?) 関 係 課/.exec(raw)?.[1] ?? null;
    p.purpose = join(parts);
    p.evidence.push(evidence(input, ls.slice(0, i + 1).join('\n'), start + body));
    // 概要
    const end = ls.findIndex((l, j) => j > i && l === '（ 全 体 計 画 ）' && ls[j + 1]?.startsWith('事 業 の 対 象'));
    const block = end > i ? ls.slice(i + 1, end) : [];
    if (block.length && block.length <= 6 && block.filter(l => l.startsWith('事 業 概 要 ')).length === 1 && !block.some(l => /^事 業 (目 的|実 施)/.test(l))) {
      const lines = block.map(l => l.replace(/^事 業 概 要 /, ''));
      p.activities = join(lines);
      const from = start + body + ls.slice(0, i + 1).join('\n').length + 1;
      p.evidence.push(evidence(input, block.join('\n'), from));
    }
    p.warnings.push('アクションプラン事業評価シートの「事業目的・事業実施効果」「事業概要（全体計画）」欄。行頭に付いた欄の見出しを除き、欄の幅での折り返しをつないだ。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '生駒市 令和6年度アクションプラン 事業評価シート（基本的施策・経営的施策）: 事業目的・事業実施効果、事業概要（目的・事業内容）。',
};
