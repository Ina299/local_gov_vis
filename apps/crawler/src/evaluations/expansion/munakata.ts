import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

const toNumber = (raw: string) => Number(raw.replaceAll(',', ''));
const eraYear = (raw: string) => 2018 + (raw === '元' ? 1 : Number(raw.normalize('NFKC')));

/** Departmental project details from the final-accounts report; fiscal/policy summaries are excluded. */
export function extractMunakata(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '40220' || input.format !== 'pdf') return [];
  const cover = input.text.match(/^令和([2-4２-４])年度 決算成果報告書/);
  if (!cover) return [];
  const fiscalYear = eraYear(cover[1]);
  const headers = [...input.text.matchAll(/^([^\n]+?) ■事業概要■/gm)];
  const records: ProjectEvaluation[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index!;
    let raw = input.text.slice(start, headers[i + 1]?.index ?? input.text.length);
    // Stop before the next department's policy commentary and before the accounts appendices.
    const boundary = raw.search(/\n(?:[^\n]*部 一般会計決算額|その他の決算額|資料[１1２2] |施策別重点課題の総括|主要事業の実績)/);
    if (boundary >= 0) raw = raw.slice(0, boundary);
    if (input.truncated && i === headers.length - 1 && boundary < 0) continue;
    const resultOffset = raw.indexOf('■実績・成果■');
    const yearHeader = raw.match(/令和([元0-9０-９]+)年度 令和([元0-9０-９]+)年度 増減/);
    if (resultOffset < 0 || !raw.includes('事業費（千円）') || !yearHeader || eraYear(yearHeader[1]) !== fiscalYear - 1 || eraYear(yearHeader[2]) !== fiscalYear) continue;
    const name = headers[i][1];
    const department = raw.split('\n')[1]?.match(/^([^ ]*(?:課|室|局))(?: |$)/)?.[1] ?? null;
    const identity = `${department ?? '部署不明'}:${name}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const supplementary = raw.slice(resultOffset).search(/\n【/);
    if (supplementary >= 0) raw = raw.slice(0, resultOffset + supplementary);
    const record = project(input, `担当部署・事業名:${identity}`, name, null, raw, start);
    record.evaluatedFiscalYear = fiscalYear;
    record.department = department;
    // Exact three-column monetary rows only; require the printed change to reconcile.
    const candidates = [...raw.matchAll(/^([\d,]+) ([\d,]+) (▲ ?[\d,]+|[\d,]+)(?= |$)/gm)]
      .filter(row => row.index! > yearHeader.index! && toNumber(row[2]) - toNumber(row[1]) === (row[3].startsWith('▲') ? -toNumber(row[3].replace(/▲ ?/, '')) : toNumber(row[3])));
    if (candidates.length === 1) {
      const row = candidates[0];
      const amountYen = toNumber(row[2]) * 1000;
      if (Number.isSafeInteger(amountYen)) record.amounts.push({ kind: 'actual', fiscalYear, amountYen,
        rawValue: row[2], rawUnit: '千円', evidence: evidence(input, raw.slice(raw.indexOf('事業費（千円）'), row.index! + row[0].length), start + raw.indexOf('事業費（千円）')) });
    }
    record.outcomes = raw.slice(resultOffset).trim() || null;
    record.warnings.push('決算成果報告書の事業別「主要事業の実績」を部分構造化。部の一般会計総額や施策総括、資料編は含めません。原文事業番号はなく担当部署と事業名を組み合わせて安定識別。補足表の見出し以降は隣接事業の表が混在するため除外。費用は前年度・当年度・増減の3値が明示され差額も一致する一意の行のみ当年度決算として採用。実績・成果欄は左右列が交錯するため原文を保持し指標値へ分解していません。');
    records.push(record);
  }
  return records;
}
