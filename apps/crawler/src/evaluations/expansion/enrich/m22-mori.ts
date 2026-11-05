import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { joinWrapped } from './m22-util';

// ---------------------------------------------------------------- 森町（地域公共交通確保維持改善事業・事業評価 令和７年度）
// 公開済みレコードは同じ資料（R7zigyouhyouka.pdf）の評価対象事業名から作られ、評価年度は令和7年（2025）。
// 別紙１－２「事業実施と生活交通確保維持改善計画との関連について」の欄「地域の交通の目指す姿（事業実施の目的・必要性）」は
// 1欄だけの表で、欄の見出し（2行）が欄の縦の中央の行頭に入る。見出しの語を除いた行を目的とする。
// 同じ文が載る「事業の概要」の頁は地域公共交通の現況の列と行が混ざるため使わない。
const HEAD = '別紙１－２\n事業実施と生活交通確保維持改善計画との関連について\n';
const LABELS = ['地域の交通の目指す姿 ', '（事業実施の目的・必要性） '];

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01345' || !input.sourceUrl.endsWith('/R7zigyouhyouka.pdf')) return [];
  const t = input.text, h = t.indexOf(HEAD);
  if (h < 0 || t.indexOf(HEAD, h + 1) >= 0) return [];
  const name = /\n評価対象事業名： ([^\n]+)\n/.exec(t.slice(h)), end = t.indexOf('\n森町地域公共交通会議における地域公共交通確保維持改善事業の概要\n', h);
  if (!name || end < 0) return [];
  const at = h + name.index! + name[0].length, raw = t.slice(at, end), lines = raw.split('\n');
  // 見出しの2語が順に1回ずつ、連続する2行の行頭にあり、最後の行が句点で終わること。
  const li = lines.findIndex(l => l.startsWith(LABELS[0]));
  if (li < 0 || !lines[li + 1]?.startsWith(LABELS[1]) || lines.some((l, i) => i !== li && i !== li + 1 && /目指す姿|目的・必要性/.test(l)) || !/。$/.test(raw)) return [];
  const parts = lines.map((l, i) => i === li ? l.slice(LABELS[0].length) : i === li + 1 ? l.slice(LABELS[1].length) : l);
  const p = project(input, `${name[1]}:purpose`, name[1], 2025, name[0].slice(1, -1), h + name.index! + 1);
  p.projectCode = null;
  p.purpose = joinWrapped(parts);
  p.evidence.push(evidence(input, raw, at));
  p.warnings.push('森町 地域公共交通確保維持改善事業・事業評価（令和７年度）別紙１－２の「地域の交通の目指す姿（事業実施の目的・必要性）」欄。行頭に入った欄の見出しの語を除き、欄の幅での折り返しは改行を除いてつないだ。');
  return [p];
}

export const entry = {
  extract,
  scope: '森町 地域公共交通確保維持改善事業・事業評価（令和７年度）: 別紙１－２の事業実施の目的・必要性欄。',
};
