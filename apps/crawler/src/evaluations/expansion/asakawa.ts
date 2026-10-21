import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, project, evidence } from './shared';
// Reviewed boundaries in the saved 2021 education report. Column-interleaved prose stays literal.
const rows = [
 ['成人式','○成人式 完了','○花いっぱい運'],
 ['花いっぱい運動','○花いっぱい運','○文化祭、芸能祭'],
 ['文化祭、芸能祭','○文化祭、芸能祭','②文化財案内看板'],
 ['文化財案内看板設置工事','②文化財案内看板','◎青少年健全育成'],
 ['チャレンジ少年教室','① チャレンジ少年教','②青少年健全育成'],
 ['青少年健全育成活動','②青少年健全育成','（１）教育施策の計画的推進について'],
 ['町教育協議会への研修補助と総合的な学習の時間取り組み補助','◎町教育協議会へ','◎県中教育事務所の'],
 ['県中教育事務所の要請指導訪問','◎県中教育事務所の','◎町教育委員会学校'],
 ['町教育委員会学校訪問','◎町教育委員会学校','-8-'],
 ['全国学力・学習状況調査等の分析と指導の改善','◎全国学力・学習状','◎漢字検定の実施'],
 ['漢字検定の実施','◎漢字検定の実施','◎GIGA スクール構'],
 ['GIGAスクール構想により配置したICT機器の活用と促進','◎GIGA スクール構','-9-'],
 ['浅川小中学校校舎整備事業','◎浅川小中学校校舎整備','◎GIGA スクール構想 GIGA'],
 ['GIGAスクール構想','◎GIGA スクール構想 GIGA','○新型コロナウイルス感染'],
 ['新型コロナウイルス感染症対応事業','○新型コロナウイルス感染 小学校学','◎公立学校施設災害復旧事'],
 ['公立学校施設災害復旧事業','◎公立学校施設災害復旧事','- 11 -'],
 ['浅川小学校','◎浅川小学校 完了','◎浅川中学校 完了'],
 ['浅川中学校','◎浅川中学校 完了','- 12 -'],
 ['あさかわこども園','◎あさかわこども園 完了','◎学校給食センター 完了'],
 ['学校給食センター','◎学校給食センター 完了','② 社会教育施設・社会体'],
 ['中央公民館耐震補強事業','○中央公民館耐震補強','○その他工事 完了'],
 ['中央公民館その他工事・管理備品整備','○その他工事 完了','- 13 -'],
 ['歴史民俗資料館','◎歴史民俗資料館 完了','◎あさかわ図書館 完了'],
 ['あさかわ図書館','◎あさかわ図書館 完了','◎町民グラウンド 完了'],
 ['町民グラウンド','◎町民グラウンド 完了','◎町民体育館 完了'],
 ['町民体育館','◎町民体育館 完了','◎町営プール 完了'],
 ['町営プール','◎町営プール 完了','◎町武道館 完了'],
 ['町武道館','◎町武道館 完了','- 14 -'],
] as const;
export function extractAsakawa(input: CachedInput): ProjectEvaluation[] {
 if(input.municipalityCode!=='07504'||input.sourceId!=='519f5827b43940e59ccfc9e2')return [];
 const heading='令和３年度浅川町教育委員会事務の点検・評価報告書';
 if(!input.text.startsWith(heading))return [];
 return rows.flatMap(([name,start,end])=>{
  const at=input.text.indexOf(start),to=input.text.indexOf(end,at+start.length);
  if(at<0||to<0)return [];
  const raw=input.text.slice(at,to).trimEnd(),grade=raw.match(/[ＡＢＣＤ]/);
  if(!grade)return [];
  const p=project(input,start,name,null,raw,at);p.projectCode=null;p.evaluatedFiscalYear=2021;
  p.evidence.push(evidence(input,heading,0));
  p.ratings.push({kind:'self',label:'事業別評価',value:grade[0],scale:'Ａ：計画通りに推進し十分成果／Ｂ：大体計画通りで成果／Ｃ：改善の余地／Ｄ：見直しが必要',evidence:evidence(input,raw,at)});
  p.warnings.push('教育委員会点検評価の事業欄を部分構造化。施設名の行は当年度の施設・設備整備のまとまりで、施設全体の運営評価ではない。横並びの所見は原文に保持し、個別成果文章や数値に分離していない。重点施策の評点・委員総括・教育予算合計は転用しない。報告書の日付を評価実施年度へ転用せず不明とした。');
  return [p];
 });
}
