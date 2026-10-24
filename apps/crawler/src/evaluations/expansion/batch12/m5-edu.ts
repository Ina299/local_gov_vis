import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { eraYear, rating } from '../batch8/h6-util';
import { type Entry, groupAt, municipal } from './m5-util';

/* ---------- 33216 浅口市 教育に関する事務の管理及び執行状況の点検・評価報告書（基本事業の点検・評価シート） ---------- */

const ASAKUCHI_SCALE = 'Ａ：十分達成された。（目標達成率 90～100％）／Ｂ：概ね達成された。（目標達成率 80～89％）／Ｃ：やや達成できなかった。（目標達成率 70～79％）／Ｄ：達成できなかった。（目標達成率 ～69％）';

function asakuchi(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!/^[^\n]+\n\n教育に関する事務の管理及び\n執行状況の点検・評価報告書\n\n浅口市教育委員会\n/.test(t)) return [];
  // 対象年度は「（２）方法」の「〇〇年度における各事業の達成状況を把握し」で確定する。
  const y = /\n(平成|令和)([元\d０-９]+)年度における各事業の達成状況を把握し/d.exec(t);
  const fy = y ? eraYear(y[1], y[2]) : null;
  if (fy === null) return [];
  const heads = [...t.matchAll(/＜基本事業＞([^\n]+)\n/dg)];
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    const s = h.index!, sheet = t.slice(s, heads[i + 1]?.index ?? t.length);
    const name = h[1].replace(/\s*【担当：[^】]*】\s*$/, '').trim();
    const p = project(input, name, name, null, name, groupAt(h, 1));
    p.projectCode = null; p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, y![0].trim(), y!.index + 1));
    const d = /【担当：([^】\n]+)】/d.exec(sheet.slice(0, 400));
    if (d) { p.department = d[1].trim(); p.evidence.push(evidence(input, d[0], s + d.index)); }
    // 自己評価: シート内に評価記号が一つだけ読める場合（新様式「自己評価 Ｂ」・旧様式「自己評価\n\n自己評価\n\nＢ」）。
    const marks = [...sheet.matchAll(/\n自己評価 ([ＡＢＣＤ])\n|\n自己評価\n\n自己評価\n\n([ＡＢＣＤ])\n/dg)];
    if (marks.length === 1) {
      const m = marks[0], g = m[1] ? 1 : 2;
      p.ratings.push(rating(input, 'self', '自己評価', m[g]!, ASAKUCHI_SCALE, m[g]!, groupAt(m, g, s)));
    }
    // 指標が一つだけのシート: 指標名・目標・実績が順に並び、直後に次の指標の値が続かない場合だけ。
    const ind = /\n指標\n([^\n]+)\n\n目標（(令和|平成)([元\d０-９]+)年度）\n([^\n]+)\n\n実績（(?:令和|平成)[元\d０-９]+年度）\n([^\n]+)\n\n(?=課題・方向性|・)/d.exec(sheet);
    if (ind && eraYear(ind[2], ind[3]) === fy && (sheet.match(/\n目標（/g) ?? []).length === 1)
      p.indicators.push({ name: ind[1].trim(), fiscalYear: fy, target: ind[4].trim(), actual: ind[5].trim(), unit: null, evidence: evidence(input, ind[0].slice(1).trimEnd(), s + ind.index + 1) });
    p.warnings.push(`浅口市 教育に関する事務の管理及び執行状況の点検・評価報告書の基本事業の点検・評価シート。報告書の「${y![0].trim()}」の年度を評価対象年度とし、評価実施年度は明示がないため未設定。`,
      '自己評価はシート内に評価記号が一つだけ読める場合のみ記録。指標は指標が一つだけで目標・実績が順に並ぶシートのみ（単位は値に含まれるため unit 未設定）。複数の指標があるシートは目標・実績の並びが崩れるため未収録。事業概要・取組状況・評価委員の総合評価は文章のため未構造化。');
    out.push(p);
  });
  return out;
}

export const entries: Record<string, Entry> = {
  '33216': { extract: municipal('33216', asakuchi), scope: '浅口市 教育に関する事務の管理及び執行状況の点検・評価報告書（平成29〜令和7年度対象）の基本事業ごとの点検・評価シートの基本事業名・担当課・自己評価（Ａ〜Ｄ）と、指標が一つだけのシートの目標・実績。教育委員会の活動状況・評価委員の総合評価・資料編・複数指標の表は対象外。' },
};
