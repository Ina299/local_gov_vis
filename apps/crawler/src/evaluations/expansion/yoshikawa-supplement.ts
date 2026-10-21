import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,project,evidence} from './shared';
const specs:[string,string,string][]=[
 ['交通安全施設整備事業','7 交通安全施設整備事業','拡大する'],
 ['学校運営事業（小学校）','8 学校運営事業（小学校）','拡大する'],
 ['学校運営事業（中学校）','9 学校運営事業（中学校）','拡大する'],
 ['学校給食センター管理事業','18 学校給食センター管理事業','手段を改善する'],
 ['家庭教育推進事業','20 家庭教育推進事業','手段を改善する'],
 ['給配水施設維持管理事業','5 給配水施設維持管理事業','縮小する'],
 ['農業集落排水事業経営事業','4 農業集落排水事業経営事業','効率化する'],
 ['橋りょう架替事業','4 橋りょう架替事業','廃止・休止'],
 ['社会教育推進事業（社会教育総務費）','社会教育推進事業（社会教育総 生涯学習課 地域寺子屋事業については、地域を主体とする活動が減少傾向にあるので、活\n19\n務費） 生涯学習担当 動が継続できるよう支援の充実などを検討する。','手段を改善する'],
 ['吉川駅北口駅前広場再整備事業','吉川駅北口駅前広場再整備事 道路課\n3 R8 年度については、効率化を踏まえ R7 年度を含めて当初予定の進捗を目指\n業 工務担当','効率化する'],
 ['越谷総合公園川藤線街路整備事業','越谷総合公園川藤線街路整備 道路課 令和 8 年度から越谷総合公園川藤線街路整備事業は、都市計画街路整備事業\n6\n事業 工務担当 に統合する。','他の事業に統合'],
];
export function extractYoshikawaSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='11243'||input.sourceId!=='d899715e7634541f5253bdb1'||input.format!=='pdf'||input.truncated||!input.text.startsWith('令和７年度事務事業評価結果報告書'))return [];
 return specs.flatMap(([name,quote,rating])=>{const start=input.text.indexOf(quote);if(start<0)return [];
 const heading=rating==='他の事業に統合'||rating==='廃止・休止'?`■ ${rating}`:`■ 改善の上で継続－${rating}`;
 const hs=input.text.lastIndexOf(heading,start);if(hs<0)return [];
 const raw=quote.includes('\n')?quote:input.text.slice(start,input.text.indexOf('\n',start));
 const p=project(input,`summary2025:${name}`,name,2025,raw,start);p.evaluatedFiscalYear=2025;
 p.ratings.push({kind:'self',label:'事業の方向性',value:rating,scale:null,evidence:evidence(input,heading,hs)});
 p.evidence.push(evidence(input,'令和７年度事務事業評価結果報告書'));
 p.warnings.push('結果報告の事業別方向性一覧から名称・方向性のみ部分抽出。既存354詳細票に同名のある事業は重複登録しない。本文中で名称変更の可能性がある地方版総合戦略は保留。説明列の行混線により個票全文や成果・費用は抽出していない。報告書表題は令和7年度、発行は令和8年8月。');return[p];});
}
