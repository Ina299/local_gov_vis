import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 蔵王町（地方創生先行型交付金 事業実施結果報告。年度の記載なし）
// 公開済みレコード（年度なし）は同じ表の「① No 交付対象事業の名称」の行の事業。表の先頭（「単位：千円」の後、最初の事業費の
// 数値の段落の前）では No 1〜6 の事業名と「事業概要」の列が「N 事業名」の段落と次の段落（または同じ行の空白の後）として
// 順に並ぶ。ここではこの並びが No 1 から連番で確かめられる事業に限り、事業概要を事業内容（activities）として足す（欄の幅で
// 折り返した行はつなぐ）。No 7 以降は事業概要の列が KPI・評価の列と混ざって並ぶため採らない。目的・成果の列はない。
const SOURCE = 'https://town.zao.miyagi.jp/kurashi_guide/shisaku_machi/shisaku_machi/machihitoshigoto/sogo_senryaku.files/kensyou.pdf';

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '04301' || input.sourceUrl !== SOURCE) return [];
  const t = input.text, from = t.indexOf('\n単位：千円\n');
  if (from < 0) return [];
  const paras: { text: string; at: number }[] = [];
  for (let at = from + '\n単位：千円\n'.length; at < t.length;) {
    const end = t.indexOf('\n\n', at), text = t.slice(at, end < 0 ? t.length : end);
    // 最初の事業費（数値だけの段落）で表の先頭の並びが終わる。
    if (/^[\d,]+$/.test(text)) break;
    paras.push({ text, at });
    if (end < 0) break;
    at = end + 2;
  }
  const out: ProjectEvaluation[] = [];
  for (let i = 0, no = 1; i < paras.length; i++, no++) {
    const row = /^(\d+) (\S+)(?: ([^\n]+))?$/.exec(paras[i].text);
    if (!row || Number(row[1]) !== no) break;
    let raw: string, at: number;
    if (row[3]) { raw = row[3]; at = paras[i].at + row[0].length - row[3].length; }
    else {
      const next = paras[i + 1];
      if (!next || /^\d+ /.test(next.text)) break;
      raw = next.text; at = next.at; i++;
    }
    const p = project(input, `No${no}:activities`, row[2], null, `${row[1]} ${row[2]}`, paras[i - (row[3] ? 0 : 1)].at);
    p.activities = raw.replaceAll('\n', '');
    p.evidence.push(evidence(input, raw, at));
    p.warnings.push('蔵王町 地方創生先行型交付金 事業実施結果報告の「事業概要」列（欄の幅での折り返しをつないだ）。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '蔵王町 地方創生先行型交付金 事業実施結果報告: 表の先頭で事業名と並ぶ No 1〜6 の「事業概要」列（事業内容）。KPI・評価の列と混ざる No 7 以降は対象外。',
};
