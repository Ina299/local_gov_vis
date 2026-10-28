import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 宇都宮市「令和７年度 行政評価 施策カルテ」
// 公開済みレコードは「事業評価一覧（令和６年度に実施した事業）」の事業名のみ。施策カルテの「３ 主要な構成事業の状況」に
// 同じ事業の「事業の進捗」（計画以上／計画どおり／計画より遅れ）があるため、これを評価として補強する。
// 「Ｒ６事業費（千円）」は予算・決算の別が本文で確定しないため金額は対象外。事業単位の指標はカルテにない。
// 表の列は段組みで交錯するが、事業名（行頭の№）と進捗欄の単独行はどちらも表の行順に出るため、
// 1施策の表で№が1から連番で、事業名と進捗の個数が一致するときだけ順に対応づける。

const CARD = /^令和([６７])年度 行政評価\n\n施策カルテ\n/gm;
const SECTION = /^３ 主要な構成事業の状況\n/m;
// 進捗欄は単独行で、セル幅により任意の位置で改行される（例:「計画よ\nり遅れ」）。
const PROGRESS = /^(計\n?画\n?(?:以\n?上|ど\n?お\n?り|よ\n?り\n?遅\n?れ))$/gm;
const ROW = /^(\d{1,2}) ([^\n]+)$/gm;
const REVIEW = '「①昨年度の評価（成果や課題）」と「②今後の取組方針」';
const SCALE = '計画以上／計画どおり／計画より遅れ';
const REIWA: Record<string, number> = { '６': 2024, '７': 2025 };

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '09201' || input.format !== 'pdf' || input.truncated) return [];
  const t = input.text;
  const cards = [...t.matchAll(CARD)];
  if (!cards.length || cards[0].index !== 0) return [];
  const found: { name: string; p: ProjectEvaluation }[] = [];
  cards.forEach((card, i) => {
    const cardEnd = i + 1 < cards.length ? cards[i + 1].index! : t.length;
    const body = t.slice(card.index, cardEnd);
    const head = SECTION.exec(body);
    if (!head) return;
    const from = card.index! + head.index;
    const to = t.indexOf('４ 今後の施策の取組方針', from);
    if (to < 0 || to > cardEnd) return;
    const sec = t.slice(from, to);
    // 評価年度は表題「令和N年度 行政評価」、評価対象は「①昨年度の評価」の昨年度（＝Ｒ(N-1)の事業費欄と同じ年度）。
    const evaluationYear = REIWA[card[1]];
    const fiscal = evaluationYear - 1;
    const yearHead = `Ｒ${String.fromCharCode('０'.charCodeAt(0) + fiscal - 2018)}\n事業費\n（千円）`;
    const review = sec.indexOf(REVIEW), yh = sec.indexOf(yearHead);
    if (review < 0 || yh < 0) return;
    const rows = [...sec.matchAll(ROW)];
    const progress = [...sec.matchAll(PROGRESS)];
    if (!rows.length || rows.length !== progress.length || !rows.every((r, k) => Number(r[1]) === k + 1)) return;
    // 進捗欄は対応する事業名より後に出る（行順の対応の検算）。
    if (!rows.every((r, k) => progress[k].index! > r.index!)) return;
    rows.forEach((r, k) => {
      const name = r[2].trim();
      if (/[。、]$/.test(name)) return;
      const g = progress[k];
      const p = project(input, name, name, evaluationYear, r[0], from + r.index!);
      p.evaluatedFiscalYear = fiscal;
      p.evidence.push(evidence(input, card[0].trim(), card.index!), evidence(input, yearHead, from + yh), evidence(input, REVIEW, from + review));
      p.ratings.push({ kind: 'self', label: '事業の進捗', value: g[1].replace(/\n/g, ''), scale: SCALE, evidence: evidence(input, g[0], from + g.index!) });
      p.warnings.push('施策カルテ「３ 主要な構成事業の状況」の行。評価年度は表題、評価対象年度は「①昨年度の評価」とＲ６事業費欄による。',
        '列が段組みで交錯するため、№が連番で事業名と進捗欄の個数が一致する表に限り、行順で進捗を対応づけた。事業費は予算・決算の別が本文にないため未採用。');
      found.push({ name, p });
    });
  });
  // 同じ資料で同名の事業が複数の施策に出る場合は対応が一意でないため除外。
  const count = new Map<string, number>();
  for (const f of found) count.set(f.name, (count.get(f.name) ?? 0) + 1);
  return found.filter(f => count.get(f.name) === 1).map(f => f.p);
}

export const entry = {
  extract: (input: CachedInput, _all: CachedInput[]): ProjectEvaluation[] => extract(input),
  scope: '施策カルテ（令和７年度・令和６年度 行政評価、各施策の「３ 主要な構成事業の状況」）の事業名と事業の進捗。事業費は予算・決算の別が確定しないため対象外。',
};
