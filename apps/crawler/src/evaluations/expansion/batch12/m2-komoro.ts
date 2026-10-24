import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import type { Entry } from '../batch9/i1-util';
import { municipality } from './m2-util';

// ---------------------------------------------------------------- 小諸市 令和７年度事業評価（総合計画審議会 参考資料）
const TITLE = '第１回総合計画審議会資料\n令和８年８月３日\n\n《参考資料》\n令和７年度事業評価\n';
const NAME = '\n事 務 事 業 名\n';
// 票の欄見出し・選択肢で、事業名ではない行。
const LABELS = new Set(['新規・継続', '事業優先順位', '会計・款・項・目', '所 管 課', '市長公約事項', '事業概要', '継続', '新規', '有', '無', '特定財源', '事業実施期間']);

export function komoroSheets(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith(TITLE)) return [];
  const starts: number[] = [];
  for (let i = t.indexOf(NAME); i >= 0; i = t.indexOf(NAME, i + 1)) starts.push(i + 1);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    // 票の見出し部分（事業名欄から「特定財源」欄まで）だけを見る。
    const end = t.indexOf('\n特定財源\n', s);
    if (end < 0 || (starts[k + 1] ?? Infinity) < end) return;
    const head = t.slice(s + NAME.length - 1, end);
    const lines = head.split('\n').filter(l => l.trim());
    // 見出し・選択肢・課名・会計名（「会計・款・項・目」欄の値）は読み飛ばし、最初に残った行が文や金額なら事業名が確定しないため除外。
    const name = lines.find(l => !LABELS.has(l) && !/^[A-DＡ-Ｄ]$/.test(l) && !/^[^\s・、。]{2,20}(課|室|局)$/.test(l) && !/会計$|会計・/.test(l));
    if (!name || name.length > 40 || /^・|[、。]|ます$|^【|年度$|千円$/.test(name)) return;
    const deps = lines.filter(l => l !== name && /^[^\s・、。]{2,20}(課|室|局)$/.test(l));
    const nameAt = s + NAME.length - 1 + head.indexOf(`\n${name}\n`) + 1;
    const p = project(input, `R7:${name}`, name, 2025, name, nameAt);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2025;
    p.evidence.push(evidence(input, '事 務 事 業 名', s), evidence(input, TITLE.trim(), 0));
    if (deps.length === 1) {
      p.department = deps[0];
      p.evidence.push(evidence(input, deps[0], s + NAME.length - 1 + head.indexOf(`\n${deps[0]}\n`) + 1));
    }
    p.warnings.push('小諸市 令和７年度事業評価（総合計画審議会 参考資料）の事務事業票。評価年度は表題「令和７年度事業評価」、評価対象年度は「令和７年度 実績」欄による。票の見出し部分の欄の並びが票ごとに異なるため、事業名は「事 務 事 業 名」欄から「特定財源」欄までの最初の非見出し行、所管課は同範囲で唯一の課名行のみ採用。年度別事業費は決算・予算の別が本文に明記されないため、指標（計画・実績）・事業優先順位・今後の方針は抽出テキストで票・列の対応が確定しないため未収録。');
    out.push(p);
  });
  return out;
}

export const komoroEntries: Record<string, Entry> = {
  '20208': {
    extract: municipality(komoroSheets, p => `${p.evaluatedFiscalYear}:${p.projectName}`),
    scope: '小諸市 令和７年度事業評価（総合計画審議会 参考資料）の事務事業票ごとの事務事業名・所管課（見出し部分で一意に読めるもの）・評価年度/評価対象年度のみの部分構造化。年度別事業費（決算・予算の別が不明）・活動/成果指標・事業優先順位・今後の方針、施策評価（r7sisakuhyouka）は対象外。',
  },
};
