import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, project } from '../shared';
import { amount, municipality, num, rating } from './g4-util';

const HEAD = '事務事業評価シート\n\n（評価対象年度：令和\n\n';
const N = '([\\d,]+)';
const COST = new RegExp(`支 出 額 計\\n\\n${N}\\n\\n${N}\\n\\n${N}\\n\\n${N}\\n\\n国 庫 支 出 金\\n\\n${N}\\n\\n${N}\\n\\n${N}\\n\\n${N}\\n\\n都 支 出 金\\n\\n${N}\\n\\n${N}\\n\\n${N}\\n\\n${N}\\n\\n`
  + `そ の 他 収 入\\n\\n${N}\\n\\n${N}\\n\\n${N}\\n\\n${N}\\n\\n収 入 額 計\\n\\n${N}\\n\\n${N}\\n\\n${N}\\n\\n${N}\\n\\n${N}\\n\\n${N}\\n\\n${N}\\n\\n${N}\\n\\nトータルコスト`);

/** Musashino 事務事業評価シート (R8_10-13, 評価対象年度 令和7年度): one sheet per business. */
function parse(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (input.format !== 'pdf' || !t.startsWith(HEAD)) return [];
  const starts: number[] = [];
  for (let i = t.indexOf(HEAD); i >= 0; i = t.indexOf(HEAD, i + 1)) starts.push(i);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const seg = t.slice(s, starts[k + 1] ?? t.length);
    const y = seg.match(/^事務事業評価シート\n\n（評価対象年度：令和\n\n(\d+)\n\n年度）/);
    const name = seg.match(/\n\n([^\n]+)\n\n事業名\n/), no = seg.match(/\n\n([^\n]+(?:課|室|局|センター|館))\n\n事\n業\n\n(\d+)\n\nNo\./);
    if (!y || !name || !no || !seg.includes('トータルコスト')) return;
    const p = project(input, no[2], name[1], null, seg.slice(0, name.index! + name[0].length), s);
    p.projectCode = no[2]; p.department = no[1]; p.evaluatedFiscalYear = 2018 + Number(y[1]);
    p.warnings.push('シートの事業No.を事業コードとして収録。評価実施年度は本文に明記がないため未設定。事業費・人件費の行は段組みが崩れて列の対応が確定できないため未収録。指標表は未構造化。');
    const c = seg.match(COST);
    if (c) {
      const v = c.slice(1).map(num), col = (row: number, i: number) => v[row * 4 + i];
      const ok = [0, 1, 2, 3].every(i => col(4, i) === col(1, i) + col(2, i) + col(3, i) && col(5, i) === col(0, i) - col(4, i));
      if (ok) {
        p.amounts.push(amount(input, 'fullCost', p.evaluatedFiscalYear - 2, c[1], '千円', c[0], s + c.index!),
          amount(input, 'fullCost', p.evaluatedFiscalYear - 1, c[2], '千円', c[0], s + c.index!));
        p.warnings.push('コスト表の支出額計（事業費＋人件費）のうち令和5・6年度決算のみ総コストとして収録（収入内訳とトータルコストで検算済み）。決算見込・予算は対象外。');
      }
    }
    const e0 = seg.indexOf('■事業の評価'), e1 = seg.indexOf('総合判定', e0), e2 = seg.indexOf('≪事業に関するデータ≫', e1);
    if (e0 >= 0 && e1 > e0) {
      const marks = [...seg.slice(e0, e1).matchAll(/\n([○△×◎])\n/g)];
      if (marks.length === 3) ['必要性', '有効性', '効率性'].forEach((label, i) =>
        p.ratings.push(rating(input, 'self', label, marks[i][1], null, marks[i][1], s + e0 + marks[i].index! + 1)));
    }
    if (e1 > 0 && e2 > e1) {
      const sec = seg.slice(e1, e2);
      const marks = [...sec.matchAll(/\n([○△×◎])\n/g)];
      if (marks.length === 1) p.ratings.push(rating(input, 'self', '施策への貢献状況', marks[0][1], null, marks[0][1], s + e1 + marks[0].index! + 1));
      const dirs = [...sec.matchAll(/\n(拡大|変更なし|改善|見直し|縮小|統合|休止|廃止|完了|その他)(?= |\n)/g)];
      if (dirs.length === 1) p.ratings.push(rating(input, 'self', '今後の方向性', dirs[0][1], null, dirs[0][1], s + e1 + dirs[0].index! + 1));
    }
    out.push(p);
  });
  return out;
}

/** Already structured for the same period (mostly from the 令和8年度 概要 list); excluded rather than judged as distinct. */
const EXISTING = ['未来をひらくはたちのつどい', '文化財保護普及事業', '武蔵野地域学長懇談会事業', '市民会館一般管理経費', '市民会館自主事業', '武蔵野プレイスの管理運営', '一般管理経費',
  '体育施設一般管理経費', '市民スポーツデー事業', '四中温水プール開放事業', '学校給食事業（一般管理経費）', '基金利子収入の拡大', '教職員労働安全衛生管理', '高等学校等修学支援事業',
  '教職員研修・研究', '副読本・教師用教科書等給与', '教育相談事業', '教職員団体等助成事業', '児童生徒指導', '一般教育指導', '情報教育指導', '特色ある教育活動の奨励事業', '教育推進室の運営',
  '通学路防犯設備整備事業', '保険税の徴収', '健康保持増進事業', '健康診査補助金（健康診査費）', 'サービス相談調整経費', '包括的支援事業費', '一般介護予防事業費', '任意事業費',
  '配水管網整備の推進', '浄水場・水源施設の維持・更新', '法務', '市政センターの管理運営', '住居表示の維持管理', '監査業務', '台帳整備'];
export const musashino = municipality('13203', parse, EXISTING);
