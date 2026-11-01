/** 西宮市 (28204): 事務事業評価結果報告書（令和6・7年度）の西宮市事務事業評価シートの「事業目標・成果・意図」欄。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// 公開済みレコードは同じ評価シート（1事業2ページ）から事務事業名・担当部署・事業費・評価を取ったもの（batch8/h2-nishinomiya）。
// 「Ⅱ. 事務事業の実施概要」の表で、対象の欄（1行）の後に縦書きの見出し「対」「象」、続いて
// 「事業目標・成果・意図（対象をどのような状態にしたいか）」の欄の本文が見出しの文字（「事業目標・成果」「・」
// 「意 （対象をどのような」「状態にしたいか）」「図」）の行と交互に並ぶ。見出しの行だけを除き、本文の行を改行のまま採る。
// 欄の終わりは「実施形態」の見出しか、実施形態の選択肢（直営・一部委託（民間等）など）の行。
// 見出しの文字と本文が同じ行に混ざる欄、対象の欄が長く折り返している可能性のある欄（40文字以上）は採らない。
// 事業概要・実施内容の欄は縦書きの見出しの文字が本文の行頭に混ざるため対象外。
const SOURCES: Record<string, [number, number]> = {
  '1157728c019b791c8364feeb': [2024, 2023], '30ba9703e084806b5a3be3ed': [2024, 2023], '127a9e89395f56dca9e4b98e': [2024, 2023],
  '33b1564bb7b9adfbce5467e5': [2024, 2023], '2d2c360739016f8ef325f1bb': [2024, 2023],
  'f21b4fdfdeef64aec63aca9f': [2025, 2024], '7851c8365072735da6559877': [2025, 2024], '6157a41414423916159390ed': [2025, 2024],
  '7f0f61b255b27291fb9ff998': [2025, 2024], 'dab7a9a488971dabada339bc': [2025, 2024],
};
const SHEET_START = /令和(\d+)年度\n\n令和(\d+)年度実施事業\nⅠ\.\n\n西宮市事務事業評価シート\n\n事務事業に関する基礎情報/g;
const TARGET = /\n対象\n([^\n]+)\n対\n象\n/g;
const LABEL = /^(?:事業目標・成果|・|意 （対象をどのような|（対象をどのような|意|状態にしたいか）|図|図 状態にしたいか）)$/;
const END = /^(?:実施形態（一部委託の.*|直営|(?:一部|全部)委託（[^）\n]+）|補助金・負担金)$/;

function extract(input: CachedInput): ProjectEvaluation[] {
  const years = SOURCES[input.sourceId];
  if (input.municipalityCode !== '28204' || !years) return [];
  const [evalYear, evaluatedYear] = years;
  const t = input.text;
  const starts = [...t.matchAll(SHEET_START)].filter(m => Number(m[1]) === evalYear - 2018 && Number(m[2]) === evaluatedYear - 2018);
  const out: ProjectEvaluation[] = [];
  starts.forEach((m, k) => {
    if (input.truncated && k === starts.length - 1) return;
    const from = m.index, seg = t.slice(from, starts[k + 1]?.index ?? t.length);
    const names = [...seg.matchAll(/\n事務事業名\n\n([^\n]+)\n\n担当部署\n/g)];
    const targets = [...seg.matchAll(TARGET)];
    if (names.length !== 1 || targets.length !== 1 || targets[0][1].length >= 40) return;
    const bodyAt = targets[0].index + targets[0][0].length;
    const lines = seg.slice(bodyAt).split('\n');
    const end = lines.findIndex(l => END.test(l));
    if (end < 1) return;
    const block = lines.slice(0, end), body = block.filter(l => !LABEL.test(l)), labels = block.filter(l => LABEL.test(l));
    // 見出しの文字がそろって（「事業目標・成果」は1回）、本文の行に空行・見出しの断片がないこと。
    if (!body.length || labels.filter(l => l === '事業目標・成果').length !== 1 || !labels.some(l => l.startsWith('図'))
      || body.some(l => !l.trim() || /対象をどのような|状態にしたいか|^事業目標|^(?:意|図) /.test(l))) return;
    // 見出しの「図」より後の本文（欄の下端に続く文）は2行まで。それより長いと次の欄との境が確かでない。
    const lastLabel = block.map(l => l.startsWith('図')).lastIndexOf(true);
    if (block.length - 1 - lastLabel > 2) return;
    const name = names[0][1].trim();
    const p = project(input, `${name}:purpose`, name, evalYear, names[0][0].slice(1, -1), from + names[0].index + 1);
    p.projectCode = null; p.evaluatedFiscalYear = evaluatedYear;
    p.purpose = body.join('\n');
    p.evidence.push(evidence(input, block.join('\n'), from + bodyAt));
    p.warnings.push('評価シートの「事業目標・成果・意図（対象をどのような状態にしたいか）」欄の原文。縦書きの見出しの文字の行だけを除き、本文の行は改行も含めてそのまま採った。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '西宮市 事務事業評価結果報告書（令和6・7年度）の評価シートから、事業目標・成果・意図の欄（見出しの文字が本文の行に混ざらない欄のみ）。事業概要・実施内容の欄は見出しの文字が本文の行頭に混ざるため対象外。',
};
