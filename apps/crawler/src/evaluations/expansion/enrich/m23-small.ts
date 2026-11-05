import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { shimizuEntries } from '../batch12/m3-shimizu';
import { entries as h7 } from '../batch8/h7-c';
import { joinWrapped, refill, startOf } from './m23-util';

// ---------------------------------------------------------------- 清水町（令和５年度物価高騰対応重点支援地方創生臨時交付金充当事業の効果検証）
// 公開済みレコードは batch12/m3-shimizu の抽出（事業名・担当課。年度なし）。一覧表の行は抽出テキストで
// 事業名 → 事業の概要（①目的・効果 ②経費内容 ③積算根拠 ④事業の対象）→ 経済対策との関係 → 始期・終期・金額 → 効果検証 → 担当課 の順に出る。
// 目的: 事業名のすぐ後の「①」で始まる段落のうち、「②」の行の前まで（見出しは「①目的・効果」で、目的を含む欄）。
// 成果: 元の抽出が行の対応を検算した範囲（始期〜担当課）のうち「効果検証」欄（給付・実施の結果）。
function shimizuFill(p: ProjectEvaluation, input: CachedInput) {
  const t = input.text, s = startOf(p), row = p.evidence.find(e => /^R\d\.\d+\.\d+\n\n/.test(e.rawText));
  const rowAt = row ? Number(/^extracted-text:chars:(\d+)-/.exec(row.cell ?? '')?.[1]) : NaN;
  if (s === null || !row || Number.isNaN(rowAt)) return null;
  const nameEnd = s + p.evidence[0].rawText.length;
  const m = /^\n\n①([^\n]+(?:\n(?![②③④])[^\n]+)*)\n②/.exec(t.slice(nameEnd, rowAt));
  if (!m) return null;
  const purpose = joinWrapped(m[1]);
  // 効果検証: 行の範囲（R始期\n\nR終期\n\n総事業費\n\n交付対象経費\n\nその他\n\n<効果検証>\n\n<担当課>）の6つ目の段落。
  const cells = row.rawText.split('\n\n');
  const outcome = cells.length === 7 && cells[6] === p.department ? cells[5] : null;
  const purposeAt = nameEnd + 3;
  if (!outcome || !/。$/.test(outcome.trim())) return { purpose, raw: m[1], at: purposeAt };
  const outcomeAt = rowAt + cells.slice(0, 5).reduce((a, c) => a + c.length + 2, 0);
  return { purpose, outcomes: joinWrapped(outcome), raw: t.slice(purposeAt, outcomeAt + outcome.length), at: purposeAt };
}

// ---------------------------------------------------------------- 西和賀町（地域公共交通確保維持改善事業・事業評価 令和８年１月21日）
// 公開済みレコードは batch8/h7-c の抽出（評価対象事業名「地域内フィーダー系統確保維持費国庫補助金」・系統別の利用者数。年度なし）。
// 同じ資料の別添１－２「事業実施と生活交通確保維持改善計画との関連について」は同じ評価対象事業名を掲げ、
// 「地域の交通の目指す姿（事業実施の目的・必要性）」欄の本文が協議会名・事業名の後に1段落で続く（資料の末尾まで）。
const NISHIWAGA = /別添１－２\n\n事業実施と生活交通確保維持改善計画との関連について\n[^\n]+\n\n協議会名：\n\n評価対象事業名：\n\n地域の交通の目指す姿\n（事業実施の目的・必要性）\n\n西和賀町地域公共交通活性化協議会\n\n([^\n]+)\n\n/;
function nishiwagaFill(p: ProjectEvaluation, input: CachedInput) {
  const t = input.text, m = NISHIWAGA.exec(t);
  if (!m || m[1] !== p.projectName) return null;
  const at = m.index + m[0].length, body = t.slice(at).replace(/\s+$/, '');
  if (!body || body.includes('\n\n') || !/。$/.test(body)) return null;
  return { purpose: joinWrapped(body), raw: body, at };
}

export const shimizu = {
  extract: (input: CachedInput, inputs: CachedInput[]) => input.municipalityCode !== '01636' ? [] : refill(input, inputs, shimizuEntries['01636'].extract,
    '清水町 令和５年度物価高騰対応重点支援地方創生臨時交付金充当事業の効果検証の一覧表。目的は「事業の概要」欄の「①目的・効果」の項、成果は同じ行の「効果検証」欄（元の抽出が行の対応を検算した範囲）。折り返しの改行は除いた。', shimizuFill),
  scope: '清水町 臨時交付金充当事業の効果検証（令和５年度）: 「①目的・効果」と「効果検証」。',
};
export const nishiwaga = {
  extract: (input: CachedInput, inputs: CachedInput[]) => input.municipalityCode !== '03366' ? [] : refill(input, inputs, h7['03366'].extract,
    '西和賀町 地域公共交通確保維持改善事業・事業評価の別添１－２（同じ評価対象事業名）の「地域の交通の目指す姿（事業実施の目的・必要性）」欄。折り返しの改行は除いた。', nishiwagaFill),
  scope: '西和賀町 地域公共交通確保維持改善事業・事業評価: 別添１－２の「事業実施の目的・必要性」。',
};
