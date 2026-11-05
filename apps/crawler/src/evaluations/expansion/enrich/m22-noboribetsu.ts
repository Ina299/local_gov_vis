import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 登別市（令和７年度（令和６年度分）事務事業評価シート 最終版）
// 公開済みレコードは同じ最終版（docs/2026040600015 の章別6冊）から作られ、目的は「目的・根拠・対象」欄が「とする。」で
// 終わる場合だけ収録されていた。ここでは欄の見出しの直後（空行・「目的」の小見出しを挟む版も）から、空行または
// 「目的」の行までを目的欄の内容とし、最後の行が句点（。または 。））で終わるときだけ足す。
const FINAL = new Set(['0875a19a422893b10f8dddcf', '0f4befd09e7ad2780f5f06b3', '6dd61a0b557cb380105d2547',
  '3a069d8b9d589d5f41a94cfc', '23d731d5a6a96334f03e858e', '37e148e5c7475c71f7eef2e3']);
const HEADER = '令和７年度（令和６年度分）事務事業評価シート\n';
const LABEL = '目的・根拠・対象\n';
const norm = (s: string) => s.normalize('NFKC').replace(/\s/g, '');

/** シートごとの事業名と、目的を取り出せた場合の事業票（同名事業の判定は目的の有無によらず全シートで行う）。 */
function sheets(input: CachedInput): { name: string; p: ProjectEvaluation | null }[] {
  const t = input.text, out: { name: string; p: ProjectEvaluation | null }[] = [], starts: number[] = [];
  for (let i = t.indexOf(HEADER); i >= 0; i = t.indexOf(HEADER, i + 1)) starts.push(i);
  starts.forEach((from, k) => {
    const sheet = t.slice(from, starts[k + 1] ?? t.length);
    const head = sheet.match(/^令和７年度（令和６年度分）事務事業評価シート\n事務事業名\n\n([^\n]+)\n\n部・グループ\n\n([^\n]+)\n/)
      ?? sheet.match(/^令和７年度（令和６年度分）事務事業評価シート\n\n事務事業コード\n\n\d{8}\n\n事業・経費名\n\n([^\n]+)\n\n部・グループ\n\n([^\n]+)\n/);
    const codes = [...sheet.matchAll(/(?<![\d,])\d{8}(?![\d,])/g)];
    const label = sheet.indexOf(LABEL);
    if (!head || codes.length !== 1) return;
    const item: { name: string; p: ProjectEvaluation | null } = { name: head[1], p: null };
    out.push(item);
    if (label < 0 || sheet.indexOf(LABEL, label + 1) >= 0) return;
    const lead = /^\n?(?:目的\n\n)?/.exec(sheet.slice(label + LABEL.length))![0];
    const at = label + LABEL.length + lead.length, lines: string[] = [];
    for (const line of sheet.slice(at).split('\n')) {
      if (!line.trim() || line === '目的') break;
      lines.push(line);
    }
    if (!lines.length || !/。）?$/.test(lines[lines.length - 1]) || lines.some(l => /^(根拠|対象|指標等の状況【D】)$/.test(l))) return;
    const raw = lines.join('\n');
    const value = lines.reduce((acc, l, i) => acc + (i === 0 || !/[。）]$/.test(lines[i - 1]) ? '' : '\n') + l, '');
    // 公開済みの事業票と同じIDにならないよう、IDの鍵だけ変える（事業コードは同じ）。
    const p = project(input, `${codes[0][0]}:purpose`, head[1], 2025, head[0], from);
    p.projectCode = codes[0][0];
    p.evaluatedFiscalYear = 2024;
    p.department = head[2];
    p.purpose = value;
    p.evidence.push(evidence(input, raw, from + at));
    p.warnings.push('登別市 事務事業評価シートの「目的・根拠・対象」欄の目的（欄の見出しの直後から空行または「目的」の行まで）。欄の幅での折り返しは改行を除いてつないだ。');
    item.p = p;
  });
  return out;
}

const cache = new Map<string, ReturnType<typeof sheets>>();
const parse = (input: CachedInput) => { if (!cache.has(input.sourceId)) cache.set(input.sourceId, sheets(input)); return cache.get(input.sourceId)!; };

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '01230' || !FINAL.has(input.sourceId)) return [];
  // 公開済みの抽出と同じく、最終版6冊の中で同名の事業が複数あるものは返さない。
  const count = new Map<string, number>();
  for (const { name } of inputs.filter(i => FINAL.has(i.sourceId)).flatMap(parse)) count.set(norm(name), (count.get(norm(name)) ?? 0) + 1);
  return parse(input).flatMap(({ name, p }) => p && count.get(norm(name)) === 1 ? [p] : []);
}

export const entry = {
  extract,
  scope: '登別市 令和７年度（令和６年度分）事務事業評価シート最終版（章別6冊）: 「目的・根拠・対象」欄の目的（句点で終わるもの）。',
};
