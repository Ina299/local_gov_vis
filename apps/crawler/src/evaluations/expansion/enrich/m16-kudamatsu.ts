import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 下松市教育委員会 事務事業評価報告書（令和６〜８年度）
// 公開済みレコードは同じ報告書の「事務事業評価シート」から作られ、令和６・７年度版は「１ 事務事業の概要」を事業内容に
// 収録済み。令和８年度版のレコードは事業内容が空のため、同じ欄を事業内容として足す。概要は目的と実施内容が一つの文章に
// 書かれており、目的だけの欄はないため目的は埋めない。今後の課題（５）は成果ではないため対象外。
// シートの見出しは「事務事業評価シート 【№N】」の次に「事務事業 名称 担当課 課名」（名称が長いと前後の行に折り返す）。
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '35207' || !/\/kyo-soumu\/documents\/r0[678]jimujigyou[a-z]+\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, title = /^令和([０-９\d]+)年度（令和([０-９\d]+)年度対象）\n事務事業評価報告書\n/.exec(t);
  if (!title) return [];
  const evaluationYear = 2018 + Number(ascii(title[1])), fiscal = 2018 + Number(ascii(title[2]));
  const heads = [...t.matchAll(/^事務事業評価シート 【№[０-９\d]+】\n/gm)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const start = heads[i].index! + heads[i][0].length, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const h = /^(?:事務事業 (\S[^\n]*?) 担当課 (\S+)|([^\n]+)\n事務事業 担当課 (\S+)\n([^\n]+))\n１ 事務事業の概要\n/.exec(seg);
    if (!h) continue;
    const name = h[1] ?? h[3] + h[5], department = h[2] ?? h[4];
    const end = seg.indexOf('\n２ 事務事業のコスト', h[0].length - 1);
    if (end < 0) continue;
    const raw = seg.slice(h[0].length, end);
    if (!raw.trim() || /^(予算|決算|Ｒ[０-９])/m.test(raw)) continue;
    const p = project(input, `${name}:activities`, name, evaluationYear, seg.slice(0, h[0].length - 1), start);
    p.department = department;
    p.evaluatedFiscalYear = fiscal;
    p.activities = unwrap(raw);
    p.evidence.push(evidence(input, raw, start + h[0].length));
    p.warnings.push('下松市教育委員会 事務事業評価シートの「１ 事務事業の概要」欄を事業内容として収録（欄の幅で折り返した改行のみ除去）。');
    out.push(p);
  }
  return out.filter(p => out.filter(o => o.projectName === p.projectName).length === 1);
}

export const entry = { extract, scope: '下松市教育委員会 事務事業評価報告書（令和６〜８年度）の事務事業評価シート「１ 事務事業の概要」（事業内容）。目的欄はない。' };
