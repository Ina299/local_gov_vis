import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 富田林市（令和6・7年度 事業評価シート）
// 公開済みレコードは同じ部課別PDFの事業評価シートから作られ、目的・事業概要が空欄。シートの「事業目的」「事業概要」欄は
// 右側の事業費（財源内訳）の表と行が交互に並ぶため、右側の表の語（当初予算・決算・【A】事業費・国庫支出金…）を行から外して残りを欄の文とする。
// 令和7年度のシートは欄の文字数（「38文字」等）が印字され、欄の文はラベルの上下にまたがって次の文字数の行まで続くので、外した結果の文字数が一致する場合のみ採る（改行の数だけの差は許す）。
// 令和6年度のシートには文字数がないため、事業目的は「決算」の行まで（右の表の4行の高さ）とし、句点で終わるか2行以内（下に続く余地がない）の場合のみ採る。
const HEAD = /^令和 ([67]) 年度 事業評価シート\n部署名 ([^\n]+)\n■対象事業 評価者[^\n]*\n事業番号 (\d{6}) 事業名称 ([^\n]+)\n/gm;
// 令和7年度: 右の表（事業コスト・財源内訳・人件費）の行と、行末に付いた右の表の語。
const RIGHT7 = /^(?:職員人件費|[\d,\s\-]+|[Aの財源内訳]|(?:(?:の|内) )?(?:国庫支出金|府支出金|地方債|その他|一般財源)(?: [\d,\-]+)*|(?:正職員|会計年度任用職員)(?: [\d,\-]+)?)$/;
const TAIL7 = / (?:(?:(?:の|内) )?(?:一般財源|正職員|会計年度任用職員|国庫支出金|府支出金|地方債|その他)(?: [\d,\-]+)*|[の財源内訳])$/;
const BULLET = /^[・①-⑳（(【■◆●○※▼]/;
const chars = (s: string) => [...s.replace(/\n/g, '')].length;

const width = (s: string) => [...s].reduce((w, c) => w + (/[\x20-\x7e｡-ﾟ]/.test(c) ? 0.5 : 1), 0);

/** 左の欄の行をつなぐ。前の行が全幅で折り返していない場合に、箇条書きの行頭（・①など）の前だけ改行を残す。 */
function join(lines: string[]): string {
  const full = Math.max(...lines.map(width));
  return lines.reduce((s, l, i) => s + (i && BULLET.test(l) && width(lines[i - 1]) < full * 0.9 ? '\n' : '') + l, '');
}

function left7(block: string, want: number): string | null {
  const lines = block.split('\n').map(l => l.replace(/ ?【(?:[AaB]|A\+B|a\+B)】.*$/, '').replace(/^事業(?:目的|概要)(?: |$)/, '').replace(TAIL7, '').trim())
    .filter(l => l && !RIGHT7.test(l));
  if (!lines.length) return null;
  // 印字の文字数はセル内の改行も1字に数える（折り返しは数えない）ため、改行の数までの差は許す。
  const d = want - chars(lines.join(''));
  return d >= 0 && d < lines.length ? join(lines) : null;
}

function sheet(input: CachedInput, h: RegExpMatchArray, seg: string, start: number): ProjectEvaluation | null {
  const r7 = h[1] === '7', name = h[4].trim();
  // IDは公開済みレコード（同じ資料・同じ番号）と別にする（同じIDのシートは補強の対象外になるため）。
  const p = project(input, `${h[3]}:narrative`, name, r7 ? 2025 : 2024, h[0].trimEnd(), start);
  p.projectCode = h[3];
  p.department = h[2].trim();
  if (!r7) p.evaluatedFiscalYear = 2023;
  if (r7) {
    const m = /[ \n](\d+)文字\n([\s\S]*?)\n(?:([^\n]*) )?(\d+)文字\n([\s\S]*?)\n【A\+B】総事業費/.exec(seg);
    if (!m) return null;
    p.purpose = left7(m[2] + (m[3] ? '\n' + m[3] : ''), Number(m[1]));
    p.activities = left7(m[5], Number(m[4]));
    if (p.purpose || p.activities) p.evidence.push(evidence(input, m[0].slice(1), start + m.index! + 1));
  } else {
    // 事業目的の欄は事業費の表（年度の見出し行〜「決算」の行）と同じ高さにあり、ラベルの上下にまたがる。
    // 1行目が年度の見出し行の左に付くことがある。
    const m = /\n（現年）\n(?:([^\n]*) )?令和5年度 令和6年度 令和7年度 令和8年度\n([\s\S]*?)\n決算(?: [\d,]+)*\n([\s\S]*?)\n（現年）\n■実施（DO）/.exec(seg);
    if (!m || !/^事業目的(?: |$)/m.test(m[2]) || !/ ?当初予算(?: [\d,]+)*$/m.test(m[2])) return null;
    const lines = [...m[1] ? [m[1]] : [], ...m[2].split('\n')].map(l => l.replace(/^事業目的(?: |$)/, '').replace(/ ?当初予算(?: [\d,]+)*$/, '').replace(/ ?(?:事業費|（単位：千円）)$/, '').trim())
      .filter(Boolean);
    const purpose = join(lines);
    // 3行以上で句点で終わらないときは事業目的が「決算」の行より下に続いている可能性があり、事業概要との境も決まらない。
    if (!lines.length || (!purpose.endsWith('。') && lines.length > 2)) return null;
    p.purpose = purpose;
    const body = m[3].split('\n').map(l => l.replace(/^事業概要(?: |$)/, '').trim()).filter(Boolean);
    if (body.length) p.activities = join(body);
    if (p.purpose || p.activities) p.evidence.push(evidence(input, m[0].slice(1, -'\n（現年）\n■実施（DO）'.length), start + m.index! + 1));
  }
  if (!p.purpose && !p.activities) return null;
  p.warnings.push('事業評価シートの「事業目的」「事業概要」欄。右側の事業費の表と行が交互に並ぶため、表の語を除いた残りを欄の文とした'
    + (r7 ? '（印字の文字数と一致するもののみ）。' : '（事業目的は「決算」の行までで、句点で終わるか2行以内のもののみ）。'));
  return p;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '27214' || !/\/uploaded\/attachment\/\d+\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const h = heads[i], start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const p = sheet(input, h, seg, start);
    if (p) out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '富田林市 令和6・7年度 事業評価シート（部課別PDF）: 事業目的・事業概要（目的・事業内容）。令和7年度は印字の文字数で検算。',
};
