import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 十和田市（第2次総合計画 第3期実施計画の事業表、令和6年度実績）
// 公開済みレコードは同じ資料の事業ごとの表から作られ、目的が空欄。「目」「的」の縦書きの見出しが欄の文を上下から挟むか、
// 欄の文の行頭に付く。見出しの2文字の間（と行頭）だけで欄が閉じる形（1行: 目／文／的、2行: 目 文／的 文、3行: 目 文／文／的 文）
// に限り、見出しの前後に文の行がはみ出す表（手段の欄の行と区別できない）は採らない。年度は公開時の抽出と同じ根拠（市の
// 評価結果ページの「令和６年度に実施した事業について内部評価」）による。
const yearQuote = '令和７年度は、第２次十和田市総合計画第３期実施計画に掲載されている事業のうち、令和６年度に実施した事業について内部評価を実施しました。';
const START = /^事業名称 (.+?) 計画番号\n事業開始年度 .*? 所管部署 (.+?) ([０-９0-9]+)\n/gm;

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '02206' || !/\/02_R07zissikeikaku\.pdf$/.test(input.sourceUrl)) return [];
  const cover = inputs.find(d => d.sourceId === '2b7102130083bd0c1448b53d' && d.text.includes(yearQuote));
  if (!cover) return [];
  const t = input.text, starts = [...t.matchAll(START)], out: ProjectEvaluation[] = [];
  starts.forEach((m, i) => {
    if (input.truncated && i === starts.length - 1) return;
    const body = m.index! + m[0].length, seg = t.slice(body, starts[i + 1]?.index ?? t.length);
    const f = /^((?:目\n[^\n]+\n的)|(?:目 [^\n]+\n(?:[^\n]+\n)?的 [^\n]+))\n手(?: |\n)/.exec(seg);
    if (!f) return;
    const ls = f[1].split('\n'), parts = ls.map(l => l.replace(/^[目的](?: |$)/, '')).filter(Boolean);
    if (parts.some(l => /^[目的手段]$/.test(l)) || !parts.at(-1)!.endsWith('。')) return;
    const p = project(input, `${m[3].normalize('NFKC')}:narrative`, m[1], 2025, m[0].slice(0, -1), m.index!);
    p.evaluatedFiscalYear = 2024;
    p.department = m[2];
    p.purpose = parts.join('');
    p.evidence.push(evidence(input, f[1], body), evidence(cover, yearQuote));
    p.warnings.push('実施計画の事業表の「目的」欄。縦書きの見出し「目」「的」を除き、欄の幅での折り返しをつないだ。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '十和田市 第2次総合計画 第3期実施計画の事業表（令和6年度実績の内部評価）: 目的。手段（事業内容）・事業実績は公開済み。',
};
