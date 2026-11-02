import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, stableId } from '../shared';
import { sakaiEntries } from '../batch12/m1-sakai';
import { unwrap } from './m6-util';

// ---------------------------------------------------------------- 境町（事務事業評価シート［平成２３年度事後評価］）
// 公開済みレコードの元と同じ個票（batch12/m1-sakai の抽出）の「２．事務事業の目的」のうち「意図（何を目指しているのか）」を目的、
// 「手段（どのようなやり方で）」を事業内容とする。抽出テキストでは欄の左のラベル（「意 図」「（何を目指して」「いるのか）」
// 「手 段」「（どのようなやり方で）」）と内容の行が交互に並ぶため、次の場合に限る。
//   意図: 「意 図」から「いるのか）」までの行（ラベルを除く）が1〜2行。2行のときは、次の行が「手 段」か、意図の最後の行が句点で終わる
//         （3行目以降があると「いるのか）」の後に続き、手段の行と区別できないため）。
//   手段: 「いるのか）」の後から「成 果」の前までの行（ラベル「手 段」を除き、行頭の「（どのようなやり方で） 」を外す）で、1行か句点で終わるもの
//         （欄からはみ出して文が途中で切れているものを除く）。
// 「成果（どのような成果を得るために）」は目指す成果（計画）で実績ではないため採らない。
const HEAD = '事務事業評価シート\n［平成２３年度事後評価］';
const PURPOSE = /\n意 図\n((?:[^\n]+\n)*?)いるのか）\n((?:[^\n]*\n)*?)成 果\n/;

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '08546') return [];
  const out: ProjectEvaluation[] = [];
  for (const sheet of sakaiEntries['08546'].extract(input, inputs)) {
    const head = sheet.evidence.find(e => e.rawText === HEAD && e.sourceUrl === input.sourceUrl);
    const pos = /^extracted-text:chars:(\d+)-/.exec(head?.cell ?? '');
    if (!pos) continue;
    const start = Number(pos[1]), next = input.text.indexOf(HEAD, start + 1), seg = input.text.slice(start, next < 0 ? input.text.length : next);
    const m = PURPOSE.exec(seg);
    if (!m || seg.split('\n意 図\n').length !== 2) continue;
    const intent = m[1].trimEnd().split('\n').filter(l => l !== '（何を目指して');
    if (!m[1].includes('（何を目指して\n') || !intent.length || intent.length > 2 || intent.some(l => !l.trim() || /^（/.test(l))) continue;
    const rest = m[2].split('\n').filter(l => l.trim());
    if (intent.length === 2 && rest[0] !== '手 段' && !intent[1].endsWith('。')) continue;
    const means = rest.filter(l => l !== '手 段').map(l => l.replace(/^（どのようなやり方で） /, '')).filter(l => l !== '（どのようなやり方で）');
    const record: ProjectEvaluation = { ...sheet, id: stableId(input, `enrich-purpose:${sheet.projectCode}`, sheet.evaluationYear), amounts: [], indicators: [], ratings: [],
      purpose: unwrap(intent.join('\n'), 36), evidence: [...sheet.evidence, evidence(input, m[0].slice(1, -1), start + m.index + 1)] };
    if (rest.includes('手 段') && (means.length === 1 || means.length > 1 && means.at(-1)!.endsWith('。')) && !means.some(l => /^（|^成 果/.test(l))) record.activities = unwrap(means.join('\n'), 36);
    record.warnings = [...sheet.warnings, '事務事業評価シートの「意図（何を目指しているのか）」を目的、「手段（どのようなやり方で）」を事業内容として収録。'
      + '抽出テキストで内容の行と交互に並ぶ欄のラベルを除き、欄の幅いっぱいで折り返した改行を除いた。「成果（どのような成果を得るために）」は目指す成果のため収録しない。'];
    out.push(record);
  }
  return out;
}

export const entry = {
  extract,
  scope: '境町 事務事業評価シート［平成２３年度事後評価］: 意図（目的）・手段（事業内容）。欄のラベルと内容の行の並びから範囲が確定する個票のみ。',
};
