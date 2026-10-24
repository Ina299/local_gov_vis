/** Batch-12 (m3) extractor for 05303 小坂町: 小坂町教育委員会 事務事業評価シート（令和６年度事業、34事業）. */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, num, type Entry } from '../batch9/i1-util';

const SHEETS_ID = 'cf06c3ba91f112852704fb28';
const HEAD = '小坂町教育委員会 事務事業評価シート';
const TARGET_YEAR = /^小坂町教育委員会 事務事業評価シート\n評価対象年度[\s\S]{0,300}?[\nＲ ]6\n\n年度\n\n評価実施年度/;
/** 「令和６年度事務事業 評価実施一覧」（5bcbd0628faaf3213b9e1548）の掲載順（１Ｐ〜３４Ｐ）。シートはこの順に1枚ずつ並ぶ。 */
const NAMES = ['児童保育委託事業', '保育対策等促進事業', '保育所等物価高騰対策事業', '外国語指導助手招致事業', '学校生活サポート事業', '教育助成事業',
  'スクールカウンセラー配置事業', '奨学資金貸付事業', '通学バス運行事業', '子ども子育て支援事業', '学校給食助成事業', '小坂小中学校ＩＣＴ関連整備事業',
  '小坂小学校整備事業', '学校給食事業', '二十祭事業', '放課後児童健全育成事業', '学校・家庭・地域連携総合推進事業', '生涯学習奨励活動事業',
  '生涯学習のつどい事業', '文化財保護事業', '文化財施設管理事業', '芸術文化振興事業', '中央公民館青少年教育事業', '中央公民館女性教育事業',
  '中央公民館成人教育事業', '中央公民館高齢者教育事業', '小坂公民館中央地区自治会運営研究会事業', '川上公民館事業', '七滝公民館事業', '図書館管理事業',
  '郷土館管理事業', '郷土館特別展実施事業', 'スポーツ事業', '水泳教室事業'];
const DEPTS = ['総務班', '学習振興班'];
const LETTERS = ['Ａ', 'Ｂ', 'Ｃ', 'Ｄ', 'Ｅ'];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function kosaka(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '05303' || input.sourceId !== SHEETS_ID) return [];
  const t = input.text, starts = [...t.matchAll(new RegExp(HEAD, 'g'))].map(m => m.index!);
  if (starts.length !== NAMES.length) return [];
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const sheet = t.slice(s, starts[k + 1] ?? t.length), year = TARGET_YEAR.exec(sheet);
    // The sheet must print its own business name (line breaks may split it).
    const nameRe = new RegExp([...NAMES[k]].map(esc).join('\n?'));
    const name = nameRe.exec(sheet);
    if (!year || !name) return;
    const p = project(input, NAMES[k], NAMES[k], null, name[0], s + name.index);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, year[0], s));
    const depts = DEPTS.filter(d => sheet.includes(`\n${d}\n`));
    if (depts.length === 1) {
      const at = sheet.indexOf(`\n${depts[0]}\n`) + 1;
      p.department = depts[0];
      p.evidence.push(evidence(input, depts[0], s + at));
    }
    // 事業費の推移: the 歳入合計／歳出合計 row prints R5決算・R6決算・R7予算 as one run; accept it only when the three
    // following five-line columns (歳出内訳: 需用費・役務費・委託料・工事請負費・その他) add up to the same three totals.
    const tri = /\n\n([\d,]+) 千円\n\n([\d,]+) 千円\n\n([\d,]+) 千円\n\n/.exec(sheet);
    if (tri) {
      const after = sheet.slice(tri.index + tri[0].length);
      const cols = [...after.matchAll(/(?<=^|\n)([\d,]+)\n([\d,]+)\n([\d,]+)\n([\d,]+)\n([\d,]+)(?=\n)/g)].slice(0, 3);
      const sums = cols.map(c => c.slice(1, 6).reduce((a, x) => a + num(x), 0));
      // An all-zero run matches any empty columns, so it does not identify the row.
      if (cols.length === 3 && sums.some(v => v > 0) && sums.every((v, i) => v === num(tri[i + 1]))) {
        const raw = tri[0].trim(), at = s + tri.index + 2;
        p.amounts.push(amount(input, 'actual', 2023, tri[1], '千円', raw, at), amount(input, 'actual', 2024, tri[2], '千円', raw, at),
          amount(input, 'budget', 2025, tri[3], '千円', raw, at));
        p.warnings.push('事業費の推移の合計（R5決算・R6決算・R7予算、千円）。抽出テキストで列見出しと値が離れて出力されるため、続く歳出内訳3列（需用費・役務費・委託料・工事請負費・その他）の合計がそれぞれ一致することを確認した場合のみ収録。');
      }
    }
    // 総合評価: the letters Ａ〜Ｅ are printed in order with the ○ immediately before the selected one.
    const rating = /総合評価\n評価説明\n\n((?:[ＡＢＣＤＥ](?: |\n\n))*?[〇○] [ＡＢＣＤＥ](?:\n\n[ＡＢＣＤＥ])*)\n\n(?:該当する欄に○|$)/.exec(sheet);
    if (rating) {
      const letters = rating[1].replace(/[〇○]/g, '').split(/\s+/).filter(Boolean);
      const chosen = /[〇○] ([ＡＢＣＤＥ])/.exec(rating[1])![1];
      if (letters.join('') === LETTERS.join(''))
        p.ratings.push({ kind: 'self', label: '総合評価', value: chosen, scale: 'Ａ／Ｂ／Ｃ／Ｄ／Ｅ（シートに区分の定義の記載なし）',
          evidence: evidence(input, rating[0].trim(), s + rating.index) });
    }
    p.warnings.push('小坂町教育委員会 令和６年度 事務事業評価シート（令和７年９月公表の点検・評価報告書の別添）。事業名は評価実施一覧の掲載順との対応をシート本文で確認。評価年度は本文の配置から確定できないため未設定。指標値（％）・実数は列の配置が崩れるため未収録。総合評価は「○」が記号の直前に出力されるシートのみ収録。');
    out.push(p);
  });
  return out;
}

export const kosakaEntries: Record<string, Entry> = {
  '05303': {
    extract: input => kosaka(input),
    scope: '小坂町教育委員会 令和６年度事業の事務事業評価シート（34事業）の事業名・所管班・事業費の推移の合計（R5・R6決算、R7予算。内訳合計で検算できるもののみ）・総合評価（Ａ〜Ｅ、○の位置が確定するもののみ）。指標値・各評価項目の○、評価実施一覧・点検評価報告書本文は対象外。',
  },
};
