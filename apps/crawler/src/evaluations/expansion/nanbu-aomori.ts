import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

export function extractNanbuAomori(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '02445' || input.format !== 'pdf' || input.truncated) return [];
  const cover = input.text.slice(0, 150).normalize('NFKC').match(/^平成(\d+)年度[\s\S]*?≪ 平成 (\d+) 年度実績 ≫/);
  if (!cover) return [];
  const first = input.text.indexOf('事業毎個別評価表 ≪');
  if (first < 0) return [];
  const end = input.text.indexOf('\n教育委員会活動の状況', first);
  const source = input.text.slice(first, end < 0 ? undefined : end);
  // All ratings are boundaries, including unnamed school-lunch goals. Those goals are not projects.
  const headers = [...source.matchAll(/^(.*)事業の評価 ([◎○〇△])$/gm)];
  const result: ProjectEvaluation[] = [];
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    let name = header[1].trim();
    if (!name && source.slice(header.index!).startsWith(header[0] + '\nふるさと“楽習”キャンプ\n')) name = 'ふるさと“楽習”キャンプ';
    if (!name) continue;
    let raw = source.slice(header.index!, headers[i + 1]?.index ?? source.length);
    const boundary = raw.search(/\n(?:事業毎個別評価表|[^\n]*関係 No\.)/);
    if (boundary >= 0) raw = raw.slice(0, boundary);
    const overall = raw.match(/総合評価 ([Ａ-ＥA-E])/);
    if (!overall || !raw.includes('向性')) continue;
    const start = first + header.index!;
    const record = project(input, name, name, 1988 + Number(cover[1]), raw, start);
    record.projectCode = null;
    record.evaluatedFiscalYear = 1988 + Number(cover[2]);
    record.activities = '事業概要・実績・成果・評価と方向性（原文欄）\n' + raw;
    record.ratings.push({ kind: 'self', label: '事業の評価', value: header[2], scale: '◎（期待どおり）／○（ほぼ達成）／△（期待以下）', evidence: evidence(input, header[0], start) });
    record.ratings.push({ kind: 'self', label: '総合評価', value: overall[1], scale: null, evidence: evidence(input, overall[0], start + overall.index!) });
    record.warnings.push('縦書き欄見出しのため概要・実績・成果・方向性を分割せず原文を保持。事業費は予算・決算の種別を確定できず金額化していません。');
    result.push(record);
  }
  return result;
}
