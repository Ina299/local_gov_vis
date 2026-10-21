import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
const documents = new Set(['56c3d0472e60a1c6c57751fb','6d67ec9f48238197b1ce0f50','90fb5c0eff46e4aaac55ab17','a69ec69c5502fb0185802271','ac580a95c60ebd8ad87ecee9','dbcf5adaad24810fa8ecf734','dd2aa1e2bc4db5a4ba3e5bf6']);
// Reviewed complete names. A matching suffix such as 「ティ推進事業」「検診事業」 is not sufficient.
const names = new Set(`食品衛生事業 畜犬事業 予防接種事業 成人保健事業 母子保健事業 危機管理事業 住居表示事業 国際交流事業 更生保護事業 人権擁護事業 公民連携事業 市民農園事業 畜産支援事業 農道整備事業 林業振興事業 食育推進事業 労働行政事業 観光支援事業 地域計画事業 広報事業 秘書事業 表彰事業 広聴事業 財政管理事業 基金管理事業 市債管理事業 行政評価事業 財産管理事業 広告事業 契約管理事業 ＩＴ活用推進事業 統計事務事業 国勢調査事業 民生委員事業 介護保険事業 行政相談事業 平和関連事業 公益通報事業 文書保管事業 法規事業 職員研修事業 福利厚生事業 人事管理事業 職員提案事業 内部統制事業 税務相談事業 諸税賦課事業 市税徴収事業 債権回収事業 窓口案内事業`.split(' '));
export function extractYotsukaidoSupplement(input: CachedInput): ProjectEvaluation[] {
 if(input.municipalityCode!=='12228'||!documents.has(input.sourceId)||input.format!=='pdf'||input.truncated)return [];
 const period=/^令和８年度事務事業評価シート（令和７年度実施(?:事)?業）/.exec(input.text)?.[0];
 if(!period)return [];
 const out:ProjectEvaluation[]=[];
 for(const m of input.text.matchAll(/^(\d+) (\S+) (\S+課|危機管理室) .+$/gm)){
  if(!names.has(m[2]))continue;
  const rating=/有効性 ([ＡＢＣＤ])/u.exec(m[0]);
  const direction=/(現行どおり|一部改善|完了)/u.exec(m[0]);
  if(!rating&&!direction)continue;
  const p=project(input,`${m[3]}:${m[1]}`,m[2],2026,m[0],m.index!);p.department=m[3];p.evaluatedFiscalYear=2025;p.evidence.push(evidence(input,period,0));
  if(rating)p.ratings.push({kind:'self',label:'有効性',value:rating[1],scale:null,evidence:evidence(input,m[0],m.index!)});
  if(direction)p.ratings.push({kind:'self',label:'令和8年度 事業の方向性',value:direction[1],scale:null,evidence:evidence(input,m[0],m.index!)});
  p.warnings.push('横長評価表の同一行で名称・担当部署と対応が確定する有効性・方向性のみ部分抽出。妥当性・効率性は別行で境界未確定のため分離しない。折返し名称、列混在の目的・成果本文、金額・指標数値は推測しない。全体版に再掲された同一事業は重複抽出しない。');out.push(p);
 }
 return out;
}
