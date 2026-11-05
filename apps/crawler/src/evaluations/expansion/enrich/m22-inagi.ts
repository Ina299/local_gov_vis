import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 稲城市（令和７年度 地方公会計制度を活用した事務事業評価）
// 公開済みレコードは同じ資料（r7jimujigyou.pdf）の対象事業一覧（評価票№・事業名・担当部署）から作られ、事業名は一覧の表記。
// 評価票の「事業目的」欄は、部・課の値（または「事業 目的」の見出し）の直後の段落で、続く「事業概要」欄との区切りが
// テキストにないため、欄の幅いっぱいの行（折り返し）が続いて句点で終わる最初の段落だけを目的とする。
// 1行目が幅に満たないのに句点で終わらない場合（見出しのような短い目的）は、続きとの区切りが決まらないため採らない。
const WIDTH = 48;
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13225' || !input.sourceUrl.endsWith('/r7jimujigyou.pdf')) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const a = t.indexOf('■令和７年度地方公会計制度を活用した事務事業評価\n評価票№\n\n対象事業一覧\n'), b = t.indexOf('稲城市行政運営評価委員会', a);
  if (a < 0 || b < 0) return [];
  const names = new Map<string, string>();
  for (const m of t.slice(a, b).matchAll(/\n([０-９]+|\d+)\n\n([^\n]+)\n\n/g)) names.set(ascii(m[1]), m[2]);
  const sheets = [...t.matchAll(/地方公会計制度を活用した事務事業評価票\nNo\n\n(\d+)\n\n/g)];
  sheets.forEach((s, i) => {
    const from = s.index!, sheet = t.slice(from, sheets[i + 1]?.index ?? t.length), name = names.get(s[1]);
    const head = /\n令和７年度\n\n[^\n]+\n\n(?:事業\n目的\n\n)?|\n部・課 [^\n]+\n/.exec(sheet);
    if (!name || !head) return;
    const at = from + head.index! + head[0].length, lines: string[] = [];
    for (const line of t.slice(at, at + 2000).split('\n')) {
      if (!line.trim()) return;
      lines.push(line);
      if (/。$/.test(line)) break;
      if (line.length < WIDTH) return;
    }
    if (!/。$/.test(lines[lines.length - 1] ?? '')) return;
    const p = project(input, `No${s[1]}:purpose`, name, 2025, s[0], from);
    p.projectCode = `No${s[1]}`;
    p.evaluatedFiscalYear = 2024;
    p.purpose = lines.join('');
    p.evidence.push(evidence(input, lines.join('\n'), at));
    p.warnings.push('稲城市 地方公会計制度を活用した事務事業評価票（令和７年度、令和６年度事務事業分）の「事業目的」欄の最初の段落（欄の幅での折り返しを除いてつないだ）。'
      + '事業名は対象事業一覧の同じ評価票№の表記。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '稲城市 令和７年度 地方公会計制度を活用した事務事業評価票（11事業）: 事業目的欄（折り返しが続いて句点で終わる最初の段落）。',
};
