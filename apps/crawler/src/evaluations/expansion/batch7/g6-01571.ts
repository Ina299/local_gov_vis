import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { type Extract, municipality } from './g6-util';

const TITLE = '令和７年度 事務事業評価結果一覧';
/** Project names per page, in the order pdftotext emits them (line breaks as in the extracted text). */
const PAGES: readonly (readonly string[])[] = [
  ['公用車維持管理事務', '民間賃貸住宅等建設促進奨励金事業（定住促進奨励事\n業）', '移住体験推進事業', 'アイヌ伝統的儀礼施設事業', 'アイヌ協会会運営費補助事業'],
  ['害虫駆除対策事業（ハチの巣・害虫）', '資源回収助成事業', '小型家電・古着回収事業', '森林環境譲与税事業', '観光協会運営補助事業', '商工振興事業'],
  ['商店街近代化事業補助金業務', '天然豊浦温泉しおさい管理運営委託事業', '道の駅とようら管理運営事業', '労働費（雇用対策）事業', '外国語青年招致事業'],
  ['豊浦町へき地複式教育研究会運営事業', 'スポーツイベント開催業務', '昆布岳開設業務', '豊浦町PTA連合会運営補助金事務', '調理委託契約事務'],
  ['結核肺がん検診事業', '地域活動支援センター業務委託事業', '高齢者コミュニティーセンター管理業務'],
];
const RATING = /^(要改善（3年以内に再検討）|維持|縮小|廃止・統合|3年以内に廃止・統合)$/gm;
const DEPARTMENT = /^(\S+課|総合保健福祉施設)$/gm;

/**
 * 豊浦町 令和７年度 事務事業評価結果一覧 (one PDF, five pages). The table columns are emitted out of row order,
 * but within each page the names, 評価 labels and 担当課 lines each keep row order and their counts agree;
 * each pairing was checked against the 今後の町の方針 text. Pages whose counts disagree are dropped.
 */
function parse(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== '4c6b53a93ab4d813ae409153' || !input.text.startsWith(TITLE)) return [];
  const starts = [...input.text.matchAll(new RegExp(TITLE, 'g'))].map(m => m.index!);
  if (starts.length !== PAGES.length) return [];
  const out: ProjectEvaluation[] = [];
  PAGES.forEach((names, i) => {
    const from = starts[i], to = starts[i + 1] ?? input.text.length, page = input.text.slice(from, to);
    const ratings = [...page.matchAll(RATING)], departments = [...page.matchAll(DEPARTMENT)].filter(m => m[1] !== '担当課');
    // Names must stand on their own lines exactly once (the body text may quote a name inline).
    const positions = names.map(n => { const i = page.indexOf(`\n${n}\n`); return i < 0 || page.indexOf(`\n${n}\n`, i + 1) >= 0 ? -1 : i + 1; });
    if (ratings.length !== names.length || departments.length !== names.length || positions.some(p => p < 0)) return;
    names.forEach((raw, j) => {
      const p = project(input, raw.replace(/\n/g, ''), raw.replace(/\n/g, ''), 2025, raw, from + positions[j]);
      p.projectCode = null;
      p.department = departments[j][1];
      p.evidence.push(evidence(input, departments[j][1], from + departments[j].index!));
      p.ratings.push({ kind: 'self', label: '評価', value: ratings[j][1], scale: null, evidence: evidence(input, ratings[j][1], from + ratings[j].index!) });
      p.warnings.push('評価結果一覧の列が行順どおりに抽出されないため、ページ内で事業名・評価・担当課をそれぞれの出現順で対応付け（件数一致と今後の町の方針の内容で確認）。評価年度は表題の「令和７年度」。評価対象年度・金額・指標は一覧に記載がないため未設定。');
      out.push(p);
    });
  });
  return out;
}

export const entries: Record<string, { extract: Extract; scope: string }> = {
  '01571': { extract: municipality('01571', parse), scope: '令和７年度事務事業評価結果一覧（24事業）の事業名・評価・担当課を構造化。事業の目的・概要と今後の町の方針の本文、金額・指標は構造化しない。' },
};
