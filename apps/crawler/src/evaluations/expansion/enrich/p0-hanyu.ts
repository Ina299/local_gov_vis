import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 羽生市（事務事業評価（総点検）の部局別シート）
// 公開済みレコードは「資料６ 事務事業評価（総点検）評価結果一覧表」（file_contents/6.pdf、年度の記載なし。令和5〜8年度の事業費の列）の439事業。
// 同じページ（docs/2026040600039/）に「【○○部】事務事業評価（総点検 シート）」として掲載された部局別PDFの
// 「事務事業評価シート（令和6・7年度総点検）」（令和5年度決算〜令和8年度予算要求額の列）は同じ総点検の調書で、ページに他の回の資料はない。
// シートの「事業の目的」の欄を目的として取る。抽出テキストでは欄の中身が「（「その他」の場合は、具体的内容を記入）⇒」（事業の種類の欄）の直前に出る。
// 欄が2行以上のときは、1行目が「目」（目的の見出し）の直前に離れて出るため、その1行（シート内に1つだけのとき）を前に付ける。
// 1行目が見つからず、欄の直前の段落が言い掛け（助詞・活用語尾で始まる）のときや、見出しだけのときは取らない。
// 主な取り組み（実施内容・実績）の欄は実績の数値が別の列と混在して出力されるため取らない。
const SHEET = '事務事業評価シート（令和6・7年度総点検）';
const TYPE = '\n（「その他」の場合は、具体的内容を記入）⇒';
const HEAD = /^\n整理番号\n\n事務事業名\n\n(?:事業の種類\n\n)?([A-Z]-\d+)\n\n(?:事業の種類\n\n)?([^\n]+(?:\n[^\n]+)?)\n\n(?:自治（[^\n]+）\n\n)?総合振興計画上の位置付け\n/;
const TAIL = /^(?:[をにのがはとでるすりくうしてせれたちかめいわおえっゃゅょんぁぃぅぇぉー、。・）」]|こと)/;

interface Para { text: string; at: number }
/** 空行で区切った段落（抽出テキスト内の位置つき） */
function paragraphs(t: string, from: number, to: number): Para[] {
  const out: Para[] = [];
  let at = from;
  for (const text of t.slice(from, to).split('\n\n')) { out.push({ text, at }); at += text.length + 2; }
  return out;
}
const textLike = (p: string) => p.length >= 12 && !p.includes('⇒') && !p.includes('\n') && !/^[（※]/.test(p);
/** 折り返しの改行を除く（句点で終わる行の後は改行を残す） */
const join = (lines: string[]) => lines.reduce((acc, l, i) => i === 0 ? l : acc + (/。$/.test(lines[i - 1]) ? '\n' : '') + l, '');

function sheets(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11216' || input.format !== 'pdf' || !/\/docs\/2026040600039\/file_contents\/[a-z]+\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, starts: number[] = [];
  for (let i = t.indexOf(SHEET); i >= 0; i = t.indexOf(SHEET, i + 1)) starts.push(i + SHEET.length);
  const found: ProjectEvaluation[] = [];
  starts.forEach((from, k) => {
    const to = k + 1 < starts.length ? starts[k + 1] - SHEET.length : t.length, s = t.slice(from, to);
    const m = s.match(HEAD), mark = s.indexOf(TYPE);
    if (!m || mark < 0 || s.indexOf(TYPE, mark + 1) >= 0) return;
    const name = m[2].replace(/\n/g, '');
    // 欄の直前の段落（末尾の「その他」は事業の種類の選択肢）
    const before = paragraphs(t, from, from + mark), last = before[before.length - 1];
    const raw = last.text.replace(/\n+$/, '').replace(/\nその他$/, '');
    if (!/(。|こと)$/.test(raw) || raw.includes('⇒')) return;
    // 目的の見出し「目」の直前に離れて出る1行目
    const all = paragraphs(t, from, to);
    const heads = all.filter((p, i) => i + 1 < all.length && (all[i + 1].text === '目' || all[i + 1].text.startsWith('目\n')) && textLike(p.text) && p.at !== last.at);
    if (heads.length > 1) return;
    const head = heads[0];
    if (!head && (raw.length < 10 || TAIL.test(raw))) return;
    const lines = [...(head ? [head.text] : []), ...raw.split('\n')];
    const p = project(input, m[1], name, null, m[0].slice(1), from + 1);
    p.purpose = join(lines);
    if (head) p.evidence.push(evidence(input, head.text, head.at));
    p.evidence.push(evidence(input, raw, last.at));
    p.warnings.push(head
      ? '羽生市 事務事業評価シート（令和6・7年度総点検）の事業の目的の欄を目的として収録。欄の1行目は抽出テキストで「目」の見出しの直前に離れて出るため、2つの根拠をつないだ（折り返しの改行を除いた）。'
      : '羽生市 事務事業評価シート（令和6・7年度総点検）の事業の目的の欄を目的として収録（折り返しの改行を除いた）。');
    found.push(p);
  });
  // 同じ整理番号のシートが資料内に2回あるときは、目的が同じなら1件にまとめ、違えば取らない
  return found.filter((p, i) => {
    const same = found.filter(q => q.projectCode === p.projectCode);
    return same.every(q => q.purpose === p.purpose && q.projectName === p.projectName) && same[0] === p;
  });
}

/** 年度の記載がない「資料６ 評価結果一覧表」の事業: 同じページに掲載された部局別の事務事業評価シートの事業の目的の欄（同じページの照合）。 */
export const entry = {
  extract: (input: CachedInput) => sheets(input),
  scope: '羽生市 事務事業評価（総点検）の部局別シート（令和6・7年度総点検、10資料）: 事業の目的の欄。評価結果一覧表（資料６）と同じページに掲載された資料として照合。実施内容は列混在のため対象外。',
};
