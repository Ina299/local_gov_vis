/**
 * 08217 取手市: 令和７年度分 重点事業マネジメントシート（部別PDF）。公開済みレコード（同じシート、評価対象年度2025）の空欄の目的に
 * 「事業目的・概要」欄を補う。欄は見出しの直後から成果指標の表の見出しの手前までの1段落で、他の欄と行が混ざらない。
 * 進捗状況・今後の方向性は進捗度・方向性の記号と同じ行に混ざるため対象外。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';

const HEADING = '令和７年度分 重点事業マネジメントシート';
/** 本文1行は60字前後。 */
const WRAP = 50;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '08217' || input.format !== 'pdf' || !input.text.startsWith(HEADING)) return [];
  const text = input.text, out: ProjectEvaluation[] = [];
  const starts = [...text.matchAll(new RegExp(`(?:^|\\n)${HEADING}\\n`, 'g'))].map(m => m.index! + (m[0].startsWith('\n') ? 1 : 0));
  starts.forEach((start, i) => {
    if (input.truncated && i === starts.length - 1) return;
    const sheet = text.slice(start, starts[i + 1] ?? text.length);
    // 詰めた様式（1行に見出しと値）と、空行で区切った様式の2通り。
    const name = /^.+\n重点事業名(?: |\n\n)([^\n]+)\n\n?総合計画\n/.exec(sheet);
    const dept = /担当部 ([^\n ]+) 担当課 ([^\n ]+)\n事業目的・概要\n/.exec(sheet) ?? /\n担当課\n\n([^\n]+)\n\n事業目的・概要\n/.exec(sheet);
    const body = /\n事業目的・概要\n\n?((?:[^\n]+\n)+?)\n?(?:R6 R7 R8 R9\n)?成果指標[ \n]/.exec(sheet);
    if (!name || !dept || !body || sheet.split('事業目的・概要').length !== 2) return;
    const raw = body[1].replace(/\n$/, ''), lines = raw.split('\n');
    if (lines.some(l => /^(R\d|成果指標|単位|（実績）)/.test(l))) return;
    const at = start + body.index! + body[0].indexOf(raw);
    const p = project(input, `narrative-${start}`, name[1].trim(), null, sheet.slice(0, name[0].length - 1), start);
    p.department = dept.length === 3 ? dept[2] : dept[1];
    p.evaluatedFiscalYear = 2025;
    p.purpose = lines.reduce((acc, l, k) => acc + (k === 0 ? '' : lines[k - 1].length >= WRAP && !/。$/.test(lines[k - 1]) ? '' : '\n') + l, '');
    p.evidence.push(evidence(input, raw, at));
    p.warnings.push('取手市 重点事業マネジメントシート（令和7年度分）の「事業目的・概要」欄を目的として収録（欄名のとおり事業の概要を含む）。PDFの折り返しの改行を除いた。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '取手市 令和７年度分 重点事業マネジメントシート（部別PDF）の「事業目的・概要」欄。進捗状況・今後の方向性は記号と行が混ざるため対象外。',
};
