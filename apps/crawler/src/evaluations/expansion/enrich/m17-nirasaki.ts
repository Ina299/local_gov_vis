import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 韮崎市（行政評価シート（事務事業評価） 評価年度7年度）
// 公開済みレコードは同じ評価シートの「事業名」「担当課」から作られ、目的・事業内容が空。シート冒頭の「事業内容（簡潔に）」は
// 1行の欄で、直後に「１ 計画（ＰＬＡＮ）」の見出しが来る場合に限り事業内容とする（行が折り返す版は採らない）。
// 「事業の目的」「事業の手段」の欄は、欄の文が見出しの行の上下にまたがり2つの欄の行が続けて出力されるため、境が決まらず採らない。
const SHEET = /^行政評価シート（事務事業評価） 評価年度 ([０-９]+)年度\n事業名 (.+?) 担当課 (\S+)\n事業内容（簡潔に） ([^\n]+)\n１ 計画（ＰＬＡＮ）/gm;
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '19207' || !/\/group\/1\/R7hyoukakekka\.pdf$/.test(input.sourceUrl)) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of input.text.matchAll(SHEET)) {
    const year = 2018 + Number(ascii(m[1]));
    if (year !== 2025) continue;
    const p = project(input, `R7:${m[2]}:narrative`, m[2], year, m[0].slice(0, m[0].indexOf('\n事業内容')), m.index!);
    p.department = m[3];
    p.activities = m[4].trim();
    const at = m.index! + m[0].indexOf('\n事業内容（簡潔に） ') + '\n事業内容（簡潔に） '.length;
    p.evidence.push(evidence(input, m[4], at));
    p.warnings.push('韮崎市 行政評価シートの「事業内容（簡潔に）」欄（1行の欄のみ）を事業内容として収録。事業の目的・手段の欄は行が混ざるため未収録。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '韮崎市 行政評価シート（評価年度7年度）: 「事業内容（簡潔に）」欄（1行のみ）。事業の目的・手段の欄は2欄の行が続けて出力され境が決まらないため対象外。',
};
