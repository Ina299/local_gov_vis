import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { type Entry, acrossMunicipality, segments } from './m1-util';

// ---------------------------------------------------------------- 08546 境町 事務事業評価シート［平成２３年度事後評価］
const SAKAI_REPORT = 'ca2c86014150f7feb35a945e';
const SAKAI_SHEETS = new Set(['14d5d2ff838fd89f1f5a7aa3', '23226b063b42c3ebe4427ac9', '3ba03c43d6aad051e06af4a0', '78b6d370e2115b2b3cfe1a41', '7e12a8d4433f9c76920b2525', 'f90f18696009e11e46fccbcc']);
const SAKAI_REPORT_HEAD = '平成 24 年度\n\n行政評価（事務事業）結果報告';
const SAKAI_REPORT_SCOPE = '今年度は，平成 23 年度に実施した 80 事業を対象に「担当課評価」を実施しました。';
const SAKAI_SHEET_HEAD = '事務事業評価シート\n［平成２３年度事後評価］';

function extractSakaiOne(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '08546' || !SAKAI_SHEETS.has(input.sourceId)) return [];
  const report = inputs.find(i => i.sourceId === SAKAI_REPORT);
  if (!report || !report.text.startsWith(SAKAI_REPORT_HEAD) || !report.text.includes(SAKAI_REPORT_SCOPE)) return [];
  // 結果報告の「事務事業一次評価一覧」: 番号・事業番号・事業名・担当部課。
  const list = new Map<string, RegExpMatchArray>();
  for (const m of report.text.matchAll(/\n(\d+)\n\n(\d{7}) (\S[^\n]*?)\n\n(\S+?)(?: +・・・|\n)/g)) list.set(m[1], m);
  const out: ProjectEvaluation[] = [];
  for (const sheet of segments(input.text, new RegExp(SAKAI_SHEET_HEAD.replace(/[［］]/g, '\\$&'), 'g'))) {
    const no = /整理番号\n+(\d+)\n/.exec(sheet.text), code = /\n(\d{7})\n/.exec(sheet.text);
    const row = no && list.get(no[1]);
    if (!no || !code || !row || row[2] !== code[1]) continue;
    const [name, dept] = [row[3], row[4]];
    const nameAt = sheet.text.indexOf(`\n${name}\n`), deptAt = sheet.text.indexOf(`\n${dept}\n`);
    if (nameAt < 0 || deptAt < 0) continue;
    const p = project(input, code[1], name, 2012, name, sheet.at + nameAt + 1);
    p.department = dept;
    p.evaluatedFiscalYear = 2011;
    p.evidence.push(evidence(input, SAKAI_SHEET_HEAD, sheet.at), evidence(input, no[0].slice(0, -1), sheet.at + no.index!),
      evidence(input, code[1], sheet.at + code.index! + 1), evidence(input, dept, sheet.at + deptAt + 1),
      evidence(report, row[0].trim(), row.index! + 1), evidence(report, SAKAI_REPORT_HEAD, 0), evidence(report, SAKAI_REPORT_SCOPE));
    p.warnings.push('境町 事務事業評価シート［平成２３年度事後評価］。事業名・担当部課は平成24年度行政評価（事務事業）結果報告（試行）の一次評価一覧と整理番号・事業番号が一致するものだけ収録。評価年度は結果報告の「平成24年度」、評価対象年度は「平成23年度に実施した80事業」による。',
      '経費・指標の表は空欄の行が抽出テキストで詰まり行と列の対応が確定できないため、項目別評価・総合評価・今後の方向性は選択印が抽出テキストに残らないため、いずれも未収録。');
    out.push(p);
  }
  return out;
}

export const sakaiEntries: Record<string, Entry> = {
  '08546': {
    extract: (input, inputs) => acrossMunicipality(input, inputs, extractSakaiOne, p => `${p.projectName}|${p.department}`),
    scope: '平成24年度（試行）の事務事業評価シート［平成23年度事後評価］から、結果報告の一次評価一覧と整理番号・事業番号が一致する事業の事業名・事業番号・担当部課・評価年度を構造化。経費・指標は列崩れ、評価区分は選択印が残らないため対象外。結果報告本体・基本方針は対象外。',
  },
};
