import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { mergeReprints, type Entry } from '../batch9/i1-util';

// ---------------------------------------------------------------- 西宮市 公共事業評価シート（新規事業評価、1事業1シート）
// 2ページ目「【 委員会評価結果 】／【 ２次評価結果 】」（評価委員会の総合判断、4段階）の事業名と評価を構造化する。
// 事務事業評価結果報告書(Ⅳ)の別URL版（238a0bea…）は既存の構造化済み冊子（R7jimujigyou4.pdf）と同内容のため対象外。
const SOURCES = new Set(('0154a5c081221109096ac108 23ae270e32d5e6d8c158e41f 24b33a63a189eb55172a9111 2d58c71bf34bdb9ef78e808d 3babb0d16af59807e0533e72 '
  + '4515aeada994587f99603647 4a3c913f607322802eb691a0 4ba736869d20be6f2f21d8c7 4cb77292df1806eb96cf6a5f 651268589d70e00af8afb7d6 6c6dc43ca1127d6fbe18f6d3 '
  + '769fcdcbc44e2ce0140aeaef 7ce5bacf8968dce767b9e92e 8222292e258e4d362aa4f44d 8ff1ab09e59c0d802011e5f0 957d588e9b08959dd8e9d88f 9d771ff2aee82078e6cd5792 '
  + 'a1f7902782df865f5a5cddbf a6678e7358167b4e973138ea af792811f090053ae3e9fecd b0135babe1f19415c7cfe993 b380f1237f08504313ca6a02 b56b6d02029641cb5f29ba4e '
  + 'd2ccf4b8b8fdb484548176c8 ffff144a7383aa8bc13ea083').split(' '));

const OPTIONS = ['計画どおりの実施が望ましい', '計画の一部見直しが望ましい', '計画の大幅見直しが望ましい', '実施の見送り、中止が妥当である'];
const SCALE = OPTIONS.map((o, i) => `${i + 1}：${o}`).join('／');
const OPT = OPTIONS.join('|');
const CHOICES = `〔 １：計画どおりの実施が望ましい\\n\\n([1-4])\\n\\n２：計画の一部見直しが望ましい\\n\\n３：計画の大幅見直しが望ましい\\n\\n(?:４：実施の見送り、中止が妥当である 〕\\n\\n)?(${OPT})\\n`;
/** 既存の構造化レコード（事務事業評価シート）と同名・同年度で衝突するため新規側を除外。 */
const EXCLUDED = new Set(['甲東瓦木地区都市基盤整備事業|2024', '大社中学校教育環境整備事業|2024']);
const ERA: Record<string, number> = { 平成: 1988, 令和: 2018 };
// 様式1（平成27年度以降）: 年度・事業名の後に評価結果。様式2（平成25年度）: 事業名の後に「事 業 名」ラベル。様式3（平成26年度）: 評価結果見出しの後に事業名。
const FORMS = [
  new RegExp(`(平成|令和)\\n事業名\\n\\n(\\d+|元)\\n\\n年度 西宮市公共事業評価シート\\n\\n([^\\n]+)\\n\\n【 (委員会評価結果|２次評価結果) 】\\n${CHOICES}`, 'g'),
  new RegExp(`(平成) (25) 年度 西宮市公共事業評価シート\\n([^\\n]+)\\n\\n事 業 名\\n\\n【 (２次評価結果) 】\\n${CHOICES}`, 'g'),
  new RegExp(`(平成) (26) 年度 西宮市公共事業評価シート\\n【 (２次評価結果) 】\\n事業名\\n\\n([^\\n]+)\\n\\n${CHOICES}`, 'g'),
];

function one(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '28204' || !SOURCES.has(input.sourceId)) return [];
  const out: ProjectEvaluation[] = [];
  FORMS.forEach((re, form) => {
    for (const m of input.text.matchAll(re)) {
      const [era, y] = [m[1], m[2]];
      const [kind, name] = form === 2 ? [m[3], m[4]] : [m[4], m[3]];
      const [digit, label] = [m[5], m[6]];
      if (OPTIONS[Number(digit) - 1] !== label || !/事業/.test(name)) continue; // 選択番号と選択肢の文言が一致する場合のみ
      const fy = ERA[era] + (y === '元' ? 1 : Number(y));
      const nameAt = m.index! + m[0].indexOf(name);
      const p = project(input, name, name, fy, name, nameAt);
      p.projectCode = null;
      p.evidence.push(evidence(input, m[0].trimEnd(), m.index!));
      p.ratings.push({ kind: 'external', label: `公共事業評価委員会の総合判断（${kind}）`, value: `${digit}：${label}`, scale: SCALE,
        evidence: evidence(input, m[0].slice(m[0].indexOf('〔')).trimEnd(), m.index! + m[0].indexOf('〔')) });
      p.warnings.push(`${era}${y}年度 西宮市公共事業評価シート（新規の公共事業評価）。評価年度はシート表題の年度。評価対象年度の概念がないため未設定。`,
        '評価は2ページ目の評価委員会による総合判断（4段階）を、選択番号と選択肢の文言が一致する場合のみ原文ラベルで転記。',
        '予定事業費は複数年度にわたる総事業費（計画値）で単年度の予算・決算ではないため金額は転記していません。担当部署・指標・事業概要・自己評価（1次評価）欄は抽出テキストで段組みが崩れ対応が確定できないため転記していません。');
      out.push(p);
    }
  });
  return mergeReprints(out, p => `${p.projectName}|${p.evaluationYear}`).filter(p => !EXCLUDED.has(`${p.projectName}|${p.evaluationYear}`));
}

export const nishinomiyaEntries: Record<string, Entry> = {
  '28204': {
    extract: one,
    scope: '西宮市の公共事業評価シート（平成25〜令和6年度の新規公共事業評価、1事業1シート）の事業名・評価年度と、公共事業評価委員会の総合判断（4段階、原文ラベル）。予定事業費・指標・担当部署・1次（自己）評価、再評価の対応方針、委員会名簿、事務事業評価結果報告書(Ⅳ)の別URL版（既存構造化分と同内容）は対象外。',
  },
};
