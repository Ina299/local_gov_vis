import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { minokamoEntries } from '../batch12/m7-a-minokamo';

// ---------------------------------------------------------------- 美濃加茂市（令和6年度 事業評価書、課別PDF）
// 公開済みレコードは同じ課別PDFの事業評価書から作られ、目的・概要が空欄。評価書の左側「インプット」は対象・目的・概要の
// 3段で、抽出テキストでは各段の文が段の見出し（「対 象」「目 的」「概 要」）より先に出る。右側「効果」の実績の文が同じ高さに
// 割り込むため、次の形に限る。
//  目的: 「対 象」見出しの直後（縦書きの「イ」「効」「ン」の後）から空行までの文。最後の行以外が全幅で、句点で終わること。
//  概要: 「目 的」見出しの直後（縦書きの「ッ」「ト」の後）から「概 要」見出しの直前までの文（間に空行・別の欄の行がないこと）。
const width = (s: string) => [...s].reduce((w, c) => w + (/[\x20-\x7e｡-ﾟ]/.test(c) ? 0.5 : 1), 0);
const fullWidth = (ls: string[]) => { const w = Math.max(...ls.map(width)); return w >= 20 && ls.slice(0, -1).every(l => width(l) >= w - 1.5); };
const offset = (cell: string | null) => Number(/^extracted-text:chars:(\d+)-/.exec(cell ?? '')![1]);

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '21211') return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const bounds = [...t.matchAll(/(?:^|\n)会計区分\n/g)].map(m => m.index! + (m[0].startsWith('\n') ? 1 : 0));
  // 事業名・事業番号・事業主体・年度は公開時の抽出（シートの冒頭「会計区分」からの見出し部）をそのまま使う。
  for (const b of minokamoEntries['21211'].extract(input, inputs)) {
    const from = offset(b.evidence[1].cell), to = bounds.find(x => x > from) ?? t.length, seg = t.slice(from, to);
    if (input.truncated && to === t.length) continue;
    const p0 = /\n対 象\nイ\n\n効\n\nン\n\n((?:[^\n]+\n)+)\n/.exec(seg);
    if (!p0 || (seg.match(/\n目 的\n/g) ?? []).length !== 1 || seg.indexOf('\n目 的\n') < p0.index!) continue;
    const pl = p0[1].slice(0, -1).split('\n');
    if (!pl.at(-1)!.endsWith('。') || !fullWidth(pl)) continue;
    // IDは公開済みレコード（同じ資料・同じ事業）と別にする（同じIDのシートは補強の対象外になるため）。
    const p = project(input, `${b.projectCode ?? b.projectName}:narrative`, b.projectName, null, b.evidence[0].rawText, offset(b.evidence[0].cell));
    p.projectCode = b.projectCode;
    p.evaluatedFiscalYear = b.evaluatedFiscalYear;
    p.department = b.department;
    p.purpose = pl.join('');
    p.evidence.push(evidence(input, p0[1].slice(0, -1), from + p0.index! + p0[0].length - p0[1].length - 1));
    const a0 = /\n果\n\nプ\n\n目 的\n\nッ\nト\n\n((?:[^\n]+\n)+)概 要\n/.exec(seg);
    if (a0) {
      const al = a0[1].slice(0, -1).split('\n');
      if (al.at(-1)!.endsWith('。') && fullWidth(al)) {
        p.activities = al.join('');
        p.evidence.push(evidence(input, a0[1].slice(0, -1), from + a0.index! + a0[0].length - a0[1].length - '概 要\n'.length));
      }
    }
    p.warnings.push('事業評価書のインプット欄の「目的」（と「概要」）。見出しより先に出る段の文を、実績の欄の割り込みがなく全幅の行が続く場合だけ、折り返しの改行を除いてつないだ。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '美濃加茂市 令和6年度 事業評価書（課別PDF）: インプット欄の目的・概要（目的・事業内容）。実績の欄が割り込む評価書は対象外。',
};
