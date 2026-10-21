import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { dedupe } from './g7-util';

const SECTION = '12 施策を構成する事務事業';
const LABEL = /^(目的|概要|成果|問題|対策|事業費|[\d,]+)$/;

/**
 * 南会津町 施策マネジメントシート（基本目標2〜5、batch7取得分）の「12 施策を構成する事務事業」欄。
 * 事業名・担当係が番号直後に連続して並ぶブロックだけを事業名＋担当係の部分レコードにする。
 */
export function extractMinamiaizuBatch7(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '07368' || !/\/material\/files\/group\/1\/[2-5]-\d-\d[a-z-]+\.pdf$/.test(input.sourceUrl)) return [];
  if (!input.text.includes('南会津町総合振興計画施策マネジメントシート')) return [];
  const from = input.text.indexOf(SECTION), to = input.text.indexOf('事業費の合計', from);
  if (from < 0 || to < 0) return [];
  const sec = input.text.slice(from, to), out: ProjectEvaluation[] = [];
  for (const m of sec.matchAll(/\n\n(\d{2})\n\n((?:[^\n]+\n){1,5}?)([^\n\s]+係)(?=\n)/g)) {
    let lines = m[2].split('\n').filter(Boolean);
    if (lines.some(l => LABEL.test(l))) continue;
    let department: string | null = null;
    if (/課$/.test(lines[0]) && lines.length > 1) { department = lines[0]; lines = lines.slice(1); }
    const name = lines.join('');
    // Names still carrying column fragments or rename markers cannot be confirmed from the text.
    if (/係|課|【|】/.test(name) || name.length < 3) continue;
    const isNew = name.startsWith('★');
    const clean = name.replace(/^★/, '');
    const raw = m[0].slice(2), start = from + m.index! + 2;
    const p = project(input, `${input.sourceId}:${m[1]}`, clean, null, raw, start);
    p.projectCode = null;
    p.department = department ? `${department} ${m[3]}` : m[3];
    p.evidence.push(evidence(input, SECTION, from));
    p.warnings.push(`施策マネジメントシート「12 施策を構成する事務事業」の一覧番号${m[1]}（施策内連番のためprojectCodeは未設定）。事業名と担当係が連続して並ぶブロックのみ収録し、改行で分割された事業名は行を連結。`);
    p.warnings.push('目的・概要・成果・問題・対策・事業費の各欄は抽出テキスト上で他事業と列が混在し、事業との対応を確定できないため未収録。作成年度も見出しが分断されており確定できないため評価年度は未設定。');
    if (isNew) p.warnings.push('事業名先頭の★は原文の「令和３年度新規事業」表示。');
    out.push(p);
  }
  return dedupe(out, p => p.projectName);
}
