import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { nfkc } from '../batch7/g1-util';
import { extractKanda } from './i4-kanda';
import { extractNagasaki, extractTsumagoi } from './i4-lists';
import { extractSemboku } from './i4-semboku';

type Extract = (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[];

/**
 * Same name (or code) in the same period from two places is either a reprint or a distinct business; neither is
 * decided here, so every such record is excluded instead of being kept on a guess.
 */
function withoutAmbiguousNames(extract: Extract): Extract {
  const cache = new WeakMap<CachedInput[], Set<string>>();
  return (input, inputs) => {
    let drop = cache.get(inputs);
    if (!drop) {
      const all = inputs.flatMap(i => extract(i, inputs)), keys = new Map<string, Set<string>>();
      drop = new Set();
      for (const p of all) {
        const period = p.evaluatedFiscalYear ?? p.evaluationYear;
        for (const k of [`n:${nfkc(p.projectName)}:${period}`, `c:${nfkc(p.projectCode ?? p.id)}:${period}`]) keys.set(k, (keys.get(k) ?? new Set()).add(p.id));
      }
      for (const ids of keys.values()) if (ids.size > 1) for (const id of ids) drop.add(id);
      cache.set(inputs, drop);
    }
    const found = extract(input, inputs);
    return found.filter(p => !drop!.has(p.id));
  };
}

export const entries: Record<string, { extract: Extract; scope: string }> = {
  '40621': { extract: withoutAmbiguousNames(extractKanda), scope: '令和5〜7年度（令和4〜6年度実施分）事務事業評価シートの見出しから事業名・No.・評価年度/実施年度と、同年度の評価一覧で頁・事業名が一致した担当課・評価（今後の方針）、検算（Ａ＋Ｂ）が5列で一致した経費表の事業費・人件費・総コストを構造化。同年度に同名の票が複数ある事業、指標、シート上の○印、評価一覧単体は対象外。' },
  '42201': { extract: withoutAmbiguousNames(extractNagasaki), scope: '事務事業事前評価結果（令和6年度当初予算）のHTML表から番号・部局名・所属名・事務事業名・今後の方向性（採択等）を構造化。段組みが崩れたPDF一覧表（補正予算分・評価理由・意見）と施策評価は対象外。' },
  '10425': { extract: withoutAmbiguousNames(extractTsumagoi), scope: '令和元〜7年度の事務事業評価 二次評価結果のうち重点化・効率化/簡素化・休止/廃止/終了の事業一覧の行から№・担当課・事業名・展開方針①②と、年度明記の決算額（令和元・2年度版のみ）を構造化。同年度に同名で複数行ある事業、現状のまま継続の事業、段組みが崩れた評価結果一覧表、様式見本は対象外。' },
  '05215': { extract: withoutAmbiguousNames(extractSemboku), scope: '令和8年度事務事業評価シート（様式１）から事業名・担当部課と、一般財源等の割合で検算が一致した事業費総額（R8予算・R7〜R5決算、円）を構造化。一次・外部・二次評価の○印、成果指標、事務事業評価一覧、施策評価は対象外。' },
};
