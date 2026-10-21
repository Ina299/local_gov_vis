import type {ProjectEvaluation} from '../../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from '../shared';
/** 加美町「Ｒ１ 事務事業評価シート」（一般・内部管理／施設管理運営／補助金）。1事業1シートの一次評価から、選択肢の■が一意に読めるものだけを構造化する。 */
const SOURCES=new Set(['4e27bb151cc0ba1d08f12438','8adec02e132a6f8ad1f07ee3','1ff0b4cd021043b1e5b7f58e']);
const HEADER='Ｒ１ 事務事業評価シート';
const DEPT=/^[^\s・/／]+(課|室|センター|支所|館|園|部|係)$/;
const QUESTIONS:{label:string;options:string[];needs?:string}[]=[
 {label:'（１）町が実施すべき事業として妥当ですか？',options:['妥当である','妥当性が低い']},
 {label:'（２）上位施策への貢献度は大きいですか？',options:['大きい','ふつう','小さい','総合計画等の位置づけなし']},
 {label:'（３）計画どおりに成果があがっていますか？',options:['あがっている','どちらかといえばあがっている','あがっていない']},
 {label:'（４）成果が向上する余地（可能性）はありますか？',options:['大いにある','多少ある','向上の余地なし','すでに成果は十分']},
 {label:'（５）類似事業との再編はできませんか？',options:['再編できる','類似事業あるが再編はできない','類似の事業はない']},
 {label:'（６）現状の成果を落とさずにコスト削減できませんか？',options:['できる','できない']},
 {label:'事務事業の方向性',options:['事業継続','改善して継続','統合','廃止・休止・終了']},
 {label:'施設の方向性',options:['存続','廃止','統合']},
 {label:'補助金採点シートに基づく評価点',options:['A 継続（20点）','B 継続（19～16点）','C 削減・見直し（15～11点）','D 廃止・休止（10点以下）'],needs:'４ 補助金採点シートに基づく評価点'},
];
const esc=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
interface Sheet{name:string;nameRaw:string;nameStart:number;start:number;end:number;kind:string}
function sheetName(text:string,start:number,end:number):{name:string;raw:string;at:number}|null{
 const body=text.slice(start,end);
 const patterns:[RegExp,(m:RegExpMatchArray)=>string|null][]=[
  [/１ 事務事業の基本情報\n\n([^\n]+)(?:\n([^\n]+))?\n\n事務事業名\n/,m=>m[2]===undefined?m[1]:/^（[^（）]+）$/.test(m[2])?m[1]+m[2]:null],
  [/１ 事務事業の基本情報\n事務事業名\n\n([^\n]+)\n\n(?=第|[ⅠⅡⅢⅣⅤⅥ])/,m=>m[1]],
  [/１ 事務事業の基本情報\n事務事業名\n([^\n]+)\n（施設名）\n/,m=>m[1]],
  [/１ 事務事業の基本情報\n補助金名\n([^\n]+)\n団体名等\n/,m=>m[1]],
 ];
 for(const [re,f] of patterns){
  const m=body.match(re);if(!m)continue;const name=f(m);
  if(!name||name.length<3||/^[＊*（(]/.test(name)||/事務事業名|施設名|団体名/.test(name))return null;
  return {name,raw:m[0],at:start+m.index!};
 }
 return null;
}
function extract(input:CachedInput):ProjectEvaluation[]{
 if(!SOURCES.has(input.sourceId)||!input.text.startsWith(HEADER))return [];
 const starts:number[]=[];for(let i=input.text.indexOf(HEADER);i>=0;i=input.text.indexOf(HEADER,i+1))starts.push(i);
 const sheets:Sheet[]=[];
 starts.forEach((start,k)=>{
  const end=starts[k+1]??input.text.length;if(k===starts.length-1&&input.truncated)return;
  const n=sheetName(input.text,start,end);if(!n)return;
  const kind=input.text.slice(start,end).match(/\n(一般・内部管理|施設管理運営|補助金)\n/)?.[1];if(!kind)return;
  sheets.push({name:n.name,nameRaw:n.raw,nameStart:n.at,start,end,kind});
 });
 // 補助金シートは同じ補助金名で団体ごとに複数枚あるため、補助金名が資料内で一意のものだけ採用する。
 const counts=new Map<string,number>();for(const s of sheets)counts.set(s.name,(counts.get(s.name)??0)+1);
 const out:ProjectEvaluation[]=[];
 for(const s of sheets){
  if(counts.get(s.name)!==1)continue;
  const body=input.text.slice(s.start,s.end);
  const p=project(input,`${s.kind}:${s.name}`,s.name,2019,HEADER,s.start);p.projectCode=null;
  p.evidence.push(evidence(input,s.nameRaw,s.nameStart));
  const headEnd=body.indexOf('１ 事務事業の基本情報');let offset=s.start;
  for(const line of body.slice(0,headEnd<0?0:headEnd).split('\n')){
   const token=line.split(/[ 　・/／]/)[0];
   if(line&&!line.startsWith('担当者')&&DEPT.test(token)&&token.length<=20){p.department=token;p.evidence.push(evidence(input,line,offset));break;}
   offset+=line.length+1;
  }
  for(const q of QUESTIONS){
   if(!body.includes(q.needs??q.label))continue;
   const hits=q.options.map(o=>[...body.matchAll(new RegExp(`([■□])${esc(o)}(?![^\\s（(])`,'g'))]);
   if(hits.some(h=>h.length!==1))continue;
   const checked=hits.map((h,i)=>({m:h[0],o:q.options[i]})).filter(x=>x.m[1]==='■');
   if(checked.length!==1)continue;
   const c=checked[0];
   p.ratings.push({kind:'self',label:q.label,value:c.o,scale:q.options.join('／'),evidence:evidence(input,c.m[0],s.start+c.m.index!)});
  }
  p.warnings.push(`Ｒ１事務事業評価シート（${s.kind}）の一次評価。評価年度は表題「Ｒ１」による。評価対象年度はシートに明示がないため空欄。選択肢の■が抽出テキスト内でシートごとに一意に読める設問だけを記録し、■が無い・複数・選択肢が欠ける設問は除外。投入指標（金額）・活動/成果指標は段組み崩れで年度列との対応が確定できないため未構造化。`);
  if(s.kind==='補助金')p.warnings.push('補助金シートは団体ごとの評価。補助金名が資料内で重複する（複数団体分がある）シートは事業名だけでは区別できないため除外。団体の決算額は町の事業費ではないため金額として扱っていません。');
  out.push(p);
 }
 // 同名シートが資料内に複数ある場合は同一事業か判別できないため全て除外。
 const byName=new Map<string,ProjectEvaluation>(),bad=new Set<string>();
 for(const p of out){const old=byName.get(p.projectName);if(!old){byName.set(p.projectName,p);continue;}bad.add(p.projectName);}
 return [...byName.values()].filter(p=>!bad.has(p.projectName)&&!EXISTING_COLLISIONS.has(p.projectName));
}
/** 既存構造化データ（Ｒ１評価一覧）と同名・同期間で衝突する事業。新規側を除外する。 */
const EXISTING_COLLISIONS=new Set<string>([
 '元気わくわくポイント事業','こころの健康づくりボランティア育成事業','ロタウイルス胃腸炎予防接種事業','流行性耳下腺炎（おたふくかぜ）予防接種事業','食育推進事業','理解促進研修・啓発事業','精神障害者家族会（家族のつどい）','日中一時支援事業','産前・産後サポート事業','子ども医療費助成事業','児童虐待防止対策','住民バス運行事業','民間住宅リフォーム助成事業','町営住宅管理事業（家賃収納）','６次産業化推進事業','農作物放射能対策','人・農地プラン作成支援','新規就農者支援事業','農業用施設維持管理事業','一般造林事業','稚魚放流事業','消費生活相談事業','新規学卒者雇用奨励金交付事業','労働対策事業','外国語指導業務','荒沢自然館管理事業','農村婦人の家管理運営事業','中新田図書館管理事業','ふるさと陶芸館管理運営事業','資源回収事業奨励金','割増商品券発行事業',
]);
export const entries:Record<string,{extract:(input:CachedInput,inputs:CachedInput[])=>ProjectEvaluation[];scope:string}>={
 '04445':{extract,scope:'加美町Ｒ１事務事業評価シート（一般・内部管理／施設管理運営／補助金）の事業名・担当所属と、■で一意に読める一次評価の設問回答・方向性のみ。金額・指標、補助金名が重複する団体別シート、二次評価候補一覧は対象外。'},
};
