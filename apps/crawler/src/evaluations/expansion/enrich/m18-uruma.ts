import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- うるま市（教育委員会事務点検・評価報告書 令和6・7年度版）
// 公開済みレコードは同じ報告書の事業シートの事業（令和6年度版: 評価年度2024・事業年度2023、令和7年度版: 2025・2024）。
// 令和6年度版: 「（１）基本情報」の「意図（対象がどのような状態になるか）」欄を目的、「成果」欄を成果として足す。意図欄は縦書きの見出し
//   「目的」「意図」と欄名「（対象がどのような状態になるか）」が文の行の前や間に入るため、それらの見出しの語だけを除いて文をつなぐ
//   （見出しの語以外の語が残る行、句点・「状態」で終わらない文は採らない）。成果欄は「成 果 」の行の後がすぐ「（２）評 価」の場合に限る。
// 令和7年度版: 事業ごとの「目指す状態」（1行）を目的として足す。取組みと成果は一つの欄にまとめて書かれ、境がないため採らない。
// 指定管理者の評価シートは設置目的の欄に縦書きの見出しの字が行頭に混ざるため対象外。
const R6 = '5c47e2675549a41ce4c6564b', R7 = 'b8fbb9bfab5d7045fdc0ba54';
const LABEL = /^(?:目 的|意 図|（対象がどのような?|な?状態になるか）)(?: |$)/;

function r6(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, heads = [...t.matchAll(/^事業名称 ([^\n]+)\n担 当 部 (\S+) 課 名 (\S+)\n/gm)], out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    if (input.truncated && i === heads.length - 1) return;
    const start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length), name = h[1].trim();
    const p = project(input, `${name}:narrative`, name, 2024, h[0].slice(0, -1), start);
    p.evaluatedFiscalYear = 2023;
    p.department = `${h[2]} ${h[3]}`;
    const m = /\n(目 的(?: [^\n]*)?\n(?:[^\n]+\n)*?)成 果 ([^\n]+)\n（２）評 価\n/.exec(seg);
    if (m) {
      const block = m[1].slice(0, -1);
      const pieces: string[] = [];
      let ok = block.split('\n').some(l => /^意 図(?: |$)/.test(l)) && !/対 象/.test(block);
      for (const line of block.split('\n')) {
        let rest = line;
        for (let k = 0; k < 2 && LABEL.test(rest); k++) rest = rest.replace(LABEL, '');
        if (rest && /^(?:目|的|意|図)$|になるか）|（対象が/.test(rest)) ok = false;
        if (rest) pieces.push(rest);
      }
      const value = pieces.join('');
      if (ok && value.length >= 8 && /(。|状態)$/.test(value)) {
        p.purpose = value;
        p.evidence.push(evidence(input, block, start + m.index! + 1));
      }
      p.outcomes = m[2].trim();
      const at = start + m.index! + m[0].indexOf(`成 果 ${m[2]}`) + 4;
      p.evidence.push(evidence(input, m[2], at));
    }
    if (!p.purpose && !p.outcomes) return;
    p.warnings.push('事務点検・評価事業シートの基本情報の「意図（対象がどのような状態になるか）」欄（目的。縦書きの見出し「目的」「意図」と欄名の語だけを除いてつないだ）と「成果」欄。');
    out.push(p);
  });
  return out;
}

function r7(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, out: ProjectEvaluation[] = [];
  const rows = [...t.matchAll(/^事業や取組み ([^\n]+)\n担当課 (\S+)\n目指す状態 ([^\n]+)\n評価の方法 /gm)];
  const count = new Map<string, number>();
  for (const r of rows) count.set(r[1].trim(), (count.get(r[1].trim()) ?? 0) + 1);
  for (const r of rows) {
    const name = r[1].trim();
    if (count.get(name) !== 1) continue;
    const p = project(input, `${name}:purpose`, name, 2025, r[0].slice(0, -('評価の方法 '.length + 1)), r.index!);
    p.evaluatedFiscalYear = 2024;
    p.department = r[2];
    p.purpose = r[3].trim();
    p.evidence.push(evidence(input, r[3], r.index! + r[0].indexOf(`目指す状態 ${r[3]}`) + '目指す状態 '.length));
    p.warnings.push('事務点検・評価報告書（令和7年度版）の事業ごとの「目指す状態」（目的）。');
    out.push(p);
  }
  return out;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '47213') return [];
  if (input.sourceId === R6 && input.text.startsWith('令和６年度\nうるま市教育委員会事務点検・評価報告書\n（令和５年度事業対象）')) return r6(input);
  if (input.sourceId === R7) return r7(input);
  return [];
}

export const entry = {
  extract,
  scope: 'うるま市 教育委員会事務点検・評価報告書: 令和6年度版（令和5年度事業）の意図欄（目的）・成果欄、令和7年度版（令和6年度事業）の目指す状態（目的）。指定管理者の評価シートは設置目的の欄に縦書き見出しの字が混ざるため対象外。',
};
