/**
 * Batch-12 (m6-f3) extractors: 08234 鉾田市（地方創生推進交付金事業の有識者評価結果）, 43205 水俣市（教育委員会重要政策事業実施状況評価表）,
 * 34205 尾道市（教育委員会 評価点検シート）。13103 港区は政策・施策評価シートのみのため対象外。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { mergeReprints, nfkc, type Entry } from '../batch9/i1-util';

const wareki = (s: string) => 2018 + (s === '元' ? 1 : Number(s.normalize('NFKC')));
/** Records whose identity repeats in one document: merged when identical, all dropped when they disagree. */
const dedupe = (out: ProjectEvaluation[]) => mergeReprints(out, p => `${nfkc(p.projectName)}|${p.evaluationYear}|${p.evaluatedFiscalYear}`);

// ---------------------------------------------------------------- 08234 鉾田市（有識者会議 委員による地方創生推進交付金事業の評価結果）
/** 令和元〜８年度 第１回 有識者会議の評価結果（1事業ごとの評価欄・意見・今後の方針）。事業概要・評価シート様式・総合戦略の進捗資料は対象外。 */
const HOKOTA_RESULTS = new Set(['376cb13a5c452fca1792feaa', '4e54e754a9fc36cec15e9db7', 'a4a85a79854a418c5a8d5658', '309c4961fd67d5b4842c77d1',
  '4821bf97aff49c1fdc295b04', 'a585bfb9cd9d16c8af17bc7f', '6b768cff9254aa54fecbb909', '31db12dc66cbd0252bf37288']);
const HOKOTA_TITLE = /^(?:1\/3\n\n)?令和(元|[０-９\d]+)年度 ?第１回 ?鉾田市まち・ひと・しごと創生有識者会議 委員による地方創生推進交付金事業の評価結果/;

function extractHokota(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '08234' || !HOKOTA_RESULTS.has(input.sourceId)) return [];
  const t = input.text, title = t.match(HOKOTA_TITLE);
  if (!title) return [];
  const year = wareki(title[1]);
  const out: ProjectEvaluation[] = [];
  // 令和２年度以降: 「事業名／事業の概要」見出しの直後の1行が事業名。令和元年度: 事業名が1字ずつ縦書きで出力される。
  const heads = [...t.matchAll(/事業名\n\n事業の概要\n\n([^\n]+)\n/g)].map(m => ({ m, name: m[1].trim(), raw: m[1], at: m.index! + m[0].indexOf(m[1]) }));
  const vertical = [...t.matchAll(/事業名\n\n((?:[^\n]\n){3,})\n/g)].map(m => ({ m, name: m[1].replace(/\n/g, ''), raw: m[1].slice(0, -1), at: m.index! + 5 }));
  for (const h of [...heads, ...vertical]) {
    const p = project(input, h.name, h.name, year, h.raw, h.at);
    p.projectCode = null;
    p.evidence.push(evidence(input, title[0], title.index));
    p.warnings.push(`鉾田市 令和${title[1]}年度 第１回 まち・ひと・しごと創生有識者会議の「委員による地方創生推進交付金事業の評価結果」に載る交付金事業1件（部分構造化）。事務事業評価ではなく交付金事業の効果検証（外部有識者による評価）。評価年度は会議の年度。評価対象年度は本文に明示がないため未設定。`);
    p.warnings.push('評価（KPI達成に有効か）・今後の方針は選択肢ごとの回答人数で、抽出テキストでは委員意見の段組みと交互に出力され人数と選択肢の対応が確定しないため未収録。事業費・KPIの値は評価結果資料にないため未収録。');
    out.push(p);
  }
  return dedupe(out);
}

// ---------------------------------------------------------------- 43205 水俣市（教育委員会重要政策事業実施状況評価表、令和３〜７年度実績）
const MINAMATA_REPORTS = new Set(['c8067c45eeeebf2a6be34052', 'fd99bc679f0a10b1565d0a1b', 'b225e2c7bc2163cea9ef5522', 'c2cb89f0651f7eb69878bb31', '11aa2dd5ae0ababdf638adb3']);
const MINAMATA_TITLE = /^水俣市教育委員会\n?点検・?評価報告書\n（令和([０-９\d]+)年度実績）/;
const MINAMATA_SHEET = /令和([０-９\d]+)年度[ \n]+教育委員会重要政策事業実施状況評価表/g;
const MINAMATA_SCALE = 'Ａ かなりの成果を上げ、今後も維持できるよう努めるもの／Ｂ 一応の成果は上げているが、更なる向上を目指すもの／Ｃ 早急の見直しが必要なもの／Ｄ 当初の目的を達しないなど、事業そのものが困難なもの';
const MINAMATA_KIND = /\n\n１ ?水俣市総合計画に掲載された事業/;

function extractMinamata(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '43205' || !MINAMATA_REPORTS.has(input.sourceId)) return [];
  const t = input.text, title = t.match(MINAMATA_TITLE);
  if (!title) return [];
  const fy = wareki(title[1]);
  const sheets = [...t.matchAll(MINAMATA_SHEET)];
  const out: ProjectEvaluation[] = [];
  sheets.forEach((s, k) => {
    if (wareki(s[1]) !== fy) return;
    const start = s.index!, end = sheets[k + 1]?.index ?? t.length, sheet = t.slice(start, end);
    const head = sheet.indexOf('政策事業名'), kind = sheet.search(MINAMATA_KIND);
    if (head < 0 || kind < 0 || kind < head) return;
    // Header lines between 政策事業名 and the 種別 choices: number, 種別, the department in parentheses (possibly split) and the name.
    const header = sheet.slice(head, kind);
    const lines = header.replace(/^政策事業名\s*/, '').split('\n').map(l => l.trim()).filter(Boolean);
    const rest = lines.filter(l => l !== '種別' && !/^[０-９\d]+$/.test(l) && !/^（[^）]*$/.test(l) && !/^[^（]*）$/.test(l) && !/^（[^）]*）$/.test(l))
      .map(l => l.replace(/^[０-９\d]+\s+/, ''));
    if (rest.length !== 1) return;
    const name = rest[0];
    const nameAt = start + head + header.indexOf(name);
    if (t.slice(nameAt, nameAt + name.length) !== name) return;
    const p = project(input, name, name, null, name, nameAt);
    p.projectCode = null;
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, title[0], title.index));
    p.evidence.push(evidence(input, s[0], start));
    // Department: a parenthesised 課・室 pair printed whole in the sheet heading (both brackets present).
    const pre = sheet.slice(0, sheet.indexOf('１【事業の概要'));
    const dept = pre.match(/（((?:教育課|教育総務課|生涯学習課)[\s\n]*[^\s（）]*)）/);
    if (dept) {
      p.department = dept[1].replace(/\s+/g, ' ').trim();
      p.evidence.push(evidence(input, dept[0], start + dept.index!));
    }
    const ratings = [...sheet.matchAll(/\n自己評価\n\n([ＡＢＣＤ])\n\n５【事業の課題/g)];
    if (ratings.length === 1) {
      const r = ratings[0], raw = `自己評価\n\n${r[1]}`;
      p.ratings.push({ kind: 'self', label: '自己評価', value: r[1], scale: MINAMATA_SCALE, evidence: evidence(input, raw, start + r.index! + 1) });
    }
    p.warnings.push(`水俣市教育委員会 点検評価報告書（令和${title[1]}年度実績）の「教育委員会重要政策事業実施状況評価表」1枚。事業名は「政策事業名」欄、評価対象年度は報告書表題の実績年度。評価年度（報告書の作成年度）は本文に評価年度として明示されないため未設定。`);
    p.warnings.push(ratings.length === 1 ? '自己評価は評価表の「自己評価」欄の記号（Ａ〜Ｄ、原文どおり）。' : '自己評価欄は抽出テキストで選択された記号が判別できない（Ａ〜Ｄが並記され丸印が失われている）ため未収録。');
    p.warnings.push(dept ? '担当課は評価表見出しの括弧書き。' : '担当課は見出しの括弧書きが行をまたいで欠けているため未設定。');
    p.warnings.push('【投入経費】（千円）の事業費は「前年度／当該年度」の2列だが予算・決算の別が本文で示されないため未収録。今後の方向性（維持・改善・見直し・休止・終了）は選択の印が抽出テキストで失われているため未収録。点検評価委員の意見・総評は文章のため未収録。');
    out.push(p);
  });
  return dedupe(out);
}

// ---------------------------------------------------------------- 34205 尾道市（教育に関する事務の点検及び評価報告書の評価点検シート、令和元〜３年度）
const ONOMICHI_REPORTS = new Set(['fede86bf82341474079d1c78', '3ee3370f414dc61f49b936c7', 'e299c6de2073b91f7effd68f']);
const ONOMICHI_TITLE = /^令和(元|[０-９\d]+)年度\n教育に関する事務の管理及び執行の\n状況の点検及び評価報告書/;
const ONOMICHI_SHEET = /評価点検シート\n\n施策・事業名 ([^\n]+(?:\n[^\n\d\s尾][^\n]*)?)\n+(?:\d+\n+)?尾道教育総合推進計画掲載ページ/g;

function extractOnomichi(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '34205' || !ONOMICHI_REPORTS.has(input.sourceId)) return [];
  const t = input.text, title = t.match(ONOMICHI_TITLE);
  if (!title) return [];
  const fy = wareki(title[1]);
  const scope = t.match(new RegExp(`令和${title[1]}年度に実施した事務の管理及び執行の状況`));
  if (!scope) return [];
  const sheets = [...t.matchAll(ONOMICHI_SHEET)];
  const out: ProjectEvaluation[] = [];
  sheets.forEach((s, k) => {
    const start = s.index!, end = sheets[k + 1]?.index ?? t.length, sheet = t.slice(start, end);
    const name = s[1].replace(/\n/g, '').trim();
    const nameAt = start + s[0].indexOf(s[1]);
    const p = project(input, name, name, null, s[1], nameAt);
    p.projectCode = null;
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, scope[0], scope.index));
    // 所管課: the single line after the label; two stacked units (e.g. 生涯学習課／因島瀬戸田地域教育課) leave it unset.
    const dept = sheet.slice(0, 400).match(/所管課[ \n]+([^\n]+?(?:課|館))\n+([^\n]*)/);
    if (dept && !/(?:課|館|地域)$/.test(dept[2].trim()) && !/^因島/.test(dept[2])) {
      p.department = dept[1].trim();
      p.evidence.push(evidence(input, dept[0].slice(0, dept[0].indexOf(dept[1]) + dept[1].length), start + dept.index!));
    }
    p.warnings.push(`尾道市教育委員会「令和${title[1]}年度 教育に関する事務の管理及び執行の状況の点検及び評価報告書」の評価点検シート1枚（施策・事業単位、部分構造化）。評価対象年度は「令和${title[1]}年度に実施した事務」の記述による。評価年度は本文に明示がないため未設定。`);
    p.warnings.push(p.department ? '所管課はシート上部の所管課欄。' : '所管課欄が複数課の併記、または抽出テキストで判別できないため未設定。');
    p.warnings.push('評価点検シートには評語・事業費の欄がない。成果指標の表は抽出テキストで指標名と年度別の値が交互に折り返され列の対応が確定しないため未収録。取組状況と成果・課題・改善の方向性は文章のため未収録。');
    out.push(p);
  });
  return dedupe(out);
}

export const entries: Record<string, Entry> = {
  '08234': {
    extract: input => extractHokota(input),
    scope: '鉾田市 まち・ひと・しごと創生有識者会議（令和元〜８年度 第１回）の「委員による地方創生推進交付金事業の評価結果」に載る交付金事業の事業名と評価年度（部分構造化）。交付金の効果検証であり事務事業評価ではない。回答人数による評価・今後の方針、事業概要・評価シート様式、総合戦略の進捗資料、交付金制度の説明資料は対象外。',
  },
  '43205': {
    extract: input => extractMinamata(input),
    scope: '水俣市教育委員会 点検評価報告書（令和３〜７年度実績）の「教育委員会重要政策事業実施状況評価表」の政策事業ごとの事業名・担当課（括弧書きが完全なもの）・評価対象年度・自己評価（Ａ〜Ｄ、記号が判別できるもののみ）。投入経費（予算・決算の別が不明）・今後の方向性・外部評価の意見は対象外。平成22〜26年度実績の旧様式は列の崩れが大きく対象外。',
  },
  '34205': {
    extract: input => extractOnomichi(input),
    scope: '尾道市教育委員会 点検及び評価報告書（令和元〜３年度）の評価点検シートごとの施策・事業名・所管課（単一の場合）・評価対象年度（部分構造化）。成果指標（表の列が崩れる）・取組の文章は対象外。令和４年度以降の報告書は施策ごとの取組記述で事業単位の評価票がなく、平成25・26年度版はOCRの誤字が多いため対象外。',
  },
};
