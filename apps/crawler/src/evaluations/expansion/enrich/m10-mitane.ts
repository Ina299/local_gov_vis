import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { joinWrapped } from './m10-util';

// ---------------------------------------------------------------- 三種町（みらい創造プラン 事業検証シート、令和3〜5・7年度事業）
// 公開済みレコードは同じ検証シートPDF（審議会検証事業分）から作られ、目的・内容が空欄。各シートの「２．概要」の
// 「目 的」「内 容」欄は見出しの直後の空行までが欄の内容（欄の幅での折り返しだけを除いてつなぐ）。
// 成果は、令和3年度版の「成果・課題等」（Check・Action の欄、内容が見出しの前）と令和7年度版の「成果」欄に限る
// （令和4・5年度版は取組状況と成果・課題等の見出しが並んだ後に内容が続き、欄の境が決まらないため採らない）。
// 年度は資料冒頭の「令和N年度」（事業年度。公開済みレコードの evaluatedFiscalYear と同じ）。
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
const SHEET = /事業検証シート\n１．基本事項\n/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '05348' || !/\/group\/3\/(?:R3kenshou|R4kenshou|kobetukenshou|kenshoushitoR7)\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, year = /令和([０-９\d])年度/.exec(t.slice(0, 60));
  if (!year) return [];
  const fy = 2018 + Number(ascii(year[1])), r7 = fy === 2025;
  const heads = [...t.matchAll(SHEET)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].index! + heads[i][0].length, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    if (input.truncated && i === heads.length - 1) continue;
    const name = r7 ? /\n担当課名\n\n●\n\n([^\n]+)\n\n([^\n]+)\nみらい創造プラン\n/.exec(seg) : /\n名称\n\n([^\n]+)\n\nPlan\n目 的\n/.exec(seg);
    const dept = r7 ? name?.[1] : /\n担当課名\n\n([^\n]+)\n\n/.exec(seg)?.[1];
    const purpose = (r7 ? /\n２．概 要\n\n?目 的\n\n((?:[^\n]+\n)+)\n内 容\n\n/ : /\nPlan\n目 的\n\n((?:[^\n]+\n)+)\nPlan\n内 容\n\n/).exec(seg);
    if (!name || !purpose) continue;
    const act = (r7 ? /\n内 容\n\n((?:[^\n]+\n)+)\n３．成果と課題\n/ : /\nPlan\n内 容\n\n((?:[^\n]+\n)+)\n３．実 績\n/).exec(seg);
    const res = (r7 ? /\n３．成果と課題\n\n?成果\n\n((?:[^\n]+\n)+)\n課題等\n/ : /\n取組状況\nCheck・Action\n((?:[^\n]+\n)+)\n成果・課題等\n/).exec(seg);
    const projectName = r7 ? name[2].trim() : name[1].trim();
    const p = project(input, `${projectName}:narrative`, projectName, null, seg.slice(name.index! + 1, name.index! + name[0].length - 1), start + name.index! + 1);
    p.evaluatedFiscalYear = fy;
    p.department = dept?.trim() || null;
    const field = (m: RegExpExecArray) => {
      const raw = m[1].slice(0, -1), at = start + m.index! + m[0].indexOf(m[1]);
      p.evidence.push(evidence(input, raw, at));
      return joinWrapped(raw, 35);
    };
    p.purpose = field(purpose);
    if (act) p.activities = field(act);
    if (res) p.outcomes = field(res);
    p.warnings.push('三種町みらい創造プラン事業検証シートの「目的」「内容」欄（と令和3年度版の「成果・課題等」、令和7年度版の「成果」欄）。欄の幅での折り返しだけを除いてつないだ。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '三種町 みらい創造プラン 事業検証シート（令和3・4・5・7年度事業、審議会検証事業分）: 目的・内容（目的・事業内容）、令和3・7年度版は成果。事業一覧表（令和3年度一覧）は目的の欄がなく対象外。',
};
