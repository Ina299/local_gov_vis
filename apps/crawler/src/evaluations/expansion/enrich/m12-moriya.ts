/**
 * 08224 守谷市: 令和6年度 事務事業マネジメントシート（分野別PDF）。公開済みレコード（同じシートの事務事業名・担当課）の空欄の目的に
 * 「目的及び期待する効果（誰（何）をどうしたいのか）」の欄を補う。
 * この欄は左列にあり、右列の「内容（何の業務活動をどのような手法で行うか）」が並走していると抽出テキストで行が交互に出たり
 * 同じ行に並んだり（半角空白区切り）する。左右の列はほぼ同じ字数（30字前後）で折り返すため、次の条件をすべて満たすものだけ採る。
 * - 見出しの直前が空行（右列の本文が見出しより上で区切られている）で、見出しの直後から空行までの段落の次が「（参考）基本事業の目指す姿」。
 * - 半角空白を含む行がない。最後の行以外はすべて欄の幅いっぱい（28〜32字）で句点で終わらず、箇条の記号で始まる行がない。最後の行は句点で終わる。
 * 欄の中の改行は折り返しなので除いてつなぐ。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';

const HEAD = /(?:^|\n)([^\n]+)\n\n令和 6年度 事務事業マネジメントシート\n事業の基本情報\n事務事業名\n\n担当課 ([^\n]+)\n\n([^\n]+)\n/g;
const PURPOSE = '\n\n目的及び期待する効果（誰（何）をどうしたいのか）\n', NEXT = '（参考）基本事業の目指す姿';
const MARK = /^[・･※＊*①-⑳○●◎■□◆◇【［〔（(＜<]/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '08224' || input.format !== 'pdf') return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    if (input.truncated && k === heads.length - 1) return;
    const name = h[1].trim();
    if (name !== h[3].trim()) return;
    const start = h.index! + (h[0].startsWith('\n') ? 1 : 0), end = heads[k + 1]?.index ?? t.length, sheet = t.slice(start, end);
    const a = sheet.indexOf(PURPOSE);
    if (a < 0 || sheet.indexOf(PURPOSE, a + 1) >= 0) return;
    const from = a + PURPOSE.length, to = sheet.indexOf('\n\n', from);
    if (to < 0 || !sheet.startsWith(`\n\n${NEXT}\n`, to)) return;
    const raw = sheet.slice(from, to), lines = raw.split('\n'), last = lines[lines.length - 1];
    if (lines.some(l => l.includes(' ') || MARK.test(l))) return;
    if (lines.slice(0, -1).some(l => l.length < 28 || l.length > 32 || l.endsWith('。')) || last.length > 32 || !last.endsWith('。')) return;
    const p = project(input, `${name}|purpose`, name, 2024, h[0].replace(/^\n/, '').trimEnd(), start);
    p.projectCode = null;
    p.department = h[2].trim();
    p.purpose = lines.join('');
    p.evidence.push(evidence(input, raw, start + from));
    p.warnings.push('守谷市 令和6年度 事務事業マネジメントシートの「目的及び期待する効果（誰（何）をどうしたいのか）」欄を目的として収録。'
      + '右列（内容）と行が混ざっていない欄（直前が空行、全行が欄の幅で折り返され空白・箇条を含まず、次が「（参考）基本事業の目指す姿」）に限る。PDFの折り返しの改行を除いた。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '守谷市 令和6年度 事務事業マネジメントシート: 「目的及び期待する効果」欄（右列の内容欄と行が混ざっていないもの）。令和7年度の基本事業(取組)評価シートは事務事業ごとの目的欄がないため対象外。',
};
