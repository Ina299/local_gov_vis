import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 国分寺市（事務事業評価票 監査委員事務局・教育委員会、年度の記載のない版）
// 公開済みレコード（batch7/g3 の extractKokubunji）は同じPDFの評価票から作られ、評価年度の表記がないため年度は未設定。
// この2冊は他の部と抽出テキストの形が違い、欄が空行で区切られて出る。「事業目的」のラベルの直後の塊が「事業対象」の
// ラベルの直前で終わり、句点で終わる場合だけ目的とする（ラベルが票の見出しに混ざって出た票は、細事業の欄の直後の塊が
// 「事業対象」の直前で終わる場合に限る）。事業概要は事業根拠・法令等の欄と混在するため採らない。
// 事業名は公開済みレコードと同じ規則（同じ事務事業名・所管課が複数あれば細事業名を括弧で付け、読めなければ採らない）。
const URL = /\/001\/037\/388\/1[01][a-z]+\.pdf$/;
const ID = /^事務事業評価票\n\n所管課\n\n事業番号\n\n(事業目的\n\n)?(\d{7})\n\n([^\n]+)\n\n([^\n]+)\n\n事務事業\n/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13214' || !URL.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(/^事務事業評価票\n/gm)];
  const sheets: { p: ProjectEvaluation; sub: { v: string; raw: string; at: number } | null }[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const start = heads[i].index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const id = ID.exec(seg);
    if (!id || !/^-\d+-$/m.test(seg)) continue;
    const target = seg.indexOf('\n\n事業対象\n');
    if (target < 0) continue;
    const head = seg.slice(0, target);
    // 目的の塊: 「事業目的」ラベルの直後（見出しに混ざった票は細事業の欄の直後）から「事業対象」の直前まで。
    const m = id[1] ? /\n細事業\n\n((?:[^\n]+\n)*?[^\n]+)$/.exec(head) : /\n事業目的\n\n((?:[^\n]+\n)*?[^\n]+)$/.exec(head);
    if (!m || (head.match(/^事業目的$/gm) ?? []).length !== 1 || !/[。．.]$/.test(m[1]) || /^(事業目的|細事業|事務事業|―)$/m.test(m[1])) continue;
    const p = project(input, `${id[2]}:narrative`, id[4], null, id[0], start);
    p.projectCode = id[2];
    p.department = id[3];
    p.purpose = unwrap(m[1]);
    p.evidence.push(evidence(input, `${m[0].slice(1)}\n\n事業対象`, start + m.index + 1));
    p.warnings.push('事務事業評価票の「事業目的」欄（「事業目的」ラベルの直後から「事業対象」ラベルの直前までの文）。欄の幅で折り返した改行だけを除いた。');
    const before = seg.match(/\n([^\n]*事務事業)\n\n細事業\n/), after = seg.match(/\n細事業\n\n([^\n]*事務事業)\n/);
    const s = before && !after ? before : after && !before ? after : null;
    sheets.push({ p, sub: s && s[1] !== '事務事業' ? { v: s[1], raw: s[0], at: start + s.index! } : null });
  }
  // 同じ事業番号の票が重複していれば採らない。同じ事務事業名・所管課の票は細事業名で区別する（公開済みレコードと同じ）。
  const once = sheets.filter(a => sheets.filter(b => b.p.projectCode === a.p.projectCode).length === 1);
  const out: ProjectEvaluation[] = [];
  for (const a of once) {
    const group = once.filter(b => b.p.projectName === a.p.projectName && b.p.department === a.p.department);
    if (group.length === 1) { out.push(a.p); continue; }
    if (!a.sub) continue;
    const name = `${a.p.projectName}（${a.sub.v}）`;
    if (group.filter(b => b.sub && `${b.p.projectName}（${b.sub.v}）` === name).length !== 1) continue;
    a.p.evidence.push(evidence(input, a.sub.raw, a.sub.at));
    out.push({ ...a.p, projectName: name });
  }
  return out;
}

export const entry = {
  extract,
  scope: '国分寺市 事務事業評価票（監査委員事務局・教育委員会、評価年度の表記のない版）: 事業目的（目的）。年度の記載がない公開済みレコードと同じ資料。',
};
