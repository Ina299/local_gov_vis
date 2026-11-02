/**
 * 12232 白井市: 白井市（後期）第2次実施計画事業（平成27年度事業）事後評価シート（分野別PDF）。公開済みレコード（同じシートの事務事業名、
 * 平成28年度評価・平成27年度事業）の空欄の目的に「２．事業概要」の「目 的（何のために）」欄を補う。
 * 抽出テキストでは欄の見出しと本文の順が崩れ、本文が直前の「これまでの見直しの経緯」欄の本文と続いて出ることがある。次の2つの形に限って採る。
 * - 見出し「目 的\n（何のために）」の直前の段落で、その段落が見直しの経緯の見出しの最終行「等の実施状況）」の直後から始まるもの。
 * - 見出し「目 的」の直後の空行から「（何のために）」の手前の空行までがちょうど1段落のもの。
 * どちらも、ほかの欄の見出しの語を含まず、文が1つ（句点は末尾だけ）で、最後の行以外が欄の幅で折り返された段落に限る（見直しの経緯の文が混ざったものを除く）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';
import { unwrap } from './m1-util';

const HEADING = '（平成27年度事業）事後評価シート';
const NAME = /\n事務事業名\n([^\n]+)\n実施期間\n/g;
const AFTER_REVIEW = /\n等の実施状況）\n((?:[^\n]+\n)+?)\n目 的\n（何のために）\n/;
const LABEL_FIRST = /\n目 的\n\n((?:[^\n]+\n)+?)\n（何のために）\n/;
const LABELS = /見直し|実施状況|何のために|対 象|手 段|成 果|事業実施の背景|導入経緯等/;

/** 最後の行以外は欄の幅（55字前後）で折り返した行であること（短い行は直前の欄の本文の終わりが混ざったもの） */
const single = (s: string) => !LABELS.test(s) && !/^[※＊]/.test(s) && !/。(?!$)/.test(s.trim())
  && s.split('\n').slice(0, -1).every(l => l.length >= 40);

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '12232' || input.format !== 'pdf' || !input.text.includes(HEADING)) return [];
  const t = input.text, names = [...t.matchAll(NAME)], out: ProjectEvaluation[] = [];
  names.forEach((m, k) => {
    if (input.truncated && k === names.length - 1) return;
    const start = m.index!, end = names[k + 1]?.index ?? t.length;
    // シートの表題がこの事務事業名と前の事務事業名の間にあること。
    const h = t.lastIndexOf(HEADING, start);
    if (h < 0 || (k > 0 && h < names[k - 1].index!)) return;
    const sheet = t.slice(start, end);
    const found = [AFTER_REVIEW, LABEL_FIRST].map(re => re.exec(sheet)).filter(Boolean) as RegExpExecArray[];
    if (found.length !== 1) return;
    const f = found[0], raw = f[1].replace(/\n$/, '');
    if (!single(raw) || raw.length < 8) return;
    const name = m[1].trim();
    const p = project(input, `${name}|purpose`, name, 2016, m[0].slice(1, -1), start + 1);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2015;
    p.evidence.unshift(evidence(input, HEADING, h));
    p.purpose = unwrap(raw);
    p.evidence.push(evidence(input, raw, start + f.index! + f[0].indexOf(f[1])));
    p.warnings.push('白井市 事後評価シート（平成27年度事業）の「目 的（何のために）」欄を目的として収録。見出しと本文の位置関係が崩れているため、'
      + '見直しの経緯の見出し直後から目的の見出しまでの段落、または目的の見出しと「（何のために）」の間のちょうど1段落で、文が1つのものに限る。PDFの折り返しの改行を除いた。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '白井市 （後期）第2次実施計画事業（平成27年度事業）事後評価シート: 「目 的（何のために）」欄（位置関係が確定し、文が1つのもの）。対象・手段・成果欄は列の対応が崩れるため対象外。',
};
