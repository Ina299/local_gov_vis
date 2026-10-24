import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import type { Entry } from '../batch9/i1-util';
import { municipality } from './m2-util';
import { eraYear } from './m2-minamikyushu';

// ---------------------------------------------------------------- 夕張市 教育行政の執行状況に関する点検評価報告書（平成28〜令和5年度版）の細目シート
const TITLE = /^((?:平成|令和)\s*(?:[\d０-９]+|元)\s*年度)\s*\n教育行政の執行状況に関する点検評価報告書\s*\n（((?:平成|令和)\s*(?:[\d０-９]+|元)\s*年度)事業対象）/;
// 細目シートの見出し: 様式名の次の2行が「事務事業名（施策のまとまり）」「事業項目」。
const ITEM = /\n夕張市教育行政点検評価表\n(?:\n?（細目）\n\n)?([^\n]+)\n([^\n]+)\n\n/g;
const RATING_HEAD = '事業達成度 事 業 効 果';
const RATING = /^事業達成度 事 業 効 果\n\n([A-DＡ-Ｄ])\n\n(?:（細目）\n\n|自己評価\n\n)?([A-DＡ-Ｄ])\n/;
const ACHIEVE = 'Ａ 事業が十分に達成された（9 割以上）／Ｂ 事業が相当程度達成された（7 割～8 割）／Ｃ 事業の達成度がやや不十分である（5 割～6 割）／Ｄ 事業が達成されなかった（5 割以下）';
const EFFECT = 'Ａ 十分な事業効果が得られた（9 割以上）／Ｂ 相当程度の事業効果が得られた（7 割～8 割）／Ｃ 事業効果がやや不十分である（5 割～6 割）／Ｄ 事業効果が不十分である（5 割以下）';

export function yubariSheets(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, title = TITLE.exec(t);
  if (!title) return [];
  const evaluationYear = eraYear(title[1]), evaluated = eraYear(title[2]);
  if (!evaluationYear || !evaluated || evaluationYear !== evaluated + 1) return [];
  const items = [...t.matchAll(ITEM)].filter(m => !/^(（細目）|事務事業名|事業項目|・)/.test(m[2]) && m[2].length <= 40 && !/[。、]$/.test(m[2]));
  const names = items.map(m => m[2].trim());
  // 事業項目名が1回だけ現れるシートに限る（2シート交互の段組みで同名が重なると区間が確定しない）。
  const tail = t.indexOf('\n資\n\n料\n');
  const out: ProjectEvaluation[] = [];
  items.forEach((m, k) => {
    const name = names[k];
    if (names.filter(n => n === name).length !== 1) return;
    const nameAt = m.index! + m[0].indexOf(`\n${m[2]}\n`) + 1;
    // 評価欄はシート見出し（様式名）の次の出現までで探す（未認識のシートの評価欄を取り込まない）。
    const nextSheet = t.indexOf('\n夕張市教育行政点検評価表\n', nameAt);
    const end = nextSheet >= 0 ? nextSheet : tail > nameAt ? tail : t.length;
    const p = project(input, `${evaluated}:${name}`, name, evaluationYear, name, nameAt);
    p.projectCode = null;
    p.evaluatedFiscalYear = evaluated;
    p.evidence.push(evidence(input, '夕張市教育行政点検評価表', m.index! + 1), evidence(input, title[0], 0));
    const seg = t.slice(nameAt, end);
    if (seg.split(RATING_HEAD).length - 1 === 1) {
      const at = seg.indexOf(RATING_HEAD), r = RATING.exec(seg.slice(at));
      if (r) {
        const ev = evidence(input, r[0].trimEnd(), nameAt + at);
        p.ratings.push({ kind: 'self', label: '事業達成度（教育委員会 自己評価）', value: r[1], scale: ACHIEVE, evidence: ev });
        p.ratings.push({ kind: 'self', label: '事業効果（教育委員会 自己評価）', value: r[2], scale: EFFECT, evidence: ev });
      }
    }
    p.warnings.push('夕張市 教育行政の執行状況に関する点検評価報告書の細目シート（事業項目）単位。評価年度は報告書の年度、評価対象年度は「（○○年度事業対象）」による。総括表（事務事業名＝施策のまとまり）は対象外。');
    p.warnings.push('抽出テキストは1ページ2シートが交互に並ぶため、事業達成度・事業効果は、当該事業項目名から次のシート見出しまでの間に評価欄が1つだけあり、2つの記号が評価欄の直後に連続する場合だけ、出現順に事業達成度・事業効果として採用。尺度の文言は令和６年度版の凡例による。事業費は記載がないため未収録。');
    out.push(p);
  });
  return out;
}

export const yubariEntries: Record<string, Entry> = {
  '01209': {
    extract: municipality(yubariSheets, p => `${p.evaluatedFiscalYear}:${p.projectName}`),
    scope: '夕張市 教育行政の執行状況に関する点検評価報告書（平成28〜令和元年度版・令和5年度版）の細目シート（事業項目）単位の事業名・評価年度/評価対象年度と、評価欄の対応が確定する場合の事業達成度・事業効果（教育委員会自己評価）。総括表・評価委員意見・資料、文字化けした平成24〜27年度版、様式の異なる令和7年度版は対象外。',
  },
};
