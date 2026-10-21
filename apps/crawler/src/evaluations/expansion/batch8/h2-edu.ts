import type { EvaluationAmount, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

/**
 * 教育委員会の点検評価報告書（事業単位の評価があるもの）と、物価高騰対応臨時交付金の効果検証シート（交付対象事業ごとの行）。
 * 施策（重点施策・施策一覧）単位の点検評価は対象外。
 */
type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

const toNum = (s: string) => Number(s.replaceAll(',', ''));
const isUnique = (t: string, raw: string) => t.indexOf(raw) >= 0 && t.indexOf(raw) === t.lastIndexOf(raw);
function yen(input: CachedInput, kind: EvaluationAmount['kind'], fiscalYear: number | null, rawValue: string, raw: string, start: number): EvaluationAmount {
  return { kind, fiscalYear, amountYen: toNum(rawValue), rawValue, rawUnit: '円', evidence: evidence(input, raw, start) };
}

// ---------------------------------------------------------------- 01209 夕張市
const YUBARI_SOURCE = '6dc7215f8a20f0f281c8ddca';
const YUBARI_HEAD = '令和６年度\n教育行政の執行状況に関する点検評価報告書\n（令和５年度事業対象）';
/** 細目シートの事業項目名（本文で1行として1回だけ現れる表記）。出現順。 */
const YUBARI_ITEMS = ['スクールバス運営', '遠距離通学支援（通学用自動車運行委託）', '児童生徒通学安全対策事業（バス添乗員）', '児童生徒通学費援助（バス定期代）',
  '児童生徒通学安全対策（児童見守りサービス・一斉同報サービス）', '地域学校協働本部事業', '夕張市学校運営協議会', '生徒指導対策', 'ことばの教室運営',
  '特別支援教育推進協議会補助', '総合的な学習の時間等における実践', '中学校体育大会補助', '外国語指導充実', '平和教育推進事業', '特別支援教育支援員配置',
  '小中学校学力向上事業', '小中学校図書充実', '夕張市小・中学校資格試験検定料補助', '小・中学校スキー学習に係るリフト代及び用具レンタル代補助',
  '小・中学校校舎維持補修', '小・中学校教材教具整備', '小・中学校維持管理', '児童生徒情報化促進', '小・中学校給食運営', '中学校給食業務（給食調理員）',
  '児童生徒の健康管理', '児童生徒鑑賞教室', '美術品管理事業', '社会教育事業', 'ふるさとギャラリー事業', '生涯学習プロジェクト・わくわくブロジェクト事業',
  '文化財保護事業', 'りすた図書館事業', '郷土文化施設事業', '人材バンク事業', '音楽発表会事業', '文化スポーツセンター管理', '平和運動公園管理',
  '体育施設管理（指定管理等施設）', '清水沢プール管理'];
const YUBARI_RATING_HEAD = '事業達成度 事 業 効 果';
const YUBARI_RATING = /^事業達成度 事 業 効 果\n\n([A-DＡ-Ｄ])\n\n(?:（細目）\n\n|自己評価\n\n)?([A-DＡ-Ｄ])\n/;

function extractYubari(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01209' || input.sourceId !== YUBARI_SOURCE) return [];
  const t = input.text, head = t.indexOf(YUBARI_HEAD);
  if (head !== 0) return [];
  const positions = YUBARI_ITEMS.map(n => {
    const raw = `\n${n}\n`, i = t.indexOf(raw);
    return i >= 0 && i === t.lastIndexOf(raw) ? i + 1 : -1;
  });
  // Sheets must appear in the listed order; otherwise segment boundaries are unreliable.
  if (positions.some((p, k) => p < 0 || (k > 0 && p <= positions[k - 1]))) return [];
  const tail = t.indexOf('\n資\n\n料\n', positions[positions.length - 1]);
  const out: ProjectEvaluation[] = [];
  YUBARI_ITEMS.forEach((name, k) => {
    const start = positions[k], end = positions[k + 1] ?? (tail > 0 ? tail : t.length);
    const p = project(input, name, name, 2024, name, start);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2023;
    p.evidence.push(evidence(input, YUBARI_HEAD, head));
    const seg = t.slice(start, end), heads = seg.split(YUBARI_RATING_HEAD).length - 1;
    if (heads === 1) {
      const at = seg.indexOf(YUBARI_RATING_HEAD), m = seg.slice(at).match(YUBARI_RATING);
      if (m) {
        const ev = evidence(input, m[0].trimEnd(), start + at);
        p.ratings.push({ kind: 'self', label: '事業達成度（教育委員会 自己評価）', value: m[1], scale: 'Ａ 事業が十分に達成された（9 割以上）／Ｂ 事業が相当程度達成された（7 割～8 割）／Ｃ 事業の達成度がやや不十分である（5 割～6 割）／Ｄ 事業が達成されなかった（5 割以下）', evidence: ev });
        p.ratings.push({ kind: 'self', label: '事業効果（教育委員会 自己評価）', value: m[2], scale: 'Ａ 十分な事業効果が得られた（9 割以上）／Ｂ 相当程度の事業効果が得られた（7 割～8 割）／Ｃ 事業効果がやや不十分である（5 割～6 割）／Ｄ 事業効果が不十分である（5 割以下）', evidence: ev });
      }
    }
    p.warnings.push('夕張市 令和６年度 教育行政点検評価報告書（令和５年度事業対象）の細目シート（事業項目）単位。総括表（事務事業名＝施策のまとまり）は対象外。');
    p.warnings.push('抽出テキストは1ページ2シートが交互に並ぶため、事業達成度・事業効果は、当該事業名から次の事業名までの間に評価欄が1つだけあり、2つの記号が評価欄の直後に連続（間に「（細目）」「自己評価」の見出しのみ）する場合だけ、出現順に事業達成度・事業効果として採用。他シートの文章が挟まる場合は未収録。事業費は記載がないため未収録。');
    out.push(p);
  });
  return out;
}

// ---------------------------------------------------------------- 01436 雨竜町
const URYU_SOURCE = '9ebeb8901e8227b2cc1534e1';
const URYU_HEAD = '令和６年度 雨竜町教育委員会内部・外部評価主要事務事業一覧\n（令和５年度実施事業対象）';
const URYU_ROW = /\n\n([^\n]+?)(?:\n\n| )([^\n ]+事業)(?:\n\n| )([ＡＢＣＤ])\n\n(継続|廃止|拡充|縮小|見直し|休止|終了)\n\n([ＡＢＣＤ])\n\n([^\n]+(?:\n[^\n]+)*)/g;
const URYU_SCALE = 'Ａ 充分成果が上がっている／Ｂ 成果が上がっている／Ｃ 改善の余地あり／Ｄ 見直しが必要';

function extractUryu(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01436' || input.sourceId !== URYU_SOURCE) return [];
  const t = input.text, head = t.indexOf(URYU_HEAD), end = t.indexOf('○ 評価区分：', head);
  if (head < 0 || end < 0) return [];
  const body = t.slice(head, end), out: ProjectEvaluation[] = [];
  for (const m of body.matchAll(URYU_ROW)) {
    const raw = m[0].slice(2), start = head + m.index! + 2;
    const p = project(input, m[2], m[2], 2024, raw, start);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2023;
    p.evidence.push(evidence(input, URYU_HEAD, head));
    const ev = p.evidence[0];
    p.ratings.push({ kind: 'self', label: '内部評価', value: m[3], scale: URYU_SCALE, evidence: ev });
    p.ratings.push({ kind: 'self', label: '今後の事業の方向性', value: m[4], scale: null, evidence: ev });
    p.ratings.push({ kind: 'external', label: '外部評価', value: m[5], scale: URYU_SCALE, evidence: ev });
    p.warnings.push(`雨竜町 令和６年度 教育委員会内部・外部評価主要事務事業一覧（令和５年度実施事業対象）の1行。施策の項目は「${m[1]}」。外部評価委員意見は根拠テキストに原文のまま含む。事業費・指標は一覧に記載がないため未収録。`);
    out.push(p);
  }
  const names = out.map(p => p.projectName);
  return out.filter(p => names.filter(n => n === p.projectName).length === 1);
}

// ---------------------------------------------------------------- 05368 大潟村（点検・評価報告書）
const OGATA_REPORT = 'a0e6cb8db94f26cdf9f54cf6';
const OGATA_HEAD = '令和４年度\n\n大潟村教育委員会\n点検・評価報告書';
/** 「(n)」で始まる事務事業名の見出し（抽出テキストで2行に折り返し）を連結した名称。出現順。 */
const OGATA_NAMES = ['大潟村連携教育推進事業', '施設等整備事業', '学校園建物総合管理事業', 'ＩＣＴ教育推進事業', '英語活動支援事業(小学校)', '外国語指導助手招致事業',
  '大潟村子ども海外研修事業', '学習生活支援員配置事業', '生徒派遣費補助金', '総合的な学習推進事業', '子育て支援センター事業', '季節保育事業', '在宅子育て支援事業',
  '放課後児童クラブ事業', '地産地消給食の推進', '地域人材活用事業', 'コミュニティ・スクール推進事業', '子育てサポーター', '家庭教育学級', '高齢者学級', '成人文化講座',
  '公民館講座', '花いっぱい運動', '二十歳のつどい', '全村盆踊り', '冬季ふるさと祭り', '子ども会育成事業', 'きらきら塾', '各種団体補助金',
  '社会教育団体リーダー研修等並びに社会教育委員研修', '施設の補改修', '図書の購入', '備品購入', '社会教育団体の支援（バス研修事業費補助金）',
  'ホストタウン推進事務事業（ホストタウン）', '教育交流推進事業（ホストタウン）', 'スポーツコミッションおおがた活動支援事業', '芸術文化協会補助金', '芸文祭の開催',
  '企画展の実施', '博物館教室・講座等の実施', 'ジオパーク関連事業', '案内ガイド', '大潟村案内ボランティア事業/研修/学習会', '村内外の小中学校の総合学習等',
  '各種スポーツ教室', '各種村民スポーツ大会', '生涯スポーツ活動推進事業', '全国市町村交流レガッタ派遣事業', 'スポーツ推進委員活動の推進', '体育協会補助金',
  'スポーツ少年団補助金', '総合型地域スポーツクラブ育成支援補助金', '各種スポーツ施設の維持管理(委託)', '各種スポーツ施設の維持管理(補修)'];
const OGATA_SCALE = 'AA（想定以上、前年度比 120％以上） A（計画どおり、前年度比 80％～120％） B（計画を大きく下回った、前年度比 80％未満） C（未実施） D（新型コロナウイルス感染拡大の影響による事業の中止、その他の理由による事業の中止等）';

function extractOgataReport(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '05368' || input.sourceId !== OGATA_REPORT) return [];
  const t = input.text, head = t.indexOf(OGATA_HEAD);
  if (head !== 0) return [];
  const from = t.indexOf('主な事務事業名');
  if (from < 0) return [];
  const heads = [...t.slice(from).matchAll(/^\(\d+\)([^\n]*)\n([^\n]*)/gm)].map(m => ({ m, at: from + m.index! }));
  if (heads.length !== OGATA_NAMES.length) return [];
  // The first heading line must be a prefix of the joined name (guards against a shifted list).
  const norm = (s: string) => s.replace(/[ 　]/g, '');
  if (heads.some(({ m }, k) => !norm(OGATA_NAMES[k]).startsWith(norm(m[1]).slice(0, Math.min(5, norm(m[1]).length))))) return [];
  const out: ProjectEvaluation[] = [];
  heads.forEach(({ m, at }, k) => {
    const name = OGATA_NAMES[k], end = heads[k + 1]?.at ?? t.length;
    const raw = m[0].trimEnd();
    const p = project(input, name, name, 2022, raw, at);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2022;
    p.evidence.push(evidence(input, OGATA_HEAD, head));
    const seg = t.slice(at, end), marks = [...seg.matchAll(/\n(ＡＡ|[ＡＢＣＤ])(?=\n|$)/g)];
    if (marks.length === 1) {
      const r = marks[0];
      p.ratings.push({ kind: 'self', label: '総合', value: r[1], scale: OGATA_SCALE, evidence: evidence(input, seg.slice(0, r.index! + r[0].length), at) });
    }
    p.warnings.push('大潟村 令和４年度 教育委員会点検・評価報告書の「主な事務事業名」1件。事業名は抽出テキストで折り返された見出しを連結したもの（括弧内の副題・改行は原文の見出しから補正）。');
    p.warnings.push('総合評価は、当該事業名から次の事業名までの間に独立した評価記号（ＡＡ/Ａ～Ｄ）が1つだけある場合のみ採用（ページ末尾へ回り込んだ記号を含む）。2つ以上または0の場合（複数事業の見出しが連続する箇所など）は未収録。表中の決算額は内訳のため事業費として未収録。');
    out.push(p);
  });
  return out;
}

// ---------------------------------------------------------------- 05368 大潟村（臨時交付金 効果検証シート）
const OGATA_GRANT = '3830683c1b550739cbf541e7';
const OGATA_GRANT_HEAD = '令和６年度 物価高騰対応重点支援地方創生臨時交付金 実施状況及び効果検証';
/** 行ごとの名称根拠と総事業費根拠。総事業費は各行の積算根拠（③）の合計と一致することを確認済み。 */
const OGATA_GRANT_ROWS: { name: string; nameRaw: string; amountRaw: string; value: string; fy: number | null }[] = [
  { name: '物価高騰重点支援給付金（低所得世帯）事業【物価高騰対策給付金】', nameRaw: '物価高騰重点支援給付金（低所得世\n帯）事業【物価高騰対策給付金】',
    amountRaw: 'R5.12.25\n\nR6.4.30\n\n6,441,352\n\n6,441,352', value: '6,441,352', fy: null },
  { name: '大潟村暮らし応援商品券事業（第２弾）', nameRaw: '単 大潟村暮らし応援商品券事業（第２弾）', amountRaw: 'R6.6.20\n\n15,711,374\n\n13,774,000', value: '15,711,374', fy: null },
  { name: '物価高騰重点支援給付金（低所得世帯）事業', nameRaw: '単\n\n物価高騰重点支援給付金（低所得世\n帯）事業\n\n単 低所得者等支援給付金事業',
    amountRaw: 'R5.12.25\n\nR6.4.10\n\n2,591,300\n\n2,591,300', value: '2,591,300', fy: null },
  { name: '低所得者等支援給付金事業', nameRaw: '単 低所得者等支援給付金事業', amountRaw: 'R6.4.1\n\n1／1\n\nR7.3.31\n\n24,550,026\n\n24,550,026', value: '24,550,026', fy: 2024 },
];

function extractOgataGrant(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '05368' || input.sourceId !== OGATA_GRANT) return [];
  const t = input.text;
  if (t.indexOf(OGATA_GRANT_HEAD) !== 0 || !t.includes('\n\n49,294,052\n\n47,356,678\n\n')) return [];
  const out: ProjectEvaluation[] = [];
  for (const r of OGATA_GRANT_ROWS) {
    if (!isUnique(t, r.nameRaw) || !isUnique(t, r.amountRaw)) continue;
    const p = project(input, r.name, r.name, 2024, r.nameRaw, t.indexOf(r.nameRaw));
    p.projectCode = null;
    p.evidence.push(evidence(input, OGATA_GRANT_HEAD, 0));
    p.amounts.push(yen(input, 'actual', r.fy, r.value, r.amountRaw, t.indexOf(r.amountRaw)));
    p.warnings.push('大潟村 令和６年度 物価高騰対応重点支援地方創生臨時交付金 実施状況及び効果検証シートの交付対象事業1行。事務事業評価ではなく交付金の効果検証。');
    p.warnings.push('抽出テキストは列が崩れているため、総事業費（円）は各行の積算根拠（③の単価×数量と事務費）の合計と一致する値を当該行の値として採用し、4行の合計が表の合計 49,294,052 と一致することを確認。交付金充当額は未収録。');
    p.warnings.push(r.fy === null ? '事業期間が年度をまたぐ（終期が令和６年度）ため、総事業費の年度は未設定。' : '事業期間（R6.4.1～R7.3.31）が令和６年度内のため総事業費を令和６年度とした。');
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 30390 印南町（教育委員会事業評価調書）
const INAMI_REPORT = 'c349859c0aa29c68a763d052';
const INAMI_HEAD = '令和７年度\n教育委員会点検評価報告書\n（令和６年度事務事業分）';
const INAMI_SHEET = '令和６年度\n\n印南町教育委員会事業評価調書';
const INAMI_OPTIONS = ['拡大する', '維持する', '見直しする', '休止する', '廃止：終了する'];

function extractInamiReport(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '30390' || input.sourceId !== INAMI_REPORT) return [];
  const t = input.text;
  if (t.indexOf(INAMI_HEAD) !== 0) return [];
  const starts = [...t.matchAll(/令和６年度\n\n印南町教育委員会事業評価調書/g)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((start, k) => {
    const end = starts[k + 1] ?? t.length, seg = t.slice(start, end);
    const nm = seg.match(/(?:\n名 |\n名\n\n|事 務 事 業 名 )([^\n]+)/);
    if (!nm) return;
    let name = nm[1].trim(), nameRaw = nm[0].replace(/^\n/, ''), nameAt = start + nm.index! + (nm[0].startsWith('\n') ? 1 : 0);
    if (name.includes('〔') && !name.includes('〕')) {
      const next = seg.slice(nm.index! + nm[0].length).match(/^\n([^\n]+〕)\n/);
      if (!next) return;
      name += next[1]; nameRaw += '\n' + next[1];
    }
    const p = project(input, name, name, 2025, nameRaw, nameAt);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, INAMI_HEAD, 0));
    const dept = seg.match(/担当係名：([^\n]+)/);
    if (dept) { p.department = dept[1].trim(); p.evidence.push(evidence(input, dept[0], start + dept.index!)); }
    // 事業コスト: 決算額 = 財源内訳（国庫・県補助金・その他・一般財源）の合計が成り立つときだけ採用。
    const a = seg.indexOf('区分\n'), b = seg.indexOf('必要性（');
    if (a >= 0 && b > a) {
      const nums = [...seg.slice(a, b).matchAll(/^([\d,]+)$/gm)];
      const v = nums.map(n => toNum(n[1]));
      if (nums.length >= 3 && nums.length <= 5 && v[0] > 0 && v[0] === v.slice(1).reduce((s, x) => s + x, 0)) {
        const last = nums[nums.length - 1], raw = seg.slice(a, a + last.index! + last[0].length);
        p.amounts.push(yen(input, 'actual', 2024, nums[0][1], raw, start + a));
      }
    }
    // 事業の方向性: 選択肢5語＋最終評価（評価委員会）欄の1語。2回現れる語がちょうど1つのときだけ、それを評価委員会の最終評価とする。
    const dirFrom = seg.indexOf('拡大する\n事\n'), finalAt = seg.indexOf('最終評価');
    if (finalAt >= 0) {
      const from = dirFrom >= 0 ? dirFrom : seg.lastIndexOf('\n', seg.indexOf('( 教 育 委 員 会 )')) + 1;
      const tailEnd = seg.indexOf('印南町教育委員会\n', finalAt);
      const block = seg.slice(from, tailEnd > 0 ? tailEnd : seg.length);
      const lines = block.split('\n').map(l => l.trim());
      const counts = INAMI_OPTIONS.map(o => lines.filter(l => l === o).length);
      if (counts.filter(c => c === 2).length === 1 && counts.every(c => c <= 2)) {
        const value = INAMI_OPTIONS[counts.indexOf(2)];
        p.ratings.push({ kind: 'external', label: '事業の方向性 最終評価（評価委員会）', value, scale: '拡大する／維持する／見直しする／休止する／廃止：終了する',
          evidence: evidence(input, block.trimEnd(), start + from) });
      }
    }
    p.warnings.push('印南町 令和７年度 教育委員会点検評価報告書（令和６年度事務事業分）の事業評価調書。事業費は「事業コスト 決算額（円）」で、財源内訳の合計と一致する場合のみ令和６年度決算として採用。');
    p.warnings.push('必要性・有効性・経済効率性・目標達成度と第１次評価（Ａ～Ｄ）は選択印が抽出テキストに残らないため未収録。事業の方向性は、選択肢の語に加えて最終評価（評価委員会）欄の語が1つだけ重複して現れる場合のみ、その語を評価委員会の最終評価として収録（教育委員会の選択は未収録）。');
    out.push(p);
  });
  const names = out.map(p => p.projectName);
  return out.filter(p => names.filter(n => n === p.projectName).length === 1);
}

// ---------------------------------------------------------------- 30390 印南町（臨時交付金 効果検証シート）
const INAMI_GRANT = '0bbd861020f04402a01bb8be';
const INAMI_GRANT_HEAD = '印南町 物価高騰対応重点支援地方創生臨時交付金事業 実施状況及び効果検証シート';
const INAMI_GRANT_ROWS: { no: string; name: string; nameRaw: string; amountRaw: string; value: string; parts: string[] }[] = [
  { no: '1', name: '印南町住民税非課税世帯等に対する臨時特別給付金事業【物価高騰対策給付金】', nameRaw: '印南町住民税非課\n税世帯等に対する\n臨時特別給付金事\n業【物価高騰対策\n給付金】',
    amountRaw: 'R5.12.20\n\nR6.3.31\n\n69,864,652\n\n0\n\n69,864,652\n\n0\n\n0 交付件数：976世帯', value: '69,864,652', parts: ['0', '69,864,652', '0', '0'] },
  { no: '10', name: '印南町介護施設等物価高騰対策支援事業', nameRaw: '印南町介護施設等\n影響が大きいサービス利用者へ提供する食費について支援する。\n10 物価高騰対策支援\n②社会福祉施設が提供する食費の一部を支援。\n事業',
    amountRaw: 'R6.1.25\n\nR6.3.25\n\n2,432,000\n\n0\n\n2,432,000\n\n0\n\n0 交付件数：町内3施設', value: '2,432,000', parts: ['0', '2,432,000', '0', '0'] },
  { no: '11', name: '印南町高校生・大学生等生活応援給付金事業', nameRaw: '印南町高校生・大 対して支援する。\n11 学生等生活応援給 ②高校・大学・大学院・短期大学・高等専門学校・専修学校に在学して\n付金事業',
    amountRaw: 'R6.1.24\n\nR6.3.29\n\n28,889,044\n\n0\n\n28,889,044\n\n0\n\n0 交付件数：高校生227件、大学生173件', value: '28,889,044', parts: ['0', '28,889,044', '0', '0'] },
  { no: '12', name: '印南町認定こども園物価高騰対策支援事業', nameRaw: '印南町認定こども\n影響が大きい利用者へ提供する食費について支援する。\n12 園物価高騰対策支\n②保育施設が提供する副食費の一部を支援。\n援事業',
    amountRaw: 'R6.1.25\n\nR6.3.25\n\n443,310\n\n0\n\n443,310\n\n0\n\n0 交付件数：認定こども園1園', value: '443,310', parts: ['0', '443,310', '0', '0'] },
];

function extractInamiGrant(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '30390' || input.sourceId !== INAMI_GRANT) return [];
  const t = input.text;
  if (t.indexOf(INAMI_GRANT_HEAD) !== 0) return [];
  const out: ProjectEvaluation[] = [];
  for (const r of INAMI_GRANT_ROWS) {
    if (!isUnique(t, r.nameRaw) || !isUnique(t, r.amountRaw)) continue;
    if (toNum(r.value) !== r.parts.reduce((s, x) => s + toNum(x), 0)) continue;
    const p = project(input, r.name, r.name, null, r.nameRaw, t.indexOf(r.nameRaw));
    p.projectCode = r.no;
    p.evaluatedFiscalYear = 2023;
    p.evidence.push(evidence(input, INAMI_GRANT_HEAD, 0));
    const at = t.indexOf(r.amountRaw);
    p.amounts.push(yen(input, 'actual', 2023, r.value, r.amountRaw, at));
    const result = t.slice(at + r.amountRaw.length).match(/^\n\n([^\n]+(?:\n[^\n]+)*)/);
    if (result) p.outcomes = r.amountRaw.slice(r.amountRaw.lastIndexOf('交付件数')) + '\n' + result[1];
    p.warnings.push('印南町 物価高騰対応重点支援地方創生臨時交付金事業 実施状況及び効果検証シートの1行（No.は原文）。事務事業評価ではなく交付金の効果検証。評価実施年度は本文に明示がないため未設定。');
    p.warnings.push('事業名は抽出テキストで概要欄と交互に折り返された名称の断片を連結したもの。補助対象事業費（円）は同じ行の臨時交付金充当額・国庫補助額・起債額・その他の合計と一致することを確認して採用し、事業期間（始期・終期）がともに令和５年度内のため令和５年度実績とした。所管課は列位置が崩れているため未設定。');
    out.push(p);
  }
  return out;
}

export const entries: Record<string, Entry> = {
  '01209': { extract: extractYubari, scope: '令和６年度 教育行政点検評価報告書（令和５年度事業対象）の細目シート（事業項目）単位の事業名と、評価欄の対応が確定する場合の事業達成度・事業効果（教育委員会自己評価）。総括表（施策のまとまり）・評価委員会意見・資料は対象外。' },
  '01436': { extract: extractUryu, scope: '令和６年度 教育委員会内部・外部評価主要事務事業一覧（令和５年度実施事業対象）の各行（事業名・内部評価・今後の方向性・外部評価）。教育委員会の活動状況・議案一覧は対象外。' },
  '05368': { extract: (input) => [...extractOgataReport(input), ...extractOgataGrant(input)], scope: '令和４年度 教育委員会点検・評価報告書の主な事務事業ごとの名称と総合評価（記号の対応が確定する場合のみ）、および令和６年度 物価高騰対応臨時交付金 実施状況及び効果検証シートの交付対象事業ごとの総事業費。会議の審議状況・案内ページは対象外。' },
  '30390': { extract: (input) => [...extractInamiReport(input), ...extractInamiGrant(input)], scope: '令和７年度 教育委員会点検評価報告書（令和６年度事務事業分）の事業評価調書28件（事業名・担当係・決算額・評価委員会の最終評価の方向性）、および物価高騰対応臨時交付金 効果検証シートの交付対象事業ごとの補助対象事業費。選択印が失われた4観点評価・第１次評価は対象外。' },
};
