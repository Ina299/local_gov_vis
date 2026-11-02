import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m17-util';

// ---------------------------------------------------------------- 平群町（令和4年度 平群町政策基本体系表の個別シート）
// 公開済みレコードは同じ資料の目次（事務・事業名・主務担当課）から作られ、目的・概要が空。個別シートの
// 「Ⅰ 事務事業の目的・概要」の「①目的」は「対象」「意図（対象をどうするのか）」の2欄で、見出しの後に空行区切りの
// 1行ずつ（対象、意図）が並ぶ。2段そろう場合に限り意図の行を目的とする（1段だけの場合は対象か意図か決まらないため採らない）。
// 「②事務事業の概要」は「③環境分析」の見出しまでの1段を事業内容とする。年度は見出しの「令和４年度」（実施年度）。
const HEAD = /^令和([０-９\d]+)年度 平群町政策基本体系表（個別シート）\n/gm;
const NAME = /^(?:事務事業名\n\n((?:[^\n]+\n)+?)\n担当課名\n|((?:[^\n]+\n)+?)\n事務事業名\n\n担当課名\n)/;
const PURPOSE = /\nⅠ 事務事業の目的・概要\n①目的\n\n対象\n\n意図\n（対象をどうするのか）\n\n([^\n]+)\n\n([^\n]+)\n\n②事務事業の概要\n/;
const ACT = /\n②事務事業の概要\n\n((?:[^\n]+\n)+)\n③環境分析（事業開始か\n/;
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '29342' || !/\/uploaded\/attachment\/8233\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    if (input.truncated && i === heads.length - 1) return;
    const start = h.index!, body = start + h[0].length, seg = t.slice(body, heads[i + 1]?.index ?? t.length);
    const n = NAME.exec(seg), year = 2018 + Number(ascii(h[1]));
    if (!n || year !== 2022) return;
    const nameLines = (n[1] ?? n[2]).slice(0, -1).split('\n');
    if (nameLines.some(l => /^(事務事業名|担当課名|款|項|目)$/.test(l))) return;
    const p = project(input, `R4:${nameLines.join('')}:narrative`, nameLines.join(''), null, h[0] + seg.slice(0, n[0].length - 1), start);
    p.evaluatedFiscalYear = year;
    const pu = PURPOSE.exec(seg);
    if (pu && !/^(対象|意図|②|③)/.test(pu[2])) {
      p.purpose = pu[2];
      p.evidence.push(evidence(input, pu[0].slice(1, -1), body + pu.index! + 1));
    }
    const a = ACT.exec(seg);
    if (a && !/^(③|Ⅱ|Ⅲ)/.test(a[1])) {
      const raw = a[1].slice(0, -1);
      p.activities = unwrap(raw);
      p.evidence.push(evidence(input, raw, body + a.index! + '\n②事務事業の概要\n\n'.length));
    }
    if (!p.purpose && !p.activities) return;
    p.warnings.push('平群町政策基本体系表（個別シート）の「①目的」の「意図（対象をどうするのか）」欄（対象・意図の2段がそろう場合のみ）を目的、'
      + '「②事務事業の概要」欄を事業内容として収録。欄の幅での折り返しだけをつないだ。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '平群町 令和4年度 平群町政策基本体系表（個別シート）: ①目的の意図（目的）・②事務事業の概要（事業内容）。対象・意図の段が1つしかないシートの目的は対象外。',
};
