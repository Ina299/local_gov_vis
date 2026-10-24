import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, mergeReprints, nfkc, type Entry } from '../batch9/i1-util';
import { municipalityRecords } from '../batch11/k0-util';

/** Text blocks separated by blank lines, with absolute offsets. */
function blocks(text: string, base = 0): { start: number; end: number; s: string }[] {
  return [...text.matchAll(/[^\n]+(?:\n[^\n]+)*/g)].map(m => ({ start: base + m.index!, end: base + m.index! + m[0].length, s: m[0] }));
}
const joined = (s: string) => s.split('\n').map(l => l.trim()).join('');
const AMOUNT = /^\d{1,3}(?:,\d{3})*$/;

// ---------------------------------------------------------------- 五島市（事業評価一覧表 別冊「主な見直し事業」）
// 列: ページ／担当課名／事業名／NN予算額（千円）［／NN決算額（千円）］／今後の方向性／左の方向性の理由
const GOTO_SOURCES: Record<string, { era: number; actualEra: number | null }> = {
  '9c4216b6b038627c4d8034a8': { era: 25, actualEra: null },
  '0f43a7189341128af4186560': { era: 26, actualEra: null },
  'deb01ca89ad1b2a413d02172': { era: 28, actualEra: 27 },
};
const DIRECTIONS = new Set(['見直し', '廃止', '縮小', '拡大', '現状維持']);
const ZEN = (n: number) => String(n).replace(/\d/g, d => '０１２３４５６７８９'[Number(d)]);

function extractGoto(input: CachedInput): ProjectEvaluation[] {
  const src = GOTO_SOURCES[input.sourceId];
  if (input.municipalityCode !== '42211' || !src) return [];
  const title = `平成${ZEN(src.era)}年度事業評価一覧表 別冊`;
  if (!input.text.startsWith(title)) return [];
  const budgetHead = `${ZEN(src.era)}予算額\n（千円）`, actualHead = src.actualEra ? `${ZEN(src.actualEra)}決算額\n（千円）` : null;
  const bh = input.text.indexOf(budgetHead), ah = actualHead ? input.text.indexOf(actualHead) : -1;
  if (bh < 0 || (actualHead && ah < 0)) return [];
  const fy = 1988 + src.era;
  const c = blocks(input.text), S = (i: number) => c[i]?.s ?? '';
  const out: ProjectEvaluation[] = [];
  for (let i = 0; i < c.length - 5; i++) {
    if (!/^\d{1,3}$/.test(S(i)) || !/^[^\s\d（）]{2,10}(?:課|室|局|支所|本部|センター)$/.test(S(i + 1))) continue;
    const name = S(i + 2);
    if (name.split('\n').length > 2 || /^[\d,]+$|計 |^担当課名$|^事$/.test(name) || /\d{1,3},\d{3}/.test(name)) continue;
    if (!AMOUNT.test(S(i + 3))) continue;
    let k = i + 4;
    if (src.actualEra) { if (!AMOUNT.test(S(k))) continue; k++; }
    // 方向性セルは単独の語（見直し等）か「拡大（事業」等の先頭行（理由欄と行が混在）。それ以外は列対応が確定しないため除外。
    const dir = S(k), firstLine = dir.split('\n')[0];
    const exact = DIRECTIONS.has(dir);
    if (!exact && !/^(?:拡大|縮小|廃止)（(?:事業|その)(?: |$)/.test(firstLine)) continue;
    const projectName = joined(name);
    const p = project(input, nfkc(projectName), projectName, fy, input.text.slice(c[i].start, c[k].end), c[i].start);
    p.department = S(i + 1);
    p.evidence.push(evidence(input, title, 0), evidence(input, budgetHead, bh));
    p.amounts.push(amount(input, 'budget', fy, S(i + 3), '千円', S(i + 3), c[i + 3].start));
    if (src.actualEra) {
      p.evidence.push(evidence(input, actualHead!, ah));
      p.amounts.push(amount(input, 'actual', 1988 + src.actualEra, S(i + 4), '千円', S(i + 4), c[i + 4].start));
    }
    if (exact) p.ratings.push({ kind: 'self', label: '今後の方向性', value: dir, scale: null, evidence: evidence(input, dir, c[k].start) });
    else p.warnings.push('「今後の方向性」欄は抽出テキストで理由欄と行が混在している（例:「拡大（事業」と「見直し）」が分離）ため評価として収録せず、原文根拠のみ保持。');
    p.warnings.push(`平成${src.era}年度事業評価一覧表 別冊「主な見直し事業」の行。評価年度は表題の「平成${src.era}年度事業評価」。金額は「${src.era}予算額（千円）」を平成${src.era}年度予算${src.actualEra ? `、「${src.actualEra}決算額（千円）」を平成${src.actualEra}年度決算` : ''}として収録。評価対象年度は本文に明記がないため未設定。方向性の区分定義は別冊に記載がないため scale は空。ページ・担当課名・事業名・金額・方向性のセルが連続して並ぶ行のみ採用（複数事業をまとめた行・列が崩れた行は除外）。`);
    out.push(p);
  }
  return mergeReprints(out, p => `${nfkc(p.projectName)}|${p.evaluationYear}`);
}

// ---------------------------------------------------------------- 丹波篠山市（平成24・25年度 施策−事務事業評価表の事務事業行）
// 列: 通番／事業ｺｰﾄﾞ／名称／トータルコスト(千円)／活動指標／単位／H(N-1)実績値／H(N)実績値／H(N+1)目標値／事務事業達成度／事務事業評価
const SASAYAMA_SOURCES: Record<string, number> = { '6d11a627e95289515c8c7c93': 24, '99bb5bc168629657e8c4b220': 25 };
const ACHIEVE = '◎：計画より進んでいる／○：計画通り進んでいる／△：計画より遅れている（施策評価の公表資料「施策評価について」の達成度記号）';
const RATE: Record<number, string> = {
  24: 'Ａ：計画通り進めることが適当／Ｂ：予算増を伴わない改善が可能／Ｃ：予算増減を伴う見直しが必要／Ｄ：抜本的な見直しが必要／－：評価対象外（事務事業の終期到来等）（「施策評価（平成２４年度実施分事後評価）について」の事務事業の方向性の記号）',
  25: 'Ａ：計画通り進めることが適切／Ｂ：予算増を伴わない改善が可能／Ｃ：予算増減を伴う見直しが必要／Ｄ：抜本的な見直しが必要／－：評価対象外（事務事業の終期到来等）（「施策評価（平成２５年度事業評価）について」の事業の評価の記号）',
};
const VALUE = /^(?:[\d,]+(?:\.\d+)?|[－−-])$/;
const dash = (s: string) => /^[－−―-]$/.test(s);

/** 既存の構造化レコード（令和6・7年度 行政評価、評価年度のみ記載）の事業名。年度比較ができず衝突するため新規側を除外する。 */
const SASAYAMA_EXISTING = new Set(["ふるさと大使事業", "ピロリ菌検診事業", "ブランド戦略事業", "休日診療所事業", "住宅リフォーム助成", "住宅耐震化の促進", "入札監視事業", "公契約事業", "公民館改修助成", "原子力防災対策", "商店街等の振興", "地域ケア会議の開催", "市営駐車場管理事業", "市有地利活用事業", "市税の徴収事務", "広報広聴事業", "待機児童対策", "放置空き家対策", "救急体制の高度化", "敬老事業の実施", "明るい挨拶事業", "森林バイオマス", "水道施設更新事業", "消防団活動事業", "病児保育事業の実施", "税務事務の電子化", "竹林整備支援事業", "診療所体制の充実", "起業支援事業", "都市施設管理事業", "障がい児支援事業", "障がい者支援事業", "預かり保育の充実"]);

function sasayamaOne(input: CachedInput): ProjectEvaluation[] {
  const era = SASAYAMA_SOURCES[input.sourceId];
  if (input.municipalityCode !== '28221' || !era) return [];
  const fy = 1988 + era;
  const headRe = new RegExp(`平成${era}年度 施策−事務事業評価表 所属 \\d{8}\\n`, 'g');
  const starts = [...input.text.matchAll(headRe)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, si) => {
    const sheet = input.text.slice(s, starts[si + 1] ?? input.text.length);
    const titleRaw = /^[^\n]+\n[^\n]+\n\d{4}\n[^\n]+/.exec(sheet)?.[0];
    const cols = [`H${era - 1}\n実績値`, `H${era}\n実績値`, `H${era + 1}\n目標値`];
    if (!titleRaw || !cols.every(h => sheet.includes(h)) || !sheet.includes('事務事業 事務事業\n達成度\n評価')) return;
    const c = blocks(sheet, s), S = (i: number) => c[i]?.s ?? '';
    for (let i = 0; i < c.length - 5; i++) {
      if (!/^(?:\S )?\d{1,2}$/.test(S(i)) || !/^\d{6}$/.test(S(i + 1))) continue;
      const name = S(i + 2);
      if (name.split('\n').length > 2 || /^[\d,]+/.test(name)) continue;
      const ci = /^([\d,]+) ([^\n]+(?:\n[^\n]+)?)$/.exec(S(i + 3));
      if (!ci || !AMOUNT.test(ci[1])) continue;
      let k: number, ind: { name: string; unit: string; v: string[] } | null = null;
      if (ci[2] === '―') k = i + 4;
      else {
        if (!/^[^\d\s]{1,4}$/.test(S(i + 4)) || ![5, 6, 7].every(d => VALUE.test(S(i + d)))) continue;
        ind = { name: joined(ci[2]), unit: S(i + 4), v: [S(i + 5), S(i + 6), S(i + 7)] };
        k = i + 8;
      }
      if (!/^[◎○△×－−]$/.test(S(k)) || !/^[ＡＢＣＤ－−]$/.test(S(k + 1))) continue;
      const projectName = joined(name);
      const p = project(input, S(i + 1), projectName, null, input.text.slice(c[i].start, c[k + 1].end), c[i].start);
      p.evaluatedFiscalYear = fy;
      p.evidence.push(evidence(input, titleRaw, s), evidence(input, cols[1], s + sheet.indexOf(cols[1])));
      if (ind) {
        const raw = input.text.slice(c[i + 3].start, c[i + 7].end);
        const at = c[i + 3].start;
        const years = [fy - 1, fy, fy + 1];
        ind.v.forEach((v, d) => {
          if (dash(v)) return;
          p.indicators.push({ name: ind!.name, fiscalYear: years[d], target: d === 2 ? v : null, actual: d === 2 ? null : v, unit: ind!.unit, evidence: evidence(input, raw, at) });
        });
      }
      if (!dash(S(k))) p.ratings.push({ kind: 'self', label: '事務事業達成度', value: S(k), scale: ACHIEVE, evidence: evidence(input, S(k), c[k].start) });
      if (!dash(S(k + 1))) p.ratings.push({ kind: 'self', label: '事務事業評価', value: S(k + 1), scale: RATE[era], evidence: evidence(input, S(k + 1), c[k + 1].start) });
      p.warnings.push(`平成${era}年度 施策−事務事業評価表（施策目的達成のための事務事業一覧）の行。評価対象年度は表題の平成${era}年度（公表資料で平成${era}年度事業の評価と明記）。評価年度は未設定。活動指標はH${era - 1}・H${era}実績値とH${era + 1}目標値を年度別に収録（各年度の目標値・実績値の対は表にないため片側のみ）。トータルコスト（千円）は対象年度の明記がないため金額として収録せず原文根拠にのみ含む。表の所属は施策の主担当課で事業ごとの担当課ではないため担当課は未設定。区分定義（scale）は同時公表の「施策評価について」から転記。セルが連続して並ぶ行のみ採用（列が崩れた行は除外）。`);
      out.push(p);
    }
  });
  return mergeReprints(out.filter(p => !SASAYAMA_EXISTING.has(nfkc(p.projectName))), p => `${p.projectCode}|${p.evaluatedFiscalYear}`);
}
/** 一般管理費等の汎用名は施策・課ごとに別事業（別コード）で担当課も未設定のため、同年度・同名の組は双方除外する。 */
const extractSasayama = (input: CachedInput, inputs: CachedInput[]) => municipalityRecords(input, inputs, sasayamaOne, p => `${p.projectCode}|${p.evaluatedFiscalYear}`);

// ---------------------------------------------------------------- 辰野町（補助金評価シート 平成２３年度実績分）
const TATSUNO_TITLE = '補助金評価シート（平成２３年度実績分）';

function extractTatsuno(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '20382' || !input.text.startsWith(TATSUNO_TITLE)) return [];
  const m = /事務事業コード\n\n補助事業名\n\n担当課\n\n(\d{6})\n\n([^\n]+)\n\n([^\n]+)\n/.exec(input.text);
  if (!m) return [];
  const p = project(input, m[1], m[2], null, m[0].trimEnd(), m.index);
  p.evaluatedFiscalYear = 2011;
  p.evidence.push(evidence(input, TATSUNO_TITLE, 0));
  if (/(?:課|署|委員会)$/.test(m[3])) p.department = m[3];
  const purpose = /この事務事業のサービスを提供することによって対象をどういう状態にしたいのですか。\n([^\n]+)\n③手段/.exec(input.text);
  if (purpose) { p.purpose = purpose[1]; p.evidence.push(evidence(input, purpose[1], purpose.index + purpose[0].indexOf(purpose[1]))); }
  p.warnings.push('補助金評価シート（平成２３年度実績分）の事務事業コード・補助事業名・担当課・目的。評価対象年度は表題の平成23年度。交付額・事業費・人件費の表、指標、チェック欄（✘印）による評価・方向性は抽出テキストで列・選択肢との対応が確定しないため未収録。評価年月日は抽出テキストで分断されているため評価年度は未設定。');
  if (!p.department) p.warnings.push('担当課欄が抽出テキストで「担当係名」等の見出しに置き換わっているため担当課は未設定。');
  return [p];
}

export const bEntries: Record<string, Entry> = {
  '42211': { extract: extractGoto, scope: '事業評価一覧表 別冊「主な見直し事業」（平成25・26・28年度）の事業行（担当課・事業名・当該年度予算額・平成28年度版は前年度決算額・今後の方向性）。本編の事業評価一覧表（平成25〜30年度・令和3・5年度）は列崩れのため対象外。平成30年度別紙・令和3・5年度の拡大/縮小/廃止一覧も列崩れのため対象外。複数事業をまとめた行・列が崩れた行も除外。' },
  '28221': { extract: extractSasayama, scope: '平成24・25年度 施策−事務事業評価表の事務事業行（事業コード・名称・活動指標の実績値/目標値・事務事業達成度・事務事業評価）。トータルコスト（年度未記載）、施策評価シート・施策評価表本体、平成26・27年度の事務事業の状況（予算・決算の列崩れ・事業別評価なし）、平成19年度実施事務事業評価一覧（事業名と施策体系欄が混在）、公表用概要は対象外。' },
  '20382': { extract: extractTatsuno, scope: '補助金評価シート（平成23年度実績分）40件の事務事業コード・補助事業名・担当課・目的。交付額・人件費の表、指標、✘印による評価・今後の方向性・所属長所見は列対応が確定しないため対象外。' },
};
export const entries = bEntries;
