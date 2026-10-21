import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { type Extract, amount, eraYear, municipality, num, rating } from './h6-util';

/* 教育委員会の点検・評価（地方教育行政法26条）のうち、事務事業ごとの点検・評価シート／結果一覧がある報告書。 */

/* ---------- 32203 出雲市 教育委員会事務事業点検・評価シート（令和3〜6年度） ---------- */

const IZUMO_LABEL = /^(事 ?務 ?事 ?業 ?名|担 ?当 ?課 ?名|担当 課名|[RＲ]\s?[0-9０-９]+|.{1,2})$/;
const IZUMO_DEPT = /^(\S+課|出雲科学館)$/;

/** シート冒頭（事業名・担当課の欄）だけを使い、ラベル・年度記号・1〜2字の断片を除いた残りの行を事業名とする。 */
function izumo(input: CachedInput): ProjectEvaluation[] {
  const title = /^(令和)([０-９0-9]+)年度（[０-９0-9]{4}）\n+教育委員会の事務の\n管理執行状況の点検・評価\n報 告 書/.exec(input.text);
  if (!title) return [];
  const fy = eraYear(title[1], title[2]);
  const out: ProjectEvaluation[] = [];
  for (const m of input.text.matchAll(/教育委員会事務事業点検・評価シート\n([\s\S]*?)\n\n第[３４]期出雲市教育振興計画における位置付け/g)) {
    const head = m[1], lines = head.split('\n').filter(l => l !== '');
    const depts = lines.filter(l => IZUMO_DEPT.test(l)), rest = lines.filter(l => !IZUMO_DEPT.test(l) && !IZUMO_LABEL.test(l));
    if (depts.length !== 1 || !rest.length || rest.length > 2 || head.length > 200) continue;
    const name = rest.join('').normalize('NFKC').replace(/\s/g, '').replace(/\(/g, '（').replace(/\)/g, '）');
    if (!/(事業|プラン（事務関係）|の充実|の推進)(（[^（）]+）)?$/.test(name)) continue;
    const start = m.index! + '教育委員会事務事業点検・評価シート\n'.length;
    const p = project(input, name, name, null, head, start);
    p.projectCode = null; p.department = depts[0]; p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, title[0], 0));
    p.warnings.push('出雲市教育委員会「教育委員会の事務の管理執行状況の点検・評価報告書」の事務事業点検・評価シート。評価対象年度は表題の年度、評価実施年度は本文に明示がないため未設定。',
      '事業名・担当課はシート冒頭の欄から取り、括弧は全角に統一。事業費（予算・決算の内訳表）は抽出テキストで行と列の並びがシートごとに異なり対応が確定できないため未構造化。自己評価・有識者評価は文章のため未構造化。');
    out.push(p);
  }
  return out;
}

/* ---------- 01228 深川市 教育委員会の活動状況に関する点検･評価報告書（令和7年度） ---------- */

const FUKAGAWA_ROW = /\n\n([0-9０-９]{1,2})\n\n([^\n]+(?:\n[^\n]+)?)\n\n([ＡＢＣＤ])\n\n([ＡＢＣＤ])\n\n([①-⑤])(?=\n)/g;
const FUKAGAWA_GRADE = 'Ａ：順調である／Ｂ：おおむね順調である／Ｃ：一部困難な問題点（課題）がある／Ｄ：困難な問題点（課題）がある';
const FUKAGAWA_TOTAL = '①：充実･拡大／②：現状維持（見直し含む）／③：統合･代替／④：移管･縮小／⑤：休止･廃止･完了';

function fukagawa(input: CachedInput): ProjectEvaluation[] {
  const title = /^令和([０-９0-9]+)年度\n\n深川市教育委員会の活動状況\nに関する点検･評価報告書/.exec(input.text);
  const scope = /(令和([０-９0-9]+)年度)の「教育行政方針」に掲げる主要施策の推進に基づき実施した事務\n事業の内、主たる１０の事務事業を点検及び評価対象事業としました。/.exec(input.text);
  const a = input.text.indexOf('１．点検及び評価の結果一覧\n推進'), b = input.text.indexOf('３．点検及び評価結果の集計', a);
  if (!title || !scope || a < 0 || b < 0 || title[1] !== scope[2]) return [];
  const rows = [...input.text.slice(a, b).matchAll(FUKAGAWA_ROW)];
  if (rows.length !== 10) return [];
  return rows.map(r => {
    const at = a + r.index! + 2, raw = r[0].slice(2), name = r[2].replace(/\n/g, '');
    const p = project(input, r[1], name, null, raw, at);
    p.projectCode = null; p.evaluatedFiscalYear = eraYear('令和', scope[2]);
    p.evidence.push(evidence(input, scope[0], scope.index));
    p.ratings.push(rating(input, 'self', '達成度', r[3], FUKAGAWA_GRADE, raw, at), rating(input, 'self', '効果度', r[4], FUKAGAWA_GRADE, raw, at),
      rating(input, 'self', '総合評価', r[5], FUKAGAWA_TOTAL, raw, at));
    p.warnings.push('深川市教育委員会 点検･評価報告書（令和７年度）の「点検及び評価の結果一覧」の行。評価対象年度は「令和７年度の教育行政方針に基づき実施した事務事業」による。評価実施年度は本文に明示がないため未設定。',
      '所管課（学務課・生涯学習スポーツ課）は縦書きの欄で行との対応が確定できないため未設定。巻末の事務事業点検評価シートは抽出テキストに含まれないため予算・決算額は未構造化。');
    return p;
  });
}

/* ---------- 01455 比布町 事務事業点検・評価調書（令和6年度） ---------- */

const PIPPU_SCALE = 'Ａ：想定どおりの成果が得られたもの／Ｂ：想定した成果はほぼ得られたが、さらなる改善が必要と考えられるもの／Ｃ：想定した成果が十分には得られず、見直しなどの検討が必要なもの／Ｄ：想定した成果が得られず、早急に見直しなどの検討を進めるべきもの';

function pippu(input: CachedInput): ProjectEvaluation[] {
  if (!/^令和６年度\s+比布町教育委員会の\s+権限に属する事務の管理及び\s+執行状況の点検・評価/.test(input.text)) return [];
  const heads = [...input.text.matchAll(/(令和(６)年度) 事務事業点検・評価調書\n/g)], out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    const start = h.index!, sheet = input.text.slice(start, heads[i + 1]?.index ?? input.text.length);
    const id = /\n((?:学|社|ス)－[0-9０-９]+)\n/.exec(sheet), unit = /事務事業実施係\n+(?:番号\n+)?(\S+係)\n/.exec(sheet);
    const cost = /決算額\n\n([\d,]+ |－)円/.exec(sheet), grade = /【評 価】\n\n([ＡＢＣＤ])(?:\n|$)/.exec(sheet);
    const label = sheet.indexOf('\n決算額\n');
    if (!id || !unit || label < 0 || sheet.split('事業名').length !== 2) return;
    // 事業名は番号から決算額欄までの間にある「…事業（…）」の行。調書により関連計画欄の前後に位置が入れ替わる。
    const names = [...sheet.slice(0, label + 1).matchAll(/\n([^\n]+事業(?:（[^（）\n]+）)?)\n/g)].filter(m => m.index! > id.index);
    if (names.length !== 1) return;
    const name = names[0][1];
    const p = project(input, id[1], name, null, name, start + names[0].index! + 1);
    p.evaluatedFiscalYear = eraYear('令和', h[2]); p.department = unit[1];
    p.evidence.push(evidence(input, id[1], start + id.index + 1), evidence(input, h[0].trimEnd(), start), evidence(input, unit[0].trim(), start + unit.index));
    if (cost && cost[1] !== '－') p.amounts.push(amount(input, 'actual', p.evaluatedFiscalYear, cost[1].trim(), '円', cost[0], start + cost.index));
    if (grade) p.ratings.push(rating(input, 'self', '評価', grade[1], PIPPU_SCALE, grade[0].trimEnd(), start + grade.index));
    p.warnings.push('比布町教育委員会 令和６年度 事務事業点検・評価調書。評価対象年度は調書表題の令和６年度、評価実施年度は本文に明示がないため未設定。事業番号（学－１等）を projectCode に記録。',
      '事業費は調書の決算額（円、令和６年度）。決算額が「－円」の調書と、金額が決算額欄の直後にない（他欄の後ろに離れて出る）調書は金額なし。評価はＡ〜Ｄの4段階（本文の基準を scale に転記）。');
    out.push(p);
  });
  return out;
}

/* ---------- 30404 上富田町 教育委員会点検評価報告書（令和6年度事務事業分） ---------- */

function kamitonda(input: CachedInput): ProjectEvaluation[] {
  const title = /^令和 ([0-9]+) 年度\n\n上富田町教育委員会点検評価報告書\n\(令和 ([0-9]+) 年度事務事業分\)/.exec(input.text);
  const a = input.text.indexOf('教育委員会評価対象事業一覧表\n基本施策'), b = input.text.indexOf('教育委員会事務事業評価一覧表\n\n教育と文化の町づくり', a);
  if (!title || a < 0 || b < 0) return [];
  const names = [...input.text.slice(a, b).matchAll(/^(\S+(?:事業|の運営|まつり))$/gm)].filter(m => m[1] !== '教育委員会評価対象事業');
  if (names.length !== 37) return [];
  return names.map(m => {
    const p = project(input, m[1], m[1], Number(title[1]) + 2018, m[1], a + m.index!);
    p.projectCode = null; p.evaluatedFiscalYear = Number(title[2]) + 2018;
    p.evidence.push(evidence(input, title[0], 0));
    p.warnings.push('上富田町教育委員会 令和7年度点検評価報告書（令和6年度事務事業分）の「教育委員会評価対象事業一覧表」（37事業）の事業名。',
      '事務事業評価一覧表の判定（数値）・今後の方向性・判定理由は、抽出テキストで事業名の折返しと判定欄の位置が行ごとに対応づけられないため未構造化。番号は一覧表の順番と事業名の並びが一致しないため記録しない。');
    return p;
  });
}

/* ---------- 06323 朝日町（山形） 教育委員会事務事業点検・評価報告書（平成21年度分） ---------- */

const ASAHI_DIRECTIONS = /○ ?(拡充|継続|縮小|見直し|休廃止)\n/g;
const ASAHI_NEED = /○ ?(適切に対応している|概ね対応できている|ほとんど対応できていない)\n/g;
const ASAHI_EFFECT = /○ ?(十分効果が得られている|ある程度の効果が得られている|効果があまり得られていない)\n/g;

function asahi(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, title = /^平成 (\d+) 年度\n\n朝日町教育委員会事務事業点検・評価報告書\n（平成 (\d+) 年度分）/.exec(t);
  const la = t.indexOf('Ⅴ．点検・評価対象事業一覧'), lb = t.indexOf('事務事業点検・評価調書\n１．事務事業名', la);
  if (!title || la < 0 || lb < 0) return [];
  const listed = new Set(t.slice(la, lb).split('\n').filter(l => l.length > 2 && !/^教育文化課|^[\d－]/.test(l)));
  const heads = [...t.matchAll(/事務事業点検・評価調書\n１．事務事業名\n事務事業名\n/g)], out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    const start = h.index!, sheet = t.slice(start, heads[i + 1]?.index ?? t.length), headEnd = sheet.indexOf('\n柱\n');
    if (headEnd < 0) return;
    const head = sheet.slice(0, headEnd);
    const nameLine = /事務事業名\n\n(?:所管課・係\n\n)?([^\n]+)\n/.exec(head), depts = [...head.matchAll(/\n(教育文化課\S+)\n/g)];
    if (!nameLine || !listed.has(nameLine[1]) || depts.length !== 1) return;
    const p = project(input, nameLine[1], nameLine[1], Number(title[1]) + 1988, nameLine[0].trim(), start + nameLine.index);
    p.projectCode = null; p.evaluatedFiscalYear = Number(title[2]) + 1988; p.department = depts[0][1];
    p.evidence.push(evidence(input, depts[0][1], start + depts[0].index! + 1), evidence(input, title[0], 0));
    // 予算額・決算額欄: 値は直後のラベルの前に出る（当初→「補正予算額」の前、補正→「合計」の前、合計→「決算額」の前、決算額は「決算額」以降の最初の数値行）。
    const sa = sheet.indexOf('４．予算額・決算額'), sb = sheet.indexOf('５．事業の評価', sa);
    if (sa >= 0 && sb > sa) {
      const sec = sheet.slice(sa, sb), unit = /（\S位：千円 千円未満切上げ）/.test(sec);
      const tou = /(-?[\d,]+) 補正予算額/.exec(sec), hosei = /(-?[\d,]+) 合計/.exec(sec), total = /(-?[\d,]+) 決算額/.exec(sec);
      const after = total ? /\n([\d,]+)(?:\n|$)/.exec(sec.slice(sec.indexOf('決算額') + 3)) : null;
      const ok = unit && tou && total && after && num(tou[1]) + (hosei ? num(hosei[1]) : 0) === num(total[1]);
      if (ok) {
        const kAt = sec.indexOf('決算額') + 3 + after.index + 1, raw = sec.slice(0, kAt + after[1].length);
        const fy = p.evaluatedFiscalYear;
        p.amounts.push(amount(input, 'budget', fy, tou[1], '千円', raw, start + sa), amount(input, 'actual', fy, after[1], '千円', raw, start + sa));
      }
    }
    for (const [re, label] of [[ASAHI_NEED, '必要性'], [ASAHI_EFFECT, '有効性・効率性'], [ASAHI_DIRECTIONS, '今後の方向性']] as const) {
      const ms = [...sheet.matchAll(re)];
      if (ms.length === 1) p.ratings.push(rating(input, 'self', label, ms[0][1], null, ms[0][0].trimEnd(), start + ms[0].index!));
    }
    p.warnings.push('朝日町教育委員会 平成22年度事務事業点検・評価報告書（平成21年度分）の事務事業点検・評価調書。事業名は点検・評価対象事業一覧にあるものだけ。',
      '予算額・決算額（単位千円・千円未満切上げ）は当初予算額＋補正予算額＝合計が成り立つ調書だけ、当初予算額を予算、決算額を実績として平成21年度で記録。評価は「○」の付いた選択肢が1つに定まる項目だけ。');
    out.push(p);
  });
  return out;
}

export const entries: Record<string, { extract: Extract; scope: string }> = {
  '32203': { extract: municipality('32203', izumo), scope: '出雲市教育委員会 点検・評価報告書（令和3〜6年度）の教育委員会事務事業点検・評価シートの事業名・担当課・評価対象年度。事業費の内訳表・事業実績・自己評価／有識者評価の文章・評価対象事業一覧表は対象外。' },
  '01228': { extract: municipality('01228', fukagawa), scope: '深川市教育委員会 点検･評価報告書（令和7年度）の点検及び評価の結果一覧（10事務事業）の事業名・達成度・効果度・総合評価。所管課（縦書き欄）・集計表・点検評価者の意見・教育行政方針は対象外。' },
  '01455': { extract: municipality('01455', pippu), scope: '比布町教育委員会 令和6年度 事務事業点検・評価調書の事業番号・事業名・実施係・決算額・評価（Ａ〜Ｄ）。総括表の主な評価・意見、調書の目的・実施内容・成果の文章と教育委員会議の開催状況は対象外。' },
  '30404': { extract: municipality('30404', kamitonda), scope: '上富田町教育委員会 点検評価報告書（令和6年度事務事業分）の評価対象事業一覧表の事業名（37事業）。事務事業評価一覧表の判定・今後の方向性・判定理由と基本方針・評価委員の意見は対象外。' },
  '06323': { extract: municipality('06323', asahi), scope: '朝日町（山形県）教育委員会 事務事業点検・評価調書（平成21年度分）の事業名・所管課係・当初予算額と決算額・必要性/有効性効率性/今後の方向性の選択結果。事業の実施状況・評価の理由の文章と外部評価委員の意見は対象外。' },
};
