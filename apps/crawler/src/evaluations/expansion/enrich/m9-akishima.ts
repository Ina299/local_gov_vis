import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 昭島市「令和７年度 事務事業評価（内部評価）シート」（令和６年度実施事業）
// 公開済みレコード（対象事業一覧から作成。目的・事業内容なし）と同じ事業の、政策別PDFの評価シートから補強する。
// 「対象」「目的」の欄は左右に並び、抽出テキストで行が交互に混ざることが多いため、次の形に限る。
//  目的   ← 「目的」の行の直後（空行なし）から空行までの段落。途中の行は欄の幅（28字以上）で句点で終わらず、
//           最後の行が句点で終わり、どの行にも空白（左右の欄の継ぎ目）がないこと。
//           「目的」の後に空行がある形は対象の本文か、対象と目的の行が混ざった形なので採らない。
//  事業内容 ← 「要 実施内容」・空行の後、空行の後に「事業費（コスト）の推移」が続く段落。
const HEAD = /令和７年度 事務事業評価（内部評価）シート\n/g;

interface Field { value: string; raw: string; at: number }

function purpose(seg: string, at: number): Field | null {
  const ms = [...seg.matchAll(/\n目的\n([^\n]+\n(?:[^\n]+\n)*)\n/g)];
  if (ms.length !== 1) return null;
  const raw = ms[0][1].slice(0, -1), lines = raw.split('\n');
  if (lines.some(l => /\s/.test(l)) || lines.slice(0, -1).some(l => l.length < 28 || l.endsWith('。')) || !lines[lines.length - 1].endsWith('。')) return null;
  return { value: lines.join(''), raw, at: at + ms[0].index! + '\n目的\n'.length };
}

function activities(seg: string, at: number): Field | null {
  const ms = [...seg.matchAll(/\n要 実施内容\n\n((?:[^\n]+\n)+)\n事業費（コスト）の推移\n/g)];
  if (ms.length !== 1) return null;
  const raw = ms[0][1].slice(0, -1);
  return { value: unwrap(raw), raw, at: at + ms[0].index! + '\n要 実施内容\n\n'.length };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13207' || input.format !== 'pdf' || !/\/001\/011\/787\/[^/]+\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, starts = [...t.matchAll(HEAD)].map(m => m.index!), out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    if (input.truncated && i === starts.length - 1) return;
    const seg = t.slice(s, starts[i + 1] ?? t.length);
    const names = [...seg.matchAll(/\n（令和６年度実施事業）\n\n([^\n]+)\n\n事業開廃年度\n/g)];
    if (names.length !== 1) return;
    const pur = purpose(seg, s), act = activities(seg, s);
    if (!pur && !act) return;
    const name = names[0][1].trim();
    const p = project(input, `${name}:narrative`, name, null, names[0][1], s + names[0].index! + '\n（令和６年度実施事業）\n\n'.length);
    p.evaluatedFiscalYear = 2024;
    if (pur) { p.purpose = pur.value; p.evidence.push(evidence(input, pur.raw, pur.at)); }
    if (act) { p.activities = act.value; p.evidence.push(evidence(input, act.raw, act.at)); }
    p.warnings.push('昭島市 事務事業評価（内部評価）シート（令和７年度、令和６年度実施事業）の「目的」欄と「事業の概要 実施内容」欄。目的は折り返しの改行だけを除いた。対象と目的の行が混ざる形は採らない。');
    out.push(p);
  });
  return out.filter(p => out.filter(o => o.projectName === p.projectName).length === 1);
}

export const entry = { extract, scope: '昭島市 令和７年度 事務事業評価（内部評価）シートの目的・実施内容（欄の対応が確定する形のみ）。公開済みの対象事業一覧由来レコードの補強用。' };
