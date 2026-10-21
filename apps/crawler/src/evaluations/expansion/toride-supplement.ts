import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
const names=new Set<string>(["防災ラジオ導入事業", "国際理解・多文化共生の促進", "広報紙による情報発信事業", "固定資産税の公平・正確な課税の推進と各種調査等の実施", "個人市民税の申告受付対応と賦課事務", "日常生活圏域ニーズ調査・在宅介護実態調査", "市民との協働による公園整備事業(都市公園施設長寿命化対策事業)", "換地処分業務", "道路施設管理移管事業", "小中学校体育館・中学校武道場空調設備設置事業", "教育委員会運営・点検評価事業", "小中学校施設管理・整備事業", "児童生徒の安全対策事業", "学校のICT環境整備", "小学校遊具更新事業", "学校給食管理事業", "児童生徒・教職員健康管理事業", "いじめ防止対策推進事業（いじめ・不登校対策）", "人権教育事業", "学力向上推進事業", "特色ある新しい学校教育推進事業（小規模特認校）", "コミュニティ・スクール事業", "市民大学事業", "文化財・郷土資料の保存・継承と活用", "公民館活動推進事業", "放課後子どもクラブ運営事業", "中学校部活動地域移行事業", "スポーツ振興事業", "スポーツ施設管理・整備事業", "読書活動推進事業（子どもの読書活動）", "読書活動推進事業（図書資料・読書環境整備）", "消防団運営事業", "消防施設・設備等維持管理事業", "住宅防火推進事業", "防火対象物及び危険物施設への防火指導事業", "消防隊員・救急隊員の育成事業（救急救命士養成）", "消防車両整備事業", "消防水利整備事業", "円滑かつ効率的な議会活動の支援", "市民にわかりやすい議会情報の発信", "市民の議会及び市政に対する関心・理解・参加を促す取組", "新しい議会のビジョン・形づくりの支援", "財務会計システム電子決裁導入事業", "支出伝票作成事務の適正化", "公金取扱いの管理徹底", "物品出納記録の徹底", "定期監査", "決算審査", "財政援助団体等に関する監査", "農地の権利移動及び転用許認可事務事業", "遊休農地の利用状況確認及び利用意向調査事業", "農業経営基盤強化促進事業"]);
export function extractTorideSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='08217'||input.sourceId!=='aa0d2c902b4a95b34c0ed4ed'||input.format!=='pdf')return [];
 const out:ProjectEvaluation[]=[];
 for(const m of input.text.matchAll(/^([^\n]+?) ([A-D]\([^）]+）) (継続|改革改善|事業完了)$/gm)){
  const tokens=m[1].split(' '),name=tokens.at(-1)!;if(!names.has(name))continue;
  const p=project(input,name,name,2025,m[0],m.index);if(tokens.length===2)p.department=tokens[0];
  p.ratings.push({kind:'self',label:'進捗度',value:m[2],scale:null,evidence:evidence(input,m[0],m.index)},{kind:'self',label:'今後の方向性',value:m[3],scale:null,evidence:evidence(input,m[0],m.index)});
  p.warnings.push('重点事業結果一覧の確定単行を部分抽出。既存詳細票の名称と照合し未収録名だけ追加。複数消防署で反復する同名行や、部署が別行の場合の所属は推測していません。費用・成果数値は未抽出。');out.push(p);
 }
 return out;
}
