import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 釜石市教育委員会 点検・評価報告書（令和6年度事業）
// 公開済みレコード（令和6年度決算の事業ごとの表）と同じ表の「目 的」欄を目的として足す。抽出テキストでは見出し
// （事業名・担当課・目 的）が先に並び、その後に事業名・年度・決算額・担当課・目的の本文・取組内容の本文が続く。
// 見出しが「事業名\n担当課\n\n目 的\n\n」とまとまって出る表に限り、決算額・担当課の行の後の最初の段落を目的とする。
// 目的の段落は句点で終わる最初の行までで、直後が空行であるか「もの。」で終わる（＝欄の定型の結び）場合だけ採る。
// 見出しが本文の途中に挟まる表、取組内容・成果と課題（見出しが本文に混ざる）は対象外。
const HEADER = /^([\d,]+ 円|決算額|令和 ?[\d０-９]+ ?年度|.*(課|センター|図書館)|.*課\))$/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '03211' || !/\/docs\/2025082700066\/file_contents\/6\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(/\n事業名\n担当課\n\n目 的\n\n/g)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].index! + heads[i][0].length;
    const end = Math.min(...[t.indexOf('\n評価結果', start), t.indexOf('\n事業名\n', start)].filter(x => x >= 0));
    if (!Number.isFinite(end) || (input.truncated && i === heads.length - 1)) continue;
    // 行と位置の一覧
    const lines: { s: string; at: number }[] = [];
    for (let pos = start; pos < end;) {
      const nl = t.indexOf('\n', pos), e = nl < 0 || nl > end ? end : nl;
      lines.push({ s: t.slice(pos, e), at: pos });
      pos = e + 1;
    }
    const firstStop = lines.findIndex(l => /。$/.test(l.s));
    if (firstStop < 0) continue;
    // 決算額・担当課などの見出し側の行の最後
    let lastHeader = -1;
    for (let k = 0; k < firstStop; k++) if (HEADER.test(lines[k].s.trim())) lastHeader = k;
    const head = lines.slice(0, lastHeader + 1).map(l => l.s.trim());
    if (lastHeader < 0 || !head.some(s => /^[\d,]+ 円$/.test(s)) || !head.includes('令和 6 年度')) continue;
    const body = lines.slice(lastHeader + 1, firstStop + 1).filter(l => l.s.trim());
    if (!body.length || lines.slice(lastHeader + 1, firstStop + 1).some((l, k, a) => !l.s.trim() && k > 0 && k < a.length - 1)) continue;
    const next = lines[firstStop + 1];
    if (!(next && !next.s.trim()) && !/もの。$/.test(lines[firstStop].s)) continue;
    // 事業名: 施策の行（(n) …）より後、見出し側の行を除いた行
    const pol = lines.slice(0, lastHeader).map(l => /^\(\d+\) /.test(l.s.trim())).lastIndexOf(true);
    const nameLines = lines.slice(pol + 1, lastHeader).map(l => l.s.trim()).filter(s => s && !HEADER.test(s));
    if (!nameLines.length || nameLines.length > 2) continue;
    const name = nameLines.join('');
    const raw = t.slice(body[0].at, body[body.length - 1].at + body[body.length - 1].s.length);
    const p = project(input, `${name}:purpose`, name, null, t.slice(start, lines[lastHeader].at + lines[lastHeader].s.length), start);
    p.evaluatedFiscalYear = 2024;
    p.purpose = body.map(l => l.s.trim()).join('');
    p.evidence.push(evidence(input, raw, body[0].at));
    p.warnings.push('釜石市教育委員会 点検・評価報告書（令和6年度事業）の「目 的」欄。見出しがまとまって出る表に限り、決算額・担当課の後の最初の段落（句点で終わる行まで）を採り、欄の幅で折り返した改行を除いた。');
    out.push(p);
  }
  return out.filter(p => out.filter(o => o.projectName === p.projectName).length === 1);
}

export const entry = { extract, scope: '釜石市教育委員会 点検・評価報告書（令和6年度事業）の「目 的」欄（見出しの位置が確定する表のみ）。公開済みレコードの補強用。' };
