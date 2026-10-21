import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** Small, individually reviewed council tables. Do not infer fiscal years from publication dates. */
export function extractReviewFiveSummaries(input: CachedInput): ProjectEvaluation[] {
  const result: ProjectEvaluation[] = [];
  const add = (code: string, name: string, year: number | null, raw: string, rating: string, kind: 'external' | 'self' = 'external') => {
    const p = project(input, code, name, year, raw);
    p.ratings.push({ kind, label: '評価・今後の方向性', value: rating, scale: null, evidence: evidence(input, raw) });
    p.warnings.push('評価対象実績年度は本文から単年度に確定できないため未設定。表の他行の意見・数値は転記していません。');
    result.push(p); return p;
  };
  if (input.municipalityCode === '20209' && input.sourceId === '4bcb5d91538cc787b2d2ef85') {
    for (const m of input.text.matchAll(/^(移住・定住促進|工場等設置補助金|奨学金返還支援|入野谷) (事業内容の見直し|現状維持|廃止)$/gm)) add(m[1], m[1], 2024, m[0], m[2]);
  }
  if (input.municipalityCode === '26206' && input.sourceId === '8ca0275e4a8eea91882d303c') {
    for (const m of input.text.matchAll(/^(\d+) ([^\n]+?) [１２３] (拡充|現状維持|見直しの上継続)/gm)) add(m[1], m[2], 2025, m[0], m[3]);
    const raw = 'コミュニティ推進経費 として働きかけられたい。\n2 ２ 現状維持\n（市政協力業務委託料）';
    if (input.text.includes(raw)) add('2', 'コミュニティ推進経費（市政協力業務委託料）', 2025, raw, '現状維持');
  }
  if (input.municipalityCode === '10521' && input.sourceId === '599196a181f4e21a39769e3a') {
    const names = ['空家対策事業','児童館運営事業','緊急通報装置設置','地球温暖化対策事業','有害鳥獣駆除事業','公園維持管理事業'];
    const values = ['275','330','351','251','316','264'];
    for (let i = 0; i < names.length; i++) {
      const score = `${i+1} ${values[i]}`;
      if (!input.text.includes(names[i]) || !input.text.includes(score)) throw new Error('Itakura reviewed row changed');
      const p = project(input, String(i+1), names[i], 2023, names[i]);
      p.ratings.push({kind:'external',label:'議会評価点（委員12人）',value:values[i],scale:'480点満点',evidence:evidence(input,score)});
      p.warnings.push('表の折返しにより説明列が混在するため、事業名と番号付き評価点のみ抽出。対象実績年度は未確定。'); result.push(p);
    }
  }
  if (input.municipalityCode === '33208' && /^事 業 名 .+について\n所管委員会 /u.test(input.text)) {
    const m = input.text.match(/^事 業 名 (.+)について\n所管委員会 ([^\n]+)\n評 価 事業内容：([^\n]+?) 予算規模：([^\n]+)/u);
    if (m) {
      const p = add(input.sourceId, m[1], null, input.text, m[3] === '見直しの上縮小' ? '見直しの上縮小する' : m[3]);
      p.ratings[0].label = `${m[2]}・事業内容`;
      p.ratings.push({kind:'external',label:`${m[2]}・予算規模`,value:m[4],scale:null,evidence:evidence(input,m[0])});
      p.outcomes = input.text.slice(m[0].length).trim();
      p.warnings.push('所管委員会は行政の担当課と区別。評価年は当該個票に記載がないため未設定。予算規模評価は金額ではありません。');
    }
  }
  if (input.municipalityCode === '33213' && ['348c5238bd8880b9604f9c0e','b540021397b2c55dcb2a42d5'].includes(input.sourceId)) {
    const year = input.sourceId === '348c5238bd8880b9604f9c0e' ? 2025 : 2024;
    const body = input.text.slice(input.text.indexOf('二次評価結果 事務事業名 部 課'));
    for (const m of body.matchAll(/^(.+?) (総合政策部|総務部|市民生活部|保健福祉部|産業振興部|建設事業部|教育委員会) ([^\n]+)$/gm)) {
      if (!m[1].trim() || m[1].startsWith('（')) continue;
      const pending = year === 2024 && /^(新イベント|お笑い赤坂亭)/.test(m[1]);
      const p = add(m[1],m[1],year,m[0],pending?'継続検討':'新規（承認）','self');
      p.department=`${m[2]} ${m[3]}`;
      p.warnings.push('次年度新規事業の事前評価。実施済みの成果とは扱いません。折返し名称の行は未抽出。');
    }
  }
  for(const p of result)p.evidence.push(evidence(input,input.text.slice(0,Math.min(300,input.text.length)),0));
  return result;
}
