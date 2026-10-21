import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { mergeReprints } from './g1-util';

const VOLUMES = new Set(['c5b821b5f73cca5e636e02a5', '4b9892130613a875d214e7da', '7af4dc644a50811d9b4a486f']);
const SHEET = /令和８年度事務事業評価調書\(令和７年度事業実施分\)\n\n事務事業名 (\d+) ([^\n]+)\n施 策 名 ([^\n]+)\n記 入 所 属 ([^\n]+)\n/g;

export function extractAdachi(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13121' || !VOLUMES.has(input.sourceId) || !input.text.includes('事務事業評価調書')) return [];
  const t = input.text, heads = [...t.matchAll(SHEET)], out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const end = heads[k + 1]?.index ?? t.length, seg = t.slice(h.index!, end);
    const p = project(input, h[1], h[2], 2026, h[0].trimEnd(), h.index);
    p.department = h[4]; p.evaluatedFiscalYear = 2025;
    const block = seg.match(/【今後の方針】\n([\s\S]*?休止・終了)/);
    const picked = block ? [...block[1].replaceAll('\n', '').matchAll(/■ ?([^□■]+)/g)].map(m => m[1].trim()) : [];
    if (block && picked.length === 1) {
      const s = h.index! + block.index!;
      p.ratings.push({ kind: 'self', label: '総合評価(課長評価) 今後の方針', value: picked[0], scale: '拡充 / 改善・変更 / 現状維持 / 縮小 / 統合による終了 / 休止・終了', evidence: evidence(input, block[0], s) });
    }
    p.warnings.push('事務事業評価調書の見出し行（事務事業番号・名称・施策名・記入所属）と総合評価の今後の方針（■印が1つの場合のみ）を収録。評価年度は令和8年度、評価対象年度は令和7年度事業実施分。指標・投入資源の表は年度列と値の対応が段組みで崩れるため未構造化。');
    if (input.truncated) p.warnings.push('保存本文は冊子の途中で切れており、以降の調書はこの資料からは収録していません。');
    out.push(p);
  });
  return mergeReprints(out, p => p.projectCode!);
}
