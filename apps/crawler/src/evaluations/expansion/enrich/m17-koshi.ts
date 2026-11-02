import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m17-util';

// ---------------------------------------------------------------- 合志市（事務事業マネジメントシート 令和6年度実績と令和7年度計画）
// 公開済みレコードは事業ごとのPDFのシートから作られ、目的・事業内容・成果が空。「① 6年度事務事業の成果・実績」欄は
// 「② 7年度計画」の見出しまで1列で出力されるため、これを成果とする。欄の中が「【目的】」「【内容】」「【実績】」の
// 小見出しで分かれるシートは、それぞれを目的・事業内容・成果とする。「【事業の内容】」の欄は左の見出し
// 「(開始した背景・…)」の欄の文と行が続けて出力され、境が決まらないため採らない。シートに目的の欄はない。
const HEAD = /^事務事業マネジメントシート\(令和 ?([０-９\d]+)年度実績と令和 ?[０-９\d]+年度計画\)/;
const NAME = /^事務事業名 ([^\n]+)$/m;
const DEPT = /^計画 施 策 .+? 所属課 (\S+) 担当者名 /m;
const FIELD = /\n① ([０-９\d]+)年度事務事業の成果・実績\n((?:[^\n]+\n)+?)② [０-９\d]+年度計画/;
const SUB = /^【目的】([^\n]+(?:\n(?!【)[^\n]+)*)\n【内容】([^\n]+(?:\n(?!【)[^\n]+)*)\n(【実績】[^]*)$/;
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '43216' || !/\/kiji\d+\/3_\d+_up_[a-z0-9]+\.pdf$/.test(input.sourceUrl) || input.truncated) return [];
  const t = input.text, h = HEAD.exec(t), n = NAME.exec(t), f = FIELD.exec(t);
  if (!h || !n || !f || ascii(h[1]) !== '6' || ascii(f[1]) !== '6') return [];
  const year = 2018 + Number(ascii(h[1]));
  const p = project(input, `R6:${n[1]}:narrative`, n[1].trim(), null, n[0], n.index!);
  p.evaluatedFiscalYear = year;
  p.department = DEPT.exec(t)?.[1] ?? null;
  const raw = f[2].slice(0, -1), at = f.index! + f[0].indexOf(f[2]);
  p.evidence.push(evidence(input, h[0], h.index!), evidence(input, raw, at));
  const s = SUB.exec(raw);
  if (s) {
    p.purpose = unwrap(s[1].trim());
    p.activities = unwrap(s[2].trim());
    p.outcomes = unwrap(s[3]);
  } else p.outcomes = unwrap(raw);
  p.warnings.push('合志市 事務事業マネジメントシートの「① 6年度事務事業の成果・実績」欄を成果として収録（欄の中が【目的】【内容】【実績】…に分かれる場合は【目的】を目的、【内容】を事業内容、【実績】以降を成果）。欄の幅での折り返しだけをつないだ。');
  return [p];
}

export const entry = {
  extract,
  scope: '合志市 事務事業マネジメントシート（令和6年度実績）: 「① 6年度事務事業の成果・実績」（成果。【目的】【内容】【実績】の小見出しがあれば目的・事業内容・成果）。目的の欄はなく、【事業の内容】欄は背景の欄と行が混ざるため対象外。',
};
