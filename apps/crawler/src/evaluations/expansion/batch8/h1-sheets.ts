import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, mergeReprints, nfkc, sheets } from '../batch7/g1-util';

/** 高松市 令和7年度（6年度決算分）事務事業評価表【事中・事後評価】の各票。 */
export function extractTakamatsu(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '37201' || input.sourceId !== '2b79d5a2a2db68a35affa2c4') return [];
  const heading = '令和 7年度（ 6年度決算分） 高松市事務事業評価表【事中・事後評価】';
  const out: ProjectEvaluation[] = [];
  const n = '([\\d,]+)';
  const cost = new RegExp(`【コストの推移】\\n単位\\n\\nR4\\n?（決算）\\n\\nR5\\n?（決算）\\n\\nR6\\n?（決算）\\n\\nR7\\n?（予算）\\n\\nトータルコスト\\n\\n\\[千円\\]\\n\\n${Array(4).fill(n).join('\\n\\n')}\\n\\n\\(事業費\\)\\n\\n\\[千円\\]\\n\\n${Array(4).fill(n).join('\\n\\n')}\\n\\n\\(職員人件費\\)\\n\\n\\[千円\\]\\n\\n${Array(4).fill(n).join('\\n\\n')}(?=\\n)`);
  for (const sh of sheets(input.text, heading)) {
    const name = sh.text.match(/\n事務事業 ([^\n]+)\n/), dept = sh.text.match(/\n課 \(室 \)名 ([^\n]+)\n/);
    if (!name || !dept) continue;
    const at = sh.start + name.index! + 1, raw = name[0].slice(1, -1);
    const p = project(input, `${dept[1]}:${name[1]}`, name[1], 2025, raw, at);
    p.department = dept[1]; p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, heading, sh.start), evidence(input, dept[0].slice(1, -1), sh.start + dept.index! + 1));
    const c = sh.text.match(cost);
    if (c) {
      const v = c.slice(1).map(x => Number(x.replaceAll(',', ''))), cs = sh.start + c.index!;
      if ([0, 1, 2, 3].every(i => v[i] === v[4 + i] + v[8 + i])) {
        ['R4', 'R5', 'R6'].forEach((_, i) => {
          if (v[4 + i] > 0) p.amounts.push(amount(input, 'actual', 2022 + i, c[5 + i], '千円', c[0], cs));
          if (v[8 + i] > 0) p.amounts.push(amount(input, 'personnel', 2022 + i, c[9 + i], '千円', c[0], cs));
          if (v[i] > 0) p.amounts.push(amount(input, 'fullCost', 2022 + i, c[1 + i], '千円', c[0], cs));
        });
        if (v[7] > 0) p.amounts.push(amount(input, 'budget', 2025, c[8], '千円', c[0], cs));
        p.warnings.push('金額は【コストの推移】表（R4〜R6決算・R7予算、千円）から、トータルコスト＝事業費＋職員人件費の検算が全列で一致した場合のみ収録。0と記載された年度は事業期間外の可能性があるため未収録。R7のトータルコスト・職員人件費は予算ベースの見込値のため未収録（事業費のみ予算として収録）。');
      }
    }
    const rank = sh.text.match(/\n評価ランク\n\n([ＡＢＣ])\n\n(拡充|継続|改善|縮小|完了|統合|休止|廃止)\n/);
    if (rank) {
      const rs = sh.start + rank.index! + 1, rr = rank[0].slice(1, -1);
      p.ratings.push({ kind: 'self', label: '評価ランク', value: rank[1], scale: 'Ａ(80%〜100%) Ｂ(60%〜 79%) Ｃ(0%〜 59%)（総合点の率）', evidence: evidence(input, rr, rs) });
      p.ratings.push({ kind: 'self', label: '今後の方向性', value: rank[2], scale: null, evidence: evidence(input, rr, rs) });
    }
    p.warnings.push('事務事業評価表の見出し・課名・事務事業名から収録。活動・成果指標は年度列の段組みが崩れているため未構造化。評価項目別の点数、事業費内訳は未構造化。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

/** 松前町 令和７年度（令和６年度対象）教育委員会の事務・事業の点検及び評価シートの各票。 */
export function extractMatsumae(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01331' || input.sourceId !== 'c4b969d538446c922d37e887') return [];
  const heading = '令和７年度（令和６年度対象）\n\n教育委員会における\n事務の点検・評価報告書';
  if (!input.text.startsWith(heading)) return [];
  const tocEnd = input.text.indexOf('１ 教育委員会における事務の点検・評価制度の概要\n（１）');
  const sec2 = '（2）\n\n文化社会教育課', sec2At = input.text.indexOf(sec2);
  if (tocEnd < 0 || sec2At < 0 || sec2At > tocEnd) return [];
  // 目次の事務事業名（課ごとの番号つき）。シートの事業名が目次と一致したものだけ採用する。
  const toc = new Map<string, string>();
  for (const m of input.text.slice(0, tocEnd).matchAll(/事務事業番号 (\d{2})\n\n([^\n]+?) ?-{3,}/g)) toc.set(`${m.index! > sec2At ? 2 : 1}:${Number(m[1])}`, nfkc(m[2]));
  const out: ProjectEvaluation[] = [];
  let section = 1, last = 0;
  for (const sh of sheets(input.text, /令和７年度\s+教育委員会の事務・事業の点検及び評価シート/)) {
    const m = sh.text.match(/事務事業番号\n(?:(\d+)\n事務事業名 ([^\n]+)\n|事務事業名\n\n(\d+)\n([^\n]+)\n|事務事業名\n\n令和６年度事務・事業分\n\n】\n\n(\d+)\n([^\n]+)\n)/);
    if (!m) continue;
    const no = Number(m[1] ?? m[3] ?? m[5]), name = (m[2] ?? m[4] ?? m[6]).trim();
    if (no <= last) section = 2;
    last = no;
    if (toc.get(`${section}:${no}`) !== nfkc(name)) continue;
    const at = sh.start + m.index!;
    const deptLine = section === 1 ? sh.text.match(/^(学校教育課|学校給食センター)$/m) : null;
    if (section === 1 && !deptLine) continue;
    const p = project(input, `${section === 1 ? '学校教育課・給食センター' : '文化社会教育課'}:${no}`, name, 2025, m[0], at);
    p.evaluatedFiscalYear = 2024;
    if (deptLine) { p.department = deptLine[1]; p.evidence.push(evidence(input, deptLine[0], sh.start + deptLine.index!)); }
    else { p.department = '文化社会教育課'; p.evidence.push(evidence(input, sec2, sec2At)); p.warnings.push('担当課は目次の区分（（2）文化社会教育課）による。'); }
    p.evidence.push(evidence(input, heading, 0));
    const b = sh.text.indexOf('予算の状況'), k = sh.text.indexOf('金額(千円)\n', b), tot = /\n計\n([\d,]+)\n/.exec(sh.text.slice(k));
    if (b >= 0 && k >= 0 && tot) {
      const body = sh.text.slice(k + '金額(千円)\n'.length, k + tot.index!);
      const items = body.split('\n').filter(l => /^[\d,]+$/.test(l)).map(l => Number(l.replaceAll(',', '')));
      if (items.length && items.reduce((a, v) => a + v, 0) === Number(tot[1].replaceAll(',', ''))) {
        const raw = sh.text.slice(k, k + tot.index! + tot[0].length - 1);
        p.amounts.push(amount(input, 'budget', 2024, tot[1], '千円', raw, sh.start + k));
        p.warnings.push('金額は「令和６年度 予算の状況」の節別金額(千円)の計で、節別金額の合計と計が一致した場合のみ予算として収録。決算額の推移は表の単位が明記されず列が崩れる票があるため未収録。');
      }
    }
    // 点数による評価（1 要改善〜4 良好）。丸囲み数字が各行の1〜4の並びの中にちょうど1つある場合だけ選択値とする。
    const selfAt = sh.text.indexOf('◎ 事業評価（自己評価）'), extAt = sh.text.indexOf('◎松前町教育委員会外部評価');
    let scored = 0;
    if (selfAt >= 0 && extAt > selfAt) {
      for (const [kind, from, to, who] of [['self', selfAt, extAt, '自己評価'], ['external', extAt, sh.text.length, '外部評価']] as const) {
        for (const [label, re] of [['事業内容', /事\s*業\s*内\s*容\n+([1①])\n+([2②])\n+([3③])\n+([4④])\n/], ['財政面', /財\s*政\s*面\n+([1①])\n+([2②])\n+([3③])\n+([4④])\n/],
          ['目的達成度', /目\s*的\s*達\s*成\s*度\n+([1①])\n+([2②])\n+([3③])\n+([4④])\n/], ['総合評価', /総\s*合\s*評\s*価\n+([1①])\n+([2②])\n+([3③])\n+([4④])\n/]] as const) {
          const r = re.exec(sh.text.slice(from, to));
          if (!r) continue;
          const picked = r.slice(1).map((v, i) => /[①-④]/.test(v) ? i + 1 : 0).filter(Boolean);
          if (picked.length !== 1) continue;
          const raw = r[0].slice(0, -1), rs = sh.start + from + r.index;
          p.ratings.push({ kind, label: `${who} ${label}`, value: String(picked[0]), scale: '1 要改善 / 2 要検討 / 3 妥当 / 4 良好', evidence: evidence(input, raw, rs) });
          scored++;
        }
      }
    }
    p.warnings.push(`点検及び評価シートの事務事業番号・事務事業名（目次と一致したもののみ）から収録。${scored ? '点数による評価は、抽出テキストで丸囲み数字が1つだけ判別できた行のみ収録。' : '自己評価・外部評価の点数（1〜4）は選択印が抽出テキストで判別できないため未収録。'}コメント本文は未構造化。`);
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

/** 西目屋村 電源立地地域対策交付金 事業評価個表（令和7年度）。 */
export function extractNishimeya(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '02343' || input.sourceId !== 'd62e0be5ce4b34e146bec7dd') return [];
  const sheet = 'Ⅱ．事業評価個表（令和7年度）', name = '味な工房LED化改修事業';
  const s = input.text.indexOf(sheet);
  const head = '1 維持補修又は維持運営等 味な工房LED化改修事業', dept = '交付金事業の担当課室\n\n西目屋村産業課';
  const period = '事業開始年度\n\n令和7年度\n\n事業終了年度\n\n令和7年度';
  const act = 'LED化改修工事\n\n交付金事業の総事業費等\n\n一式\n\n単位\n\n令和7年度\n\n活動実績\n\n式\n\n1\n\n活動見込\n\n式\n\n1\n\n達成度\n\n％\n\n100';
  const h = input.text.indexOf(head, s), d = input.text.indexOf(dept, s), pe = input.text.indexOf(period, s), a = input.text.indexOf(act, s);
  if (s < 0 || h < 0 || d < 0 || pe < 0 || a < 0) return [];
  const p = project(input, `事業評価個表1`, name, null, head, h);
  p.department = '西目屋村産業課'; p.evaluatedFiscalYear = 2025;
  p.evidence.push(evidence(input, sheet, s), evidence(input, dept, d), evidence(input, period, pe));
  p.indicators.push({ name: '活動指標 LED化改修工事', fiscalYear: 2025, target: '1', actual: '1', unit: '式', evidence: evidence(input, act, a) });
  p.warnings.push('電源立地地域対策交付金の事業評価個表（1事業）から収録。活動指標の目標は「活動見込」の値。成果指標（施設利用者数）は令和8年度評価予定で実績未記載のため未収録。金額は総括表の交付金事業に要した経費（7,000,000円）と備考・契約金額（9,827,532円）の関係が本文で確定しないため未収録。評価年度は個表見出しの年度と成果目標の評価年度（令和8年度）が異なるため未設定。');
  return [p];
}
