import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 愛川町（令和７年度事務事業評価シート）
// 公開済みレコードは同じシート集（R7shi-to.pdf、評価年度＝令和７年度）の各事業。
// 「目 的」欄（欄の見出し「(誰・何を対／象に、何の／ために)」が本文の行頭に混ざる）を目的として取る。
// 欄は「目 的」の行から「ために)」の行までとし、見出しの断片を除いた最後の行が句点で終わる場合だけ採る
// （句点で終わらない版は欄が「ために)」の行の後に続いていて、内容・方法の欄との境目が本文で確定しない）。
// 内容・方法の欄は見出しの断片の位置が版ごとに違い、終わりが確定しないため取らない。
// 事業名と担当課の出力順が版ごとに違うため、シートの頭の（区分・担当課などの見出しと課名、番号・日付を除いた）残りが1行だけのときに事業名とする。
const SHEET = /^令和７年度事務事業評価シート 取組みコード\n/gm;
const NOT_NAME = /^(区分|事務事業|補助金・交付金|イベント|事業名|担当課|作成日|開始年度|担当課 .*|.*課|[\d.]+|令和\d+年\d+月\d+日|(昭和|平成|令和)[\d０-９元]+年(度|\d+月)?|不明)$/;
const LABEL = /^(\(誰・何を対|象に、何の)(?: |$)/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '14401' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/R7shi-to.pdf')) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const starts = [...t.matchAll(SHEET)].map(m => m.index!);
  for (const [i, start] of starts.entries()) {
    const seg = t.slice(start, starts[i + 1] ?? t.length);
    const headEnd = seg.search(/\n令和7年\d+月\d+日\n/);
    if (headEnd < 0) continue;
    const names = seg.slice(seg.indexOf('\n') + 1, headEnd).split('\n').map(l => l.trim()).filter(l => l && !NOT_NAME.test(l));
    if (names.length !== 1) continue;
    const m = /\n目 的\n((?:[^\n]*\n){1,8}?)ために\)\n/.exec(seg);
    if (!m) continue;
    const lines = m[1].split('\n').slice(0, -1).map(l => l.replace(LABEL, '').trim()).filter(Boolean);
    if (!lines.length || !lines[lines.length - 1].endsWith('。')) continue;
    if (lines.some(l => /^[(（]何を行って|^いるのか\)|^内容・方法/.test(l))) continue;
    const p = project(input, `narrative:${names[0]}`, names[0], 2025, seg.slice(0, headEnd), start);
    p.projectCode = null;
    p.purpose = lines.join('');
    p.evidence.push(evidence(input, m[1].replace(/\n$/, ''), start + m.index! + '\n目 的\n'.length));
    p.warnings.push('愛川町 令和７年度事務事業評価シートの「目 的」欄を目的として収録。行頭に混ざった欄の見出しの断片（(誰・何を対／象に、何の）を除き、折り返しの改行を除いてつないだ。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '愛川町 令和７年度事務事業評価シート（R7shi-to.pdf）: 「目 的」欄（句点で終わる版のみ）。',
};
