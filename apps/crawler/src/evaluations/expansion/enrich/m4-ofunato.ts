/** 大船渡市 (03203): 事務事業評価シート（令和2年度様式・令和7年度様式）の「③ 意図」欄。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// 公開済みレコード（batch7/g0-ofunato・ofunato）は同じシートから作られ、目的が空欄。シートの「③ 意図（この事業によって、
// 対象をどう変えるのか）」を目的とする。意図欄は右列の⑥対象指標・⑦成果指標（ラベル「カ」〜「ス」、名称、単位）と
// 段組みで混ざるため、「③ 意図」の見出しから「④ 結果」の見出しまでを空行で区切った塊に分け、次のものを除く。
//  - 指標ラベルだけの行（「ク」など）、「⑤〜⑦」の見出し・「名称」「単位」、数字だけの塊、4文字以下で句点のない塊（単位）
//  - 「カ 指標名」のようにラベルと名称が並ぶ行を含む塊、ラベルだけの塊の直後で次に単位の塊が続く塊（指標名）
//  - 行の途中から右列の「⑦ 成果指標」「名称 単位」が続く場合はそこから後
// 残る本文の塊がちょうど1つで、見出しの直後か指標ラベル「ク」の直後にあるものだけを採る（段組みで②対象の本文などが
// 紛れ込む並びは採らない）。①手段・事務事業の概要の欄は活動指標・財源の列と混ざるため対象外。
const R7_START = /事務事業ID\n\n(\d{4})\n\n令和\n\n7 年度\n\n（令和\n\n6\n\n/g;
const PAGE2 = /事務事業ID\n\n(\d{3,4})\n\n事務事業名(?: |\n\n)([^\n]+)\n/g;
const INTENT = '③ 意図（この事業によって、対象をどう変えるのか）\n';
const RESULT = '\n④ 結果';
const LABEL = /(\S+)年度 ?[（(](実績|目標)[）)]/g;
const R2_LABELS = ['27:実績', '28:実績', '29:実績', '30:実績', '元:実績', '2:目標'].sort().join();
const R7_LABELS = ['2:実績', '3:実績', '4:実績', '5:実績', '6:実績', '7:目標'].sort().join();

type Item = { kind: 'label' | 'unit' | 'other' } | { kind: 'text'; text: string; at: number };

/** 意図欄（見出しの直後から④の見出しまで）の本文と、その region 内の位置。 */
function intent(region: string): { text: string; at: number } | null {
  const items: Item[] = [];
  let pos = 0;
  for (const block of region.split(/(\n\n+)/)) {
    const at = pos;
    pos += block.length;
    if (/^\n\n+$/.test(block)) continue;
    let lines = block.split('\n');
    const cut = lines.findIndex(l => /^⑦ 成果指標/.test(l) || l === '名称 単位');
    if (cut >= 0) lines = lines.slice(0, cut);
    const nonEmpty = lines.filter(l => l.trim());
    if (nonEmpty.length && nonEmpty.every(l => /^[ア-ス]$/.test(l.trim())) && cut !== 0) { items.push({ kind: 'label' }); continue; }
    lines = lines.map(l => l.replace(/ ⑦ 成果指標（対象における意図の達成度を表す指標）$/, '')).filter(l => l.trim() && !/^[ア-ス]$/.test(l.trim()));
    if (!lines.length) continue;
    const text = lines.join('\n');
    if (lines.some(l => /^[ア-ス] /.test(l)) || /^[⑤⑥⑦]/.test(text) || /^(名称|単位)$/.test(text) || /^[\d,\s.△-]+$/.test(text)) { items.push({ kind: 'other' }); continue; }
    if (text.length <= 4 && !text.includes('。')) { items.push({ kind: 'unit' }); continue; }
    // 本文は行の並びのまま原文の連続した部分であること（除いた行が途中に挟まらない）。
    const offset = block.indexOf(text);
    if (offset < 0) { items.push({ kind: 'other' }); continue; }
    items.push({ kind: 'text', text, at: at + offset });
  }
  const texts = items.flatMap((x, i) => x.kind === 'text' && !(items[i - 1]?.kind === 'label' && items[i + 1]?.kind === 'unit') ? [x] : []);
  if (texts.length !== 1) return null;
  const { text, at } = texts[0];
  if (text.split('\n').some(l => / [ア-ス](?: |$)|(?:^| )(?:名称|単位)(?: |$)/.test(l))) return null;
  const before = region.slice(0, at);
  if (before.trim() && !/(?:^|\n)ク\s*$/.test(before) && !/\nク [^\n]+\s*$/.test(before)) return null;
  return { text, at };
}

function sheet(input: CachedInput, from: number, to: number, era: 'r2' | 'r7'): ProjectEvaluation | null {
  const t = input.text, slice = t.slice(from, to);
  const pages = [...slice.matchAll(PAGE2)];
  if (pages.length !== 1) return null;
  const [p2raw, , name] = pages[0];
  // 年度は公開済みレコードと同じく「(2) 総事業費・指標等の推移」の表頭による（令和2年度様式は 27〜30・元年度が実績、2年度が目標）。
  const table = slice.indexOf('(2) 総事業費・指標等の推移');
  if (table < 0 || table > pages[0].index!) return null;
  const labels = [...slice.slice(table, pages[0].index).matchAll(LABEL)].map(m => `${m[1].normalize('NFKC')}:${m[2]}`).sort().join();
  if (labels !== (era === 'r2' ? R2_LABELS : R7_LABELS)) return null;
  const a = slice.indexOf(INTENT);
  if (a < 0 || slice.indexOf(INTENT, a + 1) >= 0) return null;
  const regionStart = a + INTENT.length, b = slice.indexOf(RESULT, regionStart);
  if (b < 0) return null;
  const found = intent(slice.slice(regionStart, b));
  if (!found) return null;
  const p = project(input, `${pages[0][1]}:intent`, name, era === 'r2' ? 2020 : 2025, p2raw, from + pages[0].index!);
  p.evaluatedFiscalYear = era === 'r2' ? 2019 : 2024;
  p.purpose = found.text;
  p.evidence.push(evidence(input, found.text, from + regionStart + found.at));
  p.warnings.push('事務事業評価シートの「③ 意図（この事業によって、対象をどう変えるのか）」欄の本文。段組みで混ざる右列の指標ラベル・名称・単位を除いた本文の塊が1つだけの場合に限る。');
  return p;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '03203' || input.format !== 'pdf' || input.truncated) return [];
  const t = input.text;
  if (!t.startsWith('事務事業ID')) return [];
  const starts = [...t.matchAll(R7_START)];
  if (!starts.length) { const p = sheet(input, 0, t.length, 'r2'); return p ? [p] : []; }
  return starts.flatMap((m, k) => {
    const p = sheet(input, m.index!, starts[k + 1]?.index ?? t.length, 'r7');
    return p && p.projectCode === `${m[1]}:intent` ? [p] : [];
  });
}

export const entry = {
  extract,
  scope: '大船渡市 事務事業評価シート（令和2年度様式＝令和元年度実績、令和7年度様式＝令和6年度実績）の「③ 意図」欄を目的として収録。段組みで混ざる指標ラベル・名称・単位を除いて本文の塊が1つだけ残る場合に限る。①手段・事務事業の概要は指標・財源の列と混ざるため対象外。',
};
