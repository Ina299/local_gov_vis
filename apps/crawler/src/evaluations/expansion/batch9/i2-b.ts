import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { mergeReprints, sheets } from '../batch7/g1-util';

const flat = (s: string) => s.replace(/\n/g, '');

/** 青森市 教育委員会事務の点検及び評価報告書（令和5〜8年度）の目次「目次・主要事業名／担当課名」の各行。 */
const AOMORI = new Set(['3586bbf0482ef66d2e5692a4', '28846e1821569c0f9e8ca69b', '15bdf9092d2f14e9ee846829', 'd306f848bddf3a3f368f1693']);
export function extractAomori(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '02201' || !AOMORI.has(input.sourceId)) return [];
  const t = input.text;
  const head = t.match(/R(\d)年度主要な施策の成果に係る報告書（抜粋）・R(\d)年度事務点検資料/);
  const a = t.indexOf('目次・主要事業名'), b = t.indexOf('【参考】青森市総合計画');
  if (!head || a < 0 || b < a || Number(head[2]) !== Number(head[1]) + 1) return [];
  const out: ProjectEvaluation[] = [];
  const toc = t.slice(a, b);
  for (const m of toc.matchAll(/(?<=\n)([^\n]+)\n\n([^\s]+?(?:課|センター|図書館))((?: |\n\n)事務点検用追加事業)?(?=\n)/g)) {
    const name = m[1];
    if (/総合計画|振興計画|施策|事務点検|^※|^【|^\d+$|担当課名|^項$/.test(name)) continue;
    const at = a + m.index!;
    const p = project(input, `${m[2]}:${name}`, name, 2018 + Number(head[2]), m[0], at);
    p.department = m[2]; p.evaluatedFiscalYear = 2018 + Number(head[1]);
    p.evidence.push(evidence(input, head[0], head.index!));
    p.warnings.push('点検・評価報告書の目次（主要事業名・担当課名）から事業名と担当課のみ収録。評価年度・対象年度は「R◯年度主要な施策の成果に係る報告書（抜粋）・R◯年度事務点検資料」の表記による。本文の決算額・成果の説明・今後の方向性は段組みが崩れ事業との対応が確定できないため未構造化。');
    if (m[3]) p.warnings.push('目次で「事務点検用追加事業」と表示された事業（主要な施策の報告書以外に事務点検のため追加された事業）。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

/** 日高市 行政評価書の「事務事業評価」表（事務事業名・担当課・経費・評価ランク・成果説明書頁）の各行。 */
// 同じ行政評価書に綴じられた施策評価の見出し（「令和６年度の主な成果と課題」）で対象年度が確認できる2分冊のみ。
// 年度表記のない分冊（1-14.pdf, sisaku14-26.pdf, 04_R8…, 05_R8…）は同名事業が年度不明のまま重複するため対象外。
const HIDAKA = new Set(['dde35082ce9aef602ee43dfe', '724cb9c2e010f8684262bf68']);
export function extractHidaka(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11242' || !HIDAKA.has(input.sourceId)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const header = '事務事業名\n担当課\n経費※単位＝千円\n\n評価\nランク';
  const fy = t.match(/令和６年度\n?の主な\n?成果と課題/);
  if (!t.includes(header) || !fy) return [];
  // 担当課の直後に（評価ランク）・経費・成果説明書頁が続く行を起点に、直前の区切り（頁番号・空行・見出し）までの1〜2行を事業名とする。
  for (const m of t.matchAll(/(?<=\n)([^\n\s]{2,15}(?:課|室|所|館|センター|局))\n(?:\n([ＡＢＣ])\n\n)?([\d,]+)\n(\d+|―)(?=\n)/g)) {
    const lines = t.slice(0, m.index! - 1).split('\n'), name: string[] = [];
    let bounded = false;
    while (lines.length && name.length < 3) {
      const l = lines.pop()!;
      if (/^(?:\d+|―|主要な施策の成果説明書頁|)$/.test(l)) { bounded = true; break; }
      name.unshift(l);
    }
    if (!bounded || !name.length || name.length > 2 || name.some(l => /[。]/.test(l) || l.length > 22)) continue;
    const nm = name.join('');
    if (!/(事業|事務|業務|費|金|手当|制度)(（[^）]+）|【[^】]+】)?$/.test(nm)) continue;
    const nameRaw = name.join('\n'), nameAt = m.index! - 1 - nameRaw.length;
    const p = project(input, `${m[1]}:${nm}`, nm, null, `${nameRaw}\n${m[0]}`, nameAt);
    p.department = m[1]; p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, header, t.indexOf(header)), evidence(input, fy[0], fy.index!));
    if (m[2]) p.ratings.push({ kind: 'self', label: '評価ランク', value: m[2], scale: '総合点（42点満点）に基づくランク：Ａ 42〜36点／Ｂ 35〜29点／Ｃ 28〜14点', evidence: evidence(input, m[0], m.index!) });
    p.warnings.push('事務事業名・担当課・経費・成果説明書頁が連続して読める行のみ収録。評価ランクはその行の中に現れた場合のみ（段組みで別位置に出たランクは対応が確定できないため未収録）。対象年度は同じ分冊に綴じられた施策評価の「令和６年度の主な成果と課題」による（評価年度は資料に明記がないため未設定）。経費（決算額を千円単位に丸めた値）は事務事業評価表に年度表記がないため未収録。評価すべき事項・改善すべき事項の本文は未構造化。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

/** 小城市 第２次小城市総合計画後期基本計画 実施計画進捗管理シートの各行（予算番号・事務事業名・担当課）。 */
const OGI: Record<string, number> = { '4b01748102703dc7e83c94cc': 2022, '0e745b1131b7e4e2977f93ac': 2023, '4046e04f86eac11d127f9f82': 2024 };
const WAREKI = ['令和４年度', '令和５年度', '令和６年度'];
export function extractOgi(input: CachedInput): ProjectEvaluation[] {
  const fy = OGI[input.sourceId];
  if (input.municipalityCode !== '41208' || !fy) return [];
  const t = input.text, label = WAREKI[fy - 2022];
  if (!t.startsWith(label) || !t.includes('実施計画進捗管理シート')) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(/(?<=\n)(\d{1,5}|上水|下水) ([^\n]+)\n\n([^\s]+?(?:課|室|局|センター|所))(?=\n)/g)) {
    const p = project(input, `${m[1]}:${m[2]}`, m[2], null, m[0], m.index!);
    p.department = m[3]; p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, label, 0), evidence(input, '実施計画進捗管理シート', t.indexOf('実施計画進捗管理シート')));
    p.warnings.push(`予算番号・事務事業名・担当課が1行にまとまって読める行のみ収録。対象年度は資料冒頭の「${label}」（実施計画進捗管理シートの年度）による。取組実績と今後の方向性の本文は2列が行単位で混ざって抽出されているため未構造化。`);
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

/** 多賀城市 令和５年度主要な施策の成果に関する報告書＜その３＞の「事務事業一覧」各行（事務事業評価表は画像のみ）。 */
export function extractTagajo(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '04209' || input.sourceId !== 'f51a81cc2766349328e8560e') return [];
  const t = input.text, title = '令和５年度\n主要な施策の成果に関する報告書\n＜ その３ ＞\n\n（事務事業評価表）';
  const titleAt = t.indexOf(title), listAt = t.indexOf('３\n\n事務事業一覧\n\n主要な施策として本報告書に事務事業評価表を掲載している事務事業の一覧です。');
  if (titleAt < 0 || titleAt > 10 || listAt < 0) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of t.slice(listAt).matchAll(/(?<=\n)(0[1-7])\n\n(0[1-9])\n\n(\d\d) ([^\n]+)\n\n([^\n]+?(?:課|室|局|センター))\n\n(一般|下水|上水|国保|介護)\n\n(\d\d \d\d \d\d)(?=[ \n])/g)) {
    const p = project(input, `${m[1]}-${m[2]}-${m[3]}:${m[4]}`, m[4], null, m[0], listAt + m.index!);
    p.department = m[5]; p.evaluatedFiscalYear = 2023;
    p.evidence.push(evidence(input, title, titleAt));
    p.warnings.push('事務事業評価表の本体は画像で本文が抽出できないため、事務事業一覧の行（政策・施策・基本事業番号、事務事業名、担当、会計、款項目）のみ収録。対象年度は報告書表題の令和５年度による。一覧の令和5年度決算額は行との対応が段組みで崩れているため未収録。評価結果（事業状況・上位貢献等）は未収録。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

/** 綾瀬市 総合計画外部評価結果（総合計画進行管理シート）の「実施計画事業名／達成状況」の各組。 */
const AYASE = new Set(['3480bc0c045e584e98bcd3b2', '2c1b3c742e5b722ee4bbff0c', '080b55a36731e1510a559278', '8d5e569eb74316215303c9f7']);
const AYASE_SCALE = 'A：順調に推移した(目標達成又は進捗している）／B：一定の進捗がある（目標達成に向け一定の進捗がある）／C：進捗が遅れている（目標達成が遅れる可能性がある）／D：進捗が大幅に遅れている（目標達成が難しい可能性がある）';
export function extractAyase(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '14218' || !AYASE.has(input.sourceId)) return [];
  const out: ProjectEvaluation[] = [];
  for (const sh of sheets(input.text, '総合計画進行管理シート')) {
    const pj = sh.text.match(/^総合計画進行管理シート\n(?:戦略\nＰＪ名\n\n)?([^\n]+(?:\n[^\n]+)?)\n\n取り組みの方向/);
    const s = sh.text.indexOf('実施計画事業名'), e = sh.text.indexOf('【１．達成状況】');
    if (!pj || s < 0 || e < s || !sh.text.includes('【進捗状況A～D】')) continue;
    const region = sh.text.slice(s, e), base = sh.start + s;
    const chunks: { text: string; at: number }[] = [];
    let pos = 0;
    for (const c of region.split('\n\n')) { chunks.push({ text: c, at: base + pos }); pos += c.length + 2; }
    for (let i = 1; i < chunks.length; i++) {
      if (!/^[A-D]$/.test(chunks[i].text)) continue;
      const lines = chunks[i - 1].text.split('\n');
      const hdr = lines.map(l => /^(?:実施計画事業名|達成|状況)$/.test(l)).lastIndexOf(true);
      const name = lines.slice(hdr + 1);
      if (!name.length || name.length > 2 || name.some(l => l.length < 2 || /[。 ]|^ＳＴＥＰ|^[①-⑩]$|進捗状況/.test(l) || l.length > 24)) continue;
      const nameRaw = name.join('\n'), nameAt = chunks[i - 1].at + chunks[i - 1].text.length - nameRaw.length, nm = flat(nameRaw);
      const p = project(input, `${flat(pj[1])}:${nm}`, nm, null, nameRaw, nameAt);
      p.evidence.push(evidence(input, pj[0].replace(/\n\n取り組みの方向$/, ''), sh.start));
      p.ratings.push({ kind: 'self', label: '主管課による一次評価 達成状況', value: chunks[i].text, scale: AYASE_SCALE,
        evidence: evidence(input, `${nameRaw}\n\n${chunks[i].text}`, nameAt) });
      p.warnings.push('戦略プロジェクトの進行管理シートのうち、関連実施計画の「実施計画事業名」と「達成状況」が隣接して読める組のみ収録（STEP別の列の区別、担当課は未確定のため未設定）。資料本文に評価年度・対象年度の明記がないため年度は未設定。STEPの進捗状況・二次評価・外部評価はプロジェクト単位のため対象外。');
      out.push(p);
    }
  }
  return mergeReprints(out, p => p.projectCode!);
}
