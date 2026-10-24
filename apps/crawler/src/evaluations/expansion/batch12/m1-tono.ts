import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { type Entry, era, segments, uniqueBy } from './m1-util';

// ---------------------------------------------------------------- 03208 遠野市 教育委員会の点検及び評価報告書（平成27〜令和3年度実施事業）
// Same sheet layout as the 令和4〜6年度 reports structured in batch 11 (batch11/k1-edu.ts); the same page-level attribution rule is applied.
const TONO_HEAD = /^遠野市教育委員会の権限に属する\n事務の管理及び執行の状況の\n点 検 及 び 評 価 報 告 書\n（(平成|令和)(元|[０-９]{1,2})年度実施事業）/;
const TONO_SOURCES = new Set(['79e3911f665bcf079647810d', 'ce8c3a902d1222eab424a495', '4b336a2a085bfd54ddf27dca', '73c820d4edc248534c9a0473',
  '7247e26e76485040aba788b8', 'faf0231d7352a4619ad90a0b', 'a20bc8bc3595e93b02e490ed']);
const TONO_AMOUNT = /^([\d,]+) ?円$/gm;
const TONO_RATING = /評価\n+(達成|概ね達成|未達成)\n/g;
const TONO_DEPT = /\n([^\n]*(?:課|室|館|センター))\n事業所管課/g;
const TONO_SCALE = '達成：事務事業の目的が十分に達成された（達成率100％以上）／概ね達成：概ね達成された（90％以上100％未満）／未達成：概ね達成されたとまではいえない（90％未満）';
const count = (s: string, re: RegExp) => [...s.matchAll(re)].length;

function extractTono(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '03208' || !TONO_SOURCES.has(input.sourceId)) return [];
  const t = input.text, head = t.match(TONO_HEAD);
  if (!head) return [];
  const fy = era(head[1], head[2]), label = `${head[1]}${head[2]}年度実施事業`;
  const cuts = [0, ...[...t.matchAll(/\n\n\d{1,3}\n\n\n/g)].map(m => m.index! + m[0].length), t.length];
  const out: ProjectEvaluation[] = [];
  for (let c = 0; c + 1 < cuts.length; c++) {
    const pageAt = cuts[c], page = t.slice(pageAt, cuts[c + 1]);
    const sheets = segments(page, /事業費名\n\n/g);
    if (!sheets.length) continue;
    const named = sheets.map(s => {
      const m = s.text.match(/^事業費名\n\n((?:[^\n]+\n){1,2}?)\n/);
      const lines = m?.[1].trimEnd().split('\n') ?? [];
      const ok = !!m && /(費|事業|）|充実)$/.test(lines[lines.length - 1]) && lines.every(l => l.length <= 40 && !/[。【]/.test(l) && !/^[\d,０-９ 円人]+$/.test(l));
      return { s, m, name: ok ? lines.join('') : null };
    });
    const settled = named.every(x => x.name && x.s.text.includes('決算額') && count(x.s.text, TONO_AMOUNT) === 1 && count(x.s.text, TONO_RATING) === 1)
      && count(page, TONO_AMOUNT) === sheets.length && count(page, TONO_RATING) === sheets.length;
    const depts = named.every(x => count(x.s.text, TONO_DEPT) === 1) && count(page, TONO_DEPT) === sheets.length;
    for (const { s, m, name } of named) {
      if (!name || !m) continue;
      const at = pageAt + s.at;
      const p = project(input, name, name, null, m[0].trimEnd(), at);
      p.projectCode = null;
      p.evaluatedFiscalYear = fy;
      p.evidence.push(evidence(input, head[0], 0));
      if (settled) {
        const a = [...s.text.matchAll(TONO_AMOUNT)][0], r = [...s.text.matchAll(TONO_RATING)][0];
        p.amounts.push({ kind: 'actual', fiscalYear: fy, amountYen: Number(a[1].replace(/,/g, '')), rawValue: a[1], rawUnit: '円', evidence: evidence(input, a[0], at + a.index!) });
        p.ratings.push({ kind: 'self', label: '評価（担当課による自己評価）', value: r[1], scale: TONO_SCALE, evidence: evidence(input, r[0].trimEnd(), at + r.index!) });
        if (depts) p.department = [...s.text.matchAll(TONO_DEPT)][0][1].trim();
        p.warnings.push(`遠野市 点検及び評価報告書（${label}）の事業費名1件。決算額（円・${label.slice(0, -4)}決算）・評価（事業所管課も別途同様に確認）は、同じページの各事業費名の区間にそれぞれ1つずつだけあり、ページ全体の個数も事業数と一致する場合のみ採用。事業所管課は報告書作成年度の所管課。`);
      } else {
        p.warnings.push(`遠野市 点検及び評価報告書（${label}）の事業費名1件。同じページの2事業の列が抽出テキストで混在し、決算額・評価・所管課の対応が確定できないため、事業費名のみ収録。`);
      }
      p.warnings.push('評価の区分は報告書の凡例（達成・概ね達成・未達成）。まちづくり指標の結果や計画値・実績値の文章は未収録。評価実施年度は本文に明示がないため未設定。同じ資料に同名の事業費名が複数ある場合は除外。');
      out.push(p);
    }
  }
  return uniqueBy(out);
}

export const tonoEntries: Record<string, Entry> = {
  '03208': {
    extract: input => extractTono(input),
    scope: '教育委員会の点検及び評価報告書（平成27〜令和3年度実施事業）の事業費名ごとの評価シートから、事業費名・対象年度と、ページ内で対応が確定する場合のみ決算額（円）・評価（達成／概ね達成／未達成）・事業所管課を構造化。平成19〜26年度の旧様式報告書（事業費名の評価シートなし）と決算の事業概要（総括事項）は対象外。',
  },
};
