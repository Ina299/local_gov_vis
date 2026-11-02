import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m17-util';

// ---------------------------------------------------------------- 江別市（令和7年度 事務事業評価表【評価版】 令和6年度実績）
// 公開済みレコードは同じ評価表の「事業名：」の行（事業名・担当課）から作られ、目的・事業内容が空。「事務事業の目的と成果及び指標」の
// 「手段（事務事業の内容、手法）」「意図（この事業によって対象をどのような状態にしたいのか）」の欄は、見出しの次の行から
// 指標の表の見出し「指標名 単位」の手前まで1列で出力される。意図を目的、手段を事業内容とする。成果動向の欄は見出しと
// 本文の行が混ざるため採らない。
const HEAD = /^令和 ?([０-９\d]+)年度 事務事業評価表【評価版】\n（令和 ?([０-９\d]+)年度実績）\n【事業番号 \d+】\n事業名： (\S+) (\S+課) [^\n]+$/gm;
const field = (label: string) => new RegExp(`\\n${label}\\n((?:(?!指標名 単位)[^\\n]+\\n)+?)指標名 単位 `);
const MEANS = field('手段（事務事業の内容、手法）');
const INTENT = field('意図（この事業によって対象をどのような状態にしたいのか）');
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01217' || !/\/uploaded\/attachment\/77426\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    if (input.truncated && i === heads.length - 1) return;
    const year = 2018 + Number(ascii(h[2]));
    if (year !== 2024 || Number(ascii(h[1])) !== 7) return;
    const start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const p = project(input, `R7:${h[3]}:narrative`, h[3], null, h[0], start);
    p.evaluatedFiscalYear = year;
    p.department = h[4];
    for (const [re, key] of [[INTENT, 'purpose'], [MEANS, 'activities']] as const) {
      const m = re.exec(seg);
      if (!m) continue;
      const raw = m[1].slice(0, -1);
      p[key] = unwrap(raw);
      p.evidence.push(evidence(input, raw, start + m.index! + m[0].indexOf(m[1])));
    }
    if (!p.purpose && !p.activities) return;
    p.warnings.push('江別市 事務事業評価表の「意図（この事業によって対象をどのような状態にしたいのか）」欄を目的、「手段（事務事業の内容、手法）」欄を事業内容として収録。欄の幅での折り返しだけをつないだ。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '江別市 令和7年度 事務事業評価表【評価版】（令和6年度実績）: 意図（目的）・手段（事業内容）。成果動向の欄は見出しと本文の行が混ざるため対象外。',
};
