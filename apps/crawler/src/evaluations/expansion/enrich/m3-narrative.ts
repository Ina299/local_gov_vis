/**
 * グループ m3 共通: 評価シートの文章欄（目的・取組内容・成果など）を保存テキストから取り出す。
 * 欄の見出しの直後から、空行・別の見出しが現れるまでの行だけを採る。折り返し（前の行が句点で終わらない長い行で、
 * 次の行が箇条の記号で始まらない）は改行を除いてつなぐ。根拠は原文の部分文字列そのもの。
 */
import type { EvaluationEvidence } from '../../../../../web/src/types/evaluation';
import { evidence, type CachedInput } from '../shared';

/** 箇条・小見出しの始まり（この記号で始まる行は前の行の続きとみなさない）。 */
const MARK = /^(◆|◇|■|□|●|○|◎|・|･|※|＊|\*|－|ー|-|【|［|〔|\[|<|＜|《|〈|[①-⑳]|[⑴-⒇]|（[０-９\d一二三四五六七八九十ア-ン]+）|\([0-9a-zア-ン]+\)|[０-９\d]+[.．)）、]|[ア-ン][.．)）、])/;
/** 表の残り（数値だけの行・表の見出し語）。1行でも混ざれば欄ごと採らない。 */
const TABLE = /^([-△▲]?[\d０-９,，.．]+ ?(%|％|千円|円|件|人|回)?|目標|実績|単位|区分|目標値|実績値|達成率|[０-９\d]+年度(\([^)]*\))?)$/;

export interface Block { value: string; raw: string; at: number }
export interface BlockOptions {
  /** 折り返しとみなす前の行の最低文字数（資料の1行の文字数より少し短く。既定 25） */
  minWrap?: number;
  /** 空行で終わったとき、次の行がこれに一致しなければ（欄が空行をまたいで続くおそれがあるため）採らない */
  next?: RegExp;
}
/** 表や箇条の前置き・見出しだけの行（この行で欄が終わると、続きが別の場所にある）。 */
const LEAD = /^([【［〔＜<《〈][^】］〕＞>》〉]*[】］〕＞>》〉]|.*(とおりです|とおり|次の通りです|下記|以下|下表|別表)[。：:]?|.*[：:])$/;

/**
 * text の at 位置（欄の内容の先頭行の先頭）から、空行または stop の見出し行の手前までを欄の内容とする。
 * 空行の後に文章らしい行（◆で始まる、または読点・句点を含む。options.next があればそれ以外のすべて）が続く場合は、
 * 欄が空行をまたいで続いているおそれがあるため採らない。表の数値・セルらしい行が1行でも混ざる場合、
 * 最後の行が表や箇条の前置き・見出しの場合も採らない。
 */
export function block(text: string, at: number, stop: RegExp, options: BlockOptions = {}): Block | null {
  const minWrap = options.minWrap ?? 25, lines: string[] = [];
  let pos = at, endedByBlank = false;
  while (pos < text.length) {
    const nl = text.indexOf('\n', pos), end = nl < 0 ? text.length : nl;
    const line = text.slice(pos, end);
    if (!line.trim()) { endedByBlank = true; break; }
    if (stop.test(line.trim())) break;
    lines.push(line);
    pos = end + 1;
  }
  if (!lines.length || lines.some(l => TABLE.test(l.trim())) || LEAD.test(lines[lines.length - 1].trim())) return null;
  if (endedByBlank) {
    const next = /^\s*([^\n]*)/.exec(text.slice(pos))![1].trim();
    if (next && !stop.test(next) && (options.next ? !options.next.test(next) : /^◆/.test(next) || /[、。]/.test(next))) return null;
  }
  const raw = lines.join('\n');
  let value = '';
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim(), prev = lines[i - 1]?.trim() ?? '';
    const wrap = i > 0 && !MARK.test(l) && prev.length >= minWrap && !/[。.]$/.test(prev);
    // 記号なし・折り返しでもない短い行（句点・括弧で終わらない）は表のセル・表題とみなし、欄ごと採らない。
    if ((i > 0 || lines.length > 1) && !MARK.test(l) && !wrap && l.length < minWrap && !/[。）)]$/.test(l)) return null;
    value += i === 0 ? l : (wrap ? '' : '\n') + l;
  }
  if (value.replace(/[◆・\s]/g, '').length < 4) return null;
  return { value, raw, at };
}

export const blockEvidence = (input: CachedInput, b: Block): EvaluationEvidence => evidence(input, b.raw, b.at);
