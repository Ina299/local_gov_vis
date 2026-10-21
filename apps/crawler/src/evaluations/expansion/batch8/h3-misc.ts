/** 04421 大和町・24344 川越町・36403 藍住町・41401 有田町・21217 飛騨市・29206 桜井市・40206 田川市。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { BASE_WARNING, type Entry, acrossInputs, digits, reiwa, segments, toNum } from './h3-util';

const at = (seg: { start: number }, m: RegExpMatchArray, group = 0, offsetInMatch?: number) => seg.start + m.index! + (offsetInMatch ?? m[0].indexOf(m[group]));

// ---------------------------------------------------------------- 大和町: 重点プロジェクト（総合戦略）事業評価シート〔事業調書〕
const TAIWA_SOURCE = '033475707e272f26f2001d70';
const TAIWA_TITLE = '大和町第五次総合計画に基づく実施計画（前期計画）重点プロジェクト\n（まち・ひと・しごと創生総合戦略）事業の令和５年度の実施状況について';
const TAIWA_EVAL_SCALE = 'A：予定を大きく上回り達成できた，B：予定以上に達成できた，C：予定通り達成できた，D：あまり達成できなかった，E：ほとんど達成できなかった';
const TAIWA_POLICY_SCALE = 'A：積極的な拡充・強化，B：拡充継続，C：継続，D：縮小継続，E：完了・廃止';

function extractTaiwa(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== TAIWA_SOURCE) return [];
  const t = input.text, titleAt = t.indexOf(TAIWA_TITLE);
  if (titleAt < 0) return [];
  const out: ProjectEvaluation[] = [];
  for (const s of segments(t, /事業評価シート 〔 事業調書 〕\n/g)) {
    const seg = t.slice(s.start, s.end);
    const nm = seg.match(/\n事業名\n\n([^\n]+)\n\n所管課\n\n([^\n]+)\n/);
    if (!nm) continue;
    // 丸数字は掲載順（重複あり）のため事業コードにしない。
    const name = nm[1].replace(/^[①-⑳㉑-㊿]/, '');
    const p = project(input, `2023:${nm[1]}`, name, null, nm[1], at(s, nm, 1));
    p.projectCode = null; p.department = nm[2]; p.evaluatedFiscalYear = 2023;
    p.evidence.push(evidence(input, nm[2], at(s, nm, 2, nm[0].lastIndexOf(nm[2]))), evidence(input, TAIWA_TITLE, titleAt));
    const ev = seg.match(/\n事業評価 ※１\n\n([A-E])：(予定を大きく上回り達成できた|予定以上に達成できた|予定通り達成できた|あまり達成できなかった|ほとんど達成できなかった)\n/);
    if (ev) p.ratings.push({ kind: 'self', label: '事業評価', value: `${ev[1]}：${ev[2]}`, scale: TAIWA_EVAL_SCALE, evidence: evidence(input, ev[0].trim(), s.start + ev.index! + 1) });
    const po = seg.match(/\n取組方針 ※２\n\n([A-E])：(積極的な拡充・強化|拡充継続|継続|縮小継続|完了・廃止)\n/);
    if (po) p.ratings.push({ kind: 'self', label: '取組方針', value: `${po[1]}：${po[2]}`, scale: TAIWA_POLICY_SCALE, evidence: evidence(input, po[0].trim(), s.start + po.index! + 1) });
    p.warnings = [BASE_WARNING + '重点プロジェクト（総合戦略）の事業評価シートから事業名・所管課・事業評価・取組方針（見出しの直後に値がある場合のみ）。KPIの表は年度列と値の対応が崩れているため構造化していません。評価年度は本文に明示がないため未設定（評価対象は令和５年度の実施状況）。'];
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 川越町: 第２期総合戦略 効果検証シート（令和６年度事業評価）の「主な事業」
const KAWAGOE_SOURCE = 'f9cdae3295902b5af5f10a9a';
const KAWAGOE_TITLE = '第２期\n川越町まち・ひと・しごと創生総合戦略\n効果検証シート（令和６年度事業評価）';
const KAWAGOE_SCALE = 'Ａ：十分進んだ（100％） Ｂ：ある程度進んだ（70％以上100％未満） Ｃ：あまり進まなかった（40％以上70％未満） Ｄ：進まなかった（40％未満）';

function extractKawagoe(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== KAWAGOE_SOURCE) return [];
  const t = input.text, titleAt = t.indexOf(KAWAGOE_TITLE), scaleAt = t.indexOf('※１ ■令和６年度の進展度（３月末時点） ⇒ 主観的にＡ・Ｂ・Ｃ・Ｄで評価');
  if (titleAt < 0 || scaleAt < 0) return [];
  const out: ProjectEvaluation[] = [];
  for (const s of segments(t, /(?<=\n)[①-⑳] [^\n]+\n\n所管課\n\n[^\n]+\n/g)) {
    const seg = t.slice(s.start, s.end), hm = seg.match(/^([①-⑳]) ([^\n]+)\n\n所管課\n\n([^\n]+)\n/)!;
    const rm = seg.match(/\n■令和６年度の進展度（３月末時点）\n\n([ＡＢＣＤ])\n/);
    if (!rm || !/(?:課|室|局)$/.test(hm[3])) continue;
    const name = hm[2].trim();
    const p = project(input, `2024:${name}:${hm[3]}`, name, null, hm[2], s.start + 2);
    p.projectCode = null; p.department = hm[3]; p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, hm[3], s.start + hm[0].lastIndexOf(hm[3])), evidence(input, KAWAGOE_TITLE, titleAt));
    p.ratings.push({ kind: 'self', label: '令和６年度の進展度（３月末時点）', value: rm[1], scale: KAWAGOE_SCALE, evidence: evidence(input, rm[0].trim(), s.start + rm.index! + 1) });
    p.warnings = [BASE_WARNING + '総合戦略効果検証シートの「主な事業」ごとの事業名・所管課・令和６年度の進展度（主観的なＡ〜Ｄ評価）。KPIは施策単位のため事業には付与していません。取組概要・今後の方向は文章のため構造化していません。評価年度は本文に明示がないため未設定。'];
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 藍住町: 教育委員会 事業評価シート（令和７年度）
const AIZUMI_SOURCE = 'fca4bb47fd3d0ab43bb7afc9';
const AIZUMI_SCALE = 'Ｓ：優れた取組が多く、予想以上の成果が上がっている Ａ：優れた取組が多く、十分成果が上がっている Ｂ：着実に取組ができており、成果が上がっている Ｃ：成果が十分上がっておらず、改善の余地が多い Ｄ：成果がほとんど上がっておらず、抜本的な見直しが必要';
const VALUE = /^(?:[\d,.]+(?:\([\d.]+%\))?|-|－)$/;

function extractAizumi(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== AIZUMI_SOURCE) return [];
  const t = input.text, title = '令和８年度（令和７年度対象事業）\n\n教育に関する事務の管理及び執行\nの状況の点検及び評価報告書';
  if (!t.startsWith(title)) return [];
  // 一覧（課ごとの見出し【学校教育課】【社会教育課】、事業番号・事業名・所轄等・評価）。
  const sections = [...t.matchAll(/【(学校教育課|社会教育課)】\n/g)];
  const rows = new Map<string, { name: string; dept: string; rating: string; raw: string; at: number }>();
  for (let i = 0; i < sections.length; i++) {
    const from = sections[i].index!, to = sections[i + 1]?.index ?? t.indexOf('事業評価シート\n', from);
    for (const r of t.slice(from, to).matchAll(/(?<=\n)(\d+)\n\n([^\n]+)\n\n(〃|学校教育課|社会教育課)\n\n([ＳＡＢＣＤ])(?=\n)/g)) {
      if (r[3] !== '〃' && r[3] !== sections[i][1]) continue;
      rows.set(r[1], { name: r[2], dept: sections[i][1], rating: r[4], raw: r[0], at: from + r.index! });
    }
  }
  const out: ProjectEvaluation[] = [];
  for (const s of segments(t, /令和７年度\n\n事業評価シート\n/g)) {
    const seg = t.slice(s.start, s.end);
    const nm = seg.match(/\n事務事業名\n\n([^\n]+)\n/), no = seg.match(/\n事業番号\n\n(\d+)\n/);
    if (!nm || !no) continue;
    const row = rows.get(no[1]);
    if (!row || row.name !== nm[1]) continue;
    const p = project(input, no[1], row.name, null, nm[1], at(s, nm, 1));
    p.projectCode = no[1]; p.department = row.dept; p.evaluatedFiscalYear = 2025;
    p.evidence.push(evidence(input, no[0].trim(), s.start + no.index! + 1), evidence(input, row.raw, row.at), evidence(input, title, 0));
    // 総合評価は一覧と個票の値が一致する場合のみ。
    const rm = seg.match(/\n総合評価\n\n判定説明\n及び考察\n\n([ＳＡＢＣＤ])\n/);
    if (rm && rm[1] === row.rating)
      p.ratings.push({ kind: 'self', label: '総合評価', value: rm[1], scale: AIZUMI_SCALE, evidence: evidence(input, rm[0].trim(), s.start + rm.index! + 1) });
    // 事業コスト: 令和５〜７年度決算の見出しの後に「事業費」3値・「うち一般財源等」3値の順で並ぶ場合のみ（各年度で一般財源等≦事業費）。
    const am = seg.match(/\n令和５年度決算\n\n令和６年度決算\n\n令和７年度決算\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n/);
    if (am && seg.includes('事業費（千円）') && seg.includes('うち一般財源等（千円）') && [0, 1, 2].every(i => toNum(am[i + 1]) >= toNum(am[i + 4]))) {
      const e = evidence(input, am[0].slice(1, -1), s.start + am.index! + 1);
      for (let i = 0; i < 3; i++) p.amounts.push({ kind: 'actual', fiscalYear: 2023 + i, amountYen: toNum(am[i + 1]) * 1000, rawValue: am[i + 1], rawUnit: '千円', evidence: e });
    }
    // 事業実績・成果（指標）: 名称・単位・令和５〜７年度実績が1行ずつ揃う行のみ。
    const iFrom = seg.indexOf('令和７年度実績\n\n'), iTo = seg.indexOf('必要性（住民のニーズ');
    if (iFrom >= 0 && iTo > iFrom) {
      const base = s.start + iFrom;
      for (const im of seg.slice(iFrom, iTo).matchAll(/(?<=\n\n)([^\n]+)\n\n([^\n\d]{1,6})\n\n([\d,.]+(?:\([\d.]+%\))?|-|－)\n\n([\d,.]+(?:\([\d.]+%\))?|-|－)\n\n([\d,.]+(?:\([\d.]+%\))?|-|－)(?=\n)/g)) {
        if (![im[3], im[4], im[5]].every(v => VALUE.test(v)) || /千円）|事業実績|単位|称|名$|^令和/.test(im[1]) || /^(?:名|称|単位)$/.test(im[2])) continue;
        const e = evidence(input, im[0], base + im.index!);
        [im[3], im[4], im[5]].forEach((v, i) => p.indicators.push({ name: im[1], fiscalYear: 2023 + i, target: null, actual: v, unit: im[2], evidence: e }));
      }
    }
    p.warnings = [BASE_WARNING + '令和７年度事業評価シートの事務事業名・担当課（一覧の課見出し）・事業番号・総合評価（一覧と個票が一致する場合のみ）・事業費（令和５〜７年度決算、千円）・事業実績（名称・単位・3年度実績が揃う行のみ、目標値なし）。必要性等の選択肢は選択状態が抽出テキストに残らないため構造化していません。評価年度は本文に明示がないため未設定（対象は令和７年度事業）。'];
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 有田町: 令和７年度事務事業評価一覧
const ARITA_SOURCE = 'ffb4e071a6bea061b8697fdf';
const ARITA_DIRECTIONS = '継続|事務改善|拡大|縮小|廃止|⺠営化|民営化|統合|休止|完了';

function extractArita(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== ARITA_SOURCE) return [];
  const t = input.text, title = '資料２\n令和７年度事務事業評価一覧';
  if (!t.startsWith(title)) return [];
  const legends = [...t.matchAll(/【[^】\n]+】([１-６])．([^\n]+)\n?/g)];
  if (legends.length !== 6) return [];
  const out: ProjectEvaluation[] = [];
  const row = new RegExp(`(?<=\\n)(\\d+)(?:\\n\\n| )([^\\n]+)\\n\\n([^\\n]+)\\n\\n([\\d,]+) ([ABC-]) ([ABC-]) ([ABC-]) ([ABC-]) ([ABC-]) ([ABC-]) (${ARITA_DIRECTIONS})\\n(?![\\d,]+ [ABC-] )`, 'g');
  for (const r of t.matchAll(row)) {
    const [, no, name, dept] = r;
    if (!/(?:課|局|室|センター)$/.test(dept) || /^\d|事業費|担当課/.test(name)) continue;
    const start = r.index!;
    const p = project(input, no, name.trim(), 2025, r[0], start);
    p.projectCode = no; p.department = dept; p.evaluationYear = 2025;
    p.evidence.push(evidence(input, title, 0));
    const e = evidence(input, r[0].trimEnd(), start);
    for (let i = 0; i < 6; i++) {
      if (r[5 + i] === '-') continue;
      const lg = legends.find(l => digits(l[1]) === i + 1)!;
      p.ratings.push({ kind: 'self', label: `評価${i + 1}（${lg[0].trim().replace(/^【([^】]+)】[１-６]．/, '$1：')}）`, value: r[5 + i], scale: 'A/B/C（区分の定義は本文に記載なし）', evidence: e });
    }
    p.ratings.push({ kind: 'self', label: '１次評価 方向性', value: r[11], scale: null, evidence: e });
    p.evidence.push(evidence(input, legends[0].index !== undefined ? t.slice(legends[0].index!, legends[5].index! + legends[5][0].length).trimEnd() : title, legends[0].index ?? 0));
    p.warnings = [BASE_WARNING + '令和７年度事務事業評価一覧の1行が「№・事務事業名・担当課・R６事業費・評価1〜6・１次評価方向性」の並びで揃う行のみ。R６事業費は予算/決算の別が本文に明示されないため金額として採用していません。時期・２次評価は列の対応が確定できないため対象外。評価1〜6の設問は一覧末尾の凡例を引用（A/B/Cの定義は記載なし）。'];
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 飛騨市: 教育委員会事務点検評価（事務局１次評価）
const HIDA_SOURCE = '5b47089abfc96c2741aeb1f8';

function extractHida(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== HIDA_SOURCE) return [];
  const t = input.text, title = '令和７年 飛騨市教育委員会事務点検評価結果';
  const titleAt = t.indexOf(title);
  if (titleAt < 0) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(/(?<=\n)[０-９]+ ([^\n]+)\n\n事業番号([０-９]+) 事務局１次評価 ([ＡＢＣＤ])\n/g)) {
    const head = m[1].match(/^(.+?)(?:（決算額 ([\d,]+)千円）)?$/)!;
    const name = head[1];
    // 括弧の対応が取れない行（決算額の内訳が見出しに続くもの）は除外。
    if ((name.match(/（/g) ?? []).length !== (name.match(/）/g) ?? []).length) continue;
    const before = t.slice(0, m.index!), dept = [...before.matchAll(/\n[１-９] (\S+課)\n/g)].at(-1);
    const p = project(input, `${digits(m[2])}:${name}`, name, 2025, name, m.index! + m[0].indexOf(m[1]));
    p.projectCode = String(digits(m[2])); p.department = dept?.[1] ?? null; p.evaluationYear = 2025;
    if (dept) p.evidence.push(evidence(input, dept[0].trim(), dept.index! + 1));
    p.evidence.push(evidence(input, title, titleAt));
    p.ratings.push({ kind: 'self', label: '事務局１次評価', value: m[3], scale: null, evidence: evidence(input, `事業番号${m[2]} 事務局１次評価 ${m[3]}`, m.index! + m[0].indexOf('事業番号')) });
    p.warnings = [BASE_WARNING + '事務点検評価結果の各事業見出し（事業名・事業番号・事務局１次評価）と直前の課見出し。評価年度は表題「令和７年 飛騨市教育委員会事務点検評価結果」による。対象年度は表紙の「令和６年度」と本文中の年度表記（令和５年度の実績・令和６年度予算計上額）が一致しないため未設定。決算額も年度が確定できないため採用していません。A〜Dの定義は本文に記載なし。'];
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 桜井市: 施策評価シート内「施策内の事務事業一覧」
const SAKURAI_SOURCES = new Set(['17ac9fd6afef2d580e343b26', '3e320c00a857a444c480d1aa', 'b63c3c6ceaa5caa9a820bcd6']);
const SAKURAI_SCALE = 'A：計画通りに事業を進めることが適当 B：事業の進め方の改善の検討 C：事業規模・内容・主体の見直し検討 D：事業の統合・休廃止の検討';
const SAKURAI_DIR = '現状維持|拡充|縮小|休廃止';

function extractSakurai(input: CachedInput): ProjectEvaluation[] {
  if (!SAKURAI_SOURCES.has(input.sourceId)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const row = new RegExp(`(?<=\\n)(\\d+) ([^\\n]+)\\n\\n([^\\n]+課)\\n\\n(?:[\\d,]+\\n\\n){0,10}(${SAKURAI_DIR}) (${SAKURAI_DIR})\\n\\n([A-D])\\n\\n(任意|義務)\\n`, 'g');
  for (const s of segments(t, /施策評価シート（対象年度：令和([0-9０-９]+)年度）\n(?:施策番号(?: |\n\n)([^\n]+)\n)?/g)) {
    const year = reiwa(s.m[1]), seg = t.slice(s.start, s.end), listAt = seg.indexOf('〇施策内の事務事業一覧');
    if (listAt < 0) continue;
    for (const r of seg.slice(listAt).matchAll(row)) {
      const start = s.start + listAt + r.index!, name = r[2].trim();
      const p = project(input, `${year}:${s.m[2] ?? '-'}:${r[1]}:${name}:${r[3]}`, name, null, r[0], start);
      p.projectCode = null; p.department = r[3]; p.evaluatedFiscalYear = year;
      p.evidence.push(evidence(input, s.m[0].trim(), s.start));
      const e = evidence(input, r[0].trimEnd(), start);
      p.ratings.push({ kind: 'self', label: '総合評価', value: r[6], scale: SAKURAI_SCALE, evidence: e });
      p.ratings.push({ kind: 'self', label: '今後の方向性（成果）', value: r[4], scale: '拡充・現状維持・縮小・休廃止', evidence: e });
      p.ratings.push({ kind: 'self', label: '今後の方向性（コスト）', value: r[5], scale: '拡充・現状維持・縮小・休廃止', evidence: e });
      p.warnings = [BASE_WARNING + `施策評価シート（施策番号 ${s.m[2] ?? '記載位置不明'}）の「施策内の事務事業一覧」で、事務事業名・所管課・今後の方向性（成果・コスト）・総合評価・事業の種類が1行に揃う行のみ。事業費の年度列は一覧の列見出しと値の対応が抽出テキストで確定できないため採用していません。評価年度は本文に明示がないため未設定（対象年度は施策評価シートの表記）。`];
      out.push(p);
    }
  }
  return out;
}

// ---------------------------------------------------------------- 田川市: 令和４年度 行政評価による効果額検証（事業別）
const TAGAWA_SOURCE = '4d051e24e1f14203572d5d36';
const N = '((?:[△+]?[\\d,]+|±0))';

function extractTagawa(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== TAGAWA_SOURCE || !input.text.startsWith('令和４年度の行政評価結果について')) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const unitAt = t.indexOf('（単位：千円）');
  // 課・係・（所管課評価）・事業名・R4当初予算額・うち一般財源・R5当初予算額・うち一般財源・効果額4列・点数。
  const row = new RegExp(`(?<=\\n)([^\\n]+課)\\n\\n([^\\n]+(?:係|室))\\n\\n(?:([A-EＡ-Ｅ]|ー)\\n\\n)?([実そ]）[^\\n]+)\\n\\n([\\d,]+)\\n\\n([\\d,]+)\\n\\n([\\d,]+)\\n\\n([\\d,]+)\\n\\n${N}\\n\\n${N}\\n\\n${N}\\n\\n${N}\\n\\n(\\d+|ー)\\n`, 'g');
  for (const r of t.matchAll(row)) {
    const start = r.index!, name = r[4];
    // 列対応の検算: 一般財源≦予算額、かつ単純比較（③−①・④−②）が表の値と一致する行のみ。
    const signed = (v: string) => v === '±0' ? 0 : (v.startsWith('△') ? -1 : 1) * toNum(v.replace(/^[△+]/, ''));
    if (toNum(r[6]) > toNum(r[5]) || toNum(r[8]) > toNum(r[7]) || signed(r[9]) !== toNum(r[7]) - toNum(r[5]) || signed(r[10]) !== toNum(r[8]) - toNum(r[6])) continue;
    const p = project(input, `2022:${name}:${r[1]}`, name, 2022, r[0], start);
    p.projectCode = null; p.department = `${r[1]} ${r[2]}`; p.evaluationYear = 2022;
    const e = evidence(input, r[0].trimEnd(), start);
    if (unitAt >= 0 && unitAt < start) {
      p.amounts.push({ kind: 'budget', fiscalYear: 2022, amountYen: toNum(r[5]) * 1000, rawValue: r[5], rawUnit: '千円', evidence: e });
      p.amounts.push({ kind: 'budget', fiscalYear: 2023, amountYen: toNum(r[7]) * 1000, rawValue: r[7], rawUnit: '千円', evidence: e });
      p.evidence.push(evidence(input, '（単位：千円）', unitAt));
    }
    if (r[3] && r[3] !== 'ー') p.ratings.push({ kind: 'self', label: '評価（効果額検証表の「評価」列）', value: r[3].normalize('NFKC'), scale: null, evidence: e });
    if (r[13] !== 'ー') p.ratings.push({ kind: 'self', label: '事務局採点（内部評価採点基準、30点満点）', value: r[13], scale: '30点満点（20点以下の事業を外部評価対象事業・効率化重点検討事業に分類）', evidence: e });
    p.warnings = [BASE_WARNING + '令和４年度行政評価の効果額検証表で、課・係・事業名・令和４/５年度当初予算額・一般財源額・効果額4列・点数が1行に揃う行のみ（一般財源額≦予算額、単純比較列＝令和５年度−令和４年度を検算）。金額は当初予算額（千円）のみ採用し、効果額は構造化していません。評価年度は表題の令和４年度。'];
    out.push(p);
  }
  return out;
}

export const entries: Record<string, Entry> = {
  '04421': { extract: acrossInputs(extractTaiwa), scope: '重点プロジェクト（総合戦略）令和５年度実施状況の事業評価シートから事業名・所管課・事業評価（A〜E）・取組方針を構造化。KPI表・プロジェクト総括表は対象外。' },
  '24344': { extract: acrossInputs(extractKawagoe), scope: '第２期総合戦略 効果検証シート（令和６年度事業評価）の主な事業ごとの事業名・所管課・進展度（Ａ〜Ｄ）を構造化。KPI・基本目標の数値目標・取組の文章は対象外。' },
  '36403': { extract: acrossInputs(extractAizumi), scope: '教育委員会 令和７年度事業評価シートから事務事業名・担当課・事業番号・総合評価（S〜D）・事業費（令和５〜７年度決算、千円）・事業実績を構造化。必要性等の選択・教育委員会の活動状況は対象外。' },
  '41401': { extract: acrossInputs(extractArita), scope: '令和７年度事務事業評価一覧から、行が揃う事業の事務事業名・担当課・評価1〜6・１次評価方向性を構造化。R６事業費（予算/決算不明）・時期・２次評価・行が崩れた事業は対象外。' },
  '21217': { extract: acrossInputs(extractHida), scope: '令和７年 教育委員会事務点検評価結果の各事業見出しから事業名・事業番号・事務局１次評価・課を構造化。決算額（年度不確定）・評価と課題の文章・点検評価委員の意見は対象外。' },
  '29206': { extract: acrossInputs(extractSakurai), scope: '施策評価結果（令和３〜５年度対象）の「施策内の事務事業一覧」から、行が揃う事務事業の名称・所管課・総合評価（A〜D）・今後の方向性を構造化。施策評価・成果指標・事業費（列対応不確定）は対象外。' },
  '40206': { extract: acrossInputs(extractTagawa), scope: '令和４年度行政評価結果の効果額検証表から、行が揃う事業の事業名・課係・当初予算額（令和４/５年度）・所管課評価・事務局採点を構造化。効果額・増減要因・外部評価の手法説明は対象外。' },
};
