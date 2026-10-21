import type { EvaluationEvidence, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

/**
 * 教育委員会の点検・評価報告書のうち、事務事業ごとの評価シートを持つもの（村山市・遠野市・白石町）。
 * 施策・基本方針単位の総括、教育委員会の活動状況、学識経験者の意見のみの資料は対象外。
 */
type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A character and its full-/half-width forms (e.g. （ and ( ), so list and sheet spellings of brackets match. */
function widthClass(c: string): string {
  const n = c.normalize('NFKC'), alts = new Set([c, n]);
  if (n.length === 1 && n.charCodeAt(0) >= 0x21 && n.charCodeAt(0) <= 0x7e) alts.add(String.fromCharCode(n.charCodeAt(0) + 0xfee0));
  return alts.size > 1 ? `(?:${[...alts].map(escape).join('|')})` : escape(c);
}
/** Exact source span of a name whose characters may be separated by spaces or line breaks in the extracted text. */
function findLoose(text: string, name: string, from = 0): { raw: string; at: number } | null {
  const chars = [...name.replace(/\s/g, '')];
  if (!chars.length) return null;
  const re = new RegExp(chars.map(widthClass).join('[ 　\\n]*'), 'g');
  re.lastIndex = from;
  const m = re.exec(text);
  return m ? { raw: m[0], at: m.index } : null;
}
function starts(text: string, re: RegExp): number[] {
  return [...text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))].map(m => m.index!);
}
function segments(text: string, re: RegExp): { at: number; text: string }[] {
  const s = starts(text, re);
  return s.map((at, k) => ({ at, text: text.slice(at, s[k + 1] ?? text.length) }));
}
/** Same name twice in one document: values cannot be told apart, so every copy is dropped. */
function uniqueNames(records: ProjectEvaluation[]): ProjectEvaluation[] {
  const count = new Map<string, number>();
  for (const p of records) count.set(p.projectName, (count.get(p.projectName) ?? 0) + 1);
  return records.filter(p => count.get(p.projectName) === 1);
}

// ---------------------------------------------------------------- 06208 村山市 教育委員会事務事業点検・評価書
const MURAYAMA: Record<string, { head: string; evaluationYear: number; fiscalYear: number }> = {
  '4c8b87fbb5a5c2ed330d59bd': { head: '令和７年度\n村山市教育委員会事務事業点検・評価報告書\n（令和６年度事業分）', evaluationYear: 2025, fiscalYear: 2024 },
  'ca0c641cb6d92ef295646412': { head: '令和５年度\n教育委員会事務事業点検・評価報告書\n（令和４年度事業分）', evaluationYear: 2023, fiscalYear: 2022 },
};
const MURAYAMA_SHEET = /村山市教育委員会 ?事務事業点検・評価書\n/g;
const MURAYAMA_TOTAL_SCALE = 'Ａ 継続・拡大（9～8点）／Ｂ 見直・改善（7～5点）／Ｃ 縮小・廃止（4～3点）（必要性＋効率性＋有効性の合計点数により評価）';
const CIRCLED: Record<string, string> = { 'Ⓐ': 'A', 'Ⓑ': 'B', 'Ⓒ': 'C', '①': '1', '②': '2', '③': '3' };
const POINT_ITEMS: { label: string; re: RegExp; scale: string }[] = [
  { label: '必要性（点数）', re: /必要性高い\n\n([③3])\n\n一応必要性ある\n\n([②2])\n\n必要性低い\n\n([①1])\n/, scale: '必要性高い 3／一応必要性ある 2／必要性低い 1' },
  { label: '効率性（点数）', re: /効率的である\n\n([③3])\n\nどちらかといえば効率的\n\n([②2])\n\n効率的でない\n\n([①1])\n/, scale: '効率的である 3／どちらかといえば効率的 2／効率的でない 1' },
];

function extractMurayama(input: CachedInput): ProjectEvaluation[] {
  const meta = MURAYAMA[input.sourceId];
  if (input.municipalityCode !== '06208' || !meta || !input.text.startsWith(meta.head)) return [];
  const t = input.text;
  // 事業一覧（○印の事業と評価書のページ番号）の出現順が評価書の並び順。
  const list = [...t.matchAll(/○([^○\n]+(?:\n[^○\n]+)?)（(\d+)\/(\d+)）/g)];
  const sheets = segments(t, MURAYAMA_SHEET).filter(s => s.text.includes('総 合 評 価') && !s.text.includes('事業一覧'));
  if (!list.length || list.length !== sheets.length) return [];
  const out: ProjectEvaluation[] = [];
  sheets.forEach((sheet, k) => {
    const item = list[k], name = item[1].replace(/\n/g, '');
    const found = findLoose(sheet.text, name);
    if (!found) return;
    const p = project(input, name, name, meta.evaluationYear, found.raw, sheet.at + found.at);
    p.projectCode = null;
    p.evaluatedFiscalYear = meta.fiscalYear;
    p.evidence.push(evidence(input, meta.head, 0), evidence(input, item[0], item.index!));
    const dept = [...sheet.text.matchAll(/所管\n([^\n]+)\n課等・係名/g)];
    if (dept.length === 1) p.department = dept[0][1].trim();
    const marks = [...sheet.text.matchAll(/[ⒶⒷⒸ]/g)];
    if (marks.length === 1) {
      const m = marks[0], from = sheet.text.lastIndexOf('総 合 評 価', m.index!);
      const raw = from >= 0 && m.index! - from < 2500 ? sheet.text.slice(from, m.index! + 1) : m[0];
      p.ratings.push({ kind: 'self', label: '総合評価（○囲みの区分）', value: CIRCLED[m[0]], scale: MURAYAMA_TOTAL_SCALE,
        evidence: evidence(input, raw, sheet.at + (from >= 0 && m.index! - from < 2500 ? from : m.index!)) });
    }
    for (const item of POINT_ITEMS) {
      const m = sheet.text.match(item.re);
      if (!m) continue;
      const circled = m.slice(1).filter(v => CIRCLED[v]);
      if (circled.length !== 1) continue;
      p.ratings.push({ kind: 'self', label: item.label, value: CIRCLED[circled[0]], scale: item.scale, evidence: evidence(input, m[0].trimEnd(), sheet.at + m.index!) });
    }
    p.warnings.push(`村山市 ${meta.head.split('\n').join(' ')} の事務事業点検・評価書1枚。事業名は事業一覧（○印の事業）の表記で、評価書本文に同じ文字列（改行・空白を除く）があることを確認したもの。評価書の並び順が事業一覧と一致することを件数で確認。`);
    p.warnings.push('総合評価は評価書内の丸囲み記号（Ⓐ/Ⓑ/Ⓒ）が1つだけの場合に採用。必要性・効率性は3段階の選択肢が連続して抽出され丸囲みが1つの場合のみ。有効性は選択肢が他欄の文章と混在するため未収録。事業費は予算・決算の別が評価書に明示されないため未収録。外部評価委員の意見は文章のため未収録。');
    out.push(p);
  });
  return uniqueNames(out);
}

// ---------------------------------------------------------------- 03208 遠野市 教育委員会の点検及び評価報告書
const TONO_HEAD = /^遠野市教育委員会の権限に属する\n事務の管理及び執行の状況の\n点 検 及 び 評 価 報 告 書\n（令和([４-６])年度実施事業）/;
const TONO_SOURCES = new Set(['106082f6c525cfe290139cc4', 'c462590f913bffa923e1dd28', 'd7787af852b9ec49b72c7811']);
const TONO_AMOUNT = /^([\d,]+) ?円$/gm;
const TONO_RATING = /評価\n+(達成|概ね達成|未達成)\n/g;
const TONO_DEPT = /\n([^\n]*(?:課|室|館|センター))\n事業所管課/g;
const TONO_SCALE = '達成：事務事業の目的が十分に達成された（達成率100％以上）／概ね達成：概ね達成された（90％以上100％未満）／未達成：概ね達成されたとまではいえない（90％未満）';
const count = (s: string, re: RegExp) => [...s.matchAll(re)].length;

function extractTono(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '03208' || !TONO_SOURCES.has(input.sourceId)) return [];
  const t = input.text, head = t.match(TONO_HEAD);
  if (!head) return [];
  const fy = 2018 + '０１２３４５６７８９'.indexOf(head[1]);
  // Pages end with a printed page number; two sheets share a page and their columns can interleave.
  const cuts = [0, ...[...t.matchAll(/\n\n\d{1,3}\n\n\n/g)].map(m => m.index! + m[0].length), t.length];
  const out: ProjectEvaluation[] = [];
  for (let c = 0; c + 1 < cuts.length; c++) {
    const pageAt = cuts[c], page = t.slice(pageAt, cuts[c + 1]);
    const sheets = segments(page, /事業費名\n\n/g);
    if (!sheets.length) continue;
    const named = sheets.map(s => {
      const m = s.text.match(/^事業費名\n\n((?:[^\n]+\n){1,2}?)\n/);
      const lines = m?.[1].trimEnd().split('\n') ?? [];
      const ok = !!m && /(費|事業|）|充実)$/.test(lines[lines.length - 1]) && lines.every(l => l.length <= 40 && !/[。【]/.test(l) && !/^[\d,０-９ 円人]+$/.test(l));
      return { s, m, name: ok ? lines.join('') : null };
    });
    // Values are attributed only when every sheet on the page has exactly one settled amount and one rating; the department is checked the same way.
    const settled = named.every(x => x.name && x.s.text.includes('決算額') && count(x.s.text, TONO_AMOUNT) === 1 && count(x.s.text, TONO_RATING) === 1)
      && count(page, TONO_AMOUNT) === sheets.length && count(page, TONO_RATING) === sheets.length;
    const depts = named.every(x => count(x.s.text, TONO_DEPT) === 1) && count(page, TONO_DEPT) === sheets.length;
    for (const { s, m, name } of named) {
      if (!name || !m) continue;
      const at = pageAt + s.at;
      const p = project(input, name, name, null, m[0].trimEnd(), at);
      p.projectCode = null;
      p.evaluatedFiscalYear = fy;
      p.evidence.push(evidence(input, head[0], 0));
      if (settled) {
        const a = [...s.text.matchAll(TONO_AMOUNT)][0], r = [...s.text.matchAll(TONO_RATING)][0];
        p.amounts.push({ kind: 'actual', fiscalYear: fy, amountYen: Number(a[1].replace(/,/g, '')), rawValue: a[1], rawUnit: '円', evidence: evidence(input, a[0], at + a.index!) });
        p.ratings.push({ kind: 'self', label: '評価（担当課による自己評価）', value: r[1], scale: TONO_SCALE, evidence: evidence(input, r[0].trimEnd(), at + r.index!) });
        if (depts) p.department = [...s.text.matchAll(TONO_DEPT)][0][1].trim();
        p.warnings.push(`遠野市 点検及び評価報告書（令和${head[1]}年度実施事業）の事業費名1件。決算額（円・令和${head[1]}年度決算）・評価（事業所管課も別途同様に確認）は、同じページの各事業費名の区間にそれぞれ1つずつだけあり、ページ全体の個数も事業数と一致する場合のみ採用。事業所管課は報告書作成年度の所管課。`);
      } else {
        p.warnings.push(`遠野市 点検及び評価報告書（令和${head[1]}年度実施事業）の事業費名1件。同じページの2事業の列が抽出テキストで混在し、決算額・評価・所管課の対応が確定できないため、事業費名のみ収録。`);
      }
      p.warnings.push('評価の区分は報告書の凡例（達成・概ね達成・未達成）。まちづくり指標の結果や計画値・実績値の文章は未収録。評価実施年度は本文に明示がないため未設定。同じ資料に同名の事業費名が複数ある場合は除外。');
      out.push(p);
    }
  }
  return uniqueNames(out);
}

// ---------------------------------------------------------------- 41425 白石町 教育委員会点検評価報告書 主要事業点検・評価シート
const SHIROISHI_SOURCE = '6935982adca4ad667453f6f2';
const SHIROISHI_HEAD = '白石町教育委員会点検評価報告書\n[令和６年度事業]';
const SHIROISHI_SHEET = '令和６年度 白石町教育委員会 主要事業点検・評価シート';
const SHIROISHI_SCALE = 'Ａ：十分達成した／Ｂ：ある程度達成／Ｃ：達成が不十分である／Ｄ：達成には程遠い';
const FW = '０１２３４５６７８９';
const fwNum = (s: string) => Number([...s].map(c => FW.indexOf(c)).join(''));

function extractShiroishi(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '41425' || input.sourceId !== SHIROISHI_SOURCE) return [];
  const t = input.text, head = t.indexOf(SHIROISHI_HEAD);
  if (head < 0 || head > 200) return [];
  const sheets = segments(t, new RegExp(escape(SHIROISHI_SHEET), 'g'));
  const listFrom = t.indexOf('重 点 目 標 （主 要 事 業 点 検 ・評 価 シート）');
  if (!sheets.length || listFrom < 0 || listFrom > sheets[0].at) return [];
  const list = [...t.slice(listFrom, sheets[0].at).matchAll(/\n([０-９]{1,2})\n\n([^\n]+)\n/g)];
  if (list.length !== sheets.length || list.some((m, k) => fwNum(m[1]) !== k + 1)) return [];
  const out: ProjectEvaluation[] = [];
  sheets.forEach((sheet, k) => {
    const nos = [...sheet.text.matchAll(/No\.?(\d+)/g)];
    if (nos.length !== 1 || Number(nos[0][1]) !== k + 1) return;
    const listed = list[k][2].replace(/[ 　]/g, '');
    const name = findLoose(sheet.text, listed) ? listed : listed.replace(/（[^）]*）/g, '');
    const found = findLoose(sheet.text, name);
    if (!found) return;
    const p = project(input, name, name, null, found.raw, sheet.at + found.at);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, SHIROISHI_HEAD, head), evidence(input, list[k][0].trim(), listFrom + list[k].index! + 1));
    const dept = [...sheet.text.matchAll(/担当部署\n\n(?:）\n\n)?([^\n]*課 [^\n]*係)\n/g)];
    if (dept.length === 1) p.department = dept[0][1].trim();
    const r = [...sheet.text.matchAll(/判\n定\n\n([A-DＡ-Ｄ])(?=\n|$)/g)];
    if (r.length === 1) p.ratings.push({ kind: 'self', label: '判定', value: r[0][1], scale: SHIROISHI_SCALE, evidence: evidence(input, r[0][0], sheet.at + r[0].index!) });
    p.warnings.push('白石町 教育委員会点検評価報告書［令和６年度事業］の主要事業点検・評価シート1枚。事業名は一覧表の表記（字間の空白を除去、シートにない括弧書きは除去）で、シート番号（No.）と一覧の番号の一致を確認。評価実施年度は本文に明示がないため未設定。');
    p.warnings.push('決算額・最終予算額・財源内訳（千円）は抽出テキストで欄の対応が確定できないため未収録。事業効果・課題・評価委員の意見は文章のため未収録。');
    out.push(p);
  });
  return uniqueNames(out);
}

export const entries: Record<string, Entry> = {
  '06208': { extract: extractMurayama,
    scope: '村山市教育委員会事務事業点検・評価報告書（令和５年度版＝令和４年度事業分、令和７年度版＝令和６年度事業分）の事務事業点検・評価書1枚1件。事業名・所管課・総合評価（Ａ～Ｃ）・必要性/効率性の点数（丸囲みが1つに確定するもののみ）。有効性・事業費・外部評価委員の意見、令和６年度版（評価書を含まない概要版）は対象外。' },
  '03208': { extract: extractTono,
    scope: '遠野市教育委員会の点検及び評価報告書（令和４～６年度実施事業）の事業費名ごとの記載1件。同じページ内で列の対応が確定する場合のみ決算額（円）・評価（達成/概ね達成/未達成）・事業所管課を収録し、それ以外は事業費名のみ。施策の展開ごとの総括・課題、主要な施策の成果説明書は対象外。' },
  '41425': { extract: extractShiroishi,
    scope: '白石町教育委員会点検評価報告書［令和６年度事業］の主要事業点検・評価シート22枚（事業名・担当部署・判定Ａ～Ｄ）。決算額・財源内訳（欄の対応が確定できない）、事業効果・課題の文章、評価委員の意見、行政経営プラン取組実績は対象外。' },
};
