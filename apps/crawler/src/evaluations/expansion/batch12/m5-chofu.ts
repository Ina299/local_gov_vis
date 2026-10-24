import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { normalize, rating } from '../batch8/h6-util';
import { type Entry, groupAt, municipal } from './m5-util';

/* ---------- 13208 調布市 施策・事務事業マネジメントシート【令和７年度】の基本計画事業の取組実績 ---------- */

const SHEET = '施策・事務事業マネジメントシート【令和７年度】\n';
/** 参考資料５ 令和７年度事務事業一覧（施策体系順）: 折り返した事業名をつないだ結果の照合に使う。 */
const LIST = '8a0c0a2c04503e1f28b8698e';
const CHECKS = ['計画どおり', '計画遅れ', '計画前倒し'];

function chofu(input: CachedInput, list: string | null): ProjectEvaluation[] {
  const t = input.text;
  if (!t.includes(SHEET) || !/\/r6-30-\d+\.pdf$/.test(input.sourceUrl) || list === null) return [];
  const head = t.indexOf(SHEET), out: ProjectEvaluation[] = [];
  const rx = /\n実績\(Check\)\n✔ (計画どおり|計画遅れ|計画前倒し)\n\n(\d{2,3})\n\n((?:[^\n]+\n){1,4}?)\n([^\n]+)\n([^\n]+)\n/dg;
  for (const m of t.matchAll(rx)) {
    const [, checked, no, nameBlock, o1, o2] = m;
    // 残りの2つの選択肢が事業名の直後に並ぶ場合だけ（✔ の付いた選択肢と事業名の対応が確定する）。
    const rest = CHECKS.filter(c => c !== checked);
    if (!(rest.includes(o1) && rest.includes(o2) && o1 !== o2)) continue;
    const lines = nameBlock.trimEnd().split('\n').filter(l => !/^【重点[①-⑤]】$/.test(l));
    const name = lines.join('');
    if (!lines.length || /^[①-⑳]|今後の|基本計画事業名|^No$/.test(name) || !list.includes(normalize(name))) continue;
    const raw = nameBlock.trimEnd();
    const p = project(input, `No.${no}`, name, 2025, raw, groupAt(m, 3));
    p.evaluatedFiscalYear = 2024;
    p.ratings.push(rating(input, 'self', '令和6年度取組実績(Check)', checked, '計画どおり／計画遅れ／計画前倒し', `✔ ${checked}`, groupAt(m, 1) - 2));
    p.evidence.push(evidence(input, SHEET.trimEnd(), head), evidence(input, no, groupAt(m, 2)));
    p.warnings.push('調布市 施策・事務事業マネジメントシート【令和７年度】の「施策を構成する基本計画事業等の取組実績」の基本計画事業の行。シート表題の令和７年度を評価年度、「令和6年度取組実績」の令和６年度を評価対象年度として記録。基本計画事業のNoを projectCode に記録。',
      `事業名は折り返した行をつなぎ（【重点】の表示は除く）、参考資料５の令和７年度事務事業一覧に同じ名称がある行のみ。取組実績(Check)は ✔ の選択肢の直後に事業名と残り2つの選択肢が並ぶ行のみ記録。今後の方向（複数選択の ✔ が取組説明の文と混在）・所管課・事業費・取組説明の文章は未収録。`);
    out.push(p);
  }
  return out;
}

export const entries: Record<string, Entry> = {
  '13208': {
    extract: (input, inputs) => {
      const doc = inputs.find(i => i.sourceId === LIST);
      const list = doc ? normalize(doc.text) : null;
      return municipal('13208', i => chofu(i, list))(input, inputs);
    },
    scope: '調布市 施策・事務事業マネジメントシート【令和７年度】（施策別 r6-30-*.pdf）の基本計画事業の行のうち、事業名と取組実績(Check)の ✔ の対応が確定し事務事業一覧で名称を照合できるものの事業名・No・令和6年度取組実績。今後の方向・事業費・基本計画事業の取組状況/決算状況（列崩れ）・事務事業一覧そのもの・施策の考察は対象外。',
  },
};
