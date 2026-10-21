import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, mergeReprints, nfkc } from '../batch7/g1-util';

/** 長崎市 事務事業事前評価結果（令和6年度当初予算）のHTML表（番号・部局名・所属名・事務事業名・今後の方向性）。 */
export function extractNagasaki(input: CachedInput): ProjectEvaluation[] {
  const title = '事務事業事前評価結果（令和6年度当初予算）', header = '番号\n部局名\n所属名\n事務事業名\n今後の\n方向性\n';
  if (input.municipalityCode !== '42201' || input.sourceId !== 'd441f6cfcf2beea74d7f56a3' || !input.text.startsWith(title)) return [];
  const h = input.text.indexOf(header);
  if (h < 0) return [];
  const out: ProjectEvaluation[] = [];
  let pos = h + header.length, n = 1;
  for (;;) {
    const m = new RegExp(`^${n}\\n([^\\n]+部|[^\\n]+室)\\n((?:[^\\n]+(?:課|室|センター)\\n)+)((?:[^\\n]+\\n)+?)(採択|一部不採択|不採択)(?=\\n|$)`).exec(input.text.slice(pos));
    if (!m) break;
    const [raw, bureau, sections, nameLines, result] = m;
    // Wrapped parentheticals are rejoined as-is; separate items listed on their own lines keep a space between them.
    const name = nameLines.trim().split('\n').reduce((a, l) => a + (/^（|（$/.test(l) || a.endsWith('（') ? '' : ' ') + l);
    if (/^(採択|一部不採択|不採択)$/m.test(nameLines)) break;
    const p = project(input, `番号${n}`, name, null, raw, pos);
    p.department = `${bureau} ${sections.trim().split('\n').join('・')}`;
    p.ratings.push({ kind: 'self', label: '今後の方向性（事前評価）', value: result, scale: '採択／一部不採択／不採択', evidence: evidence(input, raw, pos) });
    p.evidence.push(evidence(input, title, 0));
    p.warnings.push('令和6年度に新規・拡大して実施予定の事業を当初予算要求時点で評価した事前評価結果の表から、番号・部局名・所属名・事務事業名・今後の方向性を収録。事後評価ではないため評価年度・評価対象年度は未設定。表の折返しは行の順に連結。同内容のPDF一覧表（評価理由・意見）は段組みが崩れているため未構造化。');
    out.push(p);
    pos += raw.length + 1; n++;
  }
  return out;
}

const TSUMAGOI = ['08245d10cc2210c6c95df38b', '2d372859199e496ed1376906', '32fc55feb9bda08723ce5fec', '4faf014e39ea4e01c0165a79', '7fb295914d9266a0cccfdf50', '9562006641a80f2ba153c735'];
const POLICY1 = '見直しの上で継続|休止・廃止・終了|現状のまま継続';
const POLICY2 = '重点化|効率化|簡素化|事業終了|統合|廃止|休止';
const T_ROW = new RegExp(`(?<=\\n\\n)(\\d+)\\n\\n(\\d+)(?:\\n\\n| )([^\\n]+?)\\n\\n([^\\n]+(?:\\n[^\\n]+)?)\\n\\n(?:([\\d,]+) |([\\d,]+)\\n\\n)?(${POLICY1})(?:\\n\\n(${POLICY2})(?=\\n))?(?=\\n)`, 'g');
const T_DEPT = /^\S+(?:課|局|委員会|室)$/;
/** Section heading → policy values every row in it must carry (rows are rejected rather than re-assigned). */
const SECTIONS: Record<string, { p1: string; p2?: string[] }> = {
  重点化事業一覧: { p1: '見直しの上で継続', p2: ['重点化'] },
  '効率化・簡素化を図る事業一覧': { p1: '見直しの上で継続', p2: ['効率化', '簡素化'] },
  効率化を図る事業一覧: { p1: '見直しの上で継続', p2: ['効率化'] },
  簡素化する事業一覧: { p1: '見直しの上で継続', p2: ['簡素化'] },
  '休止・廃止・終了事業一覧': { p1: '休止・廃止・終了' },
};

/** 嬬恋村 事務事業評価 二次評価結果（重点化／効率化・簡素化／休止・廃止・終了の事業一覧）。 */
export function extractTsumagoi(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '10425' || !TSUMAGOI.includes(input.sourceId)) return [];
  const head = /^令和(元|[0-9０-９]+)年度\n\n事務事業評価\n\n二次評価結果集計表\n/.exec(input.text);
  if (!head) return [];
  const year = 2018 + (head[1] === '元' ? 1 : Number(nfkc(head[1])));
  const marks = [...input.text.matchAll(/■([^\n]+)\n/g)];
  const out: ProjectEvaluation[] = [];
  for (const [k, mk] of marks.entries()) {
    const section = mk[1];
    const expect = SECTIONS[section];
    if (!expect) continue;
    const s = mk.index!, seg = input.text.slice(s, marks[k + 1]?.index ?? input.text.length);
    // Settled-amount column carries an explicit year only in the R1/R2 editions (「R1決算額」「R２決算額」).
    const fy = /R([0-9０-９]+)決算額\n\(千円\)/.exec(seg);
    const rows = [...seg.matchAll(T_ROW)];
    // When some rows of the section are broken up by the layout, detached amounts may sit next to the wrong row.
    const clean = rows.length === seg.split(expect.p1).length - 1;
    for (const m of rows) {
      const [raw, , no, dept, nameRaw, amt1, , p1, p2] = m;
      const name = nameRaw.replace('\n', '');
      if (!T_DEPT.test(dept) || T_DEPT.test(nameRaw) || /^[\d,]+$/.test(nameRaw) || nameRaw.includes('\n\n')) continue;
      if (p1 !== expect.p1 || expect.p2 && !expect.p2.includes(p2)) continue;
      const start = s + m.index!;
      const p = project(input, `№${no}`, name, year, raw, start);
      p.department = dept;
      p.ratings.push({ kind: 'self', label: '二次評価 展開方針①', value: p1, scale: '現状のまま継続／見直しの上で継続／休止・廃止・終了', evidence: evidence(input, raw, start) });
      if (p2) p.ratings.push({ kind: 'self', label: '二次評価 展開方針②', value: p2, scale: null, evidence: evidence(input, raw, start) });
      // Only the 「金額 展開方針①」 single-line form keeps the amount in its row; a detached amount line is not used.
      const a = clean ? amt1 : undefined;
      if (a && fy) {
        const off = start + raw.indexOf(`${a} ${p1}`, raw.indexOf(nameRaw) + nameRaw.length);
        p.amounts.push(amount(input, 'actual', 2018 + Number(nfkc(fy[1])), a, '千円', a, off));
        p.evidence.push(evidence(input, fy[0], s + fy.index));
      }
      p.evidence.push(evidence(input, head[0], 0));
      p.warnings.push(`嬬恋村 令和${head[1]}年度事務事業評価の二次評価結果「${section}」の行から、№・担当課名・事業名・展開方針①②を収録。` +
        (a && fy ? `決算額は列見出し「R${fy[1]}決算額(千円)」の年度で、展開方針①と同じ行に印字された値のみ収録。` : '決算額は列見出しに年度の明記がない、または行との対応が確定しないため金額として未収録。') +
        '展開方針が「現状のまま継続」の事業（集計のみ）と、段組みが崩れた末尾の評価結果一覧表は未構造化。評価対象年度は本文に明記がなく未設定。');
      out.push(p);
    }
  }
  return mergeReprints(out, p => `${p.projectCode}:${p.evaluationYear}`);
}
