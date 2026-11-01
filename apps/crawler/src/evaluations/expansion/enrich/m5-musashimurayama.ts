import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 武蔵村山市（令和6・7年度 事務事業評価調書・補助金等評価調書）
// 公開済みレコードは同じ分野別PDF（と行政評価報告書）の調書から作られ、目的・内容が空欄。抽出テキストは欄ごとの段落
// （空行区切り）に分かれ、「目的」「内容」のラベルの直後の段落がそれぞれの欄の文。ラベル「目的」の段落があるものだけを扱い、
// 内容は次の段落が既知のラベル（指標名・評価指標・SDGsの取組・単位・対象（交付先）・内線・係）で始まる場合だけ採る
// （それ以外は内容の続き（施設名の一覧など）が別の段落に分かれている可能性がある）。
const HEAD = /(?:^|\n)(事務事業|補助金等)名 ([^\n]+)\n/g;
const NEXT = /^(?:指標名|評 1|SDGsの取組|単位|対象（交付先）|内線|係)/;
// 右の「SDGsの取組」欄（ラベルと「番号 目標名」）は段落の行の間や行末に混じる。目標名は決まった17語なので取り除き、
// それでも残るものは採らない。
const GOALS = ['貧困をなくそう', '飢餓をゼロに', 'すべての人に健康と福祉を', '質の高い教育をみんなに', 'ジェンダー平等を実現しよう',
  '安全な水とトイレを世界中に', 'エネルギーをみんなに そしてクリーンに', '働きがいも経済成長も', '産業と技術革新の基盤をつくろう',
  '人や国の不平等をなくそう', '住み続けられるまちづくりを', 'つくる責任 つかう責任', '気候変動に具体的な対策を', '海の豊かさを守ろう',
  '陸の豊かさも守ろう', '平和と公正をすべての人に', 'パートナーシップで目標を達成しよう'];
const GOAL = new RegExp(`(?:^| )\\d{1,2} (?:${GOALS.join('|')})$`);
const SDGS = /SDGs|(?:^|\s)\d{1,2} (?:貧困を|飢餓を|すべての人に|質の高い|ジェンダー|安全な水|エネルギー|働きがい|産業と|人や国|住み続け|つくる責任|気候変動|海の豊か|陸の豊か|平和と|パートナー)/m;

/** 段落の行から SDGs の欄の語を除いてつなぐ。除けないものが残れば null。 */
function clean(para: string): string | null {
  const lines = para.split('\n').filter(l => l !== 'SDGsの取組').map(l => { while (GOAL.test(l)) l = l.replace(GOAL, ''); return l; }).filter(Boolean);
  const text = lines.join('');
  return text.endsWith('。') && !SDGS.test(lines.join('\n')) ? text : null;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  // 年度は資料（令和6・7年度の公表ページの r6・r7 で始まるPDF）ごとに一つ。行政評価報告書（houkokusho）は分野別PDFの
  // 再掲で、公開済みレコードは分野別PDFから作られているため使わない。
  const doc = /\/_page_\/001\/02[01]\/9(?:43|68)\/r([67])[a-z_0-9]+\.pdf$/.exec(input.sourceUrl);
  if (input.municipalityCode !== '13223' || !doc || /houkokusho/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    // 調書の範囲は次の調書の見出し（「令和N年度…評価調書」）まで（目的のラベルがない調書で次の調書の欄を拾わないため）。
    const h = heads[i], start = h.index! + (h[0].startsWith('\n') ? 1 : 0);
    const nextHead = t.slice(start).search(/\n(?:武蔵村山市(?:\n\n| ))?令和[６７]年度(?:事務事業|補助金等)評価調書\n/);
    const seg = t.slice(start, Math.min(heads[i + 1]?.index ?? t.length, nextHead < 0 ? t.length : start + nextHead));
    const m = /\n目的\n\n([^\n]+(?:\n[^\n]+)*)\n\n内容\n\n([^\n]+(?:\n[^\n]+)*)\n\n([^\n]*)/.exec(seg);
    const purpose = m && clean(m[1]);
    if (!m || !purpose) continue;
    const dept = /\n所管部署\n[^\n]+ 部\n([^\n]+) 課\n/.exec(seg);
    const r7 = doc[1] === '7', name = h[2].trim();
    // IDは公開済みレコード（同じ資料）と別にする（同じIDのシートは補強の対象外になるため）。
    const p = project(input, `${h[1]}:${name}:narrative`, name, r7 ? 2025 : 2024, h[0].trim(), start);
    p.projectCode = null;
    p.evaluatedFiscalYear = r7 ? 2024 : 2023;
    p.department = dept ? `${dept[1]}課` : null;
    p.purpose = purpose;
    if (NEXT.test(m[3])) p.activities = clean(m[2]);
    const raw = p.activities ? m[0].slice(1, m[0].length - m[3].length - 2) : m[0].slice(1, m[0].indexOf('\n\n内容\n\n'));
    p.evidence.push(evidence(input, raw, start + m.index! + 1));
    p.warnings.push('評価調書の「目的」「内容」欄（ラベル直後の段落。行の間に混じるSDGsの欄の目標名は除いた）。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '武蔵村山市 令和6・7年度 事務事業評価調書・補助金等評価調書: 目的・内容（目的・事業内容）。',
};
