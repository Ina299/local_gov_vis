import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m28-util';

// ---------------------------------------------------------------- 古座川町（教育委員会事務点検評価報告書・令和５年度事業分）
// 公開済みレコードは同じPDFの「事務点検評価書（令和５年度事業）」各票の事業名から作られ、評価年度2024・対象年度2023・教育課。
// 票の左列は「根拠法令」「事業の目的」「事業の内容」の順で、抽出テキストでは欄の見出しと中身の位置が票ごとにずれる。
// 中身は根拠法令の値の後に「目的の段落」「内容の段落」の順で並ぶ（見出しが段落の前にも後にも出る）。
// 次の2形だけを採る:
//  (a) 「事業の目的」の直前の段落が根拠法令の値1行＋文章（句点で終わる）→ その文章を目的、見出しの後の段落を事業内容とする。
//  (b) 「事業の目的」の直前の段落が根拠法令の値1行だけ → 見出しの後の1段落目を目的、2段落目を事業内容とする。
//      見出しの後に段落が1つしかない票（目的と内容の区切りが本文で決まらない）は採らない。
// 事業内容は「事業の内容」見出しの手前まで（見出しの後に予算額の表以外の行が続く票は内容の範囲が決まらないため取らない）。
// 「達成した成果の内容」欄は見出しが本文の行の途中に割り込むため取らない。
const FILE = 'https://www.town.kozagawa.lg.jp/pdf/r6_kyouiku_jimuhyoukahoukoku.pdf';
const HEAD = '事務点検評価書（令和５年度事業）\n';
const NAME = /^事\n\n業\n\n名\n\n([^\n]+)\n\n担\n\n当\n\n課\n\n([^\n]+)\n/;
const PURPOSE_LABEL = '\n事業の目的\n';
const CONTENT_LABEL = /\n事業の内容\n/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '30424' || input.sourceUrl !== FILE) return [];
  const t = input.text, starts = [...t.matchAll(new RegExp(HEAD, 'g'))].map(m => m.index! + HEAD.length);
  const out: ProjectEvaluation[] = [];
  for (const [i, s] of starts.entries()) {
    if (input.truncated && i === starts.length - 1) continue;
    const sh = t.slice(s, starts[i + 1] ?? t.length), n = NAME.exec(sh);
    if (!n) continue;
    const lp = sh.indexOf(PURPOSE_LABEL), cm = CONTENT_LABEL.exec(sh);
    if (lp < 0 || !cm || cm.index < lp || sh.indexOf(PURPOSE_LABEL, lp + 1) >= 0) continue;
    // 目的見出しの直前の段落（空行で区切られた行のまとまり）
    const beforeEnd = sh.lastIndexOf('\n', lp - 1) === lp - 1 ? lp - 1 : lp;
    const beforeStart = sh.lastIndexOf('\n\n', beforeEnd - 1) + 2;
    const before = sh.slice(beforeStart, beforeEnd).split('\n');
    // 目的見出しの後から事業の内容見出しまでの段落
    const afterStart = lp + PURPOSE_LABEL.length + (sh[lp + PURPOSE_LABEL.length] === '\n' ? 1 : 0);
    const afterText = sh.slice(afterStart, cm.index).replace(/\n+$/, '');
    const paras: { text: string; at: number }[] = [];
    let pos = 0;
    for (const part of afterText.split('\n\n')) {
      if (part.trim()) paras.push({ text: part, at: afterStart + pos });
      pos += part.length + 2;
    }
    // 事業の内容見出しの後にすぐ文が続く票（見出しが段落の途中にある）は内容の範囲が決まらない
    // 見出しの後が予算額の表（令和４年度…）で始まらない票も、内容の欄が見出しの後に続いている
    const contentFollowed = !/^\n令和[０-９\d]+年度\n/.test(sh.slice(cm.index + cm[0].length));
    let purpose: { text: string; at: number } | null = null, content: { text: string; at: number } | null = null;
    const law = before[0];
    if (before.length >= 2 && !/。$/.test(law) && /。$/.test(before[before.length - 1]) && before.slice(1).every(l => l.length > 0)) {
      const body = before.slice(1).join('\n');
      purpose = { text: body, at: beforeStart + law.length + 1 };
      if (paras.length === 1 && !contentFollowed) content = paras[0];
    } else if (before.length === 1 && !/。$/.test(law) && paras.length === 2) {
      purpose = paras[0];
      if (!contentFollowed) content = paras[1];
    }
    if (!purpose) continue;
    const p = project(input, `narrative:${i + 1}`, n[1].trim(), 2024, n[0].slice(0, -1), s);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2023;
    p.department = n[2].trim();
    p.purpose = unwrap(purpose.text);
    p.evidence.push(evidence(input, purpose.text, s + purpose.at));
    if (content) {
      p.activities = unwrap(content.text);
      p.evidence.push(evidence(input, content.text, s + content.at));
    }
    p.warnings.push('古座川町 事務点検評価書（令和５年度事業）の「事業の目的」欄を目的、「事業の内容」欄を事業内容として収録。'
      + '抽出テキストでは欄の見出しと中身の位置がずれるため、根拠法令の値の後の1段落目を目的、2段落目を事業内容とみなせる票に限る。欄の幅での折り返しの改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '古座川町 教育委員会事務点検評価報告書（令和５年度事業分）: 事務点検評価書の「事業の目的」（目的）・「事業の内容」（事業内容）。目的と内容の段落の区切りが本文で決まる票に限る。',
};
