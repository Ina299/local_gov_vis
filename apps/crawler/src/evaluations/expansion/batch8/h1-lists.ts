import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, mergeReprints, nfkc } from '../batch7/g1-util';

const DEPT = /(?:課|局|館|室|病院|センター|委員会)$/;

/** 男鹿市 令和５年度（４年度実施事業）行政評価結果一覧（一次評価）の行（一般会計・企業会計）。 */
export function extractOga(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '05206' || input.sourceId !== 'ab7e519f75ef1b6a0b72a88f') return [];
  const general = '令和５年度（４年度実施事業）行政評価結果一覧（一次評価）\n\n【一般会計】', enterprise = '令和５年度（４年度実施事業）事業評価結果一覧（一次評価）\n\n【企業会計】';
  const g = input.text.indexOf(general), e = input.text.indexOf(enterprise), end = input.text.indexOf('男鹿市庁内行政評価委員会設置要綱', e);
  if (g < 0 || e < g || end < e) return [];
  const legend = '評価区分\n\nA\nB\nC\nD\n\n点\n\n数\n\n16.0以上\n\n事業継続\n\n15.9\n\n～\n\n14.0\n\n改善を検討し、事業継続\n\n13.9\n\n～\n\n12.0\n\n事業縮小・再構築の検討\n\n11.9以下';
  const hasLegend = input.text.includes(legend);
  const scale = '一次評価評点表: ①必要性②有効性③効率性④緊急性⑤将来性を各4点〜1点で評点し合計。評価区分 A 16.0以上 事業継続 / B 15.9〜14.0 改善を検討し、事業継続 / C 13.9〜12.0 事業縮小・再構築の検討 / D 11.9以下 事業廃止・凍結の検討';
  const out: ProjectEvaluation[] = [];
  for (const [account, from, to, heading] of [['一般会計', g, e, general], ['企業会計', e, end, enterprise]] as const) {
    const re = /(?<=\n)(\d{1,3})(?: |\n\n)([^\n]+)\n\n([^\n]+)\n\n([ＡＢＣＤ])\n\n(\d{1,2})\n\n([1-4])\n\n([1-4])\n\n([1-4])\n\n([1-4])\n\n([1-4])(?=\n)/g;
    re.lastIndex = from;
    for (let m = re.exec(input.text); m && m.index < to; m = re.exec(input.text)) {
      const [raw, no, name, dept, rank, total, ...points] = m;
      const sum = points.reduce((s, v) => s + Number(v), 0), t = Number(total);
      const expected = t >= 16 ? 'Ａ' : t >= 14 ? 'Ｂ' : t >= 12 ? 'Ｃ' : 'Ｄ';
      if (sum !== t || rank !== expected || !DEPT.test(dept) || /^[\d（(]/.test(name)) continue;
      const p = project(input, `${account}-${no}`, name.trim(), 2023, raw, m.index);
      p.department = dept; p.evaluatedFiscalYear = 2022;
      const ev = () => evidence(input, raw, m!.index);
      p.ratings.push({ kind: 'self', label: '評価区分（一次）', value: rank, scale: hasLegend ? scale : null, evidence: ev() });
      p.ratings.push({ kind: 'self', label: '総合点', value: total, scale: null, evidence: ev() });
      ['①必要性', '②有効性', '③効率性', '④緊急性', '⑤将来性'].forEach((label, i) => p.ratings.push({ kind: 'self', label, value: points[i], scale: '4点〜1点', evidence: ev() }));
      p.evidence.push(evidence(input, heading));
      p.warnings.push(`行政評価結果一覧（一次評価・${account}）の1行から、事業名・所管課・評価区分・総合点・5項目の評点を収録。5項目の合計＝総合点、総合点と評価区分の閾値が一致した行のみ。二次評価・外部評価（対象5事業）、決算額・成果指標は未構造化。`);
      out.push(p);
    }
  }
  return mergeReprints(out, p => p.projectCode!);
}

/** 古賀市 平成24年度行政評価（平成23年度事務事業評価）最終評価結果報告書の最終評価対象事業一覧。 */
export function extractKoga(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '40223' || input.sourceId !== 'a7762f760a07b08792949570') return [];
  const heading = '平成２４年度行政評価\n（平成２３年度事務事業評価）\n\n最終評価結果報告書';
  const listHead = '●最終評価対象事業と評価結果';
  const s = input.text.indexOf(listHead), end = input.text.indexOf('基本事業管理表', s);
  if (!input.text.startsWith(heading) || s < 0 || end < 0) return [];
  const scales: Record<string, string> = {
    必要性: '5：実施が義務付けられた事業、4：市が実施する必要がある事業、3：市が実施する必要が概ねある事業、2：市として実施する必要があまりない事業、1：市として実施する必要がない事業',
    効率性: '4：費用対効果が得られた事業、3：費用対効果が概ね得られた事業、2：費用対効果があまり得られていない事業、1：費用対効果が得られていない事業',
    成果: '4：目標を達成している事業、3：目標を概ね達成している事業、2：目標をあまり達成できていない事業、1：目標を達成できていない事業',
    方向性: '3:現状維持､2:見直しのうえ継続､1:廃止､0:終了', 規模: '4:拡大､3:維持､2:縮小', 経費: '4:拡大､3:維持､2:縮小',
  };
  const out: ProjectEvaluation[] = [];
  const re = /\n\n(\d{1,2})\n\n([^\n]+)\n\n(\S+部)\n\n([^\n]+)\n\n([1-5])\n\n([1-4])\n\n([1-4])\n\n([0-3])\n\n([2-4]|－)\n\n([2-4]|－)(?=\n)/g;
  re.lastIndex = s;
  for (let m = re.exec(input.text); m && m.index < end; m = re.exec(input.text)) {
    const [, no, name, bu, ka, need, eff, res, dir, scale, cost] = m;
    // 方向性が2（見直しのうえ継続）の場合のみ規模・経費が記入される
    if ((dir === '2') !== (scale !== '－' && cost !== '－') || !DEPT.test(ka)) continue;
    const raw = m[0].slice(2), start = m.index + 2;
    const p = project(input, `最終評価対象事業${no}`, name, 2012, raw, start);
    p.department = `${bu} ${ka}`; p.evaluatedFiscalYear = 2011;
    const rate = (label: string, value: string) => p.ratings.push({ kind: 'self', label: `最終評価 ${label}`, value, scale: scales[label], evidence: evidence(input, raw, start) });
    rate('必要性', need); rate('効率性', eff); rate('成果', res); rate('方向性', dir);
    if (dir === '2') { rate('規模', scale); rate('経費', cost); }
    p.evidence.push(evidence(input, heading, 0));
    p.warnings.push('最終評価対象事業と評価結果の一覧の1行（経営改革推進本部の最終評価）から収録。評価基準は同資料の基本事業管理表の記載による。規模・経費は方向性が2の行のみ記入され、記入有無が方向性と整合する行のみ収録。事業費・指標、各部の基本事業管理表の本文は未構造化。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

/** 米原市 令和６年度実施事業 教育委員会点検評価の「対象事業の評価一覧」と各事業票の事業コスト。 */
export function extractMaibara(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '25214' || input.sourceId !== '010684a11b29a21bb8c291f5') return [];
  const heading = '令和６年度実施事業における\n教育に関する事務の管理および\n執行の状況の点検および評価等の報告書';
  const s = input.text.indexOf('【対象事業の評価一覧】'), e = input.text.indexOf('【課別対象事業評価集計表】', s);
  if (!input.text.startsWith(heading) || s < 0 || e < 0) return [];
  const scale = '総合評価 A 平均点が３点以上(端数の場合は四捨五入して３点） / B 平均点が２点以上(端数の場合は四捨五入して２点） / C 平均点が１点以下(端数の場合は四捨五入して１点）';
  const rows: { no: number; name: string; rank: string; dept: string | null; raw: string; start: number; ditto: boolean }[] = [];
  const re = /\n\n([０-９]{1,2})\n\n([^\n]+)\n\n([ABC])(?:\n\n(?![０-９]{1,2}\n)([^\n]+))?(?=\n\n)/g;
  re.lastIndex = s;
  let prev: string | null = null;
  for (let m = re.exec(input.text); m && m.index < e; m = re.exec(input.text)) {
    const no = Number(nfkc(m[1])), dept: string | null = m[4] === '〃' ? prev : DEPT.test(m[4] ?? '') ? m[4]! : null;
    if (m[4] === '〃' && !prev) { prev = null; continue; }
    if (no !== rows.length + 1) break;
    rows.push({ no, name: m[2], rank: m[3], dept, raw: m[0].slice(2), start: m.index + 2, ditto: m[4] === '〃' });
    prev = dept;
  }
  if (rows.length !== 30) return [];
  const heads = [...input.text.matchAll(/\n款\n\n10 教育費\n/g)].map(m => m.index!).filter(i => i > e);
  const out: ProjectEvaluation[] = [];
  for (const r of rows) {
    const p = project(input, `評価一覧${r.no}`, r.name, null, r.raw, r.start);
    p.department = r.dept; p.evaluatedFiscalYear = 2024;
    p.ratings.push({ kind: 'self', label: '総合評価', value: r.rank, scale, evidence: evidence(input, r.raw, r.start) });
    p.evidence.push(evidence(input, heading, 0));
    p.warnings.push('対象事業の評価一覧の1行（番号・事務事業名・評価・主管課）から収録。主管課の「〃」は直前の行の課として補完。報告書は令和７年12月作成で、評価年度の表記がないため評価年度は未設定。');
    if (r.dept === null) p.warnings.push('主管課欄が表の段組みで行と対応しないため未設定。');
    // 評価一覧と同順に並ぶ事業票（款 10 教育費 で始まる）を、事業名・主管課が票内にあることを確認して対応させる。
    const h = heads[r.no - 1];
    if (heads.length === 30 && h !== undefined) {
      const sheet = input.text.slice(h, heads[r.no] ?? input.text.length);
      const c = sheet.match(/人件費\( ?[\d.]+\n\n人\n役\n\n[^千]{0,80}?\n([\d,]+) 千円\n\n([\d,]+) 千円\n\n([\d,]+) 千円/);
      const ok = sheet.includes(r.name) && (!r.dept || sheet.includes(r.dept));
      if (ok && c) {
        const [direct, staff, total] = [c[1], c[2], c[3]].map(v => Number(v.replaceAll(',', '')));
        if (direct + staff === total) {
          const at = h + c.index!;
          p.amounts.push(amount(input, 'actual', 2024, c[1], '千円', c[0], at), amount(input, 'personnel', 2024, c[2], '千円', c[0], at), amount(input, 'fullCost', 2024, c[3], '千円', c[0], at));
          p.warnings.push('金額は同事業票の「事業コスト」欄（決算額: 事業費・人件費・計）から、事業費＋人件費＝計の検算が一致した場合のみ収録。人件費は従事人役×令和６年度平均人件費による算出値（報告書の説明による）。予算額・財源内訳は列の対応が確定しないため未収録。');
        }
      }
    }
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

/** 杵築市 令和６年度 施策評価及び事務事業評価並びに補助金評価報告書の事務事業評価コメント一覧（外部評価）。 */
export function extractKitsuki(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '44210' || input.sourceId !== 'bf5efbef612269c6c513ab47') return [];
  const heading = '令和６年度\n施策評価及び事務事業評価並びに\n補助金評価報告書';
  const s = input.text.lastIndexOf('（２）事務事業評価コメント一覧\n外部評価');
  if (!input.text.includes(heading) || s < 0) return [];
  const scale = '“廃止”“内容見直し”“縮小”“継続”“拡大”の５つの選択肢';
  const out: ProjectEvaluation[] = [];
  const re = /\n\n([１-９])\n\n([^\n]+)\n\n(廃止|内容見直し|縮小|継続|拡大)\n/g;
  re.lastIndex = s;
  for (let m = re.exec(input.text); m; m = re.exec(input.text)) {
    const raw = m[0].slice(2, -1), start = m.index + 2;
    const p = project(input, `外部評価${nfkc(m[1])}`, m[2], 2024, raw, start);
    p.ratings.push({ kind: 'external', label: '外部評価 見直しの方針', value: m[3], scale: input.text.includes(scale) ? scale : null, evidence: evidence(input, raw, start) });
    p.evidence.push(evidence(input, heading));
    p.warnings.push('杵築市行財政改革推進委員会行政評価部会の事務事業評価コメント一覧（外部評価）の行から、事業名と見直しの方針を収録。総合コメントの本文、担当課、事業費・指標、評価対象年度は記載がないため未構造化。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}
