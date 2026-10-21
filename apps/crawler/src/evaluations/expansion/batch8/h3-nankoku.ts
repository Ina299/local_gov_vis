/** 39204 南国市: 事務事業実績・評価報告書（令和２〜５年度決算）の「事務事業評価表」。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { BASE_WARNING, type Entry, acrossInputs, digits, reiwa, segments, toNum } from './h3-util';

// 令和６年度決算版（b6fafad82842c085079583d5）は抽出テキストが文字化けしているため対象外。
const SOURCES = new Set(['0539d5116210211d76c5a709', 'ac9efa11a32e4678d344f0da', 'f702949d0b6c4857483b2edc', 'd439c46cfcae5a6dce07c2ed']);
const HEAD = /令和([０-９\d]+)年度決算 事務事業評価表\n１．事業名等\n/g;
const SCALE = /事業の評価は、「妥当性」「効率性」「有効性」についてそれぞれ「適正である」を３点、「検討余地\n?あり」\n?を２点、「改善すべき」を１点とし、合計点数が９・８点のときは「Ａ」、７・６点のときは「Ｂ」、５～３\n?点のときは\n?「Ｃ」としました。/;
const nf = (s: string) => s.normalize('NFKC').trim();
const LABELS = new Set(['事 業 名', '所管課・係\n作成者', '事業の目的']);
const DIRECTIONS = ['拡充', '継続', '縮小', '終了'];

function extract(input: CachedInput): ProjectEvaluation[] {
  if (!SOURCES.has(input.sourceId)) return [];
  const t = input.text, title = t.match(/^令和([０-９\d]+)年度決算\n\n事務事業実績・評価報告書\n/);
  if (!title) return [];
  const sheets = segments(t, HEAD);
  if (!sheets.length) return [];
  const toc = t.slice(0, sheets[0].start), scale = toc.match(SCALE);
  // 目次の各行（係名が前置される行は末尾の事業名部分も）を正規化して保持。
  const tocNames = new Set(toc.split('\n').flatMap(l => { const n = nf(l); const sp = n.match(/^\S+係 (.+)$/); return sp ? [n, sp[1]] : [n]; }));
  const out: ProjectEvaluation[] = [];
  for (const { m, start, end } of sheets) {
    const year = reiwa(m[1]);
    if (year !== reiwa(title[1])) continue;
    const seg = t.slice(start, end);
    const dm = seg.match(/\n\n([^\n]+)\n([^\n]+)\n\n?第[４５]次南国市総合計画での位置づけ\n/);
    if (!dm || !/(?:課|局|室|館|所|センター|係)/.test(dm[1]) || /[。、\d]/.test(dm[1])) continue;
    const head = seg.slice(m[0].length, dm.index!);
    // 事業名: 先頭の見出し以外の段落の1行目（2行に折り返した場合は連結）で、目次の行と一致するものだけ採用。
    let name: string | null = null, raw = '', nameAt = -1, pos = m[0].length;
    for (const para of head.split('\n\n')) {
      if (para && !LABELS.has(para)) {
        const lead = para.startsWith('事 業 名 ') ? '事 業 名 '.length : 0, lines = para.slice(lead).split('\n');
        for (const [cand, r] of [[lines[0], lines[0]], lines.length > 1 ? [lines[0] + lines[1], lines[0] + '\n' + lines[1]] : null].filter(Boolean) as string[][])
          if (cand.length <= 60 && !cand.includes('。') && tocNames.has(nf(cand))) { name = nf(cand) === cand ? cand : cand.trim(); raw = r; nameAt = pos + lead; break; }
        if (name) break;
      }
      pos += para.length + 2;
    }
    if (!name) continue;
    const p = project(input, `${year}:${name}:${dm[1]}`, name, null, raw, start + nameAt);
    p.projectCode = null; p.department = dm[1]; p.evaluatedFiscalYear = year;
    p.evidence.push(evidence(input, m[0].trimEnd(), start), evidence(input, dm[1], start + dm.index! + 2));
    const warnings = [BASE_WARNING + '事務事業評価表の事業名（目次と一致するものに限る）・所管課係・総合評価（Ａ/Ｂ/Ｃ）・担当課長が考える今後の方向性。妥当性・効率性・有効性の個別点はチェック欄の並びが崩れているため構造化していません。評価年度は本文に明示がないため未設定（評価対象年度は表題の決算年度）。'];
    // 総合評価
    const rm = [...seg.matchAll(/\n\n([ABCＡＢＣ])\n\n妥\n当\n性\n/g)];
    if (rm.length === 1 && scale) {
      p.ratings.push({ kind: 'self', label: '総合評価（妥当性・効率性・有効性の合計点による）', value: rm[0][1].normalize('NFKC'), scale: scale[0].replaceAll('\n', ''),
        evidence: evidence(input, rm[0][0].trim(), start + rm[0].index! + 2) });
      p.evidence.push(evidence(input, scale[0], scale.index!));
    }
    // 今後の方向性（☑が1つだけの場合）
    const dirAt = seg.indexOf('●担当課長が考える今後の方向性等');
    if (dirAt >= 0) {
      const marks = [...seg.slice(dirAt).matchAll(/([☑□]) (拡充|継続|縮小|終了)/g)];
      const checked = marks.filter(x => x[1] === '☑');
      if (marks.length === 4 && DIRECTIONS.every(d => marks.filter(x => x[2] === d).length === 1) && checked.length === 1)
        p.ratings.push({ kind: 'self', label: '担当課長が考える今後の方向性', value: checked[0][2], scale: '拡充／継続／縮小／終了（原文の選択肢）',
          evidence: evidence(input, checked[0][0], start + dirAt + checked[0].index!) });
    }
    // 事業費: 「（単位：千円）」が表にあり、事業費＝一般財源（他財源なし）で3年度とも一致する場合のみ決算年度の値を採用。
    const s2 = seg.indexOf('２．事業の概要・成果'), s3 = seg.indexOf('●事業の概要');
    if (s2 >= 0 && s3 > s2) {
      const block = seg.slice(s2, s3);
      const am = block.match(/\n事業費 国県支出金\n([\d,]+)\n([\d,]+)\n([\d,]+)\n\n地方債\n\nその他\n\n(?:（単位：千円）\n)?一般財源\n([\d,]+)\n([\d,]+)\n([\d,]+)\n/);
      const yl = [...block.matchAll(/(?<=\n)([HR])([０-９\d元]+)年度(?=\n)/g)].map(x => (x[1] === 'R' ? 2018 : 1988) + digits(x[2]));
      if (am && block.includes('（単位：千円）') && yl.length === 3 && yl[2] === year && yl[1] === year - 1 && yl[0] === year - 2
        && am[1] === am[4] && am[2] === am[5] && am[3] === am[6]) {
        const raw = am[0].slice(1, -1), e = evidence(input, raw, start + s2 + am.index! + 1);
        p.amounts.push({ kind: 'actual', fiscalYear: year, amountYen: toNum(am[3]) * 1000, rawValue: am[3], rawUnit: '千円', evidence: e });
        warnings.push('事業費は「（単位：千円）」表記があり国県支出金・地方債・その他が空欄（事業費＝一般財源）の表に限り、決算年度の値のみ採用。');
      }
    }
    p.warnings = warnings;
    out.push(p);
  }
  return out;
}

export const entries: Record<string, Entry> = {
  '39204': { extract: acrossInputs(extract), scope: '事務事業実績・評価報告書（令和２〜５年度決算）の事務事業評価表から事業名・所管課係・総合評価（Ａ〜Ｃ）・今後の方向性を構造化。事業費は単位表記があり財源が一般財源のみの表の決算年度分だけ。妥当性等の個別点・成果の記述・令和６年度版（文字化け）は対象外。' },
};
