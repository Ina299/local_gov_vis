import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, mergeReprints, nfkc, num, type Entry } from '../batch9/i1-util';
import { municipalityRecords } from '../batch11/k0-util';

const toInt = (s: string) => Number(s.normalize('NFKC'));

// ---------------------------------------------------------------- 白馬村（事務事業評価 評価結果報告書 平成20〜24年度の個別調書）
const HAKUBA: Record<string, number> = {
  '061e54ce6b42b384ffdfd1b6': 20, 'c374de191993f88b6d4b8a25': 21, '138e2404c2cb8d0ac161f87a': 22,
  '0887c88fd77f0a5d05016fb1': 23, '02392491d3e32a42fb9ef613': 24,
};
const HAKUBA_SCALE_OLD = 'Ａ-充実\n\nＢ-継続\n\nＣ-縮小\n\nＤ-統合\n\nＥ-基本的見直し';
const HAKUBA_SCALE_24 = 'Ａ充実/Ｂ継続/Ｃ縮小/Ｄ統合/Ｅ基本的見直し/Ｆ完結事業';

function extractHakubaOne(input: CachedInput): ProjectEvaluation[] {
  const era = HAKUBA[input.sourceId];
  if (input.municipalityCode !== '20485' || !era) return [];
  const t = input.text, title = `平成${era}年度\n白馬村事務事業評価\n評価結果報告書`;
  if (!t.startsWith(title)) return [];
  // 調書の各頁の見出し（No と「平成N年度 事務事業評価調書」）。No が変わる位置で調書を区切る。
  const heads = [...t.matchAll(/No(\d+)\n\n平成([0-9０-９]+)年度 事務事業評価調書\n|平成([0-9０-９]+)年度 事務事業評価調書\n\nNo(\d+)\n/g)]
    .map(m => ({ at: m.index!, no: m[1] ?? m[4], fy: toInt(m[2] ?? m[3]), raw: m[0] }));
  const starts = heads.filter((h, i) => i === 0 || heads[i - 1].no !== h.no);
  const out: ProjectEvaluation[] = [];
  for (const [i, h] of starts.entries()) {
    if (h.fy !== era - 1) continue;
    const end = starts[i + 1]?.at ?? t.length, sh = t.slice(h.at, end);
    const costAt = sh.indexOf('２．事務事業に要する経費');
    if (costAt < 0) continue;
    const head = sh.slice(0, costAt);
    // 事業名: 調書冒頭の最初の「名 …」行（担当係名の行は直前が「係」）。
    const nameM = [...head.matchAll(/(^|\n)([^\n]*)\n+名 ([^\n]+)\n/g)].find(m => m[2] !== '係');
    const finals = [...sh.matchAll(/最 ?終 ?方 ?針\n(?:④\n)?\n?([A-FＡ-Ｆ])(?=\n|$)/g)];
    if (!nameM || !finals.length) continue;
    const name = nameM[3].trim(), nameAt = h.at + nameM.index! + nameM[0].indexOf(`名 ${nameM[3]}`);
    const fin = finals.at(-1)!;
    if (/係$/.test(name)) continue; // 事業名欄が崩れて担当係名しか拾えない調書は除外
    const p = project(input, `${era - 1}-No${h.no}`, name, 1988 + era, `名 ${nameM[3]}`, nameAt);
    p.evaluatedFiscalYear = 1988 + h.fy;
    p.evidence.push(evidence(input, h.raw.trim(), h.at), evidence(input, title, 0));
    const dept = /担 当 課 等 名 (\S+)\n/.exec(head) ?? /\n(\S+(?:課|室))\n/.exec(head);
    if (dept) {
      p.department = dept[1];
      p.evidence.push(evidence(input, dept[0].trim(), h.at + dept.index! + dept[0].indexOf(dept[0].trim())));
    }
    let scale: string | null = null;
    if (era === 24) { if (t.includes(HAKUBA_SCALE_24)) scale = HAKUBA_SCALE_24; }
    else if (sh.includes(HAKUBA_SCALE_OLD)) scale = HAKUBA_SCALE_OLD.replace(/\n\n/g, '／');
    p.ratings.push({ kind: 'external', label: '今後の方向性 最終方針', value: fin[1], scale, evidence: evidence(input, fin[0], h.at + fin.index!) });
    p.warnings.push(`平成${era}年度事務事業評価 評価結果報告書の個別調書（平成${h.fy}年度 事務事業評価調書 No${h.no}）から事業名・担当課・最終方針を収録。評価年度は報告書の表題年度、評価対象年度は調書見出しの年度。担当課・係の各評価記号、評価項目別の評点、付記意見は列が崩れているため未収録。`);
    if (era === 24) {
      const verifyAt = sh.indexOf('３．成果の検証', costAt), base = h.at + costAt;
      const cs = sh.slice(costAt, verifyAt < 0 ? sh.length : verifyAt);
      const d = /H (\d+) 年度\n決算額\nD ○\n([\d,]+)\n/.exec(cs);
      const e = /H (\d+) 年度\n最終予算額 E ○\n([\d,]+)\n/.exec(cs);
      const f = /H (\d+) 年度\n執行率\nF\/E\n決算額\nF\n([\d,]+)[ \n]([\d.]+)\n/.exec(cs);
      // 執行率 F/E の検算が合う調書のみ（列ずれ検出）。
      if (e && f && e[1] === f[1] && num(e[2]) > 0 && Math.abs(num(f[2]) / num(e[2]) * 100 - Number(f[3])) < 0.051) {
        const fyE = 1988 + Number(e[1]);
        p.amounts.push(amount(input, 'budget', fyE, e[2], '千円', e[0].trim(), base + e.index!));
        p.amounts.push(amount(input, 'actual', fyE, f[2], '千円', f[0].trim(), base + f.index!));
        if (d && Number(d[1]) === Number(e[1]) - 1 && num(d[2]) > 0) p.amounts.push(amount(input, 'actual', 1988 + Number(d[1]), d[2], '千円', d[0].trim(), base + d.index!));
        p.warnings.push('金額は調書「２．事務事業に要する経費」の総事業費Ａ行（千円）: 前年度決算額D（0表記は未収録）、当年度最終予算額E（予算）、当年度決算額F。執行率F/Eの検算が一致する調書のみ収録。');
      } else p.warnings.push('経費欄の検算（執行率F/E）が一致しないため金額は未収録。');
    } else {
      p.warnings.push('経費欄は「Ｈｎ年度」表記で年度が明示されていないため金額は未収録。');
    }
    out.push(p);
  }
  return mergeReprints(out, p => `${nfkc(p.projectName)}|${p.evaluatedFiscalYear}`);
}
const extractHakuba = (input: CachedInput, inputs: CachedInput[]) => municipalityRecords(input, inputs, extractHakubaOne, p => `${nfkc(p.projectName)}|${p.evaluatedFiscalYear}`);

// ---------------------------------------------------------------- 橿原市（平成２９年度実施事業 行政評価結果一覧表）
const KASHIHARA_LIST = '7e61c5b570344faab7a24d81';
const KASHIHARA_TITLE = '平成２９年度実施事業 行政評価結果一覧表';
function extractKashihara(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '29205' || input.sourceId !== KASHIHARA_LIST || !input.text.startsWith(KASHIHARA_TITLE)) return [];
  const rows = [...input.text.matchAll(/^(\d+) ([^\n]+)\n\n(ソフト（義務）|ソフト（任意）|内部管理・維持管理|ハード)\n\n([abcd])\n\n(拡大する|見直しながら続ける|継続する|縮小する|廃止又は休止する|完了する)\n\n([A-D]|-)$/gm)];
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(nfkc(r[2]), (counts.get(nfkc(r[2])) ?? 0) + 1);
  const out: ProjectEvaluation[] = [];
  for (const r of rows) {
    if (counts.get(nfkc(r[2]))! > 1) continue; // 同名の別事業（別施策）は対応が確定しないため除外
    const at = r.index!, raw = r[0];
    const p = project(input, nfkc(r[2]), r[2].trim(), null, raw, at);
    p.projectCode = null; p.evaluatedFiscalYear = 2017;
    p.evidence.push(evidence(input, KASHIHARA_TITLE, 0));
    p.ratings.push({ kind: 'self', label: '貢献度', value: r[4], scale: null, evidence: evidence(input, raw, at) });
    p.ratings.push({ kind: 'self', label: '方向性', value: r[5], scale: null, evidence: evidence(input, raw, at) });
    if (r[6] !== '-') p.ratings.push({ kind: 'self', label: '優先度', value: r[6], scale: null, evidence: evidence(input, raw, at) });
    p.warnings.push(`平成２９年度実施事業 行政評価結果一覧表の行（事務事業名・事業種別「${r[3]}」・貢献度・方向性・優先度）。行頭の番号は施策内の通し番号のため事業コードにしていない。担当部・担当課の列は抽出テキストで行との対応が崩れているため未収録。評価年度は資料に明記がないため未設定。優先度「-」（ソフト（任意）以外）は未収録。事業名の直後に事業種別・貢献度・方向性・優先度が連続して出力された行のみ採用（名前が離れて出力された行は除外）。貢献度・方向性・優先度の定義は一覧表に記載がないため尺度は未設定。`);
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 鹿嶋市（各部選定施策 事業評価シート：既存事業進捗確認シート）
const KASHIMA_DEPT: Record<string, { year: number; head: string }> = {
  '7a8ae4980fa7a26b3b4eb083': { year: 2025, head: '令和７年度\n鹿嶋市 各部選定施策 事業評価シート\n【中間面談による実施】' },
  '6c081aa034c815f2f63cc5bf': { year: 2026, head: '令和８年度\n鹿嶋市 各部選定施策 事業評価シート\n【当初面談による実施】' },
};
function extractKashimaDept(input: CachedInput): ProjectEvaluation[] {
  const spec = KASHIMA_DEPT[input.sourceId];
  if (input.municipalityCode !== '08222' || !spec || !input.text.startsWith(spec.head)) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of input.text.matchAll(/既存事業進捗確認シート（[^）\n]+）\n\n№\n\n(\S+)\n\n施策の\n位置づけ\n\n担当課\n\n([^\n]+)\n\n事業名\n\n([^\n]+)(?=\n\n施策)/g)) {
    const p = project(input, `${m[2]}:${m[3]}`, m[3], spec.year, m[0], m.index!);
    p.department = m[2];
    p.evidence.push(evidence(input, spec.head, 0));
    p.warnings.push('各部選定施策 事業評価シート（既存事業進捗確認シート）の担当課・事業名を、見出しの並びが崩れていない票のみ収録。評価年度は資料見出しの年度。成果指標の目標値・実績・進捗率、予定：実績の判定記号は表の列が分離しており未構造化。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

// ---------------------------------------------------------------- 山田町（復興交付金事業計画の個別事業の実績に関する評価様式：町実施分）
const YAMADA = new Set(['7358bf5869c43e24581195a4', '6fe977c514bc16cc8a3f5810', 'c6e8d8fb32cc48cfa7072fe6', '9c472ecfca0333b43c4d460f']);
const YAMADA_HEAD = '【復興交付金事業計画の個別事業の実績に関する評価様式】';
function extractYamadaOne(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '03482' || !YAMADA.has(input.sourceId) || !input.text.startsWith(YAMADA_HEAD)) return [];
  const t = input.text, starts = [...t.matchAll(new RegExp(YAMADA_HEAD, 'g'))].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  for (const [i, s] of starts.entries()) {
    const sh = t.slice(s, starts[i + 1] ?? t.length);
    const id = /^【[^】]+】\n事業番号\n+([^\n]+)\n+事 ?業 ?名\n+([^\n]+)\n/.exec(sh);
    const purposeAt = sh.indexOf('事業目的');
    const cost = /総額 ?([\d,]+) ?千円/.exec(sh);
    const dept = /事業担当課\n([^\n]+)/.exec(sh);
    const period = /事業期間\n+([^\n]+年度)\n/.exec(sh);
    if (!id || !dept || purposeAt < 0) continue;
    const deptName = /^(\S+?(?:課|室))(?:\s*電話.*)?$/.exec(dept[1].trim());
    if (!deptName) continue;
    const p = project(input, id[1].trim(), id[2].trim(), null, id[0].trim(), s);
    p.department = deptName[1];
    p.evidence.push(evidence(input, dept[0], s + dept.index!));
    if (period) p.evidence.push(evidence(input, period[0].trim(), s + period.index!));
    // 事業費の「総額」は事業期間全体（複数年度）の合計で単年度の決算額ではないため、金額としては収録せず根拠のみ残す。
    if (cost && cost.index! < purposeAt) p.evidence.push(evidence(input, cost[0], s + cost.index!));
    p.warnings.push(`復興交付金事業計画の個別事業の実績に関する評価様式（町実施分）。事業番号・事業名・事業担当課を収録。事業費の「総額」（千円）は事業期間（${period ? period[1].replace(/\s/g, '') : '記載の期間'}）全体の合計で年度が確定しないため金額欄には入れず、原文を根拠として保持。評価は文章（活用状況・コスト・事業手法）のみで評語がないため評価区分は未収録。評価年度・評価対象年度は記載がないため未設定。`);
    out.push(p);
  }
  return out;
}
const extractYamada = (input: CachedInput, inputs: CachedInput[]) => municipalityRecords(input, inputs, extractYamadaOne, p => `${nfkc(p.projectName)}|${p.projectCode}`);

export const cEntries: Record<string, Entry> = {
  '20485': { extract: extractHakuba, scope: '白馬村 事務事業評価 評価結果報告書（平成20〜24年度、平成19〜23年度実施分）の個別調書から事業名・担当課・事務事業評価委員会の最終方針（今後の方向性）を構造化し、平成24年度版のみ年度が明記された経費欄（前年度決算・当年度最終予算・決算、執行率で検算）を収録。「Ｈｎ年度」表記の経費、項目別評点、付記意見、委員会の概要・要綱は対象外。' },
  '29205': { extract: extractKashihara, scope: '橿原市 平成２９年度実施事業 行政評価結果一覧表の事務事業行（事業名・貢献度・方向性・優先度）。列が崩れた行、同名事業、担当部課、事務事業評価表（年度見出しのない経費欄）、施策評価表・施策評価総括表・記入例は対象外。' },
  '08222': { extract: extractKashimaDept, scope: '鹿嶋市 各部選定施策 事業評価シート（令和７年度中間面談・令和８年度当初面談）の既存事業進捗確認シートから担当課・事業名を見出しの並びが崩れていない票のみ構造化。成果指標・進捗率、重点施策シート（既存構造化分の再取得）、ロジックモデルは対象外。' },
  '03482': { extract: extractYamada, scope: '山田町 復興交付金事業計画の個別事業の実績に関する評価様式（町実施分）から事業番号・事業名・事業担当課を構造化（事業期間全体の事業費総額は年度が確定しないため根拠の原文のみ）。評価の文章、県実施分（_ken）、総合的な実績評価、同名で事業番号の異なる様式は対象外。' },
};
export const entries = cEntries;
