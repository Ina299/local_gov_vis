import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

// Source-checked names: the PDF interleaves title fragments with narrative columns.
const names: Record<string, string[]> = {
 '0d03216c0ac7bcb733a49ea9': ['南郷地区水道整備事業','中部地区水道整備事業','水道高料金対策事業','水道配水設備拡張事業','静川地区水道整備事業','荒海地区水道施設再構築事業'],
 '0e6387c92ef6fbe12b8920c5': ['合併処理浄化槽設置整備補助金','公共下水道事業（田島処理区）','特定環境保全公共下水道事業（南郷処理区）'],
 '30c231a79263b979323cd749': ['国土調査事業','土地区画整理事業'],
 '42fcd6410cab6c3f1e0e1592': ['町営住宅建替事業','空き家等対策事業','空き家等活用事業（空き家等対策事業）'],
 '55f1be92890692fdf85c669c': ['住宅用太陽光発電システム設置費補助金','住宅用太陽光蓄電システム設置費補助金','尾瀬国立公園環境保全管理事業','再生可能エネルギー利活用推進事業','環境基本計画検証事業'],
 '55feffe3b2c4cd9982163410': ['除雪事業','除雪ネットワーク事業（窓口整備）','除雪ネットワーク事業（高齢者世帯等除雪支援）','除雪機械整備事業','除雪オペレーター育成支援事業（がんばる企業・人材育成事業と統合）'],
 '74f96b7cd8f8a4d65e0f26e1': ['がんばる企業・人材育成事業','ビジネスチャレンジ支援事業','地域活力創生事業','「ふるさと創造提案」事業','小規模事業者等活性化事業'],
 '788e6e41f45aafba8d8825eb': ['地上デジタルテレビ放送改修事業補助金','セキュリティ対策機器導入事業','中山峠携帯電話エリア整備事業'],
 'a4e0c36de3b614c9307d17be': ['衛生組合負担金','狂犬病予防事業','河川等水質測定事業','清掃事務事業','ごみ集積所ボックス整備事業','ＰＣＢ含有機器処理対策費用'],
 'e0635c9ffc9d57daa29392ae': ['社会資本整備総合交付金事業（町道整備）','道路メンテナンス事業（橋梁補修）','単独道路橋梁維持事業','各種同盟会活動'],
 'ee0abd61496710d16d186e4b': ['景観づくり推進事業','前沢集落周辺景観対策事業','危険空き家等除却事業（空き家等対策事業）'],
};
export function extractMinamiaizu(input: CachedInput): ProjectEvaluation[] {
 if(input.municipalityCode !== '07368' || input.format !== 'pdf' || input.truncated) return [];
 const doc = Object.keys(names).find(id => input.sourceId === id || input.sourceId.endsWith(id));
 if(!doc || !input.text.includes('施策マネジメントシート 令和 3 年度作成')) return [];
 const fiscalHeader = '令和元年度決算額 令和２年度決算額 令和３年度予算額 令和４年度予算額';
 const tableStart = input.text.indexOf(fiscalHeader,input.text.indexOf('12 施策を構成する事務事業'));
 if(tableStart < 0) return [];
 const table = input.text.slice(tableStart + fiscalHeader.length);
 const endings = [...table.matchAll(/^事業費 [^\n]+$/gm)];
 const records:ProjectEvaluation[]=[];
 let previousEnd=0;
 for(const end of endings){
  const raw=table.slice(previousEnd,end.index!+end[0].length).trim();
  const start=input.text.indexOf(raw,tableStart+fiscalHeader.length+previousEnd);
  previousEnd=end.index!+end[0].length;
  const code=raw.match(/^([0-9]{2})\b/m)?.[1];
  const name=code ? names[doc][Number(code)-1] : null;
  if(!code||!name||!raw.includes('概要')||!raw.includes('成果')||!raw.includes('対策'))continue;
  const r=project(input,`${doc}:${code}`,name,2021,raw,start);
  r.projectCode=null;
  r.warnings.push(`原文番号${code}は各施策内の一覧連番であり、自治体全体の事業コードではないためprojectCodeは未設定。`);
  const future=/^\d{2} ★/m.test(raw);
  r.evaluatedFiscalYear=future?null:2020;
  r.activities='事業の目的・概要・成果・問題・対策（原文欄）\n'+raw;
  const cost=raw.match(/^事業費 ([\d,]+) ([\d,]+) ([\d,]+) ([\d,]+)$/m);
  if(cost)for(let col=future?2:0;col<4;col++)r.amounts.push({kind:col<2?'actual':'budget',fiscalYear:2019+col,amountYen:Number(cost[col+1].replaceAll(',',''))*1000,rawValue:cost[col+1],rawUnit:'千円',evidence:evidence(input,cost[0],start+cost.index!)});
  r.warnings.push('施策票の後半にある事業別の目的・概要・成果・問題・対策節を部分収録。前半の施策全体の評価は割り当てていません。改行・左右混在の事業名称は原文確認済みの対応表で結合。');
  if(future)r.warnings.push('★は令和3年度新規事業の原文表示。過年度実績事業として扱わず予算欄のみ収録。');
  records.push(r);
 }
 return records;
}
