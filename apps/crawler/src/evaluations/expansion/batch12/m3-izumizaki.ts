/** Batch-12 (m3) extractor for 07464 泉崎村: まち・ひと・しごと創生《地方創生推進／加速化交付金》実績評価シート（平成29年度分）. */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, type Entry } from '../batch9/i1-util';

/** 資料３（加速化交付金、個別事業ごと）・資料５（推進交付金）。資料１の評価一覧表は記号と事業名の行の対応が崩れるため対象外。 */
const SOURCES = new Set(['8f6fa7b8f7e2174b5edb41ce', '23005dc6717fa6b217929e7d']);
const SHEET = /泉崎村まち・ひと・しごと創生《(地方創生(?:推進|加速化)交付金)》実績評価シート\n平成 29 年度分\n/g;
const GRANT_NOTE = '事務事業評価ではなく地方創生関係交付金の実績評価（交付金事業ごと）。';

function izumizaki(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '07464' || !SOURCES.has(input.sourceId)) return [];
  const t = input.text, heads = [...t.matchAll(SHEET)];
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const s = h.index!, b = t.slice(s, heads[k + 1]?.index ?? t.length);
    const scale = /\nA：目標以上[^\n]+\nB：[^\n]+\nC：[^\n]+\nD：[^\n]+\nE：[^\n]+/.exec(b);
    const dept = /\n担当課\n\n([^\n]+)\n\n/.exec(b);
    if (!dept) return;
    let p: ProjectEvaluation;
    // 加速化交付金: 事業名 line after the department, plus the 個別事業名 printed with its 最終予算額 (円).
    const parent = /\n担当課\n\n[^\n]+\n\n([^\n]+事業)\n/.exec(b);
    const sub = /\n個別事業名[１-９]\n[\s\S]*?\n([^\n]+)\n([\d,]+) 円\n/.exec(b);
    if (h[1] === '地方創生加速化交付金') {
      if (!parent || !sub) return;
      const name = `${parent[1]}（${sub[1]}）`;
      p = project(input, name, name, null, sub[1], s + sub.index + sub[0].lastIndexOf(sub[1]));
      p.evidence.push(evidence(input, parent[1], s + parent.index + parent[0].indexOf(parent[1])));
      // Exactly two stand-alone 「N 円」 lines precede 具体的な取組: the 最終予算額 printed with the name and the 決算額.
      const front = b.slice(0, b.indexOf('具体的') < 0 ? b.length : b.indexOf('具体的'));
      const yen = [...front.matchAll(/\n([\d,]+) 円\n/g)];
      const subAt = s + sub.index + sub[0].length - `${sub[2]} 円\n`.length;
      p.amounts.push(amount(input, 'budget', 2017, sub[2], '円', `${sub[2]} 円`, subAt));
      if (yen.length === 2 && yen[0][1] === sub[2] && front.includes('決算額')) {
        p.amounts.push(amount(input, 'actual', 2017, yen[1][1], '円', `${yen[1][1]} 円`, s + yen[1].index! + 1));
        p.warnings.push('決算額は抽出テキストで見出しと離れて出力されるため、シート前半に単独で出力される円単位の金額が最終予算額と決算額の2つだけであることを確認して収録。');
      }
      p.warnings.push('事業名は交付金事業名と個別事業名（シートごとの単位）を連結して収録。');
    } else {
      const name = /\n担当課\n\n[^\n]+\n\n([^\n]+事業)\n([^\n]+事業)\n/.exec(b);
      const money = /\n最終予算額\n\n([\d,]+) 円（村分：([\d,]+) 円）\n\n決算額\n\n([\d,]+) 円（([\d,]+) 円）\n/.exec(b);
      if (!name) return;
      p = project(input, name[1], name[1], null, name[1], s + name.index + name[0].indexOf(name[1]));
      if (money) {
        const raw = money[0].trim(), at = s + money.index + 1;
        p.amounts.push(amount(input, 'budget', 2017, money[1], '円', raw, at), amount(input, 'actual', 2017, money[3], '円', raw, at));
        p.warnings.push(`金額は広域（しらかわ地域）事業全体の最終予算額・決算額。括弧内の村分（最終予算額 ${money[2]} 円、決算額 ${money[4]} 円）は別途原文参照。`);
      }
      p.warnings.push(`事業名の次行「${name[2]}」は個別事業の名称とみられるが、本文で区別が明示されないため事業名には含めない。`);
    }
    p.projectCode = null;
    p.department = dept[1];
    p.evaluatedFiscalYear = 2017;
    p.evidence.push(evidence(input, h[0].trim(), s), evidence(input, dept[0].trim(), s + dept.index + 1));
    const self = /\n\n([ＡＢＣＤＥ])\n\n?29 年度\n/.exec(b), committee = /\n評 価\n\n([ＡＢＣＤＥ])\nA：目標以上/.exec(b);
    const sc = scale ? scale[0].trim().replace(/\n/g, '／') : null;
    if (self) p.ratings.push({ kind: 'self', label: '29年度評価（担当課評価）', value: self[1], scale: sc, evidence: evidence(input, self[0].trim(), s + self.index + 2) });
    if (committee) p.ratings.push({ kind: 'external', label: '委員会評価', value: committee[1], scale: sc, evidence: evidence(input, committee[0].trim(), s + committee.index + 1) });
    p.warnings.push(GRANT_NOTE, 'KPIは年度列と値の並びが抽出テキストで崩れるため未収録。評価年度は本文に明記がないため未設定（評価対象年度は「平成29年度分」）。');
    out.push(p);
  });
  return out;
}

export const izumizakiEntries: Record<string, Entry> = {
  '07464': {
    extract: input => izumizaki(input),
    scope: '泉崎村 まち・ひと・しごと創生《地方創生推進交付金・加速化交付金》実績評価シート（平成29年度分）の交付金事業（個別事業）ごとの事業名・担当課・最終予算額・決算額（円）・担当課評価・委員会評価（A〜E）。交付金の実績評価であり事務事業評価ではない。KPI、評価一覧表（記号と事業名の対応が崩れる）、地域再生計画KPI調書、効果検証報告書本文は対象外。',
  },
};
