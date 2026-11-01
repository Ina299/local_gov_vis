/** 苅田町 (40621): 事務事業評価シート（令和5〜7年度評価、政策別の6冊）の「事業目的」欄。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// 公開済みレコードは同じ評価シートの見出し（No.・事業名・評価年度・実施年度）と経費表から作られ（batch9/i4-kanda）、目的が空欄。
// 「事業目的」の見出しの直後に、幅の狭い欄（1行おおむね20〜24文字）の本文が空行まで続く。
// 段組みで別の欄の文字（「貢献度」「一般」や数値）が入る・欄の幅を超える行がある・最終行が欄の幅いっぱいで
// 文の終わりでない（次の段に続く可能性がある）ものは採らない。
// 活動内容・手段の欄、成果（アウトカム）の欄は見出しの文字が本文の行に混ざるため対象外。
const SHEETS: Record<string, number> = Object.fromEntries([
  ...['7ca43b5d664ec371bbc1caa6', '6c123c17d0edf97986f078ac', 'af8818470c57f5c7b84b01fe', '2692c214de57cebf540fd41f', '581b3b94a6f7e4ad6cfdb388', '8f477aa983fb8e54a74e9abc'].map(id => [id, 2025]),
  ...['96b6927a3743b688d0a6fcfa', 'd8804764fc543ad90921b31f', 'c4bbff216977340ccef542ea', 'fda2f2b8b3f73692e5eaad86', 'b74057fea36889279a7a9bdb', '016bd0d11733b66566a467d0'].map(id => [id, 2024]),
  ...['36916a0c18a9f10822acc6dd', '7e745df2f2159389734a8de8', '7909d0ea460be9b4bbcc398f', '0849af3e961df62efdbfc5e3', 'a55569d66be53471de1b1466', '2512dd9f4600505e80dc73ad'].map(id => [id, 2023]),
]);
const SHEET = /No\.\n(\d+)\n評価種別\n\n事 務 事 業 評 価 シ ー ト\n\n令和([0-9０-９]+)年度\n\n([^\n]+)\n\n（令和([0-9０-９]+)年度実施分）\n\n([^\n]+)\n\n事業名\n/g;
const PURPOSE = /\n事業目的\n((?:[^\n]+\n)*?[^\n]+)\n\n/g;
const FOREIGN = /^(?:貢献度|公益性|一般|単|位|目|会計|財務科目|事|業|経 費|費|）|（[^）]*|[\d,.\s]+|（施策の成果指標達成への影響）|【.*】.*)$/;
const nfkc = (s: string) => s.normalize('NFKC');

function extract(input: CachedInput): ProjectEvaluation[] {
  const cycle = SHEETS[input.sourceId];
  if (input.municipalityCode !== '40621' || !cycle) return [];
  const t = input.text, heads = [...t.matchAll(SHEET)], out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const [head, no, evalYear, , doneYear, rawName] = h;
    if (/^(事業名|所管課|No\.)$/.test(rawName)) return;
    const year = 2018 + Number(nfkc(evalYear)), done = 2018 + Number(nfkc(doneYear));
    if (year !== cycle || done !== cycle - 1) return;
    const start = h.index, seg = t.slice(start, heads[k + 1]?.index ?? t.length);
    const found = [...seg.matchAll(PURPOSE)];
    if (found.length !== 1) return;
    const raw = found[0][1], lines = raw.split('\n'), last = lines[lines.length - 1];
    if (raw.length < 8 || lines[0].length < 8 || lines.some(l => FOREIGN.test(l.trim()) || l.length > 26)) return;
    if (last.length >= 19 && !/[。）」．.]$/.test(last)) return;
    const p = project(input, `No.${no}:purpose`, rawName, year, head, start);
    p.projectCode = null; p.evaluatedFiscalYear = done;
    p.purpose = raw;
    p.evidence.push(evidence(input, raw, start + found[0].index + '\n事業目的\n'.length));
    p.warnings.push('事務事業評価シートの「事業目的」欄の原文（改行も原文のまま）。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '苅田町 事務事業評価シート（令和5〜7年度評価）の「事業目的」欄（別の欄の文字が混ざらず、欄の幅に収まり、文が欄内で終わるもののみ）。活動内容・手段、成果の欄は見出しの文字が本文に混ざるため対象外。',
};
